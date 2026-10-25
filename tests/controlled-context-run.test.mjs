import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {readCommandEnvironment,bindCommandEnvironment} from "../scripts/context-run.mjs";
import {createReturnSync, parseDurableOutboxComment} from "../scripts/vydykhai.mjs";
import {fixture, hash} from "./context-fixture.mjs";

const noAction = f => assert.rejects(readFile(path.join(f.root, "actions.log")), {code: "ENOENT"});
const services = {createReturnSync, parseDurableOutboxComment};
function failureDetail(result, phase, kind) {
  assert.deepEqual(Object.keys(result.controlFailure).sort(), ["elapsedMs", "kind", "phase"]);
  assert.equal(result.controlFailure.phase, phase);
  assert.equal(result.controlFailure.kind, kind);
  assert.ok(Number.isSafeInteger(result.controlFailure.elapsedMs) && result.controlFailure.elapsedMs >= 0);
}
function controller() {
  // Trusted-host projection; protected identity/storage remain a separate gate.
  const calls = [], reservations = new Map();
  return {calls, reservations, timeoutMs: 30,
    async authorize(binding) {
      calls.push("authorize"); const bindingSha256 = hash(binding);
      return {decision: "ALLOW", id: bindingSha256, bindingSha256,
        reviewReceipt: "independent-verdict", stateRevision: "state-1", expiresAt: Date.now() + 5000};
    },
    async reserve(grant) {
      calls.push("reserve");
      if (reservations.has(grant.id)) throw Error("Already reserved; reconcile before reuse");
      reservations.set(grant.id, "IN_FLIGHT");
      return {status: "RESERVED", grantId: grant.id, bindingSha256: grant.bindingSha256,
        stateRevision: grant.stateRevision, reservationId: grant.id};
    },
    async observe(claim, observed) {
      calls.push("observe"); reservations.set(claim.reservationId, observed.outcome);
      return {reservationId: claim.reservationId, bindingSha256: observed.bindingSha256, evidence: "fixture:retained-observation"};
    }};
}
const run = (f, control, operation = "resume") => runControlledContextTransition(
  {...f.request, operation}, {...services, control});

test("controlled path has no fallback when the host control adapter is missing", async t => {
  const f = await fixture(t); await f.prepare();
  const result = await run(f, undefined);
  assert.equal(result.code, "CONTROL_ADAPTER_REQUIRED"); await noAction(f);
});

test("only admitted controlled resume may use a declared action budget above sixty seconds", async t => {
  const f = await fixture(t);
  f.task.action.timeoutMs = 600000; await f.refresh(); await f.prepare();
  const ordinary = await f.run("resume");
  assert.equal(ordinary.code, "COMMAND_SCHEMA_INVALID"); await noAction(f);
  const c = controller(), authorize = c.authorize;
  c.authorize = async binding => {
    assert.equal(binding.commandSha256, hash(f.task.action));
    return authorize(binding);
  };
  const result = await run(f, c);
  assert.equal(result.status, "ACTION_COMPLETED");
  assert.deepEqual(c.calls, ["authorize", "reserve", "observe"]);
  assert.equal(result.action.commandSha256, hash(f.task.action));
});

test("long controlled actions still require exact admission and cannot exceed ten minutes", async t => {
  const f = await fixture(t);
  f.task.action.timeoutMs = 550000; await f.refresh(); await f.prepare();
  const c = controller(); c.authorize = async () => null;
  assert.equal((await run(f, c)).code, "CONTROL_ADMISSION_FAILED"); await noAction(f);
  f.task.action.timeoutMs = 600001; await f.refresh();
  const refused = await run(f, controller());
  assert.equal(refused.code, "COMMAND_SCHEMA_INVALID");
  assert.equal(refused.stats.commands, 0); await noAction(f);
});

test("changing an action budget cannot reuse the old command grant", async t => {
  const f = await fixture(t); await f.prepare();
  const c = controller(), authorize = c.authorize;
  let oldGrant;
  c.authorize = async binding => { oldGrant = await authorize(binding); return null; };
  assert.equal((await run(f, c)).code, "CONTROL_ADMISSION_FAILED");
  f.task.action.timeoutMs = 550000; await f.refresh();
  f.request.capsule = null; f.request.readback = null; await f.prepare();
  c.authorize = async () => oldGrant;
  assert.equal((await run(f, c)).code, "CONTROL_ADMISSION_FAILED"); await noAction(f);
});

