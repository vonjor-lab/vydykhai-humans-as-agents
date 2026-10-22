import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds, postAcceptKey} from "../scripts/post-accept.mjs";
import {sha256, canonicalJson} from "../scripts/memory-brief.mjs";
import {catalog, assessReview, newCycle, advance, healthDecision, reconcileFindings}
  from "./fixtures/framework-v2/reference-cycle.mjs";

const packet = {task: "task-1", scope: "scope-1", baseline: "commit-1",
  module: "module-1", memory: "memory-1", policy: "policy-1"};
const actors = {owner: "manager", preparer: "preparer", executor: "worker"};
const required = ["C01", "C04", "C05", "C06", "C19", "C20"];
const review = () => ({actor: "independent", binding: {...packet}, rows: catalog.map(id =>
  required.includes(id) ? {id, status: "PASS", evidence: `fixture:${id}`} :
    {id, status: "NOT_APPLICABLE", reason: "Trusted scenario selection, not semantic proof"})});
const initial = () => newCycle(packet, required, actors);
const prepared = () => advance(initial(), "prepare", {review: review()}).cycle;
const running = () => advance(prepared(), "start", {
  authorized: true, current: packet, workerReadback: packet}).cycle;
const proof = () => ({review: review(), retainedBehavior: true, promisedBehavior: true, exactRuntime: true});
const verified = () => advance(running(), "verify", proof()).cycle;
const retention = () => ({requiredDocs: true, requiredMemory: true, requiredTracker: true,
  receipt: "return-1", dispositions: [
    {artifact: "temporary-runtime", status: "CLEANED", evidence: "fixture:shutdown"},
    {artifact: "branch-with-unique-work", status: "RETAINED", evidence: "fixture:inventory",
      owner: "maintenance", reason: "Preserve unique work", due: "2026-10-07T12:00:00Z"}
  ]});
const retained = () => advance(verified(), "retain", retention()).cycle;
function productAcceptance() {
  const ref = name => ({path: name, sha256: sha256(name)});
  return {schema: "work.product-acceptance.v1", id: "accept-1", project: "project", task: packet.task,
    owner: actors.owner, executor: actors.executor, status: "ACCEPTED", acceptedAt: "2026-10-06T10:00:00Z",
    producerReturn: ref("return-1"), artifact: ref("artifact"), technicalProof: ref("test"), goal: ref("goal"),
    retention: retentionKinds.map(id => ({id, required: true, expected: ref(id)}))};
}
function postControl(acceptance) {
  const x = {acceptance, policy: sha256("policy"), previousFindings: [], repairLeases: [],
    observation: acceptance.retention.map(r => ({id: r.id, status: "MATCH", sha256: r.expected.sha256}))};
  x.review = {key: postAcceptKey(x), phase: "POST_ACCEPT", reviewer: "fresh-post-review", runId: "new-run",
    resultUse:{status:"ALLOW",acceptanceSha256:sha256(canonicalJson(acceptance)),evidence:"fixture:independent-result",findingIds:[]},
    observedAt: "2026-10-06T10:01:00Z", findings: [],
    rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: `fixture:${id}`}))};
  x.disposition = {owner: actors.owner, reviewKey: sha256(canonicalJson(x.review)),
    action: "CONTINUE", evidence: "fixture:response", nextAction: "task-2", continuationEvidence: "fixture:started-next"};
  return x;
}
const reject = (result, reason) => {assert.equal(result.ok, false); assert.equal(result.reason, reason);};
const health = () => ({now: 100, dueAt: 100, observedAt: 95, maxAgeMs: 10,
  incidentId: "health-1", consumed: [], budget: 1});

test("complete cycle retains result, debt and exact owner consumption; duplicate is quiet", () => {
  const retainedCycle = retained();
  const result = advance(retainedCycle, "consume", {
    consumer: actors.owner, receipt: "return-1", nextAction: "Authorized next increment", acceptance: productAcceptance()});
  assert.equal(result.ok, true);
  assert.equal(result.cycle.stage, "ACCEPTED_CONTROL_DUE");
  assert.equal(result.cycle.dispositions[1].owner, "maintenance");
  assert.equal(retainedCycle.stage, "RETAINED");
  assert.deepEqual(result.cycle.history, ["prepare", "start", "verify", "retain", "consume"]);
  const again = advance(result.cycle, "consume", {consumer: actors.owner, receipt: "return-1"});
  assert.equal(again.action, "QUIET");
  assert.equal(again.cycle, result.cycle);
  const finished = advance(result.cycle, "postAccept", {control: postControl(result.cycle.acceptance)});
  assert.equal(finished.ok, true); assert.equal(finished.cycle.stage, "CLOSED");
  assert.equal(finished.cycle.history.at(-1), "postAccept");
});

