import test from "node:test";
import assert from "node:assert/strict";
import fs, {mkdtemp, mkdir, realpath, writeFile, readFile, rm, symlink} from "node:fs/promises";
import {syncBuiltinESMExports} from "node:module";
import {tmpdir} from "node:os";
import path from "node:path";
import {spawn, spawnSync} from "node:child_process";
import {openControlStore} from "../scripts/control-store.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openControlNotification} from "../scripts/control-notification.mjs";
import {notificationOwner} from "../scripts/control-notification-owner.mjs";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {openReviewProcess} from "../scripts/control-review-process.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {createReturnSync, parseDurableOutboxComment} from "../scripts/vydykhai.mjs";
import {controlCatalog, controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {modelReviewPrompt} from "../scripts/control-model-review.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
import {fixture, hash} from "./context-fixture.mjs";

const services = {createReturnSync, parseDurableOutboxComment};
async function setup(t, options) {
  const f = await fixture(t, options), p = await f.prepare();
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-control-")));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const config = {workspace: f.root, policy: sha256("candidate-policy"), owner: "owner", executor: "worker", reviewer: "reviewer"};
  if(options?.registeredEvidence) {
    config.evidenceRegistry=path.join(dir,"sources.json");
    await f.put("public-contract.md","accepted public contract");
    await writeFile(config.evidenceRegistry,JSON.stringify({schema:"control.review-sources.v1",workspace:f.root,
      sources:[{id:"contract",path:"public-contract.md",purpose:"Consumer contract separate from stored acceptance"}]}),{mode:0o600});
  }
  const host = await openControlHost(dir, config, services); await host.initialize();
  const binding = {operation: "resume", taskId: f.task.id, taskSha256: f.request.task.sha256,
    capsuleSha256: f.request.capsule.sha256, sourceDigest: p.coverageBasis.sourceDigest,
    dependencyDigest: p.coverageBasis.dependencyDigest, commandSha256: hash(f.task.action),
    cwd: f.root, executable: await realpath(process.execPath), kind: "dependent"};
  const ref = name => ({path: `${name}.md`, sha256: sha256(name)});
  const acceptance = {schema: "work.product-acceptance.v1", id: "previous", project: "project", task: "previous-task",
    owner: config.owner, executor: config.executor, status: "ACCEPTED", acceptedAt: new Date().toISOString(),
    producerReturn: ref("return"), artifact: ref("artifact"), technicalProof: ref("proof"), goal: ref("goal"),
    retention: retentionKinds.map(id => ({id, required: true, expected: ref(id)}))};
  for (const name of ["return", "artifact", "proof", "goal", ...retentionKinds]) await f.put(`${name}.md`, name);
  const approve = (dependencies = []) => host.approveCommand(binding, {reviewer: config.reviewer,
    reviewReceipt: "independent-preparation-proof", dependencies, expiresAt: Date.now() + 120000});
  const run = (h = host, extra = {}) => runControlledContextTransition({...f.request, operation: "resume"},
    {...services, control: h.control, ...extra});
  return {f, dir, config, host, binding, acceptance, approve, run};
}
const verdictFor = (x, offer) => ({phase: "POST_ACCEPT", key: offer.key, reviewer: x.config.reviewer, runId: offer.runId,
    observedAt: new Date().toISOString(), findings: [],
    rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: `fixture:${id}`}))});
async function acceptAndReview(x, amend = () => {}) {
  await x.host.accept(x.acceptance);
  const offer = await x.host.claimReview("previous");
  const verdict = verdictFor(x, offer); amend(verdict);
  await x.host.review("previous", offer, verdict);
  return verdict;
}
const disposition = (x, verdict) => ({owner: x.config.owner, reviewKey: hash(verdict),
  action: "CONTINUE", nextAction: x.binding.taskId, evidence: "fixture:owner-applied-verdict"});

async function historicalGrant(x, taskId = x.acceptance.task) {
  const binding = {...x.binding, taskId, operation: "accept", kind: "verification",
    cwd: "/PRIVATE_COMMAND_PATH", executable: "/PRIVATE_EXECUTABLE", command: "PRIVATE_COMMAND_CONTENT"};
  const expiresAt = Date.now() + 60000;
  await x.host.approveCommand(binding, {reviewer: x.config.reviewer, reviewReceipt: "/PRIVATE_RECEIPT_PATH",
    dependencies: [], expiresAt});
  return {binding, expiresAt};
}

test("post-accept execution projection exposes scoped consumed historical proof without paths or new permission", async t => {
  const x = await setup(t), {binding, expiresAt} = await historicalGrant(x);
  // Scripted protocol observation only; no product command is executed.
  const claim = await x.host.control.reserve(await x.host.control.authorize(binding));
  await x.host.control.observe(claim, {outcome: "COMPLETED", bindingSha256: hash(binding), resultSha256: sha256("scripted-result")});
  await historicalGrant(x, "unrelated-task");
  await x.host.accept(x.acceptance);
  const before = await x.host.reviewInput("previous"), execution = before.input.execution;
  assert.equal(execution.coverage, "ACCEPTED_TASK_HOST_REGISTRY_ONLY");
  assert.equal(execution.authority, "HISTORICAL_EVIDENCE_NOT_EXECUTION_PERMISSION");
  assert.equal(execution.outsideHost, "UNKNOWN");
  assert.equal(execution.approvedCommands.length, 1);
  const grant = execution.approvedCommands[0];
  assert.equal(grant.taskId, x.acceptance.task); assert.equal(grant.operation, "accept");
  assert.equal(grant.kind, "verification"); assert.equal(grant.bindingSha256, hash(binding));
  assert.equal(grant.taskSha256, binding.taskSha256); assert.equal(grant.capsuleSha256, binding.capsuleSha256);
  assert.equal(grant.reviewReceiptSha256, sha256("/PRIVATE_RECEIPT_PATH"));
  assert.equal(grant.expiresAt, expiresAt);
  assert.equal(execution.reservations.length, 1);
  assert.equal(execution.reservations[0].status, "COMPLETED");
  assert.equal(execution.reservations[0].resultSha256, sha256("scripted-result"));
  assert.ok(!JSON.stringify(execution).includes("PRIVATE_"));
  assert.ok(!JSON.stringify(execution).includes("unrelated-task"));
  t.mock.method(Date, "now", () => expiresAt + 1);
  assert.equal((await x.host.reviewInput("previous")).key, before.key);
  await assert.rejects(x.host.control.authorize(binding), /COMMAND_NOT_APPROVED/);
});

