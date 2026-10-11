import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, writeFile, rm, readdir} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";
import {validateCompletionCheckpoint, validateCompletionAuthority, validateCompletionPhase,
  gradeProspectiveRecipient, prospectiveCompletionProfile, inspectProspectiveCompletion, requireCompletionOwnerReads,
  requireCompletedReservation, requireEndpointReservation, validateNoEffectCompletion, requireNoEffectRecoveryPaths,
  observeDeterministicEnvironment, requireDeterministicEnvironment,
  effectEnvironmentPublication, effectCommandPublication} from "../scripts/complete-prospective-cycle.mjs";
import {validateReviewEpisode} from "../scripts/control-review-partitions.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";

const hash = v => sha256(canonicalJson(v));
const phases = ["execute", "owner-acceptance", "current-recipient", ...Array.from({length: 8}, (_, i) => `post-${i + 1}`), "owner-disposition", "held-out-recall"];
function fixture() {
  const minimum = ["goal", "contract", "decisions", "success", "ideas", "prospective-plan", "prospective-roles", "execution-packet"];
  const ids = [...minimum, "current-task", "current-capsule", "actual-environment", "actual-readiness-environment", "actual-preparation", "actual-worker-readback", "actual-readback-record"];
  const row = id => ({id, path: `${id}.json`, purpose: "Synthetic unit evidence", status: "AVAILABLE", sha256: sha256(`test ${id}`)});
  const rows = ids.map(row), currentSources = {rows, digest: hash(rows), bytes: 200};
  const prior = Array.from({length: 28}, (_, i) => ({name: i === 27 ? "source-selection-probe" : `synthetic-${i}`, status: "CLI_EXIT_OK", usage: null}));
  const plan = {schema: "qualification.prospective-cycle.v1", status: "STAGED_NOT_AUTHORIZED", runtime: {digest: "aed7297eccdba2fdb4474a993d5e4d1d69e1427d9ec447cb49dbceba12614840"},
    dependencyDecisionRequired: true, workspace: "/synthetic-workspace", root: "/synthetic-control", registryFile: "/synthetic-control/sources.json",
    allocation: {model: "gpt-6.1-sol", effort: "low", secondsPerCall: 120, retries: 0, maxCalls: 16,
      calls: {prepare: 1, workerReadback: 1, independentReadiness: 1, execute: 1, ownerAcceptance: 1, currentRecipient: 1, post: 8, ownerDisposition: 1, heldOutRecall: 1}},
    order: ["parentDependency", "prepare", "workerReadback", "executorEnvironment", "independentReadiness", "execute", "ownerAcceptance", "currentRecipient", "post", "ownerDisposition", "heldOutRecall"],
    priorRuns: prior, priorRunsSha256: hash(prior), spentBefore: 28, totalMaximum: 44, refundedAttempts: 0,
    gates: {parentDependency: "PENDING_INDEPENDENT_DECISION", workerReadback: "PENDING_ACTUAL_WORKER", executorEnvironment: "PENDING_CONTEMPORANEOUS_EXECUTOR",
      independentReadiness: "PENDING_EXACT_COMPOSITION", currentRecipient: "PENDING_ACTUAL_RETRIEVAL_APPLICATION", heldOutRecall: "AFTER_CLEAN_FIRST_TASK_AT_TWO_TASK_BOUNDARY"},
    sourceLifetime: {initial: "EXISTING_SOURCES_ONLY", preparation: "SEPARATE_ACTUAL_MODEL_ARTIFACT_NOT_SEED_REPLACEMENT",
      beforeReadiness: "PUBLISH_ACTUAL_ACK_ENVIRONMENT_AND_UPDATED_PACKET_THEN_FREEZE", beforePost: "PUBLISH_ACTUAL_ACCEPTANCE_RETENTION_AND_CURRENT_RECIPIENT_THEN_FREEZE",
      duringPost: "NO_SOURCE_DRIFT_ALL_87_EIGHT_PARTS", afterClosure: "SEPARATE_HELD_OUT_REGISTRY"},
    modelsLaunched: 0, protectedActions: 0, hostAdmissions: 0,
    request: {schema: "context.request.v1", operation: "resume", workspace: "/synthetic-workspace", task: {path: "task.json", sha256: "a".repeat(64)}, capsule: {path: "capsule.json", sha256: "b".repeat(64)}, readback: null},
    policy: {unitTestOnly: true}, config: {executor: "worker-1", owner: "owner", reviewer: "reviewer", workspace: "/synthetic-workspace", evidenceRegistry: "/synthetic-control/sources.json"},
    compiledWorker: "worker-1", roles: {executor: "worker-1"}, binding: {taskSha256: "a".repeat(64), capsuleSha256: "b".repeat(64), cwd: "/synthetic-workspace"},
    input: [{id: "Z", label: " z "}, {id: "a", label: " a "}], expectedOutput: {schema: "bundle/v1", entries: [{id: "Z", label: "z"}, {id: "a", label: "a"}], count: 2},
    productDependencies: ["PINNED_PUBLIC_BUNDLE_R2_ONLY"], oldAcceptedResultDependency: false, historicalClosure: false,
    requiredSourceIdsAreWhitelist: false, requiredSourceIds: minimum, frozenSources: {rows: minimum.map(row)}, binary: "/native-never-called", authHome: "/auth-never-read"};
  plan.config.policy = hash(plan.policy);
  const runs = [...prior, ...["prospective-prepare", "prospective-worker-readback", "prospective-independent-readiness"].map(name => ({name, status: "CLI_EXIT_OK", usage: {input_tokens: 1, output_tokens: 1}}))];
  const answer = {decision: "APPROVE", problems: [], sourceIds: ids, rationale: "Synthetic pure test only"};
  const events = rows.map(r => ({type: "item.completed", item: {type: "mcp_tool_call", server: "vydykhai_review", tool: "read_source", status: "completed",
    result: {content: [{type: "text", text: JSON.stringify({...r, text: `test ${r.id}`})}]}}}));
  events.push({type: "item.completed", item: {type: "agent_message", text: JSON.stringify(answer)}}, {type: "turn.completed", usage: {input_tokens: 1, output_tokens: 1}});
  const readiness = {status: "CLI_EXIT_OK", output: events.map(e => JSON.stringify(e)).join("\n")};
  const checkpoint = {status: "EXACT_CURRENT_READINESS_VERIFIED_NO_EFFECT", runtime: plan.runtime.digest, protectedActions: 0, hostAdmissions: 0, release: "NO_RELEASE",
    binding: structuredClone(plan.binding), request: {...plan.request, readback: {path: "actual-readback.json", sha256: "c".repeat(64)}},
    readiness: answer, runsSha256: hash(runs), sourceSnapshot: currentSources};
  const preparation = {status: checkpoint.status, failure: null, runtime: plan.runtime.digest, protectedActions: 0, runs, newAttempts: 3, priorAttemptsPreserved: 28};
  return {plan, checkpoint, preparation, original: {status: "PROSPECTIVE_PREPARATION_FAILED", runs: structuredClone(runs.slice(0, 30))}, readiness, currentSources};
}