test("protected verification retains its sixty-second ceiling", async t => {
  const f = await fixture(t); await f.prepare();
  f.module.verificationCommand.timeoutMs = 60001;
  f.task.module = await f.put("module.json", f.module); await f.refresh();
  const c = controller(), result = await run(f, c, "accept");
  assert.equal(result.code, "COMMAND_SCHEMA_INVALID");
  assert.equal(result.stats.commands, 0); assert.deepEqual(c.calls, []); await noAction(f);
});

test("authorization exception, unavailable service, missing verdict and timeout all prevent the real command", async t => {
  for (const [authorize, kind] of [
    [async () => { throw Error("private service failure /secret/path token=PRIVATE"); }, "SERVICE_REJECTION"],
    [async () => { throw Error("CONTROL_TIMEOUT"); }, "SERVICE_REJECTION"],
    [async () => { throw {kind: "DEADLINE", message: "CONTROL_TIMEOUT", elapsedMs: 2000}; }, "SERVICE_REJECTION"],
    [async () => null, "SERVICE_REJECTION"],
    [async () => ({decision: "ALLOW"}), "SERVICE_REJECTION"],
    [async () => new Promise(() => {}), "DEADLINE"]]) {
    const f = await fixture(t); await f.prepare(); const c = controller(); c.authorize = authorize;
    const result = await run(f, c);
    assert.equal(result.status, "BLOCKED"); assert.equal(result.code, "CONTROL_ADMISSION_FAILED");
    assert.equal(result.actionOutcome, "NOT_INVOKED"); assert.equal(result.stats.commands, 0);
    failureDetail(result, "AUTHORIZE", kind);
    if (kind === "DEADLINE") t.diagnostic(`actual authorize deadline: ${result.controlFailure.elapsedMs} ms (30 ms bound)`);
    assert.equal(JSON.stringify(result).includes("private service failure"), false);
    assert.equal(JSON.stringify(result).includes("/secret/path"), false);
    assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
    await noAction(f);
  }
});

test("foreign, stale or rejected grants cannot launch the real command", async t => {
  for (const patch of [{bindingSha256: "0".repeat(64)}, {expiresAt: 1}, {decision: "DENY"}, {reviewReceipt: ""}]) {
    const f = await fixture(t); await f.prepare(); const c = controller(), auth = c.authorize;
    c.authorize = async b => ({...await auth(b), ...patch});
    const result = await run(f, c);
    assert.equal(result.code, "CONTROL_ADMISSION_FAILED");
    failureDetail(result, "AUTHORIZE", "SERVICE_REJECTION");
    assert.deepEqual(c.calls, ["authorize"]); await noAction(f);
  }
});

test("failed, stale or foreign reservation is not permission to invoke", async t => {
  for (const [reserve, kind] of [
    [async () => {throw Error("unavailable");}, "SERVICE_REJECTION"],
    [async () => {throw Error("CONTROL_TIMEOUT");}, "SERVICE_REJECTION"],
    [async () => new Promise(() => {}), "DEADLINE"],
    [async g => ({status: "RESERVED", bindingSha256: g.bindingSha256, grantId: g.id,
      reservationId: "id", stateRevision: "stale"}), "SERVICE_REJECTION"]]) {
    const f = await fixture(t); await f.prepare(); const c = controller(); c.reserve = reserve;
    const result = await run(f, c);
    assert.equal(result.code, "CONTROL_ADMISSION_FAILED");
    failureDetail(result, "RESERVE", kind);
    if (kind === "DEADLINE") t.diagnostic(`actual reserve deadline: ${result.controlFailure.elapsedMs} ms (30 ms bound)`);
    await noAction(f);
  }
});

test("successful controlled dispatch reserves before execution and observes after; repeat is refused", async t => {
  const f = await fixture(t); await f.prepare(); const c = controller(), reserve = c.reserve, observe = c.observe;
  c.reserve = async g => {await noAction(f); return reserve(g);};
  c.observe = async (...args) => {
    assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
    return observe(...args);
  };
  const first = await run(f, c);
  assert.equal(first.status, "ACTION_COMPLETED"); assert.equal(first.stats.commands, 1);
  assert.equal(first.controlFailure, undefined);
  assert.deepEqual(c.calls, ["authorize", "reserve", "observe"]);
  c.reserve = reserve;
  const second = await run(f, c);
  assert.equal(second.code, "CONTROL_ADMISSION_FAILED"); assert.equal(second.stats.commands, 0);
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
  assert.equal(first.hostIdentity, "NOT_ESTABLISHED");
});