test("post-accept execution empty or unavailable registry never creates permission or a source", async t => {
  const x = await setup(t, {registeredEvidence: true}); await x.host.accept(x.acceptance);
  const offer = await x.host.reviewInput("previous"), execution = offer.input.execution;
  assert.equal(execution.authority, "HISTORICAL_EVIDENCE_NOT_EXECUTION_PERMISSION");
  assert.equal(execution.outsideHost, "UNKNOWN");
  assert.deepEqual(execution.approvedCommands, []); assert.deepEqual(execution.reservations, []);
  assert.deepEqual(offer.input.sourceEvidence.rows.map(row => row.id), ["contract"]);
  await assert.rejects(x.host.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  const prompt = modelReviewPrompt(offer, {owner: "owner"});
  assert.match(prompt, /Host input\.execution/); assert.match(prompt, /historical/);
  assert.match(modelReviewPrompt({...offer, phase: "HEALTH"}, {}), /not all external project leases/);
  const answer = {schema: "control.review-answer.v2", rowGroups: [{ids: ["C03.01"], status: "UNKNOWN",
    sourceIds: ["execution"], reason: "Must not invent a registry source", findingId: "gap"}], newFindings: [], resolutions: []};
  assert.throws(() => decodeReviewAnswer(answer, {readbacks: offer.input.sourceEvidence.rows, offer,
    reviewer: "reviewer", observedAt: new Date().toISOString()}), /UNREAD_EVIDENCE/);
  await (await openControlStore(x.dir)).transact(s => {delete s.grants; delete s.reservations; return s;});
  const unavailable = (await x.host.reviewInput("previous")).input.execution;
  assert.equal(unavailable.coverage, "HOST_REGISTRY_UNAVAILABLE");
  assert.equal(unavailable.approvedCommands, null); assert.equal(unavailable.reservations, null);
});

for (const outcome of ["COMPLETED", "UNKNOWN"]) {
  test(`post-accept same-task continuation preserves historical key and ${outcome} effect guard`, async t => {
    const x = await setup(t);
    x.acceptance.task = x.binding.taskId;
    const {binding} = await historicalGrant(x);
    const historical = await x.host.control.reserve(await x.host.control.authorize(binding));
    await x.host.control.observe(historical, {outcome: "COMPLETED", bindingSha256: hash(binding), resultSha256: sha256("historical-result")});
    const verdict = await acceptAndReview(x);
    await x.host.disposition("previous", disposition(x, verdict));
    const before = await x.host.reviewInput("previous");
    await x.approve(["previous"]);
    const approved = await x.host.reviewInput("previous");
    assert.equal(approved.key, before.key);
    assert.equal(approved.stateRevision, before.stateRevision);
    const claim = await x.host.control.reserve(await x.host.control.authorize(x.binding));
    const pending = await x.host.reviewInput("previous");
    assert.deepEqual(pending.input.execution, before.input.execution);
    assert.equal(pending.key, before.key);
    assert.equal(pending.input.externalUnknown, true);
    assert.equal((await x.host.assess("previous")).action, "RECONCILE_EXTERNAL_OUTCOME");
    await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
    if (outcome === "COMPLETED") {
      await x.host.control.observe(claim, {outcome, bindingSha256: hash(x.binding), resultSha256: sha256("continuation-result")});
      const after = await x.host.reviewInput("previous");
      assert.equal(after.key, before.key);
      assert.deepEqual(after.input.execution, before.input.execution);
      assert.equal((await x.host.assess("previous")).action, "CONTROL_CONFIRMED");
      await x.host.close("previous");
    } else {
      const reopened = await openControlHost(x.dir, x.config, services);
      assert.equal((await reopened.assess("previous")).action, "RECONCILE_EXTERNAL_OUTCOME");
      await assert.rejects(reopened.close("previous"), /CONTROL_NOT_COMPLETE/);
    }
    await assert.rejects(x.host.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  });
}

for (const change of ["grant", "reservation", "completion"]) {
  test(`post-accept execution relevant ${change} invalidates an in-flight review`, async t => {
    const x = await setup(t); let binding, claim;
    if (change !== "grant") ({binding} = await historicalGrant(x));
    if (change === "completion") claim = await x.host.control.reserve(await x.host.control.authorize(binding));
    await x.host.accept(x.acceptance); const offer = await x.host.claimReview("previous");
    if (change === "grant") await historicalGrant(x);
    if (change === "reservation") await x.host.control.reserve(await x.host.control.authorize(binding));
    if (change === "completion") await x.host.control.observe(claim, {outcome: "COMPLETED", bindingSha256: hash(binding), resultSha256: sha256("result")});
    assert.notEqual((await x.host.reviewInput("previous")).key, offer.key);
    await assert.rejects(x.host.review("previous", offer, verdictFor(x, offer)), /REVIEW_SOURCE_CHANGED/);
  });
}

for (const relevant of [true, false]) {
  test(`post-accept execution ${relevant ? "relevant" : "unrelated"} grant changes ${relevant ? "invalidate" : "preserve"} owner freshness`, async t => {
    const x = await setup(t), verdict = await acceptAndReview(x), before = await x.host.reviewInput("previous");
    const {binding} = await historicalGrant(x, relevant ? x.acceptance.task : "unrelated-task");
    const claim = await x.host.control.reserve(await x.host.control.authorize(binding));
    await x.host.control.observe(claim, {outcome: "COMPLETED", bindingSha256: hash(binding), resultSha256: sha256("result")});
    const after = await x.host.reviewInput("previous");
    if (relevant) {
      assert.notEqual(after.key, before.key);
      await assert.rejects(x.host.disposition("previous", disposition(x, verdict)), /POST_ACCEPT_SOURCE_CHANGED/);
    } else {
      assert.equal(after.key, before.key); assert.equal(after.stateRevision, before.stateRevision);
      await x.host.disposition("previous", disposition(x, verdict));
    }
  });
}

for (const operation of ["review", "disposition"]) {
  test(`post-accept same-task ${operation} CAS excludes a grant dependent on this acceptance`, {timeout: 10000}, async t => {
    const x = await setup(t);
    x.acceptance.task = x.binding.taskId;
    await x.host.accept(x.acceptance);
    const offer = await x.host.claimReview("previous"), verdict = verdictFor(x, offer);
    if (operation === "disposition") await x.host.review("previous", offer, verdict);
    const originalRead = fs.readFile; let entered, release, blocked = false;
    const reading = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      if (file === path.join(x.f.root, "memory.md") && !blocked) {blocked = true; entered(); await gate;}
      return originalRead(file, ...args);
    });
    syncBuiltinESMExports(); t.after(() => {release(); intercepted.mock.restore(); syncBuiltinESMExports();});
    const pending = operation === "review" ? x.host.review("previous", offer, verdict) : x.host.disposition("previous", disposition(x, verdict));
    pending.catch(() => {}); await reading;
    await x.approve(["previous"]); release();
    await pending;
    assert.deepEqual((await x.host.reviewInput("previous")).input.execution.approvedCommands, []);
  });
}

for (const operation of ["review", "disposition"]) for (const relevant of [true, false]) {
  test(`post-accept execution ${operation} CAS ${relevant ? "refuses relevant" : "permits unrelated"} concurrent grant`, {timeout: 10000}, async t => {
    const x = await setup(t); await x.host.accept(x.acceptance);
    const offer = await x.host.claimReview("previous"), verdict = verdictFor(x, offer);
    if (operation === "disposition") await x.host.review("previous", offer, verdict);
    const originalRead = fs.readFile; let entered, release, blocked = false;
    const reading = new Promise(resolve => {entered = resolve;}), gate = new Promise(resolve => {release = resolve;});
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      if (file === path.join(x.f.root, "memory.md") && !blocked) {blocked = true; entered(); await gate;}
      return originalRead(file, ...args);
    });
    syncBuiltinESMExports(); t.after(() => {release(); intercepted.mock.restore(); syncBuiltinESMExports();});
    const pending = operation === "review" ? x.host.review("previous", offer, verdict) : x.host.disposition("previous", disposition(x, verdict));
    pending.catch(() => {}); await reading;
    await historicalGrant(x, relevant ? x.acceptance.task : "unrelated-task"); release();
    if (relevant) await assert.rejects(pending, /REVIEW_SOURCE_CHANGED|POST_ACCEPT_SOURCE_CHANGED/);
    else await pending;
  });
}

async function reviewWithFinding(x, blocksResume) {
  const finding = {id: "disposition-debt", checkId: "C12.01", area: "C12",
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C12.01").criterion,
    evidence: "fixture:disposition-debt", owner: "maintenance", work: "cleanup", status: "OPEN",
    firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 60000).toISOString(),
    attempts: 0, blocksResume};
  const verdict = await acceptAndReview(x, v => {
    v.findings.push(finding);
    Object.assign(v.rows.find(r => r.id === finding.checkId),
      {status: "FINDING", findingId: finding.id, reason: "Owned repair"});
  });
  const lease = {owner: finding.owner, work: finding.work, state: "WORKING",
    checkpoint: "repair-return", reviewAt: finding.reviewAt, evidence: "fixture:live-lease"};
  return {verdict, finding, lease};
}

function openPostVerdict(x,offer) {
  const v=verdictFor(x,offer);v.findings=structuredClone(offer.input.previousFindings);
  for(const f of v.findings.filter(f=>f.status==="OPEN"))
    Object.assign(v.rows.find(r=>r.id===f.checkId),{status:"FINDING",findingId:f.id,reason:"Still broken"});
  return v;
}

