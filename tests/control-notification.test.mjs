import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, realpath, rm, readdir, readFile, lstat, chmod, symlink, rename, mkdir} from "node:fs/promises";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import os from "node:os";
import path from "node:path";
import {openControlNotification} from "../scripts/control-notification.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {notificationOwner} from "../scripts/control-notification-owner.mjs";
import {canonicalJson, sha256} from "../scripts/memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const review = {key: "c".repeat(64), findings: []};

const receipt = {schema: "control.observer-readback.v1", owner: "owner", status: "ONE_TICK_OBSERVED",
  descriptorHash: "a".repeat(64), observedAt: "2026-10-07T10:00:00.000Z", inboxCount: 1,
  host: {revision: 2, digest: "b".repeat(64)}};
const actionable = [{id: "health", action: "OWNER_DISPOSITION_DUE", reviewKey: hash(review)}];
async function fixture(t, limits = {}) {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "notification-test-")));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, {recursive: true, force: true}));
  const config = {directory, owner: "owner", transportActor: "host-transport", ...limits};
  const api = await openControlNotification(config);
  await api.initialize();
  const enqueue = (changes = {}) => api.enqueueObservation({receipt, actionable, complete:true, ...changes});
  return {directory, config, api, enqueue};
}
const binding = notice => ({id: notice.body.id, noticeHash: notice.noticeHash, actor: "host-transport"});
const evidence = claim => ({id: claim.id, noticeHash: claim.noticeHash, actor: claim.actor,
  attemptId: claim.attemptId, evidence: "local-consumer-readback:1"});
