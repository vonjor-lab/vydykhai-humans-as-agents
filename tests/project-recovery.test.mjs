import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";
import {assessCapabilityReadiness} from "../scripts/adoption-plan.mjs";
import {incrementEvidenceKey} from "../scripts/increment-readiness.mjs";
import {assessProjectRecovery, recoveryEvidenceKey, continuationEvidenceKey, recoveryAreas} from "../scripts/project-recovery.mjs";

const now = Date.parse("2026-10-06T12:00:00Z");
const due = "2026-10-07T12:00:00Z";
const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
function sample() {
  const bindings = Object.fromEntries(ids.map(id => [id, `version:${id}`]));
  const readiness = {trigger: "update", scope: "project", bindings,
    checks: ids.map(id => ({id, status: "VERIFIED", binding: bindings[id],
      checkedBinding: bindings[id], source: `fixture:${id}`})),
    architecture: {project: "project", scope: "project", source: "fixture:survey",
      inventory: {source: "fixture:inventory", areas: ["module"]}, reviewedBy: "surveyor", review: "fixture:review",
      coverage: [{area: "module", access: "AVAILABLE", modularity: "ENCAPSULATED", documentation: "CURRENT", evidence: "fixture:module"}]}};
  readiness.accepted = {status: "ACCEPTED", acceptedBy: "owner",
    relevantKey: assessCapabilityReadiness(readiness).relevantKey,
    routeProof: Object.fromEntries(["moduleFound", "contextDelivered", "retainedAndNewAcceptance",
      "documentationUpdated", "semanticIntegration", "nextRetrieval"].map(k => [k, `fixture:${k}`]))};
  return {scope: "project", owner: "owner", readiness,
    preservation: {baseline: "baseline", backup: "fixture:snapshot", restore: "fixture:restore",
      successInventory: "fixture:historical-successes", successes: [{id: "public-use", artifact: "release-1",
        conditions: "Fixed public input, no manual correction", status: "REPRODUCED", requiredForResume: true, evidence: "fixture:replay"}]},
    inventory: {scope: "project", revision: "candidate-1", evidence: "fixture:source-survey", reviewedBy: "surveyor",
      rows: recoveryAreas.map(area => ({area, status: "VERIFIED", evidence: `fixture:${area}`}))},
    findings: [], previousFindings: [], repairLeases: [], boundary: {status: "REACHED", checkpoint: "existing-task-return",
      reviewAt: due, evidence: "fixture:in-flight-reconciled"}};
}
function finding(x, area = "repository-custody", blocksResume = true) {
  const f = {id: "repair-1", area, criterion: "Preserve unique accepted work and reconcile custody",
    status: "OPEN", owner: "maintenance", evidence: "fixture:unowned-branch", firstSeen: "2026-10-06T10:00:00Z",
    reviewAt: due, attempts: 0, blocksResume, work: "repair-work-1", plan: "Reconcile exact artifacts, preserve unique work, then recheck"};
  x.findings.push(f); x.inventory.rows.find(r => r.area === area).status = "GAP";
  x.repairLeases.push({work: f.work, owner: f.owner, state: "WORKING", checkpoint: "repair-return",
    reviewAt: due, evidence: "fixture:existing-execution-lease"});
  return f;
}
function approved(x) {
  x.review = {key: recoveryEvidenceKey(x), reviewer: "independent", evidence: "fixture:independent-review"};
  return x;
}
const check = x => assessProjectRecovery(x, {now});
const action = (x, expected) => assert.equal(check(x).action, expected);

function independentIncrement() {
  const x = sample();
  const readyRoute = structuredClone(x.readiness);
  readyRoute.scope = "project/public-module-route"; delete readyRoute.architecture;
  readyRoute.accepted.relevantKey = assessCapabilityReadiness(readyRoute, {requireArchitecture: false}).relevantKey;
  const arch = x.readiness.architecture;
  arch.inventory.areas.push("unmapped-area");
  finding(x, "code-map-and-docs", false);
  const modularity = finding(x, "successes-and-modules", false);
  modularity.id = "repair-2";
  // Both obligations belong to one existing maintenance lease.
  x.repairLeases.pop();
  x.increment = {task: "public-next", readiness: readyRoute,
    dependencyReview: {reviewer: "independent", evidence: "fixture:all-source-dependency-trace",
      rows: [{area: "module", status: "DEPENDENCY", evidence: "fixture:public-contract-use"},
        {area: "unmapped-area", status: "INDEPENDENT", evidence: "fixture:no-call-state-or-data-dependency"}]}};
  x.increment.dependencyReview.key = incrementEvidenceKey(x);
  return x;
}