test("named POST repair left OPEN records one checked failure and retains independent retry across restart", async t => {
  const x = await setup(t), {verdict, finding, lease} = await reviewWithFinding(x, true);
  const artifact=await readFile(path.join(x.f.root,"artifact.md"));
  await x.host.disposition("previous", {...disposition(x, verdict), action:"REPAIR"}, [lease]);
  await assert.rejects(x.host.requestRepairReview("previous","unbound old call"),/FINDING_IDS_REQUIRED/);
  for(const ids of [[],[finding.id,finding.id],["missing"]])
    await assert.rejects(x.host.requestRepairReview("previous","bad submission",ids),/REPAIR/);
  await x.host.requestRepairReview("previous", "fixture:first submitted repair", [finding.id]);
  await assert.rejects(x.host.requestRepairReview("previous","overwrite pending",[finding.id]),/ALREADY_PENDING/);
  const offer = await x.host.claimReview("previous"), v = openPostVerdict(x,offer);
  assert.deepEqual(offer.input.repairRequest.findingIds,[finding.id]);
  await x.host.review("previous", offer, v);
  const saved = (await x.host.snapshot()).acceptances.previous;
  assert.equal(saved.findings[0].attempts, 1);
  assert.equal(saved.findings[0].lastResult, "FAILED");
  assert.equal(saved.repairHistory.length,1);
  assert.equal(saved.repairHistory[0].request.evidence,"fixture:first submitted repair");
  await assert.rejects(x.host.review("previous",offer,v),/SOURCE_CHANGED/);
  const host=await openControlHost(x.dir,x.config,services);
  assert.deepEqual((await host.snapshot()).acceptances.previous.findings,saved.findings);
  await host.disposition("previous",{...disposition(x,saved.review),action:"REPAIR"},[lease]);
  await assert.rejects(host.requestRepairReview("previous","repeat",[finding.id]),/NEEDS_DECISION/);
  const decision={reviewer:x.config.reviewer,findingId:finding.id,fromAttempt:1,reviewKey:hash(saved.review),
    evidence:"fixture:independent changed-cause review",decision:"One changed repair"};
  for(const bad of [{reviewer:x.config.owner},{fromAttempt:0},{reviewKey:hash(verdict)}])
    await assert.rejects(host.authorizeRepairRetry("previous",{...decision,...bad}),/RETRY/);
  const outcomes=await Promise.allSettled([host.authorizeRepairRetry("previous",decision),host.authorizeRepairRetry("previous",decision)]);
  assert.equal(outcomes.filter(r=>r.status==="fulfilled").length,1);
  await assert.rejects(host.authorizeRepairRetry("previous",decision),/RETRY_INVALID/);
  const restarted=await openControlHost(x.dir,x.config,services);
  const submissions=await Promise.allSettled([restarted.requestRepairReview("previous","changed repair",[finding.id]),
    host.requestRepairReview("previous","racing changed repair",[finding.id])]);
  assert.equal(submissions.filter(r=>r.status==="fulfilled").length,1);
  const second=await restarted.claimReview("previous");
  const decoded=decodeReviewAnswer({schema:"control.review-answer.v2",
    rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["artifact"]}],newFindings:[],
    resolutions:[{id:finding.id,sourceIds:["artifact"],proof:"fixture:current independent readback"}]},
    {readbacks:[{id:"artifact",status:"AVAILABLE",sha256:x.acceptance.artifact.sha256}],offer:second,
      reviewer:x.config.reviewer,observedAt:new Date().toISOString()});
  const closed={...verdictFor(x,second),...decoded};
  for(const change of [{checkedKey:offer.key},{evidence:"rewritten origin"},{firstSeen:"2020-01-01T00:00:00Z"},
    {owner:"wrong"},{criterion:"weaker"},{attempts:1},{retryDecisions:[]}]) {
    const bad=structuredClone(closed);Object.assign(bad.findings[0],change);
    await assert.rejects(restarted.review("previous",second,bad),/REVIEW_INVALID|NEEDS_DECISION/);
  }
  const results=await Promise.allSettled([restarted.review("previous",second,closed),host.review("previous",second,closed)]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  const final=(await restarted.snapshot()).acceptances.previous;
  assert.equal(final.findings[0].attempts,2);assert.equal(final.findings[0].lastResult,"PASSED");
  assert.equal(final.findings[0].checkedKey,second.key);assert.equal(final.repairHistory.length,2);
  for(const key of ["criterion","evidence","firstSeen","owner","work"])
    assert.equal(final.findings[0][key],finding[key]);
  assert.deepEqual(final.acceptance,x.acceptance);
  assert.deepEqual(await readFile(path.join(x.f.root,"artifact.md")),artifact);
});

test("POST unsubmitted siblings and ordinary or legacy unbound follow-up do not acquire failed attempts",async t=>{
  const x=await setup(t),{verdict,finding,lease}=await reviewWithFinding(x,false);
  await x.host.disposition("previous",{...disposition(x,verdict),action:"REPAIR"},[lease]);
  const store=await openControlStore(x.dir),sibling={...finding,id:"unsubmitted"};
  // A historical unbound enrollment is intentionally not reconstructed as a checked repair.
  await store.transact(s=>{const row=s.acceptances.previous;row.findings.push(sibling);
    row.repairEvidence="legacy claim without IDs";row.enrollment="REVIEW_DUE";return s;});
  let offer=await x.host.claimReview("previous"),v=openPostVerdict(x,offer);
  assert.equal(offer.input.repairRequest,null);
  const invented=structuredClone(v);Object.assign(invented.findings[0],{attempts:1,lastResult:"FAILED"});
  await assert.rejects(x.host.review("previous",offer,invented),/REVIEW_INVALID/);
  await x.host.review("previous",offer,v);
  assert.ok((await x.host.snapshot()).acceptances.previous.findings.every(f=>f.attempts===0 && f.lastResult===undefined));
  await x.host.disposition("previous",{...disposition(x,v),action:"REPAIR"},[lease]);
  await x.host.requestRepairReview("previous","only the named finding attempted",[finding.id]);
  offer=await x.host.claimReview("previous");v=openPostVerdict(x,offer);
  await x.host.review("previous",offer,v);
  let row=(await x.host.snapshot()).acceptances.previous;
  assert.equal(row.findings[0].attempts,1);assert.deepEqual(row.findings[1],sibling);
  await x.host.disposition("previous",{...disposition(x,row.review),action:"REPAIR"},[lease]);
  await store.transact(s=>{s.acceptances.previous.enrollment="REVIEW_DUE";return s;});
  offer=await x.host.claimReview("previous");v=openPostVerdict(x,offer);
  const fabricated=structuredClone(v);
  Object.assign(fabricated.findings[0],{status:"CLOSED",attempts:2,lastResult:"PASSED",checkedKey:offer.key,
    reviewedBy:x.config.reviewer,proof:"claimed closure",retryDecisions:[{fromAttempt:1,toAttempt:2,previousResult:"FAILED",
      reviewedBy:x.config.reviewer,evidence:"invented inside verdict",decision:"retry"}]});
  await assert.rejects(x.host.review("previous",offer,fabricated),/REVIEW_INVALID/);
  await x.host.review("previous",offer,v);
  row=(await x.host.snapshot()).acceptances.previous;
  assert.equal(row.findings[0].attempts,1);assert.deepEqual(row.findings[1],sibling);
  assert.equal(row.repairHistory.length,1);
});

test("POST unsubmitted CLOSED sibling preserves attempts and result while the named repair fails",async t=>{
  const x=await setup(t),one={id:"one",checkId:"C12.01",area:"C12",
    criterion:controlCatalog.flatMap(g=>g.checks).find(c=>c.id==="C12.01").criterion,
    evidence:"fixture:original finding",owner:"maintenance",work:"cleanup",status:"OPEN",
    firstSeen:new Date().toISOString(),reviewAt:new Date(Date.now()+60000).toISOString(),attempts:0,blocksResume:true};
  const two={...one,id:"two"},lease={owner:one.owner,work:one.work,state:"WORKING",
    checkpoint:"repair-return",reviewAt:one.reviewAt,evidence:"fixture:owned repair"};
  const initial=await acceptAndReview(x,v=>{
    v.findings=[one,two];Object.assign(v.rows.find(r=>r.id===one.checkId),
      {status:"FINDING",findingId:two.id,reason:"Two open findings"});
  });
  await x.host.disposition("previous",{...disposition(x,initial),action:"REPAIR"},[lease]);
  await x.host.requestRepairReview("previous","first finding repaired",[one.id]);
  const first=await x.host.claimReview("previous"),closed=openPostVerdict(x,first);
  Object.assign(closed.findings[0],{status:"CLOSED",attempts:1,lastResult:"PASSED",
    proof:"fixture:current closure",reviewedBy:x.config.reviewer,checkedKey:first.key});
  await x.host.review("previous",first,closed);
  await x.host.disposition("previous",{...disposition(x,closed),action:"REPAIR"},[lease]);
  await x.host.requestRepairReview("previous","only second finding submitted",[two.id]);
  const offer=await x.host.claimReview("previous"),valid=openPostVerdict(x,offer);
  const before=(await x.host.snapshot()).acceptances.previous;
  for(const change of [{attempts:99},{lastResult:"FAILED"},{lastResult:undefined}]) {
    const invalid=structuredClone(valid);Object.assign(invalid.findings[0],change);
    await assert.rejects(x.host.review("previous",offer,invalid),/REVIEW_INVALID/);
    assert.deepEqual((await x.host.snapshot()).acceptances.previous,before);
  }
  await x.host.review("previous",offer,valid);
  const restarted=await openControlHost(x.dir,x.config,services);
  const saved=(await restarted.snapshot()).acceptances.previous;
  assert.deepEqual(saved.findings[0],closed.findings[0]);
  assert.deepEqual(saved.findings[1],{...two,attempts:1,lastResult:"FAILED"});
  assert.equal(saved.repairHistory.length,before.repairHistory.length+1);
  assert.deepEqual(saved.acceptance,x.acceptance);
});