test("completion accepts only exact full readiness, preserving the failed 30 and recovered 31 attempts", () => {
  const f = fixture(); assert.equal(validateCompletionCheckpoint(f), true);
  for (const [name, mutate, code] of [
    ["pending checkpoint", x => x.checkpoint.status = "NOT_COMPLETE", /READINESS/],
    ["rejected trace", x => x.readiness.output = x.readiness.output.replace('APPROVE', 'REPAIR'), /TRACE/],
    ["unread required evidence", x => x.readiness.output = x.readiness.output.split("\n").slice(1).join("\n"), /NOT_ACQUIRED/],
    ["source drift", x => x.currentSources = {...x.currentSources, digest: "d".repeat(64)}, /SOURCE_DRIFT/],
    ["wrong effect actor", x => x.plan.config.executor = "worker", /IDENTITY/],
    ["wrong capsule", x => x.checkpoint.request = {...x.checkpoint.request, capsule: {path: "old.json", sha256: "d".repeat(64)}}, /IDENTITY/],
    ["fake ACK", x => x.checkpoint.request.readback = null, /IDENTITY/],
    ["refunded paid response", x => x.preparation.runs.splice(28, 1), /ATTEMPTS/],
    ["extra readiness retry", x => x.preparation.runs.push({name: "prospective-independent-readiness"}), /ATTEMPTS/],
    ["original history rewritten", x => x.original.runs[5].usage = {input_tokens: 0}, /REFUND_OR_REPLAY/],
    ["new input changed", x => x.plan.input.reverse(), /OLD_RESULT/],
    ["model budget changed", x => x.plan.allocation.maxCalls = 17, /ALLOCATION/]
  ]) {
    const value = structuredClone(f); mutate(value); assert.throws(() => validateCompletionCheckpoint(value), code, name);
  }
});

test("completion review cannot be replaced with stage permission, owner identity, altered code or a different checkpoint", () => {
  const expected = {reviewer: "independent-harness-review", owner: "owner", executor: "worker-1",
    bindings: {manifest: {path: "/manifest.json", sha256: "a".repeat(64)}, checkpoint: {path: "/checkpoint.json", sha256: "b".repeat(64)}},
    codeHashes: {"scripts/complete-prospective-cycle.mjs": "c".repeat(64)}};
  const decision = {schema: "qualification.prospective-completion-review.v1", decision: "ALLOW_BOUNDED_COMPLETION", reviewer: expected.reviewer,
    bindings: expected.bindings, codeHashes: expected.codeHashes, scope: "REMAINING_13_CALLS_ONLY", priorAttempts: 31, maxNewCalls: 13,
    maxCumulativeAttempts: 44, retries: 0, phaseOrder: phases, ownerAcceptance: false, hostClosure: false, historicalClosure: false, releaseReady: false, hostGrant: false};
  assert.equal(validateCompletionAuthority(decision, expected), true);
  for (const patch of [{decision: "INDEPENDENT_NEW_CONSUMPTION_ONLY"}, {reviewer: "owner"}, {reviewer: "worker-1"},
    {bindings: {}}, {codeHashes: {}}, {maxNewCalls: 14}, {priorAttempts: 30}, {retries: 1}, {hostGrant: true},
    {ownerAcceptance: true}, {historicalClosure: true}, {phaseOrder: [...phases].reverse()}])
    assert.throws(() => validateCompletionAuthority({...decision, ...patch}, expected), /INDEPENDENT_REVIEW/);
});

