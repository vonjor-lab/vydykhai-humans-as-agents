import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, writeFile, readFile, rm, symlink, access, realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {controlCatalog, controlCheckIds, checkControlCoverage, phaseControlIds, controlPhaseOwnership} from "../scripts/control-catalog.mjs";
import {sha256, canonicalJson} from "../scripts/memory-brief.mjs";
import {createReturnSync, validateDurableOutbox} from "../scripts/vydykhai.mjs";
import {validProductAcceptance, recordProductAcceptance, readProductAcceptance,
  observeRetention, postAcceptKey, assessPostAccept, retentionKinds, reviewedResultUse} from "../scripts/post-accept.mjs";

const hash = value => sha256(canonicalJson(value));
const ref = name => ({path: `${name}.md`, sha256: sha256(name)});
const rows = () => controlCheckIds.map(id => ({id, status: "PASS", evidence: `fixture:${id}`}));
function acceptance() {
  return {schema: "work.product-acceptance.v1", id: "task-one", project: "project", task: "task-1",
    owner: "orchestrator", executor: "worker", status: "ACCEPTED", acceptedAt: "2026-10-06T10:00:00Z",
    producerReturn: ref("return"), artifact: ref("artifact"), technicalProof: ref("test"), goal: ref("goal"),
    retention: retentionKinds.map(id => ({id, required: true, expected: ref(id)}))};
}
function sample() {
  const a = acceptance();
  return {acceptance: a, policy: sha256("policy"), previousFindings: [], repairLeases: [],
    observation: a.retention.map(r => ({id: r.id, status: "MATCH", sha256: r.expected.sha256}))};
}
function review(x, findings = []) {
  x.review = {phase: "POST_ACCEPT", key: postAcceptKey(x), reviewer: "fresh-reviewer", runId: "fresh-run",
    resultUse:{status:"ALLOW",acceptanceSha256:hash(x.acceptance),evidence:"fixture:independent-result-judgment",findingIds:[]},
    observedAt: "2026-10-06T10:02:00Z", rows: rows(), findings};
  return x;
}
function disposition(x) {
  x.disposition = {owner: x.acceptance.owner, reviewKey: hash(x.review), evidence: "fixture:owner-response",
    action: "CONTINUE", nextAction: "task-2", continuationEvidence: "fixture:next-lease-and-progress"};
  return x;
}
function finding(x, checkId = "C16.03", blocking = true) {
  const f = {id: "finding-1", checkId, area: checkId.split(".")[0],
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === checkId).criterion,
    evidence: "fixture:missing-write", owner: "maintenance", work: "repair-1", status: "OPEN",
    firstSeen: "2026-10-06T10:01:00Z", reviewAt: "2026-10-07T10:00:00Z", attempts: 0, blocksResume: blocking};
  x.review.findings.push(f);
  Object.assign(x.review.rows.find(r => r.id === checkId),
    {status: "FINDING", reason: "Required evidence absent", findingId: f.id});
  x.repairLeases.push({owner: f.owner, work: f.work, state: "WORKING", checkpoint: "repair-return",
    reviewAt: f.reviewAt, evidence: "fixture:existing-lease"});
  return f;
}
const action = (x, expected) => assert.equal(assessPostAccept(x).action, expected);