test("POST cancelled or no-verdict repair retains binding without counting and only reconciled review counts",async t=>{
  const x=await setup(t),{verdict,finding,lease}=await reviewWithFinding(x,true);
  await x.host.disposition("previous",{...disposition(x,verdict),action:"REPAIR"},[lease]);
  await x.host.requestRepairReview("previous","attempt before cancellation",[finding.id]);
  const offer=await x.host.claimReview("previous");await x.host.reviewFailure("previous",offer.runId);
  let stopped=false;
  const host=await openControlHost(x.dir,x.config,{...services,observeReviewRun:async runId=>
    ({runId,state:stopped?"STOPPED":"RUNNING",evidence:"fixture:process observation"})});
  let row=(await host.snapshot()).acceptances.previous;
  assert.equal(row.findings[0].attempts,0);assert.equal(row.repairHistory,undefined);
  assert.deepEqual(row.repairRequest.findingIds,[finding.id]);
  assert.equal((await runControlTick(host,{review:()=>{throw Error("must not replay");}})).calls,0);
  const decision={reviewer:x.config.reviewer,action:"RETRY",evidence:"fixture:stopped transport retry"};
  await assert.rejects(host.reconcileReview("previous",decision),/OUTCOME_UNKNOWN/);
  stopped=true;await host.reconcileReview("previous",decision);
  await assert.rejects(host.requestRepairReview("previous","replace bound attempt",[finding.id]),/ALREADY_PENDING/);
  const next=await host.claimReview("previous"),v=openPostVerdict(x,next);
  const stale=structuredClone(v);stale.observedAt="2000-01-01T00:00:00Z";
  await assert.rejects(host.review("previous",next,stale),/REVIEW_INVALID/);
  await host.review("previous",next,v);
  row=(await host.snapshot()).acceptances.previous;
  assert.equal(row.findings[0].attempts,1);assert.equal(row.repairHistory.length,1);
  assert.equal(row.reviewAttempts.length,1);assert.deepEqual(row.acceptance,x.acceptance);
});

for(const change of ["lease","owner","pause"]) {
  test(`POST concurrent ${change} change invalidates a submitted repair offer without accepted-byte overwrite`,async t=>{
    const x=await setup(t),{verdict,finding,lease}=await reviewWithFinding(x,true);
    const artifact=await readFile(path.join(x.f.root,"artifact.md"));
    await x.host.disposition("previous",{...disposition(x,verdict),action:"REPAIR"},[lease]);
    await x.host.requestRepairReview("previous","bounded attempt",[finding.id]);
    const claims=await Promise.allSettled([x.host.claimReview("previous"),x.host.claimReview("previous")]);
    assert.equal(claims.filter(r=>r.status==="fulfilled").length,1);
    const offer=claims.find(r=>r.status==="fulfilled").value,v=openPostVerdict(x,offer);
    const store=await openControlStore(x.dir);
    await store.transact(s=>{const row=s.acceptances.previous;
      if(change==="lease")row.repairLeases[0].checkpoint="changed checkpoint";
      if(change==="owner")row.findings[0].owner="new-owner";
      if(change==="pause")s.paused=true;return s;});
    await assert.rejects(x.host.review("previous",offer,v),/SOURCE_CHANGED/);
    const row=(await x.host.snapshot()).acceptances.previous;
    assert.equal(row.findings[0].attempts,0);assert.equal(row.reviewLease.runId,offer.runId);
    assert.deepEqual(row.acceptance,x.acceptance);assert.deepEqual(await readFile(path.join(x.f.root,"artifact.md")),artifact);
  });
}

for (const status of ["UNKNOWN", "FINDING"]) {
  test(`readiness ${status} holds continuation without discarding accepted work (scripted protocol)`, async t => {
    const x = await setup(t);
    await x.approve();
    const finding = {id: "C05.02-readiness", checkId: "C05.02", area: "C05",
      criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C05.02").criterion,
      evidence: "fixture:mechanical-grant-and-worker-readback-do-not-prove-prior-readiness",
      owner: "maintenance", work: "readiness-repair", status: "OPEN",
      firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 60000).toISOString(),
      attempts: 0, blocksResume: true};
    const verdict = await acceptAndReview(x, v => {
      v.findings.push(finding);
      Object.assign(v.rows.find(r => r.id === finding.checkId),
        {status, findingId: finding.id, reason: "Prior independent readiness is not proven"});
    });
    const lease = {owner: finding.owner, work: finding.work, state: "WORKING",
      checkpoint: "new-compliant-increment", reviewAt: finding.reviewAt, evidence: "fixture:owned-repair"};
    await assert.rejects(x.host.disposition("previous", disposition(x, verdict), [lease]), /POST_ACCEPT_REPAIR_REQUIRED/);
    await x.host.disposition("previous", {...disposition(x, verdict), action: "REPAIR"}, [lease]);
    const retained = (await x.host.snapshot()).acceptances.previous;
    assert.deepEqual(retained.acceptance, x.acceptance);
    assert.equal(retained.findings[0].status, "OPEN");
    assert.equal(retained.findings[0].attempts, 0);
  });
}

for (const mode of ["paused", "empty-evidence", "invalid-action", "missing-next-action"]) {
  test(`post-accept disposition rejects ${mode} without replacing a good disposition`, async t => {
    const x = await setup(t), verdict = await acceptAndReview(x);
    await x.host.disposition("previous", disposition(x, verdict));
    const decision = disposition(x, verdict);
    if (mode === "paused") await x.host.pause(true);
    if (mode === "empty-evidence") decision.evidence = " ";
    if (mode === "invalid-action") decision.action = "DONE";
    if (mode === "missing-next-action") delete decision.nextAction;
    const before = await (await openControlStore(x.dir)).read();
    await assert.rejects(x.host.disposition("previous", decision),
      mode === "paused" ? /CONTROL_PAUSED/ : /OWNER_DISPOSITION_INVALID/);
    assert.deepEqual(await (await openControlStore(x.dir)).read(), before);
  });
}

for (const mode of ["missing", "closed", "late", "duplicate", "waiting", "blocking-continue"]) {
  test(`post-accept disposition rejects ${mode} repair routing and preserves findings`, async t => {
    const x = await setup(t), {verdict, finding, lease} = await reviewWithFinding(x, true);
    const decision = {...disposition(x, verdict), action: "REPAIR"};
    let leases = [lease];
    if (mode === "missing") leases = [];
    if (mode === "closed") leases = [{...lease, state: "CLOSED"}];
    if (mode === "late") leases = [{...lease, reviewAt: new Date(Date.parse(finding.reviewAt) + 1).toISOString()}];
    if (mode === "duplicate") leases = [lease, lease];
    if (mode === "waiting") leases = [{...lease, state: "WAITING"}];
    if (mode === "blocking-continue") decision.action = "CONTINUE";
    await x.host.disposition("previous", {...disposition(x, verdict), action:"REPAIR"}, [lease]);
    const before = await (await openControlStore(x.dir)).read();
    await assert.rejects(x.host.disposition("previous", decision, leases),
      mode === "blocking-continue" ? /POST_ACCEPT_REPAIR_REQUIRED/ : /POST_ACCEPT_REPAIR_OWNER_REQUIRED/);
    assert.deepEqual(await (await openControlStore(x.dir)).read(), before);
  });
}

test("post-accept nonblocking findings still require owned repair leases", async t => {
  const x = await setup(t), {verdict, lease} = await reviewWithFinding(x, false);
  await assert.rejects(x.host.disposition("previous", disposition(x, verdict)), /POST_ACCEPT_REPAIR_OWNER_REQUIRED/);
  await x.host.disposition("previous", disposition(x, verdict), [lease]);
  assert.equal((await x.host.assess("previous")).action, "VERIFY_CONTINUATION");
  assert.equal((await x.host.snapshot()).acceptances.previous.findings[0].status, "OPEN");
});

for (const source of ["memory.md", "public-contract.md"]) {
  test(`post-accept source drift in ${source} permits owned REPAIR, not stale CONTINUE or closure`, async t => {
    const x = await setup(t, {registeredEvidence: true});
    const {verdict, finding, lease} = await reviewWithFinding(x, false);
    await x.host.disposition("previous", disposition(x, verdict), [lease]);
    await x.f.put(source, "changed after review");
    const before = await (await openControlStore(x.dir)).read();
    await assert.rejects(x.host.disposition("previous", disposition(x, verdict), [lease]), /POST_ACCEPT_SOURCE_CHANGED/);
    assert.deepEqual(await (await openControlStore(x.dir)).read(), before);
    await x.host.disposition("previous", {...disposition(x, verdict), action: "REPAIR"}, [lease]);
    const row = (await x.host.snapshot()).acceptances.previous;
    assert.deepEqual(row.findings, [finding]);
    assert.deepEqual(row.acceptance, x.acceptance);
    assert.equal(row.disposition.action, "REPAIR");
    assert.equal((await x.host.assess("previous")).action, "POST_ACCEPT_REVIEW_DUE");
    await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
  });
}