test("owner transport binds actual readback; application is independently observed and lost reads can resume",async t=>{
  const x=await fixture(t);await x.enqueue();
  let disposition=null;
  const host={snapshot:async()=>({paused:false,acceptances:{health:{disposition,review,
    findings:[],repairLeases:[],enrollment:"CONTINUATION_OR_REPAIR_DUE"}}}),due:async()=>[]};
  const make=()=>notificationOwner({notifications:x.api,host,owner:"owner",transportActor:"host-transport"});
  const first=make(),[packet]=await first.readNotices();
  await assert.rejects(first.acknowledge({id:packet.notice.id,deliveryToken:"invented"}),/READBACK_REQUIRED/);
  assert.equal((await x.api.snapshot()).pendingDelivery,1);
  const resumed=make();
  await assert.rejects(resumed.acknowledge({id:packet.notice.id,deliveryToken:packet.deliveryToken}),/READBACK_REQUIRED/);
  const [again]=await resumed.readNotices();
  assert.equal((await x.api.snapshot()).state.notices[0].attempts.length,1);
  const ack=await resumed.acknowledge({id:again.notice.id,deliveryToken:again.deliveryToken});
  assert.equal(ack.ownerApplied,false);assert.equal((await x.api.snapshot()).pendingDelivery,0);
  assert.equal((await x.api.snapshot()).pendingOwnerApplication,1);
  disposition={reviewKey:"wrong",action:"CONTINUE"};assert.deepEqual(await resumed.recordApplications(),[]);
  disposition={owner:"owner",reviewKey:actionable[0].reviewKey,action:"CONTINUE",nextAction:"next",evidence:"observed response"};
  assert.deepEqual(await resumed.recordApplications(),[packet.notice.id]);
  assert.equal((await x.api.snapshot()).pendingOwnerApplication,0);
});
for (const id of ["health", "@health"]) {
  for (const mode of ["paused", "missing-lease", "closed-lease", "late-lease", "blocking-continue",
    "empty-evidence", "wrong-owner", "invalid-action", "stale-review", "review-in-flight", "review-due", "source-drift",
    "raced-pause", "raced-disposition", "raced-lease"]) {
    test(`notification application refuses ${id} ${mode} disposition`, async t => {
      const x = await fixture(t);
      const finding = {status:"OPEN",owner:"maintenance",work:"repair",blocksResume:true,reviewAt:"2026-10-07T12:00:00.000Z"};
      const currentReview = {...review,findings:[finding]};
      const reviewKey = hash(currentReview);
      const row = {review:currentReview,findings:[finding],reviewLease:null,
        enrollment:id === "@health" ? "REPAIR_DUE" : "CONTINUATION_OR_REPAIR_DUE",
        disposition:{owner:"owner",reviewKey,action:"REPAIR",evidence:"owned repair"},
        repairLeases:[{owner:finding.owner,work:finding.work,state:"WORKING",checkpoint:"repair-return",
          evidence:"live repair",reviewAt:finding.reviewAt}]};
      const state = {paused:mode === "paused",acceptances:{health:row},health:row};
      if (mode === "missing-lease") row.repairLeases = [];
      if (mode === "closed-lease") row.repairLeases[0].state = "CLOSED";
      if (mode === "late-lease") row.repairLeases[0].reviewAt = "2026-10-07T12:00:01.000Z";
      if (mode === "blocking-continue") row.disposition.action = "CONTINUE";
      if (mode === "empty-evidence") row.disposition.evidence = " ";
      if (mode === "wrong-owner") row.disposition.owner = "other";
      if (mode === "invalid-action") row.disposition.action = "DONE";
      if (mode === "stale-review") row.review = {...currentReview,key:"new review"};
      if (mode === "review-in-flight") row.reviewLease = {runId:"pending"};
      if (mode === "review-due") row.enrollment = "REVIEW_DUE";
      const host = {snapshot:async()=>structuredClone(state),due:async()=>{
        if (mode === "raced-pause") state.paused = true;
        if (mode === "raced-disposition") row.disposition = {...row.disposition,evidence:"another response"};
        if (mode === "raced-lease") row.repairLeases = [];
        return mode === "source-drift" ? [{id,action:"REVIEW_DUE"}] : [];
      }};
      await x.enqueue({actionable:[{id,action:"OWNER_DISPOSITION_DUE",reviewKey}]});
      const owner = notificationOwner({notifications:x.api,host,owner:"owner",transportActor:"host-transport"});
      const [packet] = await owner.readNotices();
      assert.equal((await owner.acknowledge({id:packet.notice.id,deliveryToken:packet.deliveryToken})).ownerApplied,false);
      assert.equal((await x.api.snapshot()).pendingOwnerApplication,1);
      assert.equal((await x.api.snapshot()).state.notices[0].ownerApplied,null);
      assert.equal(row.findings[0].status,"OPEN");
    });
  }
  test(`notification application accepts ${id} valid REPAIR without claiming closure`, async t => {
    const x = await fixture(t);
    const finding = {status:"OPEN",owner:"maintenance",work:"repair",blocksResume:true,reviewAt:"2026-10-07T12:00:00.000Z"};
    const currentReview = {...review,findings:[finding]},reviewKey = hash(currentReview);
    const row = {review:currentReview,findings:[finding],reviewLease:null,
      enrollment:id === "@health" ? "REPAIR_DUE" : "CONTINUATION_OR_REPAIR_DUE",
      disposition:{owner:"owner",reviewKey,action:"REPAIR",evidence:"owned repair"},
      repairLeases:[{owner:finding.owner,work:finding.work,state:"WAITING",checkpoint:"repair-return",
        resumeWhen:"dependency ready",evidence:"live repair",reviewAt:finding.reviewAt}]};
    const state = {paused:false,acceptances:{health:row},health:row};
    const host = {snapshot:async()=>structuredClone(state),due:async()=>[]};
    await x.enqueue({actionable:[{id,action:"OWNER_DISPOSITION_DUE",reviewKey}]});
    const owner = notificationOwner({notifications:x.api,host,owner:"owner",transportActor:"host-transport"});
    const [packet] = await owner.readNotices();
    assert.equal((await owner.acknowledge({id:packet.notice.id,deliveryToken:packet.deliveryToken})).ownerApplied,true);
    assert.equal((await x.api.snapshot()).pendingOwnerApplication,0);
    assert.deepEqual(await host.snapshot(),state);
    assert.equal(row.findings[0].status,"OPEN");
  });
}
for (const enrollment of ["FINAL_READBACK_DUE", "CLOSED"]) {
  test(`notification application preserves valid CONTINUE at ${enrollment}`, async t => {
    const x = await fixture(t); await x.enqueue();
    const row = {review,findings:[],repairLeases:[],enrollment,
      disposition:{owner:"owner",reviewKey:hash(review),action:"CONTINUE",nextAction:"next",evidence:"owned response",
        continuationEvidence:"host-observed continuation"}};
    const host = {snapshot:async()=>({paused:false,acceptances:{health:row}}),
      due:async()=>enrollment === "CLOSED" ? [] : [{id:"health",action:enrollment}]};
    const owner = notificationOwner({notifications:x.api,host,owner:"owner",transportActor:"host-transport"});
    const [packet] = await owner.readNotices();
    assert.equal((await owner.acknowledge({id:packet.notice.id,deliveryToken:packet.deliveryToken})).ownerApplied,true);
    assert.equal(row.enrollment,enrollment);
    assert.equal((await x.api.snapshot()).pendingOwnerApplication,0);
  });
}
for(const action of ["REVIEW_DUE","CADENCE_OBSERVATION_DUE"])test(`old disposition does not apply a new ${action} obligation`,async t=>{
  const x=await fixture(t);await x.enqueue({actionable:[{...actionable[0],action}]});
  const host={snapshot:async()=>({acceptances:{health:{disposition:{reviewKey:actionable[0].reviewKey,action:"CONTINUE"}}}})};
  const owner=notificationOwner({notifications:x.api,host,owner:"owner",transportActor:"host-transport"});
  const [n]=await owner.readNotices();
  assert.equal((await owner.acknowledge({id:n.notice.id,deliveryToken:n.deliveryToken})).ownerApplied,false);
  assert.equal((await x.api.snapshot()).pendingOwnerApplication,1);
});
test("incomplete error observations cannot supersede unresolved full observations",async t=>{
  const x=await fixture(t),first=await x.enqueue({complete:true});
  await x.enqueue({complete:false,receipt:{...receipt,status:"UNKNOWN_RECONCILIATION_REQUIRED"},
    actionable:[{action:"UNKNOWN_RECONCILIATION_REQUIRED"}]});
  const s=await x.api.snapshot();assert.equal(s.pendingDelivery,2);
  assert.equal(s.state.notices.find(n=>n.body.id===first.notice.body.id).supersededBy,undefined);
});