test("13 remaining slots enforce recipient before POST, all eight POST calls, owner before recall, no reset", () => {
  const prior = fixture().preparation.runs, runs = structuredClone(prior);
  for (const name of phases) {
    validateCompletionPhase(runs, prior, name);
    runs.push({name, status: name.startsWith("post-") ? "STOPPED" : ["current-recipient", "held-out-recall"].includes(name) ? "PREPARATION_STATUS_VERIFIED" : "CLI_EXIT_OK"});
  }
  assert.equal(runs.length, 44); assert.deepEqual(runs.slice(0, 31), prior);
  assert.throws(() => validateCompletionPhase(runs, prior, "execute"), /PHASE_OR_BUDGET/);
  for (const name of ["owner-acceptance", "post-1", "held-out-recall"])
    assert.throws(() => validateCompletionPhase(prior, prior, name), /PHASE_OR_BUDGET/);
  const refunded = structuredClone(prior); refunded[0].usage = {input_tokens: 0};
  assert.throws(() => validateCompletionPhase(refunded, prior, "execute"), /PHASE_OR_BUDGET/);
  assert.throws(() => validateCompletionPhase([...prior, {name: "execute", status: "UNKNOWN"}], prior, "owner-acceptance"), /PHASE_OR_BUDGET/);
});

test("fresh current recipient requires pending REVIEW_DUE, not circular CLOSED; later recall requires DONE", () => {
  const value = {entrypoint: "buildBundle", revision: "bundle-r2", preprocess: "none", format: "json", producerEdits: [], rejected: ["keep-last"],
    idea: {id: "CSV", disposition: "ASK_OWNER_NOT_IMPLEMENT"}, duplicatePolicy: "case-insensitive-reject", idPolicy: "preserve-exact", labelPolicy: "trim", orderPolicy: "codepoint",
    current: {enrollment: "REVIEW_DUE", assessedAction: "REVIEW_PENDING", executionAuthorized: false}};
  const receipt = {paused: false, mutationAuthorized: false, digest: "a".repeat(64), rows: [{id: "consumer", currentControl: {...value.current}}]};
  assert.deepEqual(gradeProspectiveRecipient(value, receipt), []);
  assert.ok(gradeProspectiveRecipient(value, receipt, true).includes("currentControl"));
  const later = {...value, current: {enrollment: "CLOSED", assessedAction: "CONTROL_DONE_CONFIRMED", executionAuthorized: false}};
  const done = {...receipt, rows: [{id: "consumer", currentControl: later.current}]};
  assert.deepEqual(gradeProspectiveRecipient(later, done, true), []);
  assert.ok(gradeProspectiveRecipient(later, done).includes("currentControl"));
  assert.ok(gradeProspectiveRecipient(value, {...receipt, paused: true}).length);
  assert.ok(gradeProspectiveRecipient({...value, current: {...value.current, executionAuthorized: true}}, receipt).length);
});

test("POST profile keeps exact87 whole-group union and finite existing executor layout", () => {
  const p = fixture().plan, profile = prospectiveCompletionProfile(p, ["current-recipient"], 1000);
  const episode = validateReviewEpisode(profile.review);
  assert.equal(profile.review.maxCalls, 8); assert.equal(profile.maxReviewsPerTick, 1);
  assert.equal(profile.review.native.timeoutMs, 120000); assert.equal(profile.review.native.effort, "low");
  assert.equal(profile.review.native.model, "gpt-6.1-sol");
  assert.equal(profile.review.episodeMaxUsageTokens, 2500000); assert.equal(profile.review.episodeMaxDurationMs, 3600000);
  assert.equal(Date.parse(profile.review.expiresAt), 3601000);
  assert.deepEqual(episode.partitions.flat().sort(), [...controlCheckIds].sort());
  assert.equal(new Set(episode.partitions.flat()).size, 87);
  assert.equal(profile.review.native.home, "/synthetic-control/model-home");
  assert.equal(profile.config.executor, "worker-1"); assert.equal(profile.continuation, undefined);
});

test("missing external authorization is denied without filesystem changes or native calls", async () => {
  await assert.rejects(inspectProspectiveCompletion({output: "/", authorizationFile: "/no-authorization", authorizationSha256: "not-a-digest", reviewer: "independent"}),
    /EXPLICIT_AUTHORITY/);
});