for (const change of ["pause", "review", "replacement-disposition", "unrelated-acceptance"]) {
  test(`post-accept disposition revalidates CAS after concurrent ${change}`, {timeout:10000}, async t => {
    const x = await setup(t), verdict = await acceptAndReview(x);
    const originalRead = fs.readFile;
    let entered, release, blocked = false;
    const reading = new Promise(resolve => {entered = resolve;});
    const gate = new Promise(resolve => {release = resolve;});
    const intercepted = t.mock.method(fs, "readFile", async (file, ...args) => {
      if (file === path.join(x.f.root, "memory.md") && !blocked) {
        blocked = true; entered(); await gate;
      }
      return originalRead(file, ...args);
    });
    syncBuiltinESMExports();
    t.after(() => {release(); intercepted.mock.restore(); syncBuiltinESMExports();});
    const pending = x.host.disposition("previous", disposition(x, verdict));
    pending.catch(() => {});
    await reading;
    if (change === "pause") await x.host.pause(true);
    if (change === "review") {
      await x.f.put("memory.md", "changed source");
      await x.host.claimReview("previous");
    }
    if (change === "replacement-disposition")
      await x.host.disposition("previous", {...disposition(x, verdict), nextAction:"other-task"});
    if (change === "unrelated-acceptance") await x.host.accept({...x.acceptance,id:"unrelated",task:"other-task"});
    const before = await (await openControlStore(x.dir)).read();
    release();
    if (change === "unrelated-acceptance") {
      await pending;
      const after = await x.host.snapshot();
      assert.deepEqual(after.acceptances.previous.disposition, disposition(x, verdict));
      assert.deepEqual(after.acceptances.unrelated, before.state.acceptances.unrelated);
      return;
    }
    await assert.rejects(pending, /CONTROL_PAUSED|REVIEW_PENDING|POST_ACCEPT_SOURCE_CHANGED/);
    assert.deepEqual(await (await openControlStore(x.dir)).read(), before);
  });
}

for (const mode of ["paused", "source-drift", "legacy-missing-lease", "valid-repair"]) {
  test(`actual host notification ${mode} preserves findings and validates application`, async t => {
    const x = await setup(t), {verdict, finding, lease} = await reviewWithFinding(x, true);
    const directory = path.join(x.dir, "notifications"); await mkdir(directory, {mode:0o700});
    const notifications = await openControlNotification({directory,owner:x.config.owner,transportActor:"transport"});
    await notifications.initialize();
    await notifications.enqueueObservation({complete:true,
      receipt:{schema:"control.observer-readback.v1",owner:x.config.owner,status:"ONE_TICK_OBSERVED"},
      actionable:[{id:"previous",action:"OWNER_DISPOSITION_DUE",reviewKey:hash(verdict)}]});
    const owner = notificationOwner({notifications,host:x.host,owner:x.config.owner,transportActor:"transport"});
    const [packet] = await owner.readNotices();
    assert.equal((await owner.acknowledge({id:packet.notice.id,deliveryToken:packet.deliveryToken})).ownerApplied,false);
    await x.host.disposition("previous", {...disposition(x, verdict), action:"REPAIR"}, [lease]);
    if (mode === "paused") await x.host.pause(true);
    if (mode === "source-drift") await x.f.put("memory.md", "changed after disposition");
    if (mode === "legacy-missing-lease") await (await openControlStore(x.dir)).transact(state => {
      state.acceptances.previous.repairLeases = []; return state;
    });
    const before = await x.host.snapshot();
    assert.deepEqual(await owner.recordApplications(), mode === "valid-repair" ? [packet.notice.id] : []);
    assert.equal((await notifications.snapshot()).pendingOwnerApplication, mode === "valid-repair" ? 0 : 1);
    assert.deepEqual(await x.host.snapshot(), before);
    assert.deepEqual(before.acceptances.previous.findings, [finding]);
    await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
    if (mode === "paused") {
      await x.host.pause(false);
      assert.deepEqual(await owner.recordApplications(), [packet.notice.id]);
      assert.equal((await x.host.assess("previous")).action, "REPAIR_REQUIRED");
    }
  });
}

test("durable CAS rejects concurrent duplicate reservations and survives host recreation", async t => {
  const x = await setup(t); await x.approve();
  const grant = await x.host.control.authorize(x.binding);
  const attempts = await Promise.allSettled([x.host.control.reserve(grant), x.host.control.reserve(grant)]);
  assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1);
  const resumed = await openControlHost(x.dir, x.config, services);
  await assert.rejects(resumed.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  assert.equal(Object.values((await resumed.snapshot()).reservations)[0].status, "IN_FLIGHT");
});

test("changing a command cannot bypass an unknown outcome for the same task", async t => {
  const x = await setup(t); await x.approve();
  await x.host.control.reserve(await x.host.control.authorize(x.binding));
  const other = {...x.binding, commandSha256: sha256("changed command")};
  await x.host.approveCommand(other, {reviewer: x.config.reviewer, reviewReceipt: "new-review",
    dependencies: [], expiresAt: Date.now() + 120000});
  await assert.rejects(x.host.control.authorize(other), /TASK_OUTCOME_UNKNOWN/);
});

test("separate processes cannot both reserve; SIGKILL leaves the winner unresolved, not replayable", async t => {
  const x = await setup(t); await x.approve();
  const grant = await x.host.control.authorize(x.binding);
  const program = `import {openControlHost} from ${JSON.stringify(new URL("../scripts/control-host.mjs", import.meta.url).href)};
    const {dir,config,grant}=JSON.parse(process.argv[1]);
    const host=await openControlHost(dir,config,{});
    try {await host.control.reserve(grant); process.stdout.write('RESERVED\\n'); setInterval(()=>{},1000);}
    catch {process.stdout.write('REFUSED\\n');}`;
  const launch = () => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", program, JSON.stringify({dir:x.dir,config:x.config,grant})],
      {stdio: ["ignore", "pipe", "pipe"]});
    t.after(() => child.kill("SIGKILL"));
    const closed = new Promise(resolve => child.once("close", (code, signal) => resolve({code,signal})));
    const result = new Promise((resolve, reject) => {
      let output = "";
      child.once("error", reject);
      child.stdout.on("data", chunk => {output += chunk; if(output.includes("\n")) resolve(output.trim());});
      child.once("close", () => {if(!output) reject(Error("child produced no reservation result"));});
    });
    return {child, closed, result};
  };
  const children = [launch(), launch()];
  const results = await Promise.all(children.map(c => c.result));
  assert.deepEqual(results.toSorted(), ["REFUSED", "RESERVED"]);
  const winner = children[results.indexOf("RESERVED")]; winner.child.kill("SIGKILL");
  assert.equal((await winner.closed).signal, "SIGKILL");
  await Promise.all(children.map(c => c.closed));
  const reopened = await openControlHost(x.dir, x.config, services);
  assert.equal(Object.values((await reopened.snapshot()).reservations)[0].status, "IN_FLIGHT");
  await assert.rejects(reopened.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
});

test("late command results cannot certify a changed owner disposition", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  const claim = await x.host.control.reserve(await x.host.control.authorize(x.binding));
  await x.host.disposition("previous", {...disposition(x, verdict), nextAction: "different-task"});
  await x.host.control.observe(claim, {outcome: "COMPLETED", bindingSha256: hash(x.binding), resultSha256: sha256("actual result")});
  const state = await x.host.snapshot();
  assert.equal(state.reservations[claim.reservationId].continuationStatus, "STALE_DISPOSITION");
  assert.equal(state.acceptances.previous.disposition.continuationEvidence, undefined);
  await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
});

test("late command result cannot erase review enrollment or manufacture continuation", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  await x.run(); await x.host.close("previous");
  const second = {...x.binding, commandSha256: sha256("a separately approved next command")};
  await x.host.approveCommand(second, {reviewer: x.config.reviewer, reviewReceipt: "independent-next-command",
    dependencies: ["previous"], expiresAt: Date.now() + 120000});
  const claim = await x.host.control.reserve(await x.host.control.authorize(second));
  const before = (await x.host.snapshot()).acceptances.previous.disposition;
  await x.host.claimReview("previous");
  await x.host.control.observe(claim, {outcome: "COMPLETED", bindingSha256: hash(second), resultSha256: sha256("late")});
  const state = await x.host.snapshot();
  assert.equal(state.reservations[claim.reservationId].status, "COMPLETED");
  assert.equal(state.reservations[claim.reservationId].continuationStatus, "STALE_DISPOSITION");
  assert.equal(state.acceptances.previous.enrollment, "REVIEW_IN_FLIGHT");
  assert.deepEqual(state.acceptances.previous.disposition, before);
});

