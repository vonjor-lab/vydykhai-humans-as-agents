import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { classifyGuard, evaluateExecutionReadiness, evaluateProductionContinuation,
  readProductionContinuation, evaluateLeaseActivity, readLeaseActivityScope } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
const next = { schemaVersion: 1, id: "NEXT-1", work: "WORK-1", action: "Inspect the accepted source",
  owner: "worker", state: "WORKING", evidence: "first-read-1" };
function state(record = next, lease = "WORKING") {
  return `Orchestrator health: HEALTHY | Context: manager | Profile: maximum
Project Guard: ACTIVE | Incident: none
Human attention: NONE
## Execution Leases
| Work | State | Owner / context |
| --- | --- | --- |
| WORK-1 [GOAL] - inspect source | ${lease} | worker |
| WORK-2 [GOAL] - independent work | WORKING | other-worker |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify(record)}
\`\`\`
<!-- vydykhai:project-state:end -->`;
}
function readiness() {
  return Object.fromEntries(["cwd", "sources", "report", "delivery"].map((key) =>
    [key, { status: "AVAILABLE", evidence: `actual-${key}-scope-1` }]));
}
function view(extra = {}) {
  return { context: "worker", status: "IDLE", turnId: "turn-1", evidence: "native-turn-completed", ...extra };
}
function activity(content, owner = view(), overrides = {}) {
  return { schemaVersion: 1, observedAt: new Date(now).toISOString(),
    continuationKey: readProductionContinuation(content).key,
    orchestrator: { context: "manager", status: "IDLE", evidence: "native-manager" }, owner,
    ...overrides };
}
function check(content, owner, overrides = {}, options = {}) {
  const continuation = evaluateProductionContinuation(content, activity(content, owner, overrides), { now });
  return { continuation, ...classifyGuard({ ok: !continuation.issues.length, stateIssues: continuation.issues,
    graphIssues: [], continuation }, content, options) };
}
const blocked = (status, cause) => ({ status, evidence: cause, resumeWhen: "Changed boundary verified in the same task" });