test("orchestrator acceptance cannot replace the later independent control", () => {
  const accepted = advance(retained(), "consume", {consumer: actors.owner, receipt: "return-1",
    nextAction: "task-2", acceptance: productAcceptance()}).cycle;
  const control = postControl(accepted.acceptance); delete control.review;
  reject(advance(accepted, "postAccept", {control}), "POST_ACCEPT_REVIEW_DUE");
  const stale = postControl(accepted.acceptance); stale.acceptance = {...stale.acceptance, task: "other"};
  reject(advance(accepted, "postAccept", {control: stale}), "ACCEPTANCE_MISMATCH");
  reject(advance(retained(), "postAccept", {control}), "INVALID_TRANSITION");
  reject(advance(retained(), "consume", {consumer: actors.owner, receipt: "return-1", nextAction: "task-2"}),
    "PRODUCT_ACCEPTANCE_REQUIRED");
});

test("review requires every catalog item exactly once", () => {
  for (const mutate of [r => r.rows.pop(), r => r.rows[27] = {...r.rows[0]},
    r => r.rows[27].id = "C99"]) {
    const r = review(); mutate(r);
    reject(assessReview(r, packet, required, []), "INCOMPLETE_CATALOG");
  }
});

test("required meaning cannot be marked skipped, unknown, or evidence-free", () => {
  for (const patch of [{status: "NOT_APPLICABLE", reason: "Pressure"},
    {status: "UNKNOWN"}, {evidence: " "}]) {
    const r = review(); Object.assign(r.rows[0], patch);
    reject(assessReview(r, packet, required, []), "UNCOVERED:C01");
  }
  const r = review(); r.rows[1].reason = "";
  reject(assessReview(r, packet, required, []), "UNJUSTIFIED_SKIP:C02");
});

test("invalid relevance selection and review by any producer fail", () => {
  for (const selection of [["C99"], ["C01", "C01"], null])
    reject(assessReview(review(), packet, selection, []), "INVALID_SELECTION");
  for (const actor of Object.values(actors))
    reject(advance(initial(), "prepare", {review: {...review(), actor}}), "NOT_INDEPENDENT");
});

for (const key of Object.keys(packet)) {
  test(`changed ${key} invalidates review, dispatch and continuation`, () => {
    const changed = {...packet, [key]: "changed"};
    reject(assessReview({...review(), binding: changed}, packet, required, []), "STALE_BINDING");
    reject(advance(prepared(), "start", {authorized: true, current: changed,
      workerReadback: packet}), "REPREPARE_CHANGED_SCOPE");
    reject(advance(running(), "continue", {authorized: true, current: changed}), "REPREPARE_CHANGED_SCOPE");
  });
}

test("worker must apply current packet; valid repeat avoids another review", () => {
  reject(advance(prepared(), "start", {authorized: true, current: packet}), "WORKER_READBACK_REQUIRED");
  const result = advance(running(), "continue", {authorized: true, current: packet});
  assert.equal(result.action, "CONTINUE_WITHOUT_REVIEW");
  assert.equal(result.cycle.stage, "RUNNING");
});

test("pause, unknown effect and missing authority do not mutate state", () => {
  const before = prepared(); const snapshot = structuredClone(before);
  reject(advance(before, "start", {paused: true}), "PAUSED");
  reject(advance(before, "start", {externalUnknown: true}), "RECONCILE_EXTERNAL_OUTCOME");
  for (const authorized of [undefined, false, "true"])
    reject(advance(before, "start", {authorized, current: packet, workerReadback: packet}), "AUTHORITY_REQUIRED");
  assert.deepEqual(before, snapshot);
});

test("stage skipping and incomplete bindings fail", () => {
  reject(advance(initial(), "retain", retention()), "INVALID_TRANSITION");
  reject(advance(running(), "consume", {receipt: "return-1"}), "INVALID_TRANSITION");
  reject(advance(newCycle({...packet, memory: ""}, required, actors), "prepare", {review: review()}), "MISSING_BINDING");
});

test("new behavior alone, old behavior alone or different runtime cannot pass", () => {
  for (const key of ["retainedBehavior", "promisedBehavior", "exactRuntime"])
    for (const value of [false, undefined, "PASS"])
      reject(advance(running(), "verify", {...proof(), [key]: value}), "BEHAVIOR_NOT_PROVEN");
  reject(advance(running(), "verify", {...proof(), review: {...review(), actor: actors.executor}}), "NOT_INDEPENDENT");
});