test("owner disposition requires actual inbox and exact verdict reads before response", () => {
  const key = "a".repeat(64);
  const event = (tool, body) => ({type: "item.completed", item: {type: "mcp_tool_call", server: "vydykhai_owner", tool,
    arguments: tool === "inbox" ? {} : {id: "consumer"}, status: "completed", result: {content: [{type: "text", text: JSON.stringify(body)}]}}});
  const events = [event("inbox", [{id: "consumer"}]), event("read_verdict", {id: "consumer", reviewKey: key}), event("respond", {status: "RECORDED"})];
  const result = rows => ({output: rows.map(r => JSON.stringify(r)).join("\n")});
  assert.doesNotThrow(() => requireCompletionOwnerReads(result(events), key));
  assert.throws(() => requireCompletionOwnerReads(result(events.slice(1)), key), /NOT_ACQUIRED/);
  assert.throws(() => requireCompletionOwnerReads(result(events), "b".repeat(64)), /NOT_ACQUIRED/);
  assert.throws(() => requireCompletionOwnerReads(result([...events].reverse()), key), /NOT_ACQUIRED/);
});

test("execution requires positively completed exact grant/reservation and native result association", () => {
  const binding = {taskId: "TASK-1", commandSha256: "a".repeat(64), executable: "/node", cwd: "/workspace"};
  const key = hash(binding), request = {operation: "resume", task: {sha256: "b".repeat(64)}};
  const action = {exitCode: 0, commandSha256: binding.commandSha256, stdoutSha256: "c".repeat(64), executable: binding.executable, cwd: binding.cwd};
  const reservation = {status: "COMPLETED", reservationId: key, grantId: key, bindingSha256: key, nextTask: binding.taskId,
    dependencies: [], resultSha256: hash(action)};
  const state = {reservations: {[key]: reservation}, grants: {[key]: {id: key, bindingSha256: key, binding, dependencies: [], executionRequest: request}}};
  const event = {type: "item.completed", item: {type: "mcp_tool_call", server: "vydykhai_control", tool: "execute_registered",
    arguments: {requestId: "consumer"}, status: "completed", result: {content: [{type: "text", text: JSON.stringify({status: "ACTION_COMPLETED", operation: "resume", action})}]}}};
  const execution = {output: JSON.stringify(event)};
  assert.equal(requireCompletedReservation(state, binding, request, execution), reservation);
  assert.equal(requireEndpointReservation(state, binding, request, {status: "ACTION_COMPLETED", operation: "resume", action}), reservation);
  assert.throws(() => requireEndpointReservation(state, binding, request, {status: "ACTION_COMPLETED", operation: "resume", action: {...action, stdoutSha256: "e".repeat(64)}}), /UNCONFIRMED/);
  for (const status of ["UNKNOWN", "FAILED", "FAILED_RECONCILED", "IN_FLIGHT"])
    assert.throws(() => requireCompletedReservation({...state, reservations: {[key]: {...reservation, status}}}, binding, request, execution), /UNCONFIRMED/);
  for (const patch of [{bindingSha256: "d".repeat(64)}, {resultSha256: "d".repeat(64)}, {reservationId: "other"},
    {grantId: "other"}, {nextTask: "other"}, {dependencies: ["old-consumer"]}, {failure: {observed: true}}])
    assert.throws(() => requireCompletedReservation({...state, reservations: {[key]: {...reservation, ...patch}}}, binding, request, execution), /UNCONFIRMED/);
  assert.throws(() => requireCompletedReservation(state, binding, {...request, operation: "accept"}, execution), /UNCONFIRMED/);
  for (const changed of [{...action, stdoutSha256: "e".repeat(64)}, {...action, exitCode: 1}, {...action, executable: "/other-node"}]) {
    const raw = structuredClone(event); raw.item.result.content[0].text = JSON.stringify({status: "ACTION_COMPLETED", operation: "resume", action: changed});
    assert.throws(() => requireCompletedReservation(state, binding, request, {output: JSON.stringify(raw)}), /UNCONFIRMED/);
  }
});