for(const operation of ["resume","accept"])test(`${operation} preserves an action-bound pre-execution environment observation`,async t=>{
  const f=await fixture(t);await f.prepare();const c=controller(),observe=c.observe;let proof;
  c.observe=async(claim,observed)=>{proof=readCommandEnvironment(observed);return observe(claim,observed);};
  const result=await run(f,c,operation);
  assert.equal(result.status,operation==="resume"?"ACTION_COMPLETED":"VERIFIED");
  assert.deepEqual(result.environment,proof.environment);
  assert.equal(proof.environment.cwd,f.root);
  assert.equal(proof.environment.commandSha256,operation==="resume"?result.action.commandSha256:result.receipt.commandSha256);
  assert.equal(proof.environment.contextBindings,"RECHECKED_BEFORE_EXECUTION");
  assert.ok(Date.parse(proof.environment.checkedAt)<=Date.parse(proof.process.startedAt));
  assert.equal(proof.environment.remotePermissions,"NOT_OBSERVED");
  assert.equal(readCommandEnvironment(structuredClone(proof)),null);
  assert.throws(()=>bindCommandEnvironment({}, {environment:proof.environment}),/COMMAND_ENVIRONMENT_UNBOUND/);
});

test("lost observation preserves uncertainty and reservation instead of rerunning the effect", async t => {
  const f = await fixture(t); await f.prepare(); const c = controller();
  c.observe = async () => {throw Error("lost after action");};
  const result = await run(f, c);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.code, "CONTROL_OUTCOME_RECONCILIATION_REQUIRED");
  assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN"); assert.equal(result.replayRequiresReconciliation, true);
  assert.equal(result.action.exitCode, 0);
  failureDetail(result, "OBSERVE", "SERVICE_REJECTION");
  assert.equal(result.action.commandSha256, hash(f.task.action));
  assert.ok(result.sourceReceipt);
  assert.equal(result.stats.dependentCommands, 1);
  assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
  assert.equal((await run(f, c)).stats.commands, 0);
  assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
});

test("context changed while admission was pending is rechecked before actual dispatch", async t => {
  const f = await fixture(t); await f.prepare(); const c = controller(), reserve = c.reserve;
  // Exercise the post-reservation source fence, not disk-write scheduling against a 30ms deadline.
  c.timeoutMs = 2000;
  c.reserve = async g => {
    f.task.id = "changed-task"; await f.put("task.json", f.task); return reserve(g);
  };
  const result = await run(f, c);
  assert.equal(result.status, "BLOCKED"); assert.equal(result.stats.commands, 0); await noAction(f);
  assert.deepEqual([...c.reservations.values()],["IN_FLIGHT"]);
  failureDetail(result, "EXECUTE", "ACTION_UNRESOLVED");
});