test("actual private append-only files: receipt/inbox is pending, restart deduplicates unchanged observations", async t => {
  const x = await fixture(t), first = await x.enqueue();
  assert.equal(first.queued, true);
  assert.equal(first.notice.transportObserved, null);
  assert.equal(first.notice.ownerApplied, null);
  const before = await x.api.snapshot();
  assert.equal(before.pendingDelivery, 1);
  assert.equal(before.pendingOwnerApplication, 1);
  const names = (await readdir(x.directory)).sort();
  assert.deepEqual(names, ["0000000000.json", "0000000001.json"]);
  for (const name of names) assert.equal((await lstat(path.join(x.directory, name))).mode & 0o777, 0o600);
  const initialBytes = await readFile(path.join(x.directory, names[0]), "utf8");
  // A separate process proves restart, without network/native transport/model use.
  const moduleUrl = new URL("../scripts/control-notification.mjs", import.meta.url).href;
  const code = `import {openControlNotification} from ${JSON.stringify(moduleUrl)};
    const api = await openControlNotification(${JSON.stringify(x.config)});
    await api.initialize();
    console.log(JSON.stringify(await api.enqueueObservation(${JSON.stringify({receipt: {...receipt,
      observedAt: "2026-10-07T11:00:00.000Z", inboxCount: 9, host: {revision: 99}}, actionable,complete:true})})));`;
  const child = await promisify(execFile)(process.execPath, ["--input-type=module", "-e", code], {timeout: 10000});
  const duplicate = JSON.parse(child.stdout);
  assert.equal(duplicate.queued, false);
  assert.equal(duplicate.notice.body.id, first.notice.body.id);
  assert.deepEqual(await x.api.snapshot(), before);
  assert.equal(await readFile(path.join(x.directory, names[0]), "utf8"), initialBytes);
});

test("changed actionable projection and resolved/recurrent episode create exact new notice identities", async t => {
  const x = await fixture(t), first = await x.enqueue();
  const second = await x.enqueue({actionable: [{...actionable[0], reviewKey: "d".repeat(64)}]});
  assert.equal(second.queued, true);
  assert.notEqual(second.notice.noticeHash, first.notice.noticeHash);
  assert.deepEqual(await x.enqueue({actionable: []}), {queued: false, notice: null});
  const third = await x.enqueue();
  assert.equal(third.queued, true);
  assert.notEqual(third.notice.body.id, first.notice.body.id);
  const snapshot=await x.api.snapshot();
  assert.equal(snapshot.pendingDelivery, 1);
  assert.equal(snapshot.state.notices.length,3);
  assert.ok(snapshot.state.notices[0].supersededBy);
  assert.equal(snapshot.state.notices[0].ownerApplied,null);
  assert.equal(snapshot.state.notices[0].transportObserved,null);
});

