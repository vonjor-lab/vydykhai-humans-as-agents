import test from "node:test";
import assert from "node:assert/strict";
import { evaluateResumeReceipt } from "../scripts/task-continuity.mjs";
import { evaluateProductionContinuation, readProductionContinuation, evaluateLeaseActivity, readLeaseActivityScope } from "../scripts/vydykhai.mjs";
const scope = {work:"task",owner:"worker",humanEvent:"resume-2",checkpoint:"saved",action:"publish-saved"};
const fixture = () => ({...scope,boundary:"task-resume",pause:"CLEARED",effects:"RECONCILED",
  taskIdentity:{schemaVersion:1, failedRestorations:[],
    current:{work:"task",owner:"worker",revision:"brief-2",checkpoint:"saved",humanEvent:"resume-2",contextEpoch:"epoch-2",evidence:"current-checkpoint"},
    seen:{work:"task",revision:"brief-2",checkpoint:"saved",humanEvent:"resume-2",contextEpoch:"epoch-2",turnId:"turn-2",evidence:"worker-readback"}},
  dispatch:{...scope,turnId:"turn-2",evidence:"native-send"},
  readback:{evidence:"worker-readback",contextEpoch:"epoch-2",sequence:10},
  observed:{...scope,turnId:"turn-2",evidence:"native-first-command",kind:"FIRST_ACTION",contextEpoch:"epoch-2",sequence:11}});
test("resume needs actual first action, not promise, send or ACK", () => {
  const r = fixture();
  assert.equal(evaluateResumeReceipt(r).status,"PASS");
  delete r.observed;
  assert.equal(evaluateResumeReceipt(r).status,"UNVERIFIED");
  delete r.dispatch;
  assert.equal(evaluateResumeReceipt(r).status,"UNVERIFIED");
  const ack = fixture(); ack.observed.kind="ACK";
  assert.equal(evaluateResumeReceipt(ack).status,"UNVERIFIED");
});
test("old turn or other scope cannot pass current resume", () => {
  for (const key of [...Object.keys(scope),"turnId"]) {
    const r=fixture(); r.observed[key]="old";
    assert.equal(evaluateResumeReceipt(r).status,"MISMATCH");
  }
});
test("pause and unknown effects never authorize replay", () => {
  const r=fixture(); r.pause="ACTIVE";
  assert.equal(evaluateResumeReceipt(r).status,"UNVERIFIED");
  r.effects="UNKNOWN";
  assert.equal(evaluateResumeReceipt(r).status,"OUTCOME_UNKNOWN");
  assert.equal(evaluateResumeReceipt(r).replayAuthorized,false);
});
test("restoration keeps current resume, rejects replayed pause and honors genuinely new pause", () => {
  const r = fixture();
  assert.equal(evaluateResumeReceipt(r).status, "PASS");
  r.taskIdentity.current.contextEpoch = "epoch-3";
  assert.equal(evaluateResumeReceipt(r).status, "MISMATCH");
  r.taskIdentity.seen.contextEpoch = "epoch-3";
  r.taskIdentity.seen.humanEvent = "old-pause-1";
  assert.equal(evaluateResumeReceipt(r).status, "MISMATCH");
  r.taskIdentity.seen.humanEvent = "resume-2";
  assert.equal(evaluateResumeReceipt(r).status, "UNVERIFIED");
  r.readback.contextEpoch = r.observed.contextEpoch = "epoch-3";
  r.readback.sequence = 12;
  assert.equal(evaluateResumeReceipt(r).status, "UNVERIFIED");
  r.observed.sequence = 13;
  assert.equal(evaluateResumeReceipt(r).status, "PASS");
  r.taskIdentity.current.humanEvent = "new-pause-3";
  assert.equal(evaluateResumeReceipt(r).status, "MISMATCH");
  r.pause = "ACTIVE";
  assert.equal(evaluateResumeReceipt(r).status, "UNVERIFIED");
  assert.equal(evaluateResumeReceipt(r).replayAuthorized, false);
});
test("resume cannot omit identity or use a mutually matching but superseded event", () => {
  const r = fixture();
  delete r.taskIdentity;
  assert.equal(evaluateResumeReceipt(r).status, "UNVERIFIED");
  const s = fixture();
  s.taskIdentity.current.humanEvent = s.taskIdentity.seen.humanEvent = "later-event";
  assert.equal(evaluateResumeReceipt(s).status, "MISMATCH");
});
test("normal continuation observation consumes required resume instead of trusting ACTIVE", () => {
  const next = {schemaVersion:1,id:"next",work:"task",owner:"worker",state:"WORKING",action:"publish-saved",evidence:"saved"};
  const state = 'Orchestrator health: HEALTHY | Context: manager | Profile: low\n## Execution Leases\n| Work | State | Owner / context |\n| --- | --- | --- |\n| task | WORKING | worker |\n## Pending Return Inbox\n## Next-Best-Action\n```json\n'+JSON.stringify(next)+'\n```\n<!-- vydykhai:project-state:end -->';
  const now = Date.now(), receipt = fixture();
  const activity = {schemaVersion:1,continuationKey:readProductionContinuation(state).key,observedAt:new Date(now).toISOString(),
    orchestrator:{context:"manager",status:"IDLE",evidence:"native-manager"},
    owner:{context:"worker",status:"ACTIVE",turnId:"turn-2",evidence:"native-worker",resumeRequired:true,taskIdentity:receipt.taskIdentity}};
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_RESUME");
  activity.owner.resumeReceipt=receipt;
  assert.equal(evaluateProductionContinuation(state,activity,{now}).coverage,"COVERED");
  receipt.observed.sequence=9;
  assert.equal(evaluateProductionContinuation(state,activity,{now}).nextAction,"RECONCILE_RESUME");
  delete activity.owner;
  activity.leaseKey = readLeaseActivityScope(state).key;
  activity.leases = [{work:"task",context:"worker",status:"ACTIVE",turnId:"turn-2",
    evidence:"native-worker",resumeRequired:true,taskIdentity:receipt.taskIdentity}];
  for (const supplied of [undefined, receipt]) {
    activity.leases[0].resumeReceipt = supplied;
    const result = evaluateLeaseActivity(state,activity,{now});
    assert.equal(result.coverage,"LIMITED");
    assert.equal(result.nextActions[0].action,"RECONCILE_RESUME");
  }
});