function noEffectFixture() {
  const f = amendedFixture(), key = hash(f.plan.binding), usage = {input_tokens: 16, output_tokens: 1};
  const start = {plan: f.plan, priorRuns: structuredClone(f.preparation.runs), priorRunsSha256: hash(f.preparation.runs),
    authorizationSha256: "a".repeat(64), bindings: {readiness: {sha256: "b".repeat(64)}}, currentSources: f.currentSources,
    budget: {priorAttempts: 32, maxCumulativeAttempts: 45}};
  const state = {paused: false, reservations: {}, acceptances: {}, grants: {[key]: {id: key, bindingSha256: key,
    binding: f.plan.binding, executionRequest: f.checkpoint.request, dependencies: [], expiresAt: 1,
    reviewReceipt: `actual-readiness:${start.bindings.readiness.sha256};harness-review:${start.authorizationSha256}`}}};
  const failed = {status: "PROSPECTIVE_COMPLETION_STOPPED_NO_RETRY", failure: "WORKER_ACTION_NOT_COMPLETED", parentUnchanged: true,
    runs: [...structuredClone(start.priorRuns), {name: "execute", status: "CLI_EXIT_OK", reason: null, usage, tracePublication: "RETAINED"}],
    newAttempts: 1, originalAttemptsPreserved: 32, maxCumulativeAttempts: 45, allocation: start.budget, runtime: f.plan.runtime.digest,
    state: structuredClone(state)};
  const trace = {status: "CLI_EXIT_OK", code: 0, state: "CLOSED", reason: null, signal: null,
    output: [{type: "thread.started"}, {type: "turn.started"}, {type: "item.completed", item: {type: "agent_message", text: "No execution"}},
      {type: "turn.completed", usage}].map(JSON.stringify).join("\n")};
  const allocation = {name: "execute", role: "worker", cumulativeAttempt: 33, authorizationSha256: start.authorizationSha256,
    runtime: failed.runtime, sourceDigest: start.currentSources.digest, model: "gpt-6.1-sol", effort: "low", timeoutMs: 120000};
  return {failed, start, trace, allocation, state, binding: f.plan.binding, request: f.checkpoint.request, now: 2};
}

test("no-effect33 requires completed zero-tool trace, all paid history and exact expired pristine grant", () => {
  const f = noEffectFixture(); assert.equal(validateNoEffectCompletion(f), true);
  for (const [name, mutate] of [
    ["MCP started", x => x.trace.output = JSON.stringify({type: "item.started", item: {type: "mcp_tool_call"}}) + "\n" + x.trace.output],
    ["failed tool", x => x.trace.output = JSON.stringify({type: "item.completed", item: {type: "mcp_tool_call", status: "failed"}}) + "\n" + x.trace.output],
    ["command", x => x.trace.output = JSON.stringify({type: "item.completed", item: {type: "command_execution"}}) + "\n" + x.trace.output],
    ["unknown trace", x => x.trace.status = "UNKNOWN"], ["failed process", x => x.trace.code = 1],
    ["refund", x => x.failed.runs.shift()], ["altered usage", x => x.failed.runs[0].usage = {input_tokens: 0}],
    ["paid usage lost", x => x.failed.runs[32].usage = null], ["other failure", x => x.failed.failure = "UNKNOWN"],
    ["wrong allocation", x => x.allocation.cumulativeAttempt = 32], ["changed source", x => x.allocation.sourceDigest = "c".repeat(64)],
    ["paused", x => x.state.paused = true], ["reservation", x => x.state.reservations.any = {status: "UNKNOWN"}],
    ["acceptance", x => x.state.acceptances.consumer = {}], ["live grant", x => x.now = 0],
    ["identity", x => x.request = {...x.request, readback: null}], ["parent drift", x => x.failed.parentUnchanged = false]
  ]) {
    const v = structuredClone(f); mutate(v); assert.throws(() => validateNoEffectCompletion(v), /COMPLETION_RECOVERY_/, name);
  }
});

test("explicit no-effect recovery consumes twelve native slots after33, never another execute or refunded row", () => {
  const prior = noEffectFixture().failed.runs, runs = structuredClone(prior);
  const budget = {priorAttempts: 33, originalMaximum: 44, maxCumulativeAttempts: 45, maxNewCalls: 12,
    additionalReadinessCalls: 1, amendmentDecisionSha256: "a".repeat(64), noEffectRecovery: true, deterministicModelCalls: 0};
  assert.throws(() => validateCompletionPhase(runs, prior, "execute", budget), /PHASE_OR_BUDGET/);
  assert.throws(() => validateCompletionPhase(runs, prior, "owner-acceptance", {...budget, noEffectRecovery: false}), /PHASE_OR_BUDGET/);
  for (const name of phases.slice(1)) {
    validateCompletionPhase(runs, prior, name, budget);
    runs.push({name, status: name.startsWith("post-") ? "STOPPED" : ["current-recipient", "held-out-recall"].includes(name) ? "PREPARATION_STATUS_VERIFIED" : "CLI_EXIT_OK"});
  }
  assert.equal(runs.length, 45); assert.deepEqual(runs.slice(0, 33), prior);
  assert.throws(() => validateCompletionPhase(runs, prior, "owner-acceptance", budget), /PHASE_OR_BUDGET/);
  const recovery = {method: "FROZEN_WORKER_ENDPOINT_EXECUTE_CONSUMER_ONCE", modelCalls: 0, stateSha256: "b".repeat(64),
    environment: observeDeterministicEnvironment({runtime: "a".repeat(64),
      binding: {...fixture().plan.binding, commandSha256: "b".repeat(64), executable: "/node"}, env: {PATH: "/bin"}})};
  const expected = {reviewer: "external-review", owner: "owner", executor: "worker", budget, recovery, bindings: {all: "pinned"}, codeHashes: {all: "pinned"}};
  const decision = {schema: "qualification.prospective-completion-review.v1", decision: "ALLOW_BOUNDED_COMPLETION", reviewer: expected.reviewer,
    scope: "NO_EFFECT_33_DISPATCH_AND_REMAINING_12_ONLY", ...budget, recovery, bindings: expected.bindings, codeHashes: expected.codeHashes,
    phaseOrder: ["deterministic-dispatch", ...phases.slice(1)], retries: 0, ownerAcceptance: false, hostClosure: false, historicalClosure: false, releaseReady: false, hostGrant: false};
  assert.equal(validateCompletionAuthority(decision, expected), true);
  const later = {...expected, recovery: {...recovery, environment: {...recovery.environment,
    observedAt: new Date(Date.parse(recovery.environment.observedAt) + 1000).toISOString()}}};
  assert.equal(validateCompletionAuthority(decision, later), true);
  for (const key of ["PATH", "TMPDIR"]) {
    const drift = structuredClone(later); drift.recovery.environment.inherited[key] = "/drift";
    assert.throws(() => validateCompletionAuthority(decision, drift), /DISPATCH_ENVIRONMENT_CHANGED/);
  }
  for (const patch of [{scope: "REMAINING_13_CALLS_ONLY"}, {maxNewCalls: 13}, {priorAttempts: 32}, {maxCumulativeAttempts: 46},
    {recovery: {...recovery, stateSha256: "c".repeat(64)}}, {bindings: {}}, {codeHashes: {}}, {phaseOrder: phases}])
    assert.throws(() => validateCompletionAuthority({...decision, ...patch}, expected), /INDEPENDENT_REVIEW/);
});