test("required docs, memory and tracker cannot be lost as optional aftercare", () => {
  for (const key of ["requiredDocs", "requiredMemory", "requiredTracker"])
    for (const value of [false, undefined, "done"])
      reject(advance(verified(), "retain", {...retention(), [key]: value}), "RETENTION_INCOMPLETE");
  reject(advance(verified(), "retain", {...retention(), receipt: ""}), "RETURN_REQUIRED");
});

test("cleanup or owned retention is required, never delete by branch count", () => {
  reject(advance(verified(), "retain", {...retention(), dispositions: []}), "CUSTODY_REQUIRED");
  const r = retention(); r.dispositions[1].owner = "";
  reject(advance(verified(), "retain", r), "RETAINED_OWNER_REQUIRED");
  const unproven = retention(); unproven.dispositions[0].evidence = "";
  reject(advance(verified(), "retain", unproven), "CUSTODY_UNPROVEN");
});

test("delivered Return is not consumed until correct owner and next action", () => {
  reject(advance(retained(), "consume", {consumer: "other", receipt: "return-1"}), "CONSUMPTION_MISMATCH");
  reject(advance(retained(), "consume", {consumer: actors.owner, receipt: "other"}), "CONSUMPTION_MISMATCH");
  reject(advance(retained(), "consume", {consumer: actors.owner, receipt: "return-1"}), "NEXT_ACTION_REQUIRED");
});

test("health becomes due without any manager or task completion input", () => {
  assert.equal(healthDecision(health()).action, "REVIEW_DUE");
  assert.equal(healthDecision({...health(), dueAt: 200}).action, "QUIET");
  assert.equal(healthDecision({...health(), dueAt: 200, signal: true}).action, "REVIEW_DUE");
});

test("unknown, stale and future observations are never healthy", () => {
  for (const patch of [{observedAt: undefined}, {observedAt: 1}, {observedAt: 101},
    {dueAt: NaN}, {maxAgeMs: -1}])
    assert.equal(healthDecision({...health(), ...patch}).action, "UNKNOWN_OBSERVATION");
});

test("health deduplicates, preserves pause and requires enrollment/budget", () => {
  assert.equal(healthDecision({...health(), consumed: ["health-1"]}).action, "QUIET");
  assert.equal(healthDecision({...health(), paused: true}).action, "PAUSED");
  assert.equal(healthDecision({...health(), incidentId: ""}).action, "MISSING_ENROLLMENT");
  for (const budget of [0, -1, NaN])
    assert.equal(healthDecision({...health(), budget}).action, "BUDGET_DECISION");
});

const debt = () => [1, 2].map(i => ({id: `finding-${i}`, criterion: `original-${i}`,
  status: "OPEN", owner: "repair", due: "2026-10-07T12:00:00Z"}));

test("repair closes only proven finding and preserves original remaining debt", () => {
  const previous = debt(); const incoming = debt();
  incoming[0] = {...incoming[0], status: "CLOSED", evidence: "fixture:repair-recheck"};
  const result = reconcileFindings(previous, incoming, "independent", "repair");
  assert.equal(result.ok, true); assert.deepEqual(result.findings[1], previous[1]);
  assert.equal(previous[0].status, "OPEN");
});

test("context reset cannot drop findings, change criteria or self-close", () => {
  reject(reconcileFindings(debt(), debt().slice(1), "independent", "repair"), "LOST_CRITERION");
  const changed = debt(); changed[0].criterion = "easier";
  reject(reconcileFindings(debt(), changed, "independent", "repair"), "LOST_CRITERION");
  reject(reconcileFindings(debt(), debt(), "repair", "repair"), "NOT_INDEPENDENT");
  const closed = debt(); closed[0].status = "CLOSED";
  reject(reconcileFindings(debt(), closed, "independent", "repair"), "REPAIR_UNPROVEN");
  const duplicate = debt(); duplicate[1] = duplicate[0];
  reject(reconcileFindings(debt(), duplicate, "independent", "repair"), "DUPLICATE_FINDING");
});

test("all 28 design responsibilities have qualification rows with honest pending proof", () => {
  const design = readFileSync(new URL("../docs/design/independent-control-v2.md", import.meta.url), "utf8");
  const plan = readFileSync(new URL("../docs/design/framework-v2-qualification-rollout.md", import.meta.url), "utf8");
  for (const text of [design, plan])
    assert.deepEqual([...text.matchAll(/^\| (C\d{2}) \|/gm)].map(m => m[1]), catalog);
  assert.match(plan, /NOT[ _]RUN|NOT_COMPLETED|NOT_PROVEN/);
  assert.match(plan, /trusted fixture/);
});