test("bounded ready increment does not require or claim whole-project completion", () => {
  const x = independentIncrement();
  assert.equal(assessCapabilityReadiness(x.readiness).preparation.codeMapped, false);
  approved(x); action(x, "PREPARE_PRODUCTIVE_RESUME");
  const key = recoveryEvidenceKey(x);
  x.continuation = {task: "public-next", owner: "worker", authority: "fixture:approved-step",
    recoveryKey: key, workerReadback: "fixture:contract-readback", observedProgress: "fixture:public-step-started"};
  x.continuation.bindingKey = continuationEvidenceKey(x);
  x.humanReport = "fixture:delivered-with-whole-project-debt"; x.reportKey = x.continuation.bindingKey;
  const result = check(x);
  assert.equal(result.action, "RECORDED_RESUME_WITH_DEBT");
  assert.equal(result.wholeProjectReady, false);
  assert.equal(result.debt.length, 2);
  x.continuation.task = "unchecked-next"; action(x, "PREPARE_PRODUCTIVE_RESUME");
});

test("bounded continuation needs complete independent dependency proof and current public boundary", () => {
  for (const mutate of [x => x.increment.dependencyReview.rows.pop(),
    x => x.increment.dependencyReview.reviewer = x.owner,
    x => x.increment.readiness.accepted.routeProof.nextRetrieval = "",
    x => x.readiness.architecture.coverage[0].documentation = "GAPS",
    x => x.increment.dependencyReview.rows[1].status = "DEPENDENCY",
    x => x.increment.task = "other-task"]) {
    const x = independentIncrement(); mutate(x); action(x, "PROVE_INDEPENDENT_INCREMENT");
  }
  const x = independentIncrement(); x.increment.dependencyReview.rows[1].status = "DEPENDENCY";
  x.increment.dependencyReview.key = incrementEvidenceKey(x); action(x, "PROVE_INDEPENDENT_INCREMENT");
});

test("a bounded route cannot erase whole-project obligations or override a blocking finding", () => {
  const x = independentIncrement(); x.findings = x.findings.filter(f => f.area !== "code-map-and-docs");
  action(x, "ASSIGN_EXISTING_MAINTENANCE");
  const y = independentIncrement(); y.findings[0].blocksResume = true;
  action(y, "REPAIR_BEFORE_DEPENDENT_RESUME");
});

test("independent counterexample: retain original closure and revalidate a later inventory revision", () => {
  const x = sample(), f = finding(x);
  Object.assign(f, {status: "CLOSED", proof: "fixture:original-fix", reviewedBy: "independent", checkedRevision: "candidate-1"});
  x.inventory.rows.find(r => r.area === f.area).status = "VERIFIED";
  x.previousFindings = structuredClone(x.findings); x.inventory.revision = "candidate-2";
  action(x, "RECONCILE_FINDINGS");
  f.revalidations = [{revision: "candidate-2", reviewedBy: "independent", evidence: "fixture:unchanged-closure-scope"}];
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
  assert.equal(f.checkedRevision, "candidate-1");
  x.previousFindings = structuredClone(x.findings); f.revalidations = [];
  action(x, "RECONCILE_FINDINGS");
});

test("recovery cannot count an unapproved second attempt as success after an earlier failure", () => {
  const x = sample(), f = finding(x, "repository-custody", false);
  Object.assign(f, {attempts: 1, lastResult: "FAILED"}); x.previousFindings = structuredClone(x.findings);
  Object.assign(f, {attempts: 2, lastResult: "PASSED"}); action(x, "RECONCILE_FINDINGS");
  f.retryDecisions = [{fromAttempt: 1, toAttempt: 2, previousResult: "FAILED", decision: "fixture:bounded-retry",
    evidence: "fixture:changed-method", reviewedBy: "independent"}];
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
  x.previousFindings = structuredClone(x.findings); f.retryDecisions[0].decision = "new-history";
  action(x, "RECONCILE_FINDINGS");
});