test("deterministic receipt binds actual four-key child environment, never unused native HOME or fixed PATH", () => {
  const options = {runtime: "a".repeat(64), binding: {...fixture().plan.binding, commandSha256: "b".repeat(64), executable: "/node"},
    observedAt: "2026-10-09T00:00:00.000Z", env: {PATH: "/actual/bin", TMPDIR: "/actual/tmp", SystemRoot: "/system", TEMP: "/temp",
      HOME: "/unused-home", CODEX_HOME: "/unused-codex", OPENAI_API_KEY: "synthetic-not-forwarded"}};
  const reviewed = observeDeterministicEnvironment(options);
  assert.deepEqual(reviewed.inherited, {PATH: "/actual/bin", TMPDIR: "/actual/tmp", SystemRoot: "/system", TEMP: "/temp"});
  assert.equal(JSON.stringify(reviewed).includes("synthetic-not-forwarded"), false);
  const current = observeDeterministicEnvironment({...options, observedAt: "2026-10-09T01:00:00.000Z"});
  assert.equal(requireDeterministicEnvironment(current, reviewed), true);
  assert.deepEqual(JSON.parse(effectEnvironmentPublication(current).bytes), current);
  for (const key of ["PATH", "TMPDIR", "TEMP", "SystemRoot"]) {
    const changed = observeDeterministicEnvironment({...options, env: {...options.env, [key]: "/changed"}});
    assert.throws(() => requireDeterministicEnvironment(changed, reviewed), /DISPATCH_ENVIRONMENT_CHANGED/);
  }
  assert.equal(requireDeterministicEnvironment(observeDeterministicEnvironment({...options,
    env: {...options.env, HOME: "/other-unused", CODEX_HOME: "/other-unused"}}), reviewed), true);
  const missing = observeDeterministicEnvironment({...options, env: {PATH: "", TEMP: undefined}});
  assert.deepEqual(missing.inherited, {});
  for (const patch of [{nativeLauncherUsed: true}, {inherited: {...current.inherited, HOME: "/wrong"}}, {extraEnv: {TOKEN: "wrong"}},
    {runtime: "c".repeat(64)}, {commandSha256: "c".repeat(64)}, {taskSha256: "c".repeat(64)}, {executionAuthorized: true}])
    assert.throws(() => requireDeterministicEnvironment({...current, ...patch}, reviewed), /DISPATCH_ENVIRONMENT_CHANGED/);
});

test("recovery path inspection is read-only and rejects output, prior start, return or dispatch, including empty files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "prospective-recovery-paths-"));
  try {
    await requireNoEffectRecoveryPaths(dir, dir);
    assert.deepEqual(await readdir(dir), []);
    for (const name of ["consumer-output.json", "actual-effect-environment.json", "actual-effect-command.json",
      "completion-recovery-start.json", "completion-recovery-result.json", "completion-recovery-dispatch.json"]) {
      const file = path.join(dir, name); await writeFile(file, "", {flag: "wx"});
      await assert.rejects(requireNoEffectRecoveryPaths(dir, dir), /RECOVERY_PATH_EXISTS/);
      assert.deepEqual(await readdir(dir), [name]); await rm(file);
    }
  } finally { await rm(dir, {recursive: true, force: true}); }
});