test("technical verification command is also gated and cannot pretend to be product acceptance", async t => {
  const f = await fixture(t); await f.prepare();
  const bad = controller(); bad.authorize = async () => null;
  assert.equal((await run(f, bad, "accept")).stats.verificationCommands, 0);
  const c = controller(); const result = await run(f, c, "accept");
  assert.equal(result.status, "VERIFIED"); assert.equal(result.stats.verificationCommands, 1);
  assert.equal(result.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.deepEqual(c.calls, ["authorize", "reserve", "observe"]);
});

test("verification completion is observed only after final checks and the verification return", async t => {
  const f = await fixture(t); await f.prepare();
  const c = controller(), observe = c.observe;
  let returned = false, observed;
  c.observe = async (claim, evidence) => {
    assert.equal(returned, true);
    observed = evidence;
    return observe(claim, evidence);
  };
  const result = await runControlledContextTransition({...f.request, operation: "accept"},
    {...services, control: c, createReturnSync: input => {
      returned = true;
      return createReturnSync(input);
    }});
  assert.equal(result.status, "VERIFIED");
  assert.equal(observed.outcome, "COMPLETED");
  assert.equal(observed.resultSha256, hash({...result.receipt.execution,
    commandSha256: result.receipt.commandSha256}));
  assert.deepEqual([...c.reservations.values()], ["COMPLETED"]);
});

for (const [file, code] of [["task.json", "TASK_CHANGED_DURING_ACTION"],
  ["sources.json", "CONTEXT_CHANGED_DURING_ACTION"], ["module.json", "ARTIFACT_HASH_MISMATCH"]]) {
  test(`final action readback failure in ${file} preserves its diagnostic and never observes completion`, async t => {
    const f = await fixture(t, {actionBody: `import {appendFileSync} from 'node:fs'; appendFileSync('actions.log','called\\n'); appendFileSync(${JSON.stringify(file)},' ');\n`});
    await f.prepare();
    const before = await readFile(path.join(f.root, file)), c = controller();
    const result = await run(f, c);
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.code, code);
    assert.equal(result.reference, null);
    assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
    assert.equal(result.replayRequiresReconciliation, true);
    assert.equal(result.stats.dependentCommands, 1);
    failureDetail(result, "EXECUTE", "ACTION_UNRESOLVED");
    assert.ok(result.sourceReceipt);
    assert.deepEqual(c.calls, ["authorize", "reserve"]);
    assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
    // Restore the checked bytes so the retry reaches the spent reservation.
    await f.put(file, before.toString("utf8"));
    const retry = await run(f, c);
    assert.equal(retry.code, "CONTROL_ADMISSION_FAILED");
    assert.equal(retry.stats.commands, 0);
    assert.equal(await readFile(path.join(f.root, "actions.log"), "utf8"), "called\n");
  });
}

for (const [options, code, reference] of [
  [{verificationMode: "mutate-candidate"}, "CANDIDATE_CHANGED_DURING_VERIFICATION", null],
  [{verificationMode: "mutate-task"}, "TASK_CHANGED_DURING_VERIFICATION", null],
  [{verificationMode: "mutate-dependency"}, "CONTEXT_CHANGED_DURING_VERIFICATION", null],
  [{verificationMode: "missing"}, "BEHAVIOR_EVIDENCE_MISSING", null],
  [{omitInputMember: true}, "BEHAVIOR_MISMATCH", "B1"],
]) {
  test(`failed verification preserves ${code} and leaves its reservation unresolved`, async t => {
    const f = await fixture(t, options); await f.prepare(); const c = controller();
    const result = await run(f, c, "accept");
    assert.equal(result.status, "BLOCKED");
    assert.equal(result.code, code);
    assert.equal(result.reference, reference);
    assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
    assert.equal(result.replayRequiresReconciliation, true);
    assert.equal(result.stats.verificationCommands, 1);
    failureDetail(result, "EXECUTE", "ACTION_UNRESOLVED");
    assert.ok(result.sourceReceipt);
    assert.equal(result.receipt, undefined);
    assert.equal(result.returnSync, undefined);
    assert.deepEqual(c.calls, ["authorize", "reserve"]);
    assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
  });
}

for (const operation of ["resume", "accept"]) {
  for (const mode of ["exception", "fake-timeout", "missing", "foreign", "empty", "timeout"]) {
    test(`${operation} ${mode} observation preserves result evidence without replay`, async t => {
      const f = await fixture(t); await f.prepare(); const c = controller();
      let observed;
      c.observe = async (claim, evidence) => {
        c.calls.push("observe"); observed = evidence;
        if (mode === "exception") throw Error("private observation failure");
        if (mode === "fake-timeout") throw Error("CONTROL_TIMEOUT");
        if (mode === "timeout") return new Promise(() => {});
        if (mode === "missing") return null;
        return {reservationId: mode === "foreign" ? "foreign" : claim.reservationId,
          bindingSha256: evidence.bindingSha256, evidence: mode === "empty" ? "" : "readback"};
      };
      const result = await run(f, c, operation);
      assert.equal(result.status, "BLOCKED");
      assert.equal(result.code, "CONTROL_OUTCOME_RECONCILIATION_REQUIRED");
      assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
      assert.equal(result.replayRequiresReconciliation, true);
      failureDetail(result, "OBSERVE", mode === "timeout" ? "DEADLINE" : "SERVICE_REJECTION");
      if (mode === "timeout") t.diagnostic(`actual ${operation} observe deadline: ${result.controlFailure.elapsedMs} ms (30 ms bound)`);
      assert.equal(result.stats.commands, 1);
      assert.ok(result.sourceReceipt);
      const execution = operation === "resume" ? result.action :
        {...result.receipt.execution, commandSha256: result.receipt.commandSha256};
      assert.equal(execution.exitCode, 0);
      assert.equal(observed.resultSha256, hash(execution));
      if (operation === "accept") {
        assert.equal(result.receipt.productAcceptance, "NOT_ESTABLISHED");
        assert.deepEqual(result.receipt.observations.map(o => o.id), ["B1", "B2"]);
        assert.ok(result.returnSync);
      }
      assert.equal(JSON.stringify(result).includes("private observation failure"), false);
      assert.deepEqual(c.calls, ["authorize", "reserve", "observe"]);
      assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
      const retry = await run(f, c, operation);
      assert.equal(retry.code, "CONTROL_ADMISSION_FAILED");
      assert.equal(retry.stats.commands, 0);
      assert.equal(c.calls.filter(call => call === "observe").length, 1);
    });
  }
}