async function processReviewer(x, program, options = {}) {
  const directory = path.join(x.dir, "review-process"); await mkdir(directory, {mode: 0o700});
  const config = {directory, workspace: x.f.root, controlRoot: x.dir, reviewer: x.config.reviewer,
    command: [process.execPath, "--input-type=module", "-e", program], ...options};
  const transport = await openReviewProcess(config); await transport.initialize();
  return {transport, config};
}
const readOffer = "let text='';for await(const b of process.stdin)text+=b;const offer=JSON.parse(text);";
test("fresh reviewer subprocess and retained result survive controller recreation", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const {transport, config} = await processReviewer(x, `${readOffer}
    import{writeFileSync}from'node:fs';
    let protectedWrites=0;for(const p of ${JSON.stringify([path.join(x.f.root,"forbidden"),path.join(x.dir,"forbidden")])}){
      try{writeFileSync(p,'bad')}catch{protectedWrites++}}
    console.log(JSON.stringify({phase:'POST_ACCEPT',key:offer.key,reviewer:'forged',runId:'forged',
      findings:[],rows:${JSON.stringify(controlCheckIds)}.map(id=>({id,status:'PASS',evidence:'protocol-fixture:'+id})),protectedWrites}));`);
  const result = await runControlTick(x.host, {review: transport.review, timeoutMs: 3000});
  assert.equal(result.results[0].action, "OWNER_DISPOSITION_DUE");
  const verdict = (await x.host.snapshot()).acceptances.previous.review;
  assert.equal(verdict.reviewer, x.config.reviewer); assert.equal(verdict.protectedWrites, 2);
  assert.notEqual(verdict.runId, "forged");
  const restarted = await openReviewProcess(config), observed = await restarted.observe(verdict.runId);
  assert.equal(observed.state, "STOPPED"); assert.deepEqual(observed.verdict, verdict);
  await assert.rejects(restarted.review({runId: verdict.runId, key: verdict.key}), /ALREADY_DISPATCHED/);
  await assert.rejects(readFile(path.join(x.f.root, "forbidden")), {code: "ENOENT"});
  // Owner consumes the stored exact verdict, not the transport's summary.
  const reopened = await openControlHost(x.dir, x.config, {...services, observeReviewRun: restarted.observe});
  await reopened.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  assert.equal((await x.run(reopened)).status, "ACTION_COMPLETED");
  await reopened.close("previous"); assert.deepEqual(await reopened.due(), []);
});

test("review timeout records actual termination without automatic retry", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const {transport} = await processReviewer(x, "setInterval(()=>{},1000)", {timeoutMs: 100});
  const host = await openControlHost(x.dir, x.config, {...services, observeReviewRun: transport.observe});
  const result = await runControlTick(host, {review: transport.review, timeoutMs: 3000});
  assert.equal(result.results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  const lease = (await host.snapshot()).acceptances.previous.reviewLease;
  const observed = await transport.observe(lease.runId);
  assert.equal(observed.state, "STOPPED"); assert.equal(observed.signal, "SIGKILL");
  assert.equal(observed.reason, "TIMEOUT"); assert.equal(observed.verdict, undefined);
  await assert.rejects(host.reconcileReview("previous"), /INDEPENDENT_RETRY_DECISION_REQUIRED/);
  assert.equal((await runControlTick(host, {review: transport.review})).calls, 0);
});

test("cancelled and failed reviewer processes cannot publish an apparent verdict", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const {transport} = await processReviewer(x, `${readOffer}console.log(JSON.stringify({phase:'POST_ACCEPT',key:offer.key}));process.exitCode=1;`);
  const offer = await x.host.claimReview("previous");
  await assert.rejects(transport.review(offer), /REVIEW_PROCESS_FAILED/);
  assert.equal((await transport.observe(offer.runId)).verdict, undefined);
  const second = {...offer, runId: "11111111-1111-4111-8111-111111111111"};
  await assert.rejects(transport.review(second, {signal: AbortSignal.abort()}), /CANCELLED_BEFORE_DISPATCH/);
  assert.equal((await transport.observe(second.runId)).state, "STOPPED");
  assert.deepEqual(await transport.observe("not-a-run"), {runId: "not-a-run", state: "UNKNOWN"});
});

test("reviewer cannot leave a detached helper behind a successful result", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const {transport} = await processReviewer(x, `${readOffer}
    import{spawn}from'node:child_process';let helperLaunchDenied=false,helperPid;
    try{const c=spawn(process.execPath,['-e','setTimeout(()=>{},10000)'],{detached:true,stdio:'ignore'});
      await new Promise((resolve,reject)=>{c.once('spawn',resolve);c.once('error',reject)});helperPid=c.pid;c.unref();
    }catch{helperLaunchDenied=true}
    console.log(JSON.stringify({key:offer.key,helperLaunchDenied,helperPid}));`);
  const offer = await x.host.claimReview("previous"), verdict = await transport.review(offer);
  if(verdict.helperPid) t.after(() => {try {process.kill(-verdict.helperPid,"SIGKILL");} catch {}});
  assert.equal(verdict.helperLaunchDenied, true);
});

test("worker-writable entrypoints cannot be configured as independent reviewer programs", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t);
  await x.f.put("review.mjs", "console.log('{}')");
  const directory = path.join(x.dir, "unsafe-review"); await mkdir(directory, {mode: 0o700});
  await assert.rejects(openReviewProcess({directory, workspace: x.f.root, controlRoot: x.dir,
    reviewer: x.config.reviewer, command: [process.execPath, path.join(x.f.root,"review.mjs")]}), /PROGRAM_NOT_HOST_OWNED/);
});

test("review counterexample: restored bytes do not hide a claimed drift review", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  await x.run(); await x.host.close("previous");
  await x.f.put("memory.md", "changed"); await x.host.claimReview("previous");
  await x.f.put("memory.md", "memory");
  await assert.rejects(x.host.close("previous"), /REVIEW_PENDING/);
  assert.deepEqual(await x.host.due(), [{id: "previous", action: "REVIEW_IN_FLIGHT"}]);
  const other = {...x.binding, commandSha256: sha256("later command")};
  await x.host.approveCommand(other, {reviewer: x.config.reviewer, reviewReceipt: "new-review",
    dependencies: ["previous"], expiresAt: Date.now() + 120000});
  await assert.rejects(x.host.control.authorize(other), /REVIEW_PENDING/);
});

test("review counterexample: unrelated work cannot strand an independent verdict", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const offer = await x.host.claimReview("previous");
  await x.host.accept({...x.acceptance, id: "unrelated", task: "another-task"});
  await x.approve();
  await x.host.review("previous", offer, verdictFor(x, offer));
  assert.equal((await x.host.snapshot()).acceptances.previous.enrollment, "OWNER_DISPOSITION_DUE");
});

test("review counterexample: due nonblocking debt is independently reviewable after closure", async t => {
  const x = await setup(t);
  const finding = {id: "debt", checkId: "C12.01", area: "C12",
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C12.01").criterion,
    evidence: "fixture:owned-debt", owner: "maintenance", work: "cleanup", status: "OPEN",
    firstSeen: new Date().toISOString(), reviewAt: new Date(0).toISOString(), attempts: 0, blocksResume: false};
  const verdict = await acceptAndReview(x, v => {
    v.findings.push(finding);
    Object.assign(v.rows.find(r => r.id === finding.checkId), {status: "FINDING", findingId: finding.id, reason: "Owned debt"});
  });
  await x.host.disposition("previous", disposition(x, verdict), [{owner: finding.owner, work: finding.work,
    state: "WORKING", checkpoint: "repair-return", reviewAt: finding.reviewAt, evidence: "fixture:live-lease"}]);
  await x.approve(["previous"]); await x.run(); await x.host.close("previous");
  assert.deepEqual(await x.host.due(), [{id: "previous", action: "REPAIR_REVIEW_DUE"}]);
  const result = await runControlTick(x.host, {review: async offer => {
    assert.deepEqual(offer.input.previousFindings, [finding]);
    const next = verdictFor(x, offer);
    next.findings = [{...finding, status: "CLOSED", proof: "fixture:repaired", reviewedBy: x.config.reviewer,
      checkedKey: offer.key, attempts: 1, lastResult: "PASSED"}];
    return next;
  }});
  assert.equal(result.calls, 1); assert.equal(result.results[0].action, "OWNER_DISPOSITION_DUE");
});

test("accepted result enrolls review durably; owner cannot fabricate independent completion", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance); await x.approve(["previous"]);
  assert.deepEqual(await x.host.due(), [{id: "previous", action: "REVIEW_DUE"}]);
  const reopened = await openControlHost(x.dir, x.config, services);
  assert.deepEqual(await reopened.due(), await x.host.due());
  assert.equal((await x.run(reopened)).stats.commands, 0);
  const verdict = await acceptAndReview(x);
  await assert.rejects(x.host.disposition("previous", {...disposition(x, verdict), continuationEvidence: "I say done"}), /HOST_OBSERVATION_REQUIRED/);
  await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
});

test("complete stored cycle: acceptance, independent review, owner response, actual continuation, closure and restart", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict));
  assert.equal((await x.host.assess("previous")).action, "VERIFY_CONTINUATION");
  await x.approve(["previous"]);
  assert.equal((await x.run()).status, "ACTION_COMPLETED");
  assert.equal((await x.host.assess("previous")).action, "CONTROL_CONFIRMED");
  await x.host.close("previous");
  const resumed = await openControlHost(x.dir, x.config, services);
  assert.deepEqual(await resumed.due(), []);
  assert.equal((await x.run(resumed)).stats.commands, 0);
  assert.equal(await readFile(path.join(x.f.root, "actions.log"), "utf8"), "called\n");
  await x.f.put("memory.md", "stale memory");
  assert.deepEqual(await resumed.due(), [{id: "previous", action: "REVIEW_DUE"}]);
});