test("concurrent enqueue CAS deduplicates; concurrent claim/failure never loses pending delivery", async t => {
  const x = await fixture(t), other = await openControlNotification(x.config);
  const results = await Promise.all([x.enqueue(), other.enqueueObservation({receipt, actionable,complete:true})]);
  assert.equal(results.filter(r => r.queued).length, 1);
  assert.equal(results[0].notice.body.id, results[1].notice.body.id);
  const input = binding(results[0].notice);
  const claims = await Promise.allSettled([x.api.beginDelivery(input), other.beginDelivery(input)]);
  assert.equal(claims.filter(c => c.status === "fulfilled").length, 1);
  assert.match(claims.find(c => c.status === "rejected").reason.message, /DELIVERY_IN_FLIGHT/);
  const claim = claims.find(c => c.status === "fulfilled").value;
  const failure = {...evidence(claim), error: "local transport unavailable"};
  await Promise.all([x.api.recordDeliveryFailure(failure), other.recordDeliveryFailure(failure)]);
  const snapshot = await other.snapshot();
  assert.equal(snapshot.pendingDelivery, 1);
  assert.equal(snapshot.state.notices[0].attempts.length, 1);
  assert.equal(snapshot.state.notices[0].attempts[0].status, "FAILED");
  assert.equal(snapshot.state.notices[0].transportObserved, null);
  assert.equal(snapshot.state.notices[0].ownerApplied, null);
  const restarted = await openControlNotification(x.config);
  const retry = await restarted.beginDelivery(input);
  assert.notEqual(retry.attemptId, claim.attemptId);
  await assert.rejects(restarted.recordTransportObserved(evidence(claim)), /ATTEMPT_MISMATCH/);
});

test("lost in-flight claim survives restart and cannot be stolen or treated as delivery", async t => {
  const x = await fixture(t), {notice} = await x.enqueue();
  const claim = await x.api.beginDelivery(binding(notice));
  const restart = await openControlNotification(x.config);
  await restart.initialize();
  await assert.rejects(restart.beginDelivery(binding(notice)), /DELIVERY_IN_FLIGHT/);
  assert.equal((await restart.snapshot()).pendingDelivery, 1);
  await restart.recordDeliveryFailure({...evidence(claim), error: "host reconciled interrupted claim"});
  assert.equal((await restart.snapshot()).pendingDelivery, 1);
});

test("ack binds exact notice id/hash, attempt and actor; transport observed is not owner applied", async t => {
  const x = await fixture(t), {notice} = await x.enqueue(), claim = await x.api.beginDelivery(binding(notice));
  const ack = evidence(claim), before = await x.api.snapshot();
  for (const patch of [{id: "wrong"}, {noticeHash: "0".repeat(64)}, {actor: "model"}, {attemptId: "wrong"}]) {
    await assert.rejects(x.api.recordTransportObserved({...ack, ...patch}), /MISMATCH/);
  }
  await assert.rejects(x.api.recordTransportObserved({...ack, evidence: ""}), /EVIDENCE_REQUIRED/);
  await assert.rejects(x.api.recordOwnerApplied({...ack, actor: "owner"}), /TRANSPORT_EVIDENCE_REQUIRED/);
  assert.deepEqual(await x.api.snapshot(), before);
  await x.api.recordTransportObserved(ack);
  const transported = await x.api.snapshot();
  assert.equal(transported.pendingDelivery, 0);
  assert.equal(transported.pendingOwnerApplication, 1);
  assert.equal(transported.state.notices[0].ownerApplied, null);
  await x.api.recordTransportObserved(ack);
  assert.deepEqual(await x.api.snapshot(), transported);
  await assert.rejects(x.api.recordTransportObserved({...ack, evidence: "different readback"}), /EVIDENCE_CONFLICT/);
  await assert.rejects(x.api.recordOwnerApplied(ack), /ACTOR_MISMATCH/);
  await assert.rejects(x.api.recordOwnerApplied({...ack, actor: "owner", noticeHash: "0".repeat(64)}), /NOTICE_MISMATCH/);
  await x.api.recordOwnerApplied({...ack, actor: "owner", evidence: "owner-application-readback:1"});
  const final = await x.api.snapshot();
  assert.equal(final.pendingOwnerApplication, 0);
  const restart = await openControlNotification(x.config);
  assert.deepEqual(await restart.snapshot(), final);
  assert.equal((await x.enqueue()).queued, false);
  await assert.rejects(restart.beginDelivery(binding(notice)), /ALREADY_OBSERVED/);
});