test("experimental recovery is read-only and does not certify semantic health", () => {
  const x = sample(), before = structuredClone(x), result = check(x);
  assert.equal(result.action, "INDEPENDENT_RECOVERY_REVIEW");
  assert.equal(result.mutationAuthorized, false);
  assert.equal(result.semanticAcceptance, "NOT_ESTABLISHED");
  assert.deepEqual(x, before);
});

test("pause and uncertain effects precede any proposal to continue", () => {
  action({...sample(), paused: true}, "PRESERVE_PAUSE");
  action({...sample(), externalUnknown: true}, "RECONCILE_EXTERNAL_OUTCOME");
});

test("installation or empty inputs never certify project recovery", () => {
  action(undefined, "INVALID_INPUT");
  const x = sample(); x.readiness = {kit: "installed"};
  action(x, "RECONCILE_READINESS");
  const y = sample(); y.readiness.scope = "another-project";
  action(y, "RECONCILE_READINESS");
});

test("preservation includes success conditions, backup and recovery instructions", () => {
  for (const field of ["baseline", "backup", "restore", "successInventory"]) {
    const x = sample(); x.preservation[field] = ""; action(x, "PRESERVE_BASELINE");
  }
  const x = sample(); x.preservation.successes[0].conditions = "";
  action(x, "PRESERVE_BASELINE");
});

test("every area is surveyed independently, not only maps or the next task", () => {
  for (const area of recoveryAreas) {
    const x = sample(); x.inventory.rows = x.inventory.rows.filter(r => r.area !== area);
    action(x, "COMPLETE_DIAGNOSIS");
  }
  const x = sample(); x.inventory.reviewedBy = x.owner; action(x, "COMPLETE_DIAGNOSIS");
  const y = sample(); y.inventory.rows[0].status = "UNKNOWN";
  action(y, "ASSIGN_EXISTING_MAINTENANCE");
});

test("dirty or unknown areas get owned work, not automatic disposal", () => {
  const x = sample(); finding(x); action(x, "REPAIR_BEFORE_DEPENDENT_RESUME");
  x.findings[0].owner = ""; action(x, "RECONCILE_FINDINGS");
});

test("safe boundary is a named condition with a finite review, not perpetual postponement", () => {
  const x = sample(); finding(x); x.boundary.status = "PENDING";
  action(x, "WAIT_SAFE_BOUNDARY");
  x.boundary.reviewAt = "2026-10-06T11:00:00Z"; action(x, "REPLAN_OVERDUE_BOUNDARY");
  x.boundary.checkpoint = ""; action(x, "SCHEDULE_SAFE_BOUNDARY");
  const y = sample(); y.boundary.evidence = ""; action(y, "PROVE_SAFE_BOUNDARY");
});

test("restart cannot erase an open finding, its original criterion or failed attempts", () => {
  for (const mutate of [x => x.findings.splice(0), x => x.findings[0].criterion = "easier",
    x => x.findings[0].attempts = 0, x => x.findings[0].firstSeen = due]) {
    const x = sample(); finding(x).attempts = 1;
    x.previousFindings = structuredClone(x.findings); mutate(x); action(x, "RECONCILE_FINDINGS");
  }
  const x = sample(); const f = finding(x); f.attempts = 1; f.lastResult = "FAILED";
  action(x, "REVIEW_FAILED_REPAIR");
});

test("original evidence and area survive; weakening a hold or changing owner needs a decision", () => {
  for (const patch of [{evidence: "different problem"}, {area: "memory-and-ideas"},
    {blocksResume: false}, {owner: "someone else"}, {work: "new-task"}]) {
    const x = sample(); const f = finding(x); x.previousFindings = structuredClone(x.findings);
    Object.assign(f, patch); action(x, "RECONCILE_FINDINGS");
  }
  const x = sample(); const f = finding(x); x.previousFindings = structuredClone(x.findings);
  f.blocksResume = false;
  f.blockingChange = {previous: true, next: false, decision: "fixture:scope-decision", evidence: "fixture:independent-boundary"};
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
});