test("POST requires the exact pre-effect environment receipt, without recapture or historical rewriting", () => {
  const environment = {schema: "qualification.prospective-environment.v1", phase: "BEFORE_PROTECTED_ACTION",
    observedAt: "2026-10-09T00:00:00.000Z", commandSha256: "a".repeat(64), output: "ABSENT_CREATE_ONCE"};
  const before = structuredClone(environment), publication = effectEnvironmentPublication(environment);
  assert.deepEqual(JSON.parse(publication.bytes), before); assert.deepEqual(environment, before);
  assert.equal(publication.bytes, canonicalJson(before) + "\n");
  assert.equal(publication.entry.path, "actual-effect-environment.json");
  const profile = prospectiveCompletionProfile(fixture().plan, ["current-recipient"]);
  assert.ok(profile.review.scope.requiredSourceIds.includes(publication.entry.id));
  assert.equal(prospectiveCompletionProfile(fixture().plan, [publication.entry.id]).review.scope.requiredSourceIds.filter(id => id === publication.entry.id).length, 1);
  assert.throws(() => effectEnvironmentPublication({...environment, phase: "AFTER_PROTECTED_ACTION"}), /INVALID/);
});

function amendedFixture() {
  const f = fixture(), oldSources = structuredClone(f.currentSources);
  const rejected = {...structuredClone(f.preparation), status: "PROSPECTIVE_PREPARATION_FAILED", failure: "PROSPECTIVE_READINESS_REJECTED"};
  const rejectedTrace = structuredClone(f.readiness);
  rejectedTrace.output = rejectedTrace.output.replace('APPROVE', 'REPAIR');
  f.preparation.runs.push({name: "prospective-readiness-repair", status: "CLI_EXIT_OK", usage: {input_tokens: 2, output_tokens: 1}});
  f.preparation.newAttempts = 1; f.preparation.priorAttemptsPreserved = 31;
  f.checkpoint.runsSha256 = hash(f.preparation.runs);
  const ids = ["current-dependency-application", "current-command-observation", "current-readiness-environment"];
  const additions = ids.map(id => ({id, path: `${id}.json`, purpose: "Synthetic additive repair", status: "AVAILABLE", sha256: sha256(`test ${id}`)}));
  const rows = [...structuredClone(oldSources.rows), ...additions];
  f.currentSources = {rows, digest: hash(rows), bytes: 300}; f.checkpoint.sourceSnapshot = f.currentSources;
  const acquisition = additions.map(r => JSON.stringify({type: "item.completed", item: {type: "mcp_tool_call", server: "vydykhai_review", tool: "read_source", status: "completed",
    result: {content: [{type: "text", text: JSON.stringify({...r, text: `test ${r.id}`})}]}}})).join("\n");
  f.readiness.output = acquisition + "\n" + f.readiness.output;
  const plan = {schema: "qualification.prospective-readiness-repair-plan.v1", originalMaximum: 44, amendedMaximum: 45,
    priorAttempts: 31, maxNewCalls: 1, remainingLaterSlots: 13, retries: 0, protectedActions: 0,
    sourceSnapshot: oldSources, bindings: {failed: {path: "/rejected.json", sha256: hash(rejected)}},
    codeHashes: {"scripts/prospective-cycle-preparation.mjs": "d".repeat(64)}};
  const planSha256 = hash(plan);
  const decision = {schema: "qualification.prospective-readiness-repair.v1", decision: "ALLOW_ONE_READ_ONLY_RECHECK", reviewer: "independent-repair",
    planSha256, bindings: structuredClone(plan.bindings), codeHashes: structuredClone(plan.codeHashes), priorAttempts: 31, maxNewCalls: 1,
    originalMaximum: 44, amendedMaximum: 45, remainingLaterSlots: 13, retries: 0, noRefund: true, oldVerdictPreserved: true,
    executionGranted: false, historicalClosure: false, releaseReady: false, evidence: ["Synthetic unit-test amendment only"]};
  f.amendment = {plan, decision, rejected, rejectedTrace, planSha256, decisionSha256: hash(decision)};
  f.checkpoint.repairDecisionSha256 = f.amendment.decisionSha256;
  return f;
}