test("execute failure preserves protected exact metadata and phase despite capture cleanup deadline", async t => {
  const f = await fixture(t, {actionBody: "process.stdout.write('PRIVATE_STDOUT'); process.stderr.write('PRIVATE_STDERR'); process.exit(7);\n"});
  await f.prepare(); const c = controller(); let captured;
  c.captureFailure = async (claim, input) => {
    assert.equal(c.reservations.get(claim.reservationId), "IN_FLIGHT");
    captured = input;
    return new Promise(() => {});
  };
  const result = await run(f, c);
  assert.equal(result.code, "CONTROL_OUTCOME_RECONCILIATION_REQUIRED");
  assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
  assert.equal(result.replayRequiresReconciliation, true);
  failureDetail(result, "EXECUTE", "ACTION_UNRESOLVED");
  assert.equal(captured.failure.exitCode, 7);
  assert.equal(captured.failure.signal, null);
  assert.equal(captured.failure.reason, "COMMAND_FAILED");
  assert.equal(captured.failure.commandSha256, hash(f.task.action));
  assert.equal(captured.bindingSha256, [...c.reservations.keys()][0]);
  assert.ok(captured.failure.process.closedAt);
  assert.match(captured.failure.stdoutSha256, /^[a-f0-9]{64}$/);
  assert.match(captured.failure.stderrSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(c.calls, ["authorize", "reserve"]);
  assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
  assert.equal(JSON.stringify(result).includes("PRIVATE_STDOUT"), false);
  assert.equal(JSON.stringify(result).includes("PRIVATE_STDERR"), false);
  assert.equal(JSON.stringify(result.controlFailure).includes(f.root), false);
  assert.equal((await run(f, c)).stats.commands, 0);
});

for (const method of ["authorize", "reserve"]) {
  test(`late ${method} callback never automatically invokes, retries or resets a reservation`, async t => {
    const f = await fixture(t); await f.prepare(); const c = controller(), original = c[method];
    let release, late, signal;
    const gate = new Promise(resolve => {release = resolve;});
    c[method] = (...args) => {
      signal = args[1].signal;
      late = gate.then(() => original(...args));
      return late;
    };
    const result = await run(f, c);
    failureDetail(result, method === "authorize" ? "AUTHORIZE" : "RESERVE", "DEADLINE");
    const detail = structuredClone(result.controlFailure);
    assert.equal(signal.aborted, true);
    assert.equal(result.code, "CONTROL_ADMISSION_FAILED");
    assert.equal(result.actionOutcome, "NOT_INVOKED");
    assert.equal(result.stats.commands, 0);
    release(); await late;
    assert.deepEqual(result.controlFailure, detail);
    assert.deepEqual(c.calls, method === "authorize" ? ["authorize"] : ["authorize", "reserve"]);
    assert.deepEqual([...c.reservations.values()], method === "reserve" ? ["IN_FLIGHT"] : []);
    await noAction(f);
    if (method === "reserve") {
      c.reserve = original;
      const retry = await run(f, c);
      failureDetail(retry, "RESERVE", "SERVICE_REJECTION");
      assert.equal(retry.stats.commands, 0);
      assert.deepEqual([...c.reservations.values()], ["IN_FLIGHT"]);
      await noAction(f);
    }
  });
}