test("named repair owner is insufficient when its lease is absent, closed or duplicated", () => {
  for (const state of ["CLOSED", "RETURNED", "UNKNOWN"]) {
    const x = sample(); finding(x, "repository-custody", false); x.repairLeases[0].state = state;
    action(x, "RECONCILE_REPAIR_OWNER");
  }
  const x = sample(); finding(x, "repository-custody", false); x.repairLeases = [];
  action(x, "RECONCILE_REPAIR_OWNER");
  const y = sample(); finding(y, "repository-custody", false); y.repairLeases.push({...y.repairLeases[0]});
  action(y, "RECONCILE_REPAIR_OWNER");
});

test("owner transfer requires an observed continuing lease and invalidates prior acceptance", () => {
  const x = sample(); const f = finding(x, "repository-custody", false);
  x.previousFindings = structuredClone(x.findings); approved(x);
  f.transfer = {fromOwner: f.owner, toOwner: "new-owner", fromWork: f.work, toWork: "new-work",
    decision: "fixture:transfer", evidence: "fixture:handoff"};
  f.owner = "new-owner"; f.work = "new-work";
  action(x, "RECONCILE_REPAIR_OWNER");
  Object.assign(x.repairLeases[0], {owner: f.owner, work: f.work});
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
});

test("closed repair requires independent evidence on current inventory revision", () => {
  const x = sample(); const f = finding(x); f.status = "CLOSED";
  action(x, "RECONCILE_FINDINGS");
  Object.assign(f, {proof: "fixture:repair-proof", reviewedBy: f.owner, checkedRevision: x.inventory.revision});
  action(x, "RECONCILE_FINDINGS");
  f.reviewedBy = "independent"; f.checkedRevision = "old"; action(x, "RECONCILE_FINDINGS");
  f.checkedRevision = x.inventory.revision;
  x.inventory.rows.find(r => r.area === f.area).status = "VERIFIED";
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
});

test("a clean label cannot conceal open debt", () => {
  const x = sample(); finding(x);
  x.inventory.rows.find(r => r.area === "repository-custody").status = "VERIFIED";
  action(x, "RECONCILE_FINDINGS");
});

test("whole-project mapping and modularity gaps remain explicitly owned", () => {
  const x = sample(); x.readiness.architecture.coverage[0].modularity = "PARTIAL";
  x.readiness.architecture.coverage[0].followUp = "existing-maintenance";
  x.readiness.architecture.proposal = {source: "fixture:proposal", disposition: "PROPOSED"};
  action(x, "ASSIGN_EXISTING_MAINTENANCE");
  finding(x, "successes-and-modules", false);
  action(x, "FINISH_EXISTING_ADOPTION");
});

test("existing adoption route remains required even when recovery prose says ready", () => {
  const x = sample(); x.readiness.accepted.routeProof.nextRetrieval = "";
  action(x, "FINISH_EXISTING_ADOPTION");
});

test("assisted historical output is retained but never declared autonomous", () => {
  for (const status of ["ASSISTED", "UNVERIFIED"]) {
    const x = sample(); x.preservation.successes[0].status = status;
    action(x, "PROVE_RETAINED_SUCCESSES");
  }
});

test("independent recovery review is bound to all observed evidence", () => {
  const x = approved(sample()); action(x, "PREPARE_PRODUCTIVE_RESUME");
  x.inventory.revision = "changed"; action(x, "INDEPENDENT_RECOVERY_REVIEW");
  const y = approved(sample()); y.review.reviewer = y.owner;
  action(y, "INDEPENDENT_RECOVERY_REVIEW");
});

test("changing recovery owner or reached boundary invalidates the prior review", () => {
  for (const mutate of [x => x.owner = "replacement-owner",
    x => x.boundary.checkpoint = "different-task-return",
    x => x.boundary.evidence = "different-boundary-observation"]) {
    const x = approved(sample()); mutate(x);
    action(x, "INDEPENDENT_RECOVERY_REVIEW");
  }
});

test("failed repair cannot disappear by clearing lastResult without a new decision", () => {
  const x = sample(); const f = finding(x, "repository-custody", false);
  Object.assign(f, {attempts: 1, lastResult: "FAILED"});
  x.previousFindings = structuredClone(x.findings);
  delete f.lastResult;
  action(x, "RECONCILE_FINDINGS");
});