test('phase coverage binds the stage, retains all old findings and never supplies omitted PASS rows',()=>{
  for(const preparation of [undefined,{kind:'PREPARED_PACKAGE_NOT_TASK_OUTPUT'}]) {
    const x=review({...sample(),reviewPolicy:'PHASED_V1',...(preparation?{preparation}:{})});
    const ids=phaseControlIds(x);assert.equal(ids.length,preparation?45:59);
    x.review.rows=x.review.rows.filter(r=>ids.includes(r.id));disposition(x);
    action(x,'CONTROL_CONFIRMED');
    assert.equal(checkControlCoverage(x.review.rows).ok,false);
    assert.equal(checkControlCoverage(x.review.rows,ids).ok,true);
    for(const id of ['C05.02','C07.03','C19.01','C20.02','C16.03','C14.02','C18.01','C12.03'])assert.ok(ids.includes(id));
    const partial=structuredClone(x);partial.review.rows.pop();disposition(partial);action(partial,'RECONCILE_REVIEW');
    const changed=structuredClone(x);delete changed.reviewPolicy;action(changed,'POST_ACCEPT_REVIEW_DUE');
    const retained=phaseControlIds({...x,previousFindings:[{checkId:'C22.01',status:'OPEN'}]});
    assert.ok(retained.includes('C22.01'));
    const negative=structuredClone(x);finding(negative,'C19.01',false);
    negative.review.resultUse={...negative.review.resultUse,status:'REJECT',findingIds:['finding-1']};
    disposition(negative);action(negative,'RESULT_USE_REJECTED');
    const missingScope=structuredClone(x);finding(missingScope,'C24.02',false);
    disposition(missingScope);action(missingScope,'RECONCILE_REVIEW');
  }
  assert.equal(Object.keys(controlPhaseOwnership).length,87);
  assert.ok(Object.values(controlPhaseOwnership).every(p=>p.includes('HEALTH')));
  assert.deepEqual(phaseControlIds(),controlCheckIds);
  assert.throws(()=>phaseControlIds({reviewPolicy:'SHORTCUT'}),/POLICY_INVALID/);
});