test("readiness32 requires exact additive amendment, preserves rejected31 and formatfailure30, and acquires all three additions", () => {
  const f = amendedFixture(); assert.equal(validateCompletionCheckpoint(f), true);
  assert.equal(f.original.runs.length, 30); assert.equal(f.amendment.rejected.runs.length, 31);
  for (const [label, change, code] of [
    ["missing amendment", x => delete x.amendment, /ATTEMPTS/],
    ["readiness refunded", x => x.preparation.runs.splice(30, 1), /ATTEMPTS/],
    ["old REPAIR overridden", x => x.amendment.rejectedTrace.output = x.amendment.rejectedTrace.output.replace('REPAIR', 'APPROVE'), /ADDITIVE/],
    ["prior31 changed", x => x.amendment.rejected.runs[30].usage.input_tokens++, /ADDITIVE/],
    ["prior30 changed", x => x.original.runs[29].usage.input_tokens++, /REFUND_OR_REPLAY/],
    ["extra slot silently reset", x => x.amendment.plan.amendedMaximum = 44, /ADDITIVE/],
    ["unreviewed code change", x => x.amendment.plan.codeHashes["scripts/prospective-cycle-preparation.mjs"] = "e".repeat(64), /INDEPENDENT_DECISION/],
    ["decision hash changed", x => x.checkpoint.repairDecisionSha256 = "e".repeat(64), /ADDITIVE/],
    ["dependent old source changed", x => x.amendment.plan.sourceSnapshot.rows[0].sha256 = "e".repeat(64), /EXISTING_SOURCE/],
    ["unread public applicability", x => x.readiness.output = x.readiness.output.split("\n").slice(1).join("\n"), /NOT_ACQUIRED/]
  ]) {
    const changed = structuredClone(f); change(changed); assert.throws(() => validateCompletionCheckpoint(changed), code, label);
  }
});

test("amended completion consumes only13 after32, retains original44 and requires the amendment in independent authority", () => {
  const prior = amendedFixture().preparation.runs, runs = structuredClone(prior);
  const budget = {priorAttempts: 32, maxCumulativeAttempts: 45, originalMaximum: 44, additionalReadinessCalls: 1, amendmentDecisionSha256: "a".repeat(64)};
  assert.throws(() => validateCompletionPhase(runs, prior, "execute"), /PHASE_OR_BUDGET/);
  for (const name of phases) {
    validateCompletionPhase(runs, prior, name, budget);
    runs.push({name, status: name.startsWith("post-") ? "STOPPED" : ["current-recipient", "held-out-recall"].includes(name) ? "PREPARATION_STATUS_VERIFIED" : "CLI_EXIT_OK"});
  }
  assert.equal(runs.length, 45); assert.deepEqual(runs.slice(0, 32), prior);
  assert.throws(() => validateCompletionPhase(runs, prior, "execute", budget), /PHASE_OR_BUDGET/);
  const expected = {reviewer: "independent-completion", owner: "owner", executor: "worker-1", bindings: {repairDecision: "test-bound"}, codeHashes: {harness: "test-bound"}, budget};
  const decision = {schema: "qualification.prospective-completion-review.v1", decision: "ALLOW_BOUNDED_COMPLETION", reviewer: expected.reviewer,
    bindings: expected.bindings, codeHashes: expected.codeHashes, scope: "REMAINING_13_CALLS_ONLY", ...budget, maxNewCalls: 13,
    retries: 0, phaseOrder: phases, ownerAcceptance: false, hostClosure: false, historicalClosure: false, releaseReady: false, hostGrant: false};
  assert.equal(validateCompletionAuthority(decision, expected), true);
  for (const patch of [{priorAttempts: 31}, {maxCumulativeAttempts: 44}, {originalMaximum: 45}, {additionalReadinessCalls: 0}, {amendmentDecisionSha256: "b".repeat(64)}])
    assert.throws(() => validateCompletionAuthority({...decision, ...patch}, expected), /INDEPENDENT_REVIEW/);
});

test("fresh effect command preserves reviewed executable/action/opaque producer pins and is mandatory POST evidence", () => {
  const reviewed = {schema: "qualification.prospective-command-observation.v1", phase: "BEFORE_PROTECTED_ACTION", executionAuthorized: false,
    observedAt: "2026-10-09T01:00:00.000Z", executable: {resolved: "/node", sha256: "a".repeat(64), access: "X_OK"},
    script: {path: "action.mjs", sha256: "b".repeat(64), access: "R_OK"}, producer: {path: "candidate.mjs", sha256: "c".repeat(64), context: "OPAQUE_BYTES_HASH_ONLY"}};
  const fresh = {...reviewed, observedAt: "2026-10-09T02:00:00.000Z"}, before = structuredClone(reviewed);
  const publication = effectCommandPublication(fresh, reviewed);
  assert.deepEqual(JSON.parse(publication.bytes), fresh); assert.deepEqual(reviewed, before);
  assert.equal(publication.entry.id, "actual-effect-command");
  for (const patch of [{executable: {...fresh.executable, sha256: "d".repeat(64)}}, {producer: {...fresh.producer, sha256: "d".repeat(64)}},
    {script: {...fresh.script, path: "other.mjs"}}, {observedAt: "2026-10-09T00:00:00.000Z"}, {executionAuthorized: true}])
    assert.throws(() => effectCommandPublication({...fresh, ...patch}, reviewed), /EFFECT_COMMAND_CHANGED/);
  const required = prospectiveCompletionProfile(fixture().plan, []).review.scope.requiredSourceIds;
  for (const id of ["actual-effect-command", "actual-effect-environment", "current-dependency-application"]) assert.ok(required.includes(id));
});