test("malformed historical findings cannot reset the comparison baseline", () => {
  for (const field of ["attempts", "owner", "area", "status"]) {
    const x = sample(); finding(x, "repository-custody", false);
    x.previousFindings = structuredClone(x.findings);
    delete x.previousFindings[0][field];
    action(x, "RECONCILE_FINDINGS");
  }
});
test("sparse exported records are missing evidence, never a skipped check", () => {
  for (const rows of [Array(1), [undefined], [null]]) {
    for (const field of ["findings", "previousFindings"]) {
      const x = sample(); x[field] = rows; action(x, "RECONCILE_FINDINGS");
    }
    const x = sample(); x.preservation.successes = rows; action(x, "PRESERVE_BASELINE");
  }
  const x = sample(); delete x.inventory.rows[0]; action(x, "COMPLETE_DIAGNOSIS");
});

test("recovery rejects silent postponement even without a debt trend window", () => {
  const x = sample(); const f = finding(x, "repository-custody", false);
  f.reviewAt = "2026-10-06T11:00:00Z";
  x.previousFindings = structuredClone(x.findings); f.reviewAt = due;
  action(x, "RECONCILE_FINDINGS");
  f.reschedule = {previous: x.previousFindings[0].reviewAt, next: due,
    decision: "authorized-deferral", evidence: "fixture:decision"};
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
});

test("supplied debt cannot disappear from recovery findings even before it is overdue", () => {
  const x = sample(); const row = {id: "repair-1", criterion: "Preserve unique accepted work and reconcile custody",
    owner: "maintenance", evidence: "observed", origin: "INHERITED", originEvidence: "inventory",
    severity: "NORMAL", status: "OPEN", reviewAt: Date.parse(due), attempts: 0};
  x.debtProgress = {before: {scope: "project", evidence: "first", at: now - 100, items: [row]},
    after: {scope: "project", evidence: "second", at: now, items: [row]}, outcomes: [], stagnantWindows: 0,
    policy: {evidence: "accepted", windowMs: 100, maxStagnantWindows: 2}};
  action(x, "RECONCILE_FINDINGS");
  finding(x, "repository-custody", false);
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
  x.findings[0].criterion = "easier";
  action(x, "RECONCILE_FINDINGS");
});

test("old worker progress and report cannot certify a different continuation", () => {
  for (const mutate of [x => x.continuation.task = "different-task",
    x => x.continuation.owner = "different-worker",
    x => x.continuation.authority = "different-authority"]) {
    const x = approved(sample());
    x.continuation = {task: "next-dod", owner: "worker", authority: "fixture:authority",
      recoveryKey: x.review.key, workerReadback: "fixture:packet", observedProgress: "fixture:progress"};
    x.continuation.bindingKey = continuationEvidenceKey(x);
    x.humanReport = "fixture:report"; x.reportKey = x.continuation.bindingKey;
    action(x, "RECORDED_RECOVERY_COMPLETE");
    mutate(x); action(x, "PREPARE_PRODUCTIVE_RESUME");
  }
});

test("recovery cannot hide an adverse independently supplied debt window", () => {
  const x = approved(sample());
  x.debtProgress = {before: {scope: "other"}, after: {scope: "other"}};
  action(x, "REVIEW_DEBT_TREND");
  const row = {id: "old", criterion: "original", owner: "maintenance", evidence: "observed", origin: "INHERITED",
    originEvidence: "initial-inventory", severity: "NORMAL", status: "DEFERRED", reviewAt: 1000, attempts: 0};
  x.debtProgress = {before: {scope: "project", evidence: "first", at: 100, items: [row]},
    after: {scope: "project", evidence: "second", at: 200, items: [row]}, outcomes: [], stagnantWindows: 1,
    policy: {evidence: "accepted", windowMs: 100, maxStagnantWindows: 2}};
  action(x, "REVIEW_DEBT_TREND");
  assert.equal(check(x).trend.action, "PRIORITY_REVIEW");
});