test("independent review regression: lost accepted artifact reopens control despite unchanged retention", async t=>{
  const x=await setup(t), verdict=await acceptAndReview(x);
  await x.host.disposition("previous",disposition(x,verdict));await x.approve(["previous"]);
  await x.run();await x.host.close("previous");
  await rm(path.join(x.f.root,"artifact.md"));
  assert.notEqual((await x.host.assess("previous")).action,"CONTROL_CONFIRMED");
  assert.deepEqual(await x.host.due(),[{id:"previous",action:"REVIEW_DUE"}]);
  await assert.rejects(x.host.close("previous"),/CONTROL_NOT_COMPLETE/);
  const offer=await x.host.claimReview("previous");assert.notEqual(offer.key,verdict.key);
  await assert.rejects(x.host.review("previous",offer,verdictFor(x,offer)),/REVIEW_INVALID/);
});

for(const source of ["return","artifact","proof","goal"])test(`changed accepted ${source} blocks dependent admission even when retention still matches`,async t=>{
  const x=await setup(t),verdict=await acceptAndReview(x);
  await x.host.disposition("previous",disposition(x,verdict));await x.approve(["previous"]);
  await x.f.put(`${source}.md`,"different accepted source");
  assert.equal((await x.run()).stats.commands,0);
  assert.deepEqual(await x.host.due(),[{id:"previous",action:"REVIEW_DUE"}]);
  assert.notEqual((await x.host.assess("previous")).action,"CONTROL_CONFIRMED");
  await assert.rejects(x.host.close("previous"),/CONTROL_NOT_COMPLETE/);
  await x.host.claimReview("previous");
});

test("registered semantic source drift blocks stale admission outside the four retention and accepted source paths",async t=>{
  const x=await setup(t,{registeredEvidence:true}),verdict=await acceptAndReview(x);
  await x.host.disposition("previous",disposition(x,verdict));await x.approve(["previous"]);
  await x.f.put("public-contract.md","changed duplicate semantics");
  assert.equal((await x.run()).stats.commands,0);
  assert.deepEqual(await x.host.due(),[{id:"previous",action:"REVIEW_DUE"}]);
  const offer=await x.host.claimReview("previous");assert.notEqual(offer.key,verdict.key);
  assert.equal(offer.input.sourceEvidence.rows[0].sha256,sha256("changed duplicate semantics"));
  const current=verdictFor(x,offer);await x.host.review("previous",offer,current);
  await x.host.disposition("previous",disposition(x,current));assert.equal((await x.run()).status,"ACTION_COMPLETED");
  await x.host.close("previous");
  const registry=JSON.parse(await readFile(x.config.evidenceRegistry,"utf8"));
  registry.sources.push({id:"new-decision",path:"missing-decision.md",purpose:"New required source"});
  await writeFile(x.config.evidenceRegistry,JSON.stringify(registry));
  assert.deepEqual(await x.host.due(),[{id:"previous",action:"REVIEW_DUE"}]);
});

test("missing memory is repaired and independently rechecked without repeating accepted product work", async t => {
  const x = await setup(t); await rm(path.join(x.f.root, "memory.md"));
  const finding = {id: "missing-memory", checkId: "C16.03", area: "C16",
    criterion: controlCatalog.flatMap(g => g.checks).find(c => c.id === "C16.03").criterion,
    evidence: "fixture:actual-missing-file", owner: "maintenance", work: "restore-memory", status: "OPEN",
    firstSeen: new Date().toISOString(), reviewAt: new Date(Date.now() + 60000).toISOString(), attempts: 0, blocksResume: true};
  const verdict = await acceptAndReview(x, v => {
    v.findings.push(finding);
    Object.assign(v.rows.find(r => r.id === finding.checkId), {status: "FINDING", findingId: finding.id, reason: "Missing write"});
  });
  await x.host.disposition("previous", {...disposition(x, verdict), action: "REPAIR"}, [{owner: finding.owner,
    work: finding.work, state: "WORKING", checkpoint: "repair-return", reviewAt: finding.reviewAt, evidence: "fixture:live-lease"}]);
  await x.approve(["previous"]); assert.equal((await x.run()).stats.commands, 0);
  await x.f.put("memory.md", "memory");
  const resumed = await openControlHost(x.dir, x.config, services);
  await resumed.requestRepairReview("previous", "fixture:restored-memory", [finding.id]);
  const offer = await resumed.claimReview("previous");
  assert.deepEqual(offer.input.previousFindings, [finding]);
  const repaired = verdictFor(x, offer);
  await assert.rejects(resumed.review("previous", offer, repaired), /REVIEW_INVALID/);
  repaired.findings = [{...finding, status: "CLOSED", proof: "fixture:actual-readback", reviewedBy: x.config.reviewer,
    checkedKey: offer.key, attempts: 1, lastResult: "PASSED"}];
  await resumed.review("previous", offer, repaired);
  await resumed.disposition("previous", disposition(x, repaired));
  assert.equal((await x.run(resumed)).status, "ACTION_COMPLETED"); await resumed.close("previous");
  const state = await resumed.snapshot();
  assert.deepEqual(state.acceptances.previous.acceptance, x.acceptance);
  assert.deepEqual(state.acceptances.previous.previousFindings, [finding]);
  assert.equal(await readFile(path.join(x.f.root, "actions.log"), "utf8"), "called\n");
});

test("changed retention, user pause and changed controller identity block the dependent action", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  await x.host.pause(true); assert.equal((await x.run()).stats.commands, 0);
  await x.host.pause(false); await x.f.put("memory.md", "not the accepted version");
  assert.equal((await x.run()).stats.commands, 0);
  const wrong = await openControlHost(x.dir, {...x.config, reviewer: "worker"}, services).catch(e => e);
  assert.match(wrong.message, /CONFIG_INVALID/);
  await assert.rejects(readFile(path.join(x.f.root, "actions.log")), {code: "ENOENT"});
});

test("semantic retention repair versions writes without rewriting acceptance or erasing a finding", async t => {
  const x = await setup(t);
  const finding = {id:"wrong-memory",checkId:"C16.03",area:"C16",
    criterion:controlCatalog.flatMap(g=>g.checks).find(c=>c.id==="C16.03").criterion,
    evidence:"fixture:semantic-contradiction-despite-matching-hash",owner:"maintenance",work:"correct-memory",
    status:"OPEN",firstSeen:new Date().toISOString(),reviewAt:new Date(Date.now()+60000).toISOString(),attempts:0,blocksResume:true};
  const verdict = await acceptAndReview(x, v => {
    v.findings=[finding];Object.assign(v.rows.find(r=>r.id===finding.checkId),{status:"FINDING",findingId:finding.id,reason:"Wrong meaning"});
  });
  const repair={owner:x.config.owner,reviewKey:hash(verdict),evidence:"fixture:correction",
    retention:x.acceptance.retention.map(r=>r.id==="memory"?{...r,expected:{...r.expected,sha256:sha256("corrected")}}:r)};
  await assert.rejects(x.host.recordRetentionRepair("previous",repair),/REPAIR_NOT_OWNED/);
  await x.host.disposition("previous",{...disposition(x,verdict),action:"REPAIR"},[{owner:finding.owner,work:finding.work,
    state:"WORKING",checkpoint:"readback",reviewAt:finding.reviewAt,evidence:"fixture:repair"}]);
  await assert.rejects(x.host.recordRetentionRepair("previous",repair),/NOT_OBSERVED/);
  await assert.rejects(x.host.recordRetentionRepair("previous",{...repair,retention:repair.retention.map(r=>r.id==="memory"?
    {id:r.id,required:false,reason:"ignore"}:r)}),/NOT_AUTHORIZED/);
  await x.f.put("memory.md","corrected");await x.host.pause(true);
  await assert.rejects(x.host.recordRetentionRepair("previous",repair),/REPAIR_NOT_OWNED/);
  await x.host.pause(false);await x.host.recordRetentionRepair("previous",repair);
  await x.approve(["previous"]);assert.equal((await x.run()).stats.commands,0);
  const host=await openControlHost(x.dir,x.config,services), offer=await host.claimReview("previous");
  assert.deepEqual(offer.input.acceptance,x.acceptance);
  assert.deepEqual(offer.input.previousFindings,[finding]);
  assert.equal(offer.input.observation.find(r=>r.id==="memory").status,"MATCH");
  assert.notEqual(offer.key,verdict.key);
  const fixed=verdictFor(x,offer);fixed.findings=[{...finding,status:"CLOSED",proof:"fixture:semantic-recheck",
    reviewedBy:x.config.reviewer,checkedKey:offer.key,attempts:1,lastResult:"PASSED"}];
  await host.review("previous",offer,fixed);await host.disposition("previous",disposition(x,fixed));
  assert.equal((await x.run(host)).status,"ACTION_COMPLETED");await host.close("previous");
  const saved=(await host.snapshot()).acceptances.previous;
  assert.deepEqual(saved.acceptance,x.acceptance);assert.equal(saved.retentionRevisions.length,1);
  assert.deepEqual(saved.previousFindings,[finding]);assert.deepEqual(await host.due(),[]);
});