test("racing transport evidence and failure are monotonic, not a delivery rollback", async t => {
  const x = await fixture(t), {notice} = await x.enqueue(), claim = await x.api.beginDelivery(binding(notice));
  const other = await openControlNotification(x.config), ack = evidence(claim);
  await Promise.all([x.api.recordDeliveryFailure({...ack, error: "late failure"}), other.recordTransportObserved(ack)]);
  assert.equal((await x.api.snapshot()).pendingDelivery, 0);
  await x.api.recordDeliveryFailure({...ack, error: "another late failure"});
  assert.equal((await x.api.snapshot()).state.notices[0].transportObserved.evidence, ack.evidence);
});

test("finite notice/attempt/revision allocations never evict pending work or replenish on restart", async t => {
  const x = await fixture(t, {maxNotices: 1, maxAttempts: 1, maxRevisions: 4});
  const {notice} = await x.enqueue(), claim = await x.api.beginDelivery(binding(notice));
  await x.api.recordDeliveryFailure({...evidence(claim), error: "not delivered"});
  const before = await x.api.snapshot();
  await assert.rejects(x.enqueue({actionable: [{id: "another"}]}), /NOTICE_CAPACITY/);
  await assert.rejects(x.api.beginDelivery(binding(notice)), /ATTEMPT_CAPACITY/);
  await assert.rejects(x.enqueue({actionable: []}), /REVISION_CAPACITY/);
  await assert.rejects(x.api.recordTransportObserved(evidence(claim)), /REVISION_CAPACITY/);
  assert.deepEqual(await x.api.snapshot(), before);
  assert.equal((await x.enqueue()).queued, false);
  assert.equal((await readdir(x.directory)).length, 4);
  const restart = await openControlNotification(x.config);
  assert.deepEqual(await restart.snapshot(), before);
  await assert.rejects((await openControlNotification({...x.config, maxRevisions: 5})).initialize(), /CONFIG_MISMATCH/);
});

test("bounds and private host directory are enforced before publication", async t => {
  const x = await fixture(t), before = await x.api.snapshot();
  await assert.rejects(x.enqueue({receipt: {...receipt, owner: "other"}}), /RECEIPT_INVALID/);
  await assert.rejects(x.enqueue({receipt: {...receipt, padding: "x".repeat(17000)}}), /RECEIPT_INVALID/);
  await assert.rejects(x.enqueue({actionable: [{padding: "x".repeat(9000)}]}), /OBSERVATION_INVALID/);
  assert.deepEqual(await x.api.snapshot(), before);
  await assert.rejects(openControlNotification({...x.config, maxRevisions: 2000}), /LIMITS_INVALID/);
  await chmod(x.directory, 0o755);
  await assert.rejects(x.api.snapshot(), /DIRECTORY_UNSAFE/);
  await chmod(x.directory, 0o700);
  const alias = x.directory + "-alias";
  t.after(() => rm(alias, {force: true}));
  await symlink(x.directory, alias);
  await assert.rejects(openControlNotification({...x.config, directory: alias}), /DIRECTORY_UNSAFE/);
});

test("concurrent initialization publishes only one allocation; an unrelated host journal is never reused", async t => {
  const directory = await realpath(await mkdtemp(path.join(os.tmpdir(), "notification-init-")));
  await chmod(directory, 0o700);
  t.after(() => rm(directory, {recursive: true, force: true}));
  const config = {directory, owner: "owner", transportActor: "host-transport"};
  const first = await openControlNotification(config), second = await openControlNotification(config);
  const rows = await Promise.all([first.initialize(), second.initialize()]);
  assert.equal(rows[0].digest, rows[1].digest);
  assert.deepEqual(await readdir(directory), ["0000000000.json"]);
  const foreign = path.join(directory, "host");
  await mkdir(foreign, {mode: 0o700});
  const store = await openControlStore(foreign);
  const before = await store.initialize({schema: "control.host.v1", paused: true});
  const sidecar = await openControlNotification({...config, directory: foreign});
  await assert.rejects(sidecar.initialize(), /CONFIG_MISMATCH/);
  assert.deepEqual(await store.read(), before);
});

test("directory replacement refuses existing handles and does not certify an empty replacement", async t => {
  const x = await fixture(t), moved = x.directory + "-old";
  t.after(() => rm(moved, {recursive: true, force: true}));
  await x.enqueue();
  await rename(x.directory, moved);
  await mkdir(x.directory, {mode: 0o700});
  await assert.rejects(x.api.snapshot(), /DIRECTORY_CHANGED/);
  await assert.rejects(x.enqueue(), /DIRECTORY_CHANGED/);
  await assert.rejects(x.api.initialize(), /DIRECTORY_CHANGED/);
  assert.deepEqual(await readdir(x.directory), []);
  assert.equal((await readdir(moved)).length, 2);
});