test("unrelated historical recovery remains owned without holding an independent product step", () => {
  const x = sample(); Object.assign(x.preservation.successes[0], {status: "ASSISTED", requiredForResume: false});
  action(x, "ASSIGN_EXISTING_MAINTENANCE");
  finding(x, "successes-and-modules", false).successIds = ["public-use"];
  action(x, "INDEPENDENT_RECOVERY_REVIEW");
});

test("planned resume is not actual continuation or delivered human result", () => {
  const x = approved(sample());
  x.continuation = {task: "next-dod", owner: "worker", authority: "fixture:current-authority",
    recoveryKey: x.review.key, workerReadback: "fixture:current-packet"};
  x.continuation.bindingKey = continuationEvidenceKey(x);
  action(x, "VERIFY_ACTUAL_CONTINUATION");
  x.continuation.observedProgress = "fixture:first-accepted-progress";
  action(x, "DELIVER_RECOVERY_REPORT");
  x.humanReport = "fixture:report"; x.reportKey = x.continuation.bindingKey;
  action(x, "RECORDED_RECOVERY_COMPLETE");
});

test("nonblocking owned debt stays visible after productive resume and is reviewed when due", () => {
  const x = sample(); finding(x, "repository-custody", false); approved(x);
  x.continuation = {task: "next-dod", owner: "worker", authority: "fixture:authority", recoveryKey: x.review.key,
    workerReadback: "fixture:packet", observedProgress: "fixture:actual-progress"};
  x.continuation.bindingKey = continuationEvidenceKey(x);
  x.humanReport = "fixture:report"; x.reportKey = x.continuation.bindingKey;
  const result = check(x);
  assert.equal(result.action, "RECORDED_RESUME_WITH_DEBT");
  assert.equal(result.debt[0].owner, "maintenance");
  x.findings[0].reviewAt = "2026-10-06T11:00:00Z";
  x.repairLeases[0].reviewAt = x.findings[0].reviewAt;
  action(x, "REVIEW_DUE_DEBT");
});

test("real disposable Git workspace: assessment never deletes unique dirty work; rehearsal retains public success", async t => {
  const dir = await mkdtemp(path.join(tmpdir(), "recovery-rehearsal-"));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const git = (...args) => execFileSync("git", args, {cwd: dir, encoding: "utf8"}).trim();
  git("init", "--quiet"); git("config", "user.name", "Fixture"); git("config", "user.email", "fixture@example.invalid");
  await writeFile(path.join(dir, "public-module.mjs"), "export const calculate = n => n * 2;\n");
  git("add", "."); git("-c", "commit.gpgsign=false", "commit", "--quiet", "-m", "Retained baseline");
  const baseline = git("rev-parse", "HEAD");
  git("branch", "historical-success");
  await writeFile(path.join(dir, "unique-notes.txt"), "uncommitted decision, must survive\n");
  const before = git("status", "--porcelain"), refs = git("show-ref");
  const x = sample(); x.preservation.baseline = baseline;
  x.preservation.successes[0].artifact = baseline;
  finding(x).evidence = `Git status: ${before}; refs: ${refs}`;
  action(x, "REPAIR_BEFORE_DEPENDENT_RESUME");
  assert.equal(git("status", "--porcelain"), before); assert.equal(git("show-ref"), refs);
  // The test owns this scratch repair. The assessor neither performs nor authorizes it.
  await writeFile(path.join(dir, "custody.json"), JSON.stringify({branch: "historical-success",
    revision: baseline, owner: "maintenance", reason: "Retain baseline and unique notes", reviewAt: due}));
  const custody = JSON.parse(await readFile(path.join(dir, "custody.json"), "utf8"));
  assert.equal(custody.revision, baseline);
  const output = execFileSync(process.execPath, ["--input-type=module", "-e",
    "import {calculate} from './public-module.mjs'; if(calculate(3)!==6 || calculate(7)!==14) process.exit(1); console.log('public-use-pass')"],
  {cwd: dir, encoding: "utf8"}).trim();
  assert.equal(output, "public-use-pass");
  assert.equal(await readFile(path.join(dir, "unique-notes.txt"), "utf8"), "uncommitted decision, must survive\n");
  assert.equal(git("show-ref"), refs);
  assert.equal(check(x).semanticAcceptance, "NOT_ESTABLISHED");
});