test("result-use decision is pinned, explicit and consistent; advisory debt alone does not reject it", () => {
  const x=review(sample());assert.equal(reviewedResultUse(x.review,x.acceptance),"ALLOW");
  finding(x,"C08.01",false);assert.equal(reviewedResultUse(x.review,x.acceptance),"ALLOW");
  disposition(x);action(x,"CONTROL_CONFIRMED");
  for(const mutate of [d=>d.acceptanceSha256=sha256("another acceptance"),d=>d.findingIds=["missing"],
    d=>d.status="PASS",d=>d.evidence="",d=>d.extra=true]) {
    const bad=structuredClone(x.review);mutate(bad.resultUse);
    assert.equal(reviewedResultUse(bad,x.acceptance),"INVALID");
  }
  const negative=review(sample());finding(negative,"C19.01",false);
  assert.equal(reviewedResultUse(negative.review,negative.acceptance),"INVALID");
  for(const id of ["C07.03","C19.01"])for(const status of ["FINDING","UNKNOWN","DEFERRED"]) {
    const contradictory=review(sample());
    contradictory.review.rows.find(row=>row.id===id).status=status;
    assert.equal(reviewedResultUse(contradictory.review,contradictory.acceptance),"INVALID");
  }
  negative.review.resultUse={...negative.review.resultUse,status:"REJECT",findingIds:["finding-1"]};
  disposition(negative);action(negative,"RESULT_USE_REJECTED");
  const legacy=review(sample());delete legacy.review.resultUse;
  disposition(legacy);action(legacy,"RESULT_USE_UNPROVEN");
  assert.equal(legacy.review.resultUse,undefined);
});
async function storage(t) {
  const root = await mkdtemp(path.join(tmpdir(), "vydykhai-post-accept-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  return realpath(root);
}

test("operational catalog has 28 unique groups and every authority source exists", async () => {
  assert.equal(controlCatalog.length, 28);
  assert.equal(new Set(controlCheckIds).size, controlCheckIds.length);
  for (const group of controlCatalog) {
    assert.ok(group.checks.length >= 2);
    await access(new URL(`../${group.source}`, import.meta.url));
  }
  assert.deepEqual(checkControlCoverage(rows()), {ok: true, semanticAcceptance: "NOT_ESTABLISHED"});
});

test("catalog forbids forgotten, duplicate, sparse or unjustifiably excluded criteria", () => {
  for (const mutate of [r => r.pop(), r => r[0] = r[1], r => delete r[0],
    r => r[0].id = "C99.01", r => r[0].status = "DONE", r => r[0].evidence = "",
    r => r[0].status = "NOT_APPLICABLE", r => Object.assign(r[0], {status: "UNKNOWN", reason: "Unknown"})]) {
    const r = rows(); mutate(r); assert.equal(checkControlCoverage(r).ok, false);
  }
  const r = rows(); Object.assign(r[0], {status: "NOT_APPLICABLE", reason: "Explicit scope exclusion"});
  assert.equal(checkControlCoverage(r).ok, true);
});

test("product acceptance is not technical verification or a manager self-run", () => {
  assert.equal(validProductAcceptance(acceptance()), true);
  for (const patch of [{status: "VERIFIED"}, {executor: "orchestrator"}, {id: "../escape"}, {id: 1}, {id: undefined}, {retention: []}])
    assert.equal(validProductAcceptance({...acceptance(), ...patch}), false);
  const a = acceptance(); delete a.retention[0]; assert.equal(validProductAcceptance(a), false);
});

test("acceptance atomically enrolls canonical Return, survives reload and is idempotent", async t => {
  const root = await storage(t), a = acceptance();
  const first = await recordProductAcceptance(root, a, {createReturnSync});
  assert.equal(first.status, "RECORDED");
  assert.equal(first.controlClosure, "NOT_CONFIRMED");
  assert.deepEqual(await readProductAcceptance(first.file, {validateDurableOutbox}), a);
  assert.equal((await recordProductAcceptance(root, a, {createReturnSync})).status, "REUSED");
  const outbox = validateDurableOutbox(await readFile(first.file, "utf8"));
  assert.deepEqual(outbox.issues, [`Durable outbox: return ${first.receiptId} requires routing`]);
  assert.deepEqual(outbox.pendingReturnIds, [first.receiptId]); assert.equal(outbox.returns.length, 1);
  assert.equal(outbox.returns[0].id, first.receiptId);
  await assert.rejects(recordProductAcceptance(root, {...a, artifact: ref("changed")}, {createReturnSync}), /CONFLICT/);
  assert.deepEqual(await readProductAcceptance(first.file, {validateDurableOutbox}), a);
});

test("reader rejects tampered enrollment, duplicate acceptance and symlink storage", async t => {
  const root = await storage(t), a = acceptance();
  const stored = await recordProductAcceptance(root, a, {createReturnSync});
  const original = await readFile(stored.file, "utf8");
  await writeFile(stored.file, original.replace(stored.receiptId, "wrong-receipt"));
  await assert.rejects(readProductAcceptance(stored.file, {validateDurableOutbox}), /ENROLLMENT/);
  await writeFile(stored.file, original.replace("Status: CHECKPOINT_READY", "Status: PASS"));
  await assert.rejects(readProductAcceptance(stored.file, {validateDurableOutbox}), /ENROLLMENT/);
  await writeFile(stored.file, original + original);
  await assert.rejects(readProductAcceptance(stored.file, {validateDurableOutbox}), /RECORD_MISSING/);
  await writeFile(stored.file, original);
  const linked = path.join(root, "link.md"); await symlink(stored.file, linked);
  await assert.rejects(readProductAcceptance(linked, {validateDurableOutbox}), /INVALID_ACCEPTANCE_FILE/);
  await assert.rejects(readProductAcceptance(stored.file), /ADAPTER_REQUIRED/);
});

test("retention checks actual bytes and keeps missing and stale evidence distinct", async t => {
  const root = await storage(t), a = acceptance();
  await writeFile(path.join(root, "memory.md"), "memory");
  await writeFile(path.join(root, "map.md"), "old-map");
  a.retention[3] = {id: "custody", required: false, reason: "No task artifacts"};
  const observed = await observeRetention(root, a);
  assert.deepEqual(observed.map(o => o.status), ["MATCH", "MISMATCH", "MISSING", "NOT_REQUIRED"]);
  a.retention[0].expected.path = "../outside.md";
  await assert.rejects(observeRetention(root, a), /UNSAFE_RETENTION_PATH/);
  a.retention[0].expected.path = "memory-link.md";
  await symlink(path.join(root, "memory.md"), path.join(root, "memory-link.md"));
  await assert.rejects(observeRetention(root, a), /UNSAFE_RETENTION_PATH/);
});

test("accepted work waits for independent post-accept review and actual manager disposition", () => {
  const x = sample(); action(x, "POST_ACCEPT_REVIEW_DUE");
  review(x); action(x, "AWAIT_ORCHESTRATOR_DISPOSITION");
  x.disposition = {read: true}; action(x, "AWAIT_ORCHESTRATOR_DISPOSITION");
  disposition(x); action(x, "CONTROL_CONFIRMED");
  const result = assessPostAccept(x);
  assert.equal(result.productAcceptance, "PRESERVED");
  assert.equal(result.mutationAuthorized, false);
  assert.equal(result.semanticAcceptance, "HOST_AND_REVIEW_REQUIRED");
});

test("legacy verdict cannot close a failed repair without a new independently authorized attempt", () => {
  const x = review(sample()), old = {...finding(x), attempts: 1, lastResult: "FAILED"};
  x.previousFindings = [old];
  const closed = {...old, status: "CLOSED", proof: "claimed current repair", reviewedBy: "fresh-reviewer",
    checkedKey: postAcceptKey(x)};
  disposition(review(x, [closed]));
  action(x, "RECONCILE_FINDINGS");
  closed.attempts = 2; closed.lastResult = "PASSED";
  disposition(review(x, [closed])); action(x, "RECONCILE_FINDINGS");
  closed.retryDecisions = [{fromAttempt: 1, toAttempt: 2, previousResult: "FAILED",
    reviewedBy: "fresh-reviewer", decision: "Bounded repair approved", evidence: "independent transition proof"}];
  disposition(review(x, [closed])); action(x, "CONTROL_CONFIRMED");
});

test("pre-accept, reused or owner-authored verdicts cannot close the cycle", () => {
  for (const patch of [{reviewer: "orchestrator"}, {reviewer: "worker"}, {runId: ""},
    {phase: "TECHNICAL"}, {observedAt: "2026-10-06T09:00:00Z"}, {key: sha256("old")}]) {
    const x = disposition(review(sample())); Object.assign(x.review, patch);
    action(x, "POST_ACCEPT_REVIEW_DUE");
  }
  const x = disposition(review(sample())); x.policy = sha256("new-policy");
  action(x, "POST_ACCEPT_REVIEW_DUE");
});

test("all criteria are considered and a failed memory write cannot receive a green verdict", () => {
  const x = disposition(review(sample())); x.review.rows.pop(); action(x, "RECONCILE_REVIEW");
  const y = sample(); y.observation[0] = {id: "memory", status: "MISSING"};
  disposition(review(y)); action(y, "RECONCILE_REVIEW");
  finding(y); disposition(y); action(y, "REPAIR_REQUIRED");
  assert.equal(assessPostAccept(y).productAcceptance, "PRESERVED");
});

test("open findings cannot disappear, change criterion, lose attempts or be verbally closed", () => {
  const x = review(sample()); const f = finding(x); x.previousFindings = [structuredClone(f)];
  for (const mutate of [r => r.findings.splice(0), r => r.findings[0].evidence = "rewritten",
    r => r.findings[0].blocksResume = false, r => r.findings[0].status = "CLOSED"]) {
    const y = structuredClone(x); y.review.key = postAcceptKey(y); mutate(y.review); disposition(y);
    action(y, "RECONCILE_FINDINGS");
  }
});

test("repair requires a live owner; unrelated owned debt need not block continuation", () => {
  const x = review(sample()); finding(x, "C12.01", false); disposition(x);
  action(x, "CONTROL_CONFIRMED"); assert.deepEqual(assessPostAccept(x).remainingDebt, ["finding-1"]);
  x.repairLeases[0].state = "CLOSED"; action(x, "RECONCILE_REPAIR_OWNER");
  x.repairLeases = []; action(x, "RECONCILE_REPAIR_OWNER");
});

test("independent repair readback closes the incident without discarding accepted work", () => {
  const x = review(sample()); const f = finding(x); x.previousFindings = [structuredClone(f)];
  x.review.key = postAcceptKey(x);
  Object.assign(f, {status: "CLOSED", proof: "fixture:actual-repaired-write", reviewedBy: x.review.reviewer,
    checkedKey: x.review.key, attempts: 1, lastResult: "PASSED"});
  x.review.rows = rows(); disposition(x); action(x, "CONTROL_CONFIRMED");
  x.previousFindings = structuredClone(x.review.findings);
  x.review.key = postAcceptKey(x); x.review.runId = "later-run";
  disposition(x); action(x, "CONTROL_CONFIRMED");
  f.proof = "changed-history"; disposition(x); action(x, "RECONCILE_FINDINGS");
});

test("pause, uncertain effect and planned-only continuation never establish completion", () => {
  const x = disposition(review(sample()));
  action({...x, paused: true}, "PRESERVE_PAUSE");
  action({...x, externalUnknown: true}, "RECONCILE_EXTERNAL_OUTCOME");
  delete x.disposition.continuationEvidence; action(x, "VERIFY_CONTINUATION");
  delete x.observation[0]; action(x, "OBSERVE_RETENTION");
});

test("independent counterexample: increasing attempts cannot authorize a repeated failed repair", () => {
  for (const lastResult of ["FAILED", "PASSED"]) {
    const x = review(sample()), f = finding(x, "C12.01", false);
    Object.assign(f, {attempts: 1, lastResult: "FAILED"}); x.previousFindings = [structuredClone(f)];
    Object.assign(f, {attempts: 2, lastResult}); x.review.key = postAcceptKey(x); disposition(x);
    action(x, "RECONCILE_FINDINGS");
    f.retryDecisions = [{fromAttempt: 1, toAttempt: 2, previousResult: "FAILED",
      decision: "fixture:changed-repair-approach", evidence: "fixture:changed-conditions", reviewedBy: "independent"}];
    disposition(x); action(x, "CONTROL_CONFIRMED");
    f.retryDecisions[0].reviewedBy = f.owner; disposition(x); action(x, "RECONCILE_FINDINGS");
  }
});

test("stored acceptance survives failed retention, repair and reload without repeating product work", async t => {
  const root = await storage(t), a = acceptance();
  for (const id of ["map", "tracker", "custody"])
    await writeFile(path.join(root, `${id}.md`), id);
  const stored = await recordProductAcceptance(root, a, {createReturnSync});
  const original = await readFile(stored.file, "utf8");
  const first = sample(); first.acceptance = await readProductAcceptance(stored.file, {validateDurableOutbox});
  first.observation = await observeRetention(root, first.acceptance);
  action(first, "POST_ACCEPT_REVIEW_DUE");
  review(first); const issue = finding(first); disposition(first);
  action(first, "REPAIR_REQUIRED");
  const verdictFile = path.join(root, "existing-review-result.json");
  await writeFile(verdictFile, JSON.stringify(first.review));

  // Host reloads retained evidence; the independent reviewer must still judge meaning.
  await writeFile(path.join(root, "memory.md"), "memory");
  const after = sample();
  after.acceptance = await readProductAcceptance(stored.file, {validateDurableOutbox});
  after.observation = await observeRetention(root, after.acceptance);
  after.previousFindings = JSON.parse(await readFile(verdictFile, "utf8")).findings;
  review(after); action(after, "RECONCILE_FINDINGS");
  after.review.findings = [{...issue, status: "CLOSED", proof: "fixture:readback-of-repaired-memory",
    reviewedBy: after.review.reviewer, checkedKey: postAcceptKey(after), attempts: 1, lastResult: "PASSED"}];
  action(after, "AWAIT_ORCHESTRATOR_DISPOSITION");
  disposition(after); action(after, "CONTROL_CONFIRMED");
  assert.equal(await readFile(stored.file, "utf8"), original);
  assert.equal((await recordProductAcceptance(root, a, {createReturnSync})).status, "REUSED");
});