test("missing acceptance source, altered verdict identity and changed state cannot pass", async t => {
  const x = await setup(t); await x.f.put("proof.md", "wrong proof");
  await assert.rejects(x.host.accept(x.acceptance), /SOURCE_MISMATCH/);
  await x.f.put("proof.md", "proof"); await x.host.accept(x.acceptance);
  const offer = await x.host.reviewInput("previous");
  await assert.rejects(x.host.review("previous", offer, {reviewer: "owner"}), /REVIEW_IDENTITY_INVALID/);
  await x.host.pause(true);
  await assert.rejects(x.host.review("previous", offer, {reviewer: "reviewer"}), /REVIEW_SOURCE_CHANGED/);
});

test("independent scheduled tick enrolls accepted work without an orchestrator turn; repeats stay quiet", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  let calls = 0;
  // The host tick is driven by the timer, not by any manager callback.
  await new Promise(resolve => setTimeout(resolve, 10));
  const result = await runControlTick(x.host, {review: async offer => {
    calls++;
    return {phase: "POST_ACCEPT", key: offer.key, reviewer: x.config.reviewer, runId: offer.runId,
      observedAt: new Date().toISOString(), findings: [],
      rows: controlCheckIds.map(id => ({id, status: "PASS", evidence: `fixture:${id}`}))};
  }});
  assert.equal(result.calls, 1); assert.equal(result.results[0].action, "OWNER_DISPOSITION_DUE");
  const second = await runControlTick(x.host, {review: () => {throw Error("Must not run twice");}});
  assert.equal(second.calls, 0); assert.equal(calls, 1);
  await assert.rejects(x.host.close("previous"), /CONTROL_NOT_COMPLETE/);
});

test("paused or zero-budget ticks launch no review; unavailable review remains owned across restart", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  await x.host.pause(true);
  assert.equal((await runControlTick(x.host, {review: () => {throw Error("unexpected");}})).calls, 0);
  await x.host.pause(false);
  assert.equal((await runControlTick(x.host, {maxReviews: 0})).calls, 0);
  const failed = await runControlTick(x.host, {timeoutMs: 5, review: () => new Promise(() => {})});
  assert.equal(failed.results[0].action, "REVIEW_RECONCILIATION_REQUIRED");
  const resumed = await openControlHost(x.dir, x.config, services);
  assert.equal((await runControlTick(resumed, {review: () => {throw Error("no retry");}})).calls, 0);
  assert.ok((await resumed.snapshot()).acceptances.previous.reviewLease.runId);
});

test("reconciliation needs stopped-process proof and explicit retry; it never forgets the old run", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const offer = await x.host.claimReview("previous"); await x.host.reviewFailure("previous", offer.runId);
  await assert.rejects(x.host.reconcileReview("previous"), /REVIEW_OBSERVER_REQUIRED/);
  let stopped = false;
  const resumed = await openControlHost(x.dir, x.config, {...services,
    observeReviewRun: async runId => ({runId, state: stopped ? "STOPPED" : "RUNNING", evidence: "fixture:process-readback"})});
  const decision = {reviewer: x.config.reviewer, action: "RETRY", evidence: "fixture:new-bounded-attempt"};
  await assert.rejects(resumed.reconcileReview("previous", decision), /REVIEW_OUTCOME_UNKNOWN/);
  stopped = true;
  await assert.rejects(resumed.reconcileReview("previous"), /INDEPENDENT_RETRY_DECISION_REQUIRED/);
  await resumed.reconcileReview("previous", decision);
  const next = await resumed.claimReview("previous");
  assert.notEqual(next.runId, offer.runId);
  assert.equal((await resumed.snapshot()).acceptances.previous.reviewAttempts[0].lease.runId, offer.runId);
});

test("reconciliation reuses a lost valid verdict without another model call", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const offer = await x.host.claimReview("previous"), verdict = verdictFor(x, offer);
  await x.host.reviewFailure("previous", offer.runId);
  const resumed = await openControlHost(x.dir, x.config, {...services,
    observeReviewRun: async runId => ({runId, state: "STOPPED", evidence: "fixture:retained-result", verdict})});
  assert.deepEqual(await resumed.reconcileReview("previous"), {action: "OWNER_DISPOSITION_DUE", reused: true});
  assert.deepEqual((await resumed.snapshot()).acceptances.previous.review, verdict);
});

test("repair review counterexample: old owner disposition cannot erase an independently queued retry", async t => {
  const x = await setup(t), verdict = await acceptAndReview(x);
  await x.host.disposition("previous", disposition(x, verdict)); await x.approve(["previous"]);
  await x.run(); await x.host.close("previous");
  await x.f.put("memory.md", "changed"); const offer = await x.host.claimReview("previous");
  await x.f.put("memory.md", "memory"); await x.host.reviewFailure("previous", offer.runId);
  const resumed = await openControlHost(x.dir, x.config, {...services,
    observeReviewRun: async runId => ({runId, state: "STOPPED", evidence: "fixture:stopped-run"})});
  await resumed.reconcileReview("previous", {reviewer: x.config.reviewer, action: "RETRY", evidence: "fixture:new-decision"});
  await assert.rejects(resumed.disposition("previous", disposition(x, verdict)), /REVIEW_PENDING/);
  assert.deepEqual(await resumed.due(), [{id: "previous", action: "REVIEW_DUE"}]);
});

test("repair review counterexample: obsolete saved verdict permits explicit retry with its full history", async t => {
  const x = await setup(t); await x.host.accept(x.acceptance);
  const offer = await x.host.claimReview("previous"), verdict = verdictFor(x, offer);
  await x.host.reviewFailure("previous", offer.runId); await x.f.put("memory.md", "changed");
  const resumed = await openControlHost(x.dir, x.config, {...services,
    observeReviewRun: async runId => ({runId, state: "STOPPED", evidence: "fixture:retained-result", verdict})});
  await assert.rejects(resumed.reconcileReview("previous"), /INDEPENDENT_RETRY_DECISION_REQUIRED/);
  await resumed.reconcileReview("previous", {reviewer: x.config.reviewer, action: "RETRY", evidence: "fixture:current-sources"});
  assert.deepEqual((await resumed.snapshot()).acceptances.previous.reviewAttempts[0].observation.verdict, verdict);
  const next = await resumed.claimReview("previous");
  assert.notEqual(next.key, offer.key); assert.notEqual(next.runId, offer.runId);
});

test("unpublished partial files do not become revisions; missing history fails closed", async t => {
  const x = await setup(t); await writeFile(path.join(x.dir, ".pending-abandoned"), "partial");
  const store = await openControlStore(x.dir);
  assert.equal((await store.read()).revision, 0);
  await x.host.pause(true); await rm(path.join(x.dir, "0000000000.json"));
  await assert.rejects(store.read(), /CONTROL_HISTORY_GAP/);
});

test("macOS sandbox denies control read/write and network while allowing scoped work", {skip: process.platform !== "darwin"}, async t => {
  const x = await setup(t); const launch = await localControlSandbox({workspace: x.f.root, controlRoot: x.dir});
  await x.approve(); assert.equal((await x.run(x.host, {sandboxLaunch: launch})).status, "ACTION_COMPLETED");
  const secret = path.join(x.dir, "private.json"); await writeFile(secret, "private-host-state");
  await symlink(secret, path.join(x.f.root, "alias.json"));
  for (const target of [secret, path.join(x.f.root, "alias.json")]) {
    const code = `const f=require('fs');for(const op of ['readFileSync','writeFileSync']){try{op==='readFileSync'?f[op](${JSON.stringify(target)}):f[op](${JSON.stringify(target)},'bad');process.exit(9)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e}}`;
    const spec = launch({executable: process.execPath, args: ["-e", code], cwd: x.f.root});
    const result = spawnSync(spec.executable, spec.args, {cwd: x.f.root, env: {}, encoding: "utf8", timeout: 5000});
    assert.equal(result.status, 0, result.stderr);
  }
  const linkCode = `const f=require('fs');try{f.linkSync(${JSON.stringify(secret)},${JSON.stringify(path.join(x.f.root, "hard-alias.json"))});process.exit(9)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e}`;
  const linkSpec = launch({executable: process.execPath, args: ["-e", linkCode], cwd: x.f.root});
  const linked = spawnSync(linkSpec.executable, linkSpec.args, {cwd: x.f.root, env: {}, encoding: "utf8", timeout: 5000});
  assert.equal(linked.status, 0, linked.stderr);
  const code = "const net=require('net');const s=net.connect(9,'127.0.0.1');s.on('connect',()=>process.exit(9));s.on('error',e=>process.exit(['EPERM','EACCES'].includes(e.code)?0:8));setTimeout(()=>process.exit(7),1000);";
  const spec = launch({executable: process.execPath, args: ["-e", code], cwd: x.f.root});
  const result = spawnSync(spec.executable, spec.args, {cwd: x.f.root, env: {}, encoding: "utf8", timeout: 5000});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(secret, "utf8"), "private-host-state");
});