test("real missing-cwd and denied-write process evidence feeds the existing recovery route", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "execution-readiness-"));
  try {
    const missing = spawnSync(process.execPath, ["-e", "process.exit(0)"], { cwd: path.join(root, "absent") });
    assert.equal(missing.error?.code, "ENOENT");
    const checks = readiness();
    checks.cwd = blocked("MISSING", `actual-spawn-${missing.error.code}`);
    assert.equal(check(state(), view({ readiness: checks })).continuation.nextAction, "REPAIR_ENVIRONMENT");

    // Node's isolated permission policy exercises a real denial, not Codex's sandbox.
    const output = path.join(root, "result.md");
    const denied = spawnSync(process.execPath, ["--experimental-permission", "--allow-fs-read=*",
      "--input-type=module", "-e", `import {writeFileSync} from 'node:fs';
        try { writeFileSync(process.argv[1], 'result'); process.exitCode = 1; }
        catch (error) { console.log(JSON.stringify({code:error.code, permission:error.permission})); }`, output],
    { cwd: root, encoding: "utf8" });
    assert.equal(denied.status, 0, denied.stderr);
    const failure = JSON.parse(denied.stdout);
    assert.equal(failure.code, "ERR_ACCESS_DENIED");
    assert.equal(failure.permission, "FileSystemWrite");
    await assert.rejects(access(output), { code: "ENOENT" });
    const actual = readiness();
    actual.report = blocked("DENIED", `actual-process-${failure.code}-${failure.permission}`);
    assert.equal(check(state(), view({ readiness: actual })).continuation.nextAction, "RESOLVE_ACCESS");
    // An API adapter can expose no final despite this observed command failure.
    const api = { status: "completed", items: [] };
    assert.equal(api.items.length, 0);
    const terminal = { turnId: "turn-1", status: "BLOCKED", evidence: actual.report.evidence,
      resumeWhen: actual.report.resumeWhen };
    assert.equal(check(state(), view({ terminal })).continuation.nextAction, "RESOLVE_BLOCKER");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("launch qualification requires actual source, cwd, report and delivery evidence, not a role label", () => {
  assert.equal(evaluateExecutionReadiness(readiness()).status, "READY");
  assert.equal(evaluateExecutionReadiness(undefined).status, "NOT_REQUESTED");
  for (const missing of [null, {}, { cwd: { status: "AVAILABLE", evidence: "readonly-auditor" } }]) {
    assert.equal(evaluateExecutionReadiness(missing).status, "LIMITED");
  }
  const noDelivery = readiness();
  noDelivery.delivery = { status: "NOT_REQUIRED", evidence: "agreed-local-only-result" };
  assert.equal(evaluateExecutionReadiness(noDelivery).status, "READY");
  noDelivery.cwd = noDelivery.delivery;
  assert.equal(evaluateExecutionReadiness(noDelivery).status, "LIMITED");
});

test("missing checkout and denied report route to different bounded repairs, never blind retry", () => {
  for (const [field, status, expected] of [["cwd", "MISSING", "REPAIR_ENVIRONMENT"],
    ["report", "DENIED", "RESOLVE_ACCESS"], ["delivery", "DENIED", "RESOLVE_ACCESS"]]) {
    const checks = readiness();
    checks[field] = blocked(status, `observed-${field}-${status}`);
    const qualification = evaluateExecutionReadiness(checks);
    assert.equal(qualification.status, "BLOCKED");
    assert.equal(qualification.nextAction, expected);
    assert.deepEqual(qualification.blocked, [field]);
    const content = state();
    const result = check(content, view({ readiness: checks }));
    assert.equal(result.action, "WAKE");
    assert.equal(result.continuation.nextAction, expected);
    assert.equal(result.continuation.value.owner, "worker");
    const escalated = check(content, view({ readiness: checks }), {}, { wokenIncidentId: result.incidentId });
    assert.equal(escalated.action, "AUDIT_REQUIRED");
    const stopped = check(content, view({ readiness: checks }), {},
      { repairIncidentId: result.incidentId, repairAttempts: 1, wokenIncidentId: result.incidentId });
    assert.equal(stopped.action, "CONTROL_DEGRADED");
  }
});

test("empty API is not an empty execution: exact-turn terminal evidence routes the result or blocker", () => {
  const content = state();
  for (const [status, nextAction] of [["RESULT", "RECONCILE_RESULT"], ["BLOCKED", "RESOLVE_BLOCKER"]]) {
    const terminal = { turnId: "turn-1", status, evidence: "authorized-current-turn-journal",
      resumeWhen: "Exact unresolved access boundary is resolved" };
    const result = check(content, view({ terminal }));
    assert.equal(result.action, "WAKE");
    assert.equal(result.continuation.nextAction, nextAction);
    // Finding a final is not product acceptance or a producer delivery receipt.
    assert.equal(result.continuation.value.state, "WORKING");
    assert.equal(result.continuation.value.owner, "worker");
    assert.equal(result.continuation.returnLifecycle, undefined);
  }
  const hidden = check(content, view({ terminal: { turnId: "turn-1", status: "UNAVAILABLE", evidence: "empty-api" } }));
  assert.equal(hidden.continuation.coverage, "LIMITED");
  assert.equal(hidden.continuation.signal, null);
  assert.equal(hidden.action, "AUDIT_REQUIRED");
  assert.equal(hidden.continuation.nextAction, "RECOVER_OBSERVATION");
});

test("old, conflicting, malformed or unavailable evidence cannot qualify a restart", () => {
  const content = state();
  const terminal = { turnId: "turn-1", status: "RESULT", evidence: "journal-turn-1" };
  for (const owner of [view({ terminal: { ...terminal, turnId: "old-turn" } }),
    view({ terminal: { ...terminal, evidence: "" } }), view({ terminal: null }),
    view({ terminal: { ...terminal, status: "BLOCKED" } }),
    view({ status: "ACTIVE", terminal }), view({ readiness: null })]) {
    assert.equal(check(content, owner).continuation.coverage, "LIMITED");
  }
  assert.equal(check(content, view({ terminal }), { observedAt: new Date(now - 301000).toISOString() }).continuation.coverage, "LIMITED");
  assert.equal(check(content, view({ context: "other-worker", terminal })).continuation.coverage, "LIMITED");
  const checks = readiness();
  checks.cwd = blocked("MISSING", "missing-checkout");
  assert.equal(check(content, view({ readiness: checks, terminal })).continuation.nextAction, "RECONCILE_RESULT");
  assert.equal(check(content, view({ readiness: checks,
    terminal: { ...terminal, status: "UNAVAILABLE" } })).continuation.nextAction, "RECOVER_OBSERVATION");
});

test("a changed environment cause is not suppressed as the previous access incident", () => {
  const checks = readiness();
  checks.report = blocked("MISSING", "missing-folder");
  const first = check(state(), view({ readiness: checks }));
  checks.report = blocked("DENIED", "host-policy-denial");
  const changed = check(state(), view({ readiness: checks }), {}, { acceptedIncidentId: first.incidentId });
  assert.notEqual(changed.incidentId, first.incidentId);
  assert.equal(changed.action, "WAKE");
  assert.equal(changed.continuation.nextAction, "RESOLVE_ACCESS");
});

test("one access wait leaves independent work active, stays quiet, then resumes the original worker", () => {
  const waiting = state({ ...next, state: "WAITING", resumeWhen: "Report location is permitted by host policy" }, "WAITING");
  const checks = readiness();
  checks.report = blocked("DENIED", "read-only-policy");
  const owner = view({ readiness: checks, terminal: { turnId: "turn-1", status: "BLOCKED",
    evidence: "write-denial", resumeWhen: "Report location is permitted by host policy" } });
  const pending = { wait: { status: "PENDING", evidence: "unchanged-host-policy" } };
  assert.equal(check(waiting, owner, pending).action, "NOOP");
  const observed = activity(waiting, owner, { ...pending, leaseKey: readLeaseActivityScope(waiting).key,
    leases: [{ ...owner, work: "WORK-1", wait: { ...pending.wait,
      resumeWhen: "Report location is permitted by host policy", dependsOn: [] } },
    { work: "WORK-2", context: "other-worker", status: "ACTIVE", evidence: "actual-independent-command" }] });
  assert.deepEqual(evaluateLeaseActivity(waiting, observed, { now }).issues, []);
  assert.equal(check(waiting, owner, { wait: { status: "CHANGED", evidence: "approved-scope-and-host-readback" } }).action, "WAKE");
  const running = state();
  assert.equal(check(running, view({ status: "ACTIVE", readiness: readiness(), turnId: "turn-2" })).action, "NOOP");
});

test("whole-lease checks use the same outcome distinction as the next-action owner", () => {
  const content = state();
  const owner = view({ terminal: { turnId: "turn-1", status: "UNAVAILABLE", evidence: "empty-api" } });
  const observed = activity(content, owner, { leaseKey: readLeaseActivityScope(content).key,
    leases: [{ ...owner, work: "WORK-1" },
      { work: "WORK-2", context: "other-worker", status: "ACTIVE", evidence: "running" }] });
  assert.equal(evaluateLeaseActivity(content, observed, { now }).coverage, "LIMITED");
  observed.owner.terminal.status = "RESULT";
  observed.leases[0] = { ...observed.leases[0], terminal: { ...observed.owner.terminal,
    status: "BLOCKED", resumeWhen: "Actual permission changes" } };
  assert.match(evaluateLeaseActivity(content, observed, { now }).issues.join(" "), /conflicting execution evidence/);
  observed.leases[0].terminal = { ...observed.owner.terminal };
  const matched = evaluateLeaseActivity(content, observed, { now });
  assert.equal(matched.coverage, "COVERED");
  assert.equal(matched.nextActions[0].action, "RECONCILE_RESULT");
});
