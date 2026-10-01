import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { evaluateTaskIdentity, evaluateProductionContinuation, readProductionContinuation, classifyGuard,
  readLeaseActivityScope, evaluateLeaseActivity } from "../scripts/vydykhai.mjs";

const now = Date.parse("2026-01-01T12:00:00Z");
const scope = {work: "WORK-1", context: "worker", turnId: "turn-2"};
const current = {work: "WORK-1", owner: "worker", revision: "brief-2", checkpoint: "checkpoint-2",
  humanEvent: "human-2", contextEpoch: "compaction-2", evidence: "authenticated-current-checkpoint-and-native-epoch"};
const seen = {work: "WORK-1", revision: "brief-2", checkpoint: "checkpoint-2", humanEvent: "human-2",
  contextEpoch: "compaction-2", turnId: "turn-2", evidence: "actual-turn-readback"};
const identity = (changes = {}) => ({schemaVersion: 1, current, seen, failedRestorations: [], ...changes});
function state(waiting = false) {
  return `Orchestrator health: HEALTHY | Context: manager | Profile: accepted
Project Guard: LIMITED | Incident: none
Human attention: PENDING | decisionId: review-1
## Execution Leases
| Work | State | Owner / context |
| --- | --- | --- |
| WORK-1 [GOAL] - accepted increment | ${waiting ? "WAITING" : "WORKING"} | worker |
## Pending Return Inbox
## Next-Best-Action
\`\`\`json
${JSON.stringify({schemaVersion: 1, id: "NEXT-1", work: "WORK-1", action: "Continue accepted increment",
    owner: "worker", state: waiting ? "WAITING" : "WORKING", evidence: "current-brief",
    ...(waiting ? {resumeWhen: "Human returns control"} : {})})}
\`\`\`
<!-- vydykhai:project-state:end -->`;
}
function activity(content, taskIdentity, changes = {}) {
  return {schemaVersion: 1, observedAt: new Date(now).toISOString(), continuationKey: readProductionContinuation(content).key,
    orchestrator: {context: "manager", status: "IDLE", evidence: "native-current-manager"},
    wait: {status: "PENDING", evidence: "current-human-wait"},
    owner: {context: "worker", status: "IDLE", turnId: "turn-2", evidence: "native-current-turn",
      taskIdentity, ...changes}};
}

test("ordinary current continuation is aligned; no enrollment is not proof", () => {
  assert.equal(evaluateTaskIdentity(undefined, scope).coverage, "NOT_REQUESTED");
  const r = evaluateTaskIdentity(identity(), scope);
  assert.equal(r.coverage, "COVERED"); assert.equal(r.nextAction, null);
  assert.equal(r.replayAuthorized, false); assert.equal(r.replacementAuthorized, false);
});

for (const field of ["work", "revision", "checkpoint", "humanEvent", "contextEpoch"]) {
  test(`restored old ${field} cannot supersede current assignment`, () => {
    const value = identity({seen: {...seen, [field]: "old"}});
    const first = evaluateTaskIdentity(value, scope);
    assert.equal(first.nextAction, "RESTORE_CURRENT_TASK");
    value.failedRestorations.push({turnId: "repair-1", evidence: "same-loss-after-repair"});
    assert.equal(evaluateTaskIdentity(value, scope).nextAction, "REBRIEF_FRESH_CONTEXT");
  });
}

test("missing, wrong-turn, wrong-owner, malformed and duplicate evidence remain limited", () => {
  for (const value of [null, {}, identity({seen:null}), identity({seen:{...seen,turnId:"old-turn"}}),
    identity({current:{...current,owner:"other"}}), identity({current:{...current,work:"other"}}),
    identity({current:{...current,evidence:"<missing>"}}), identity({failedRestorations:[{turnId:"r",evidence:"e"},{turnId:"r",evidence:"e"}]}),
    identity({failedRestorations:[{turnId:"r"}]}), identity({seen:{...seen,extra:"unreviewed"}})]) {
    const r = evaluateTaskIdentity(value, scope);
    assert.equal(r.coverage, "LIMITED"); assert.equal(r.nextAction, "RECOVER_OBSERVATION");
    assert.equal(r.replacementAuthorized, false);
  }
});

test("old-question final routes current-task restoration, not result reconciliation", () => {
  const content = state();
  const observation = activity(content, identity({seen:{...seen,revision:"old-question"}}),
    {terminal:{turnId:"turn-2",status:"RESULT",evidence:"old-question-final"}});
  const r = evaluateProductionContinuation(content, observation, {now});
  assert.equal(r.nextAction, "RESTORE_CURRENT_TASK");
  const guard = classifyGuard({ok:false,stateIssues:r.issues,graphIssues:[],continuation:r},content);
  assert.equal(guard.action, "WAKE");
  observation.orchestrator.status = "ACTIVE";
  const busy = evaluateProductionContinuation(content, observation, {now});
  const deferred = classifyGuard({ok:false,stateIssues:busy.issues,graphIssues:[],continuation:busy},content);
  assert.equal(deferred.action, "NOOP"); assert.equal(deferred.requiredAction, "WAKE");
});

test("a real blocker, unavailable outcome and explicit human wait dominate recovery", () => {
  const stale = identity({seen:{...seen,revision:"old"},failedRestorations:[{turnId:"r",evidence:"repeat"}]});
  for (const [terminal, expected] of [
    [{turnId:"turn-2",status:"BLOCKED",evidence:"policy-denial",resumeWhen:"Policy permits"},"RESOLVE_BLOCKER"],
    [{turnId:"turn-2",status:"UNAVAILABLE",evidence:"unknown-external-outcome"},"RECOVER_OBSERVATION"]]) {
    const r = evaluateProductionContinuation(state(),activity(state(),stale,{terminal}),{now});
    assert.equal(r.nextAction,expected);
  }
  const content = state(true), observation = activity(content,stale);
  const r = evaluateProductionContinuation(content,observation,{now});
  assert.equal(r.signal,null); assert.equal(r.nextAction,null);
  assert.equal(classifyGuard({ok:true,stateIssues:[],graphIssues:[],continuation:r},content).action,"NOOP");
});

test("whole-lease coverage checks the same task identity and rejects conflicting projections", () => {
  const content = state(), observation = activity(content,identity());
  observation.owner.status = "ACTIVE";
  observation.leaseKey = readLeaseActivityScope(content).key;
  observation.leases = [{work:"WORK-1",...observation.owner}];
  assert.equal(evaluateLeaseActivity(content,observation,{now}).signal,false);
  observation.leases[0].taskIdentity = identity({seen:{...seen,checkpoint:"old"}});
  assert.equal(evaluateLeaseActivity(content,observation,{now}).coverage,"LIMITED");
  observation.owner.taskIdentity = observation.leases[0].taskIdentity;
  assert.equal(evaluateLeaseActivity(content,observation,{now}).nextActions[0].action,"RESTORE_CURRENT_TASK");
});

test("one failed restoration changes routing without discarding the accepted checkpoint", () => {
  const value = identity({seen:{...seen,revision:"old"},failedRestorations:[{turnId:"repair-1",evidence:"observed-repeat"}]});
  const before = structuredClone(value);
  assert.equal(evaluateProductionContinuation(state(),activity(state(),value),{now}).nextAction,"REBRIEF_FRESH_CONTEXT");
  assert.deepEqual(value,before);
  value.seen = {...seen};
  assert.equal(evaluateTaskIdentity(value,scope).nextAction,null);
  const content = state(), observation = activity(content,value,{status:"ACTIVE"});
  const restored = evaluateProductionContinuation(content,observation,{now});
  for (let i=0;i<20;i++) assert.equal(classifyGuard({ok:true,stateIssues:[],graphIssues:[],continuation:restored},content).action,"NOOP");
});

test("a same-turn readback from before compaction cannot certify restored task identity", () => {
  const content = state(), value = identity({seen:{...seen,contextEpoch:"before-compaction"}});
  const observation = activity(content,value,{terminal:{turnId:"turn-2",status:"RESULT",evidence:"old-annotation-answer"}});
  assert.equal(evaluateProductionContinuation(content,observation,{now}).nextAction,"RESTORE_CURRENT_TASK");
  observation.owner.taskIdentity.seen.contextEpoch = "compaction-2";
  assert.equal(evaluateProductionContinuation(content,observation,{now}).nextAction,"RECONCILE_RESULT");
});

test("known execution access denial is resolved before a new restoration attempt", () => {
  const checks = Object.fromEntries(["cwd","sources","report","delivery"].map(k=>[k,{status:"AVAILABLE",evidence:`actual-${k}`} ]));
  checks.report = {status:"DENIED",evidence:"current-policy",resumeWhen:"Report scope permitted"};
  const value = identity({seen:{...seen,revision:"old"}});
  const r = evaluateProductionContinuation(state(),activity(state(),value,{readiness:checks}),{now});
  assert.equal(r.nextAction,"RESOLVE_ACCESS");
});

test("covered legacy activity is not reported as enrolled identity protection", () => {
  const content = state(), observation = activity(content,identity(),{status:"ACTIVE"});
  assert.equal(evaluateProductionContinuation(content,observation,{now}).identityCoverage,"COVERED");
  delete observation.owner.taskIdentity;
  const legacy = evaluateProductionContinuation(content,observation,{now});
  assert.equal(legacy.coverage,"COVERED"); assert.equal(legacy.identityCoverage,"NOT_REQUESTED");
  observation.leaseKey = readLeaseActivityScope(content).key;
  observation.leases = [{work:"WORK-1",...observation.owner,taskIdentity:identity()}];
  assert.equal(evaluateLeaseActivity(content,observation,{now}).coverage,"LIMITED");
  observation.owner.taskIdentity = identity();
  assert.equal(evaluateLeaseActivity(content,observation,{now}).taskIdentities[0].coverage,"COVERED");
});

test("two aligned but different assignments cannot share an observation verdict", () => {
  const content = state(), observation = activity(content,identity(),{status:"ACTIVE"});
  observation.leaseKey = readLeaseActivityScope(content).key;
  for (const field of ["revision", "checkpoint", "humanEvent", "contextEpoch"]) {
    observation.leases = [{work:"WORK-1",...observation.owner,
      taskIdentity:identity({current:{...current,[field]:"other"},seen:{...seen,[field]:"other"}})}];
    assert.equal(evaluateLeaseActivity(content,observation,{now}).coverage,"LIMITED",field);
  }
  const equivalent = identity({current:{...current,evidence:"second-authenticated-source"},
    seen:Object.fromEntries(Object.entries(seen).reverse())});
  observation.leases = [{work:"WORK-1",...observation.owner,taskIdentity:equivalent}];
  assert.equal(evaluateLeaseActivity(content,observation,{now}).coverage,"COVERED");
});

test("combined JSON keys cannot stand in for required checkpoint and epoch fields", () => {
  const value = structuredClone(identity());
  for (const projection of [value.current,value.seen]) {
    delete projection.checkpoint; delete projection.contextEpoch;
    projection["checkpoint,contextEpoch"] = "not-two-fields";
  }
  assert.equal(evaluateTaskIdentity(value,scope).coverage,"LIMITED");
});

test("unobserved secondary lease retains limited task-identity coverage", () => {
  const content = state(), observation = activity(content,identity({seen:null}),{status:"ACTIVE"});
  observation.leaseKey = readLeaseActivityScope(content).key;
  observation.leases = [{work:"WORK-1",...observation.owner}];
  delete observation.owner;
  const result = evaluateLeaseActivity(content,observation,{now});
  assert.equal(result.coverage,"LIMITED");
  assert.equal(result.taskIdentities[0].coverage,"LIMITED");
  assert.deepEqual(result.nextActions,[]);
});

test("recurrence and unrelated edits cannot renew the automatic repair budget", () => {
  const content = state(), value = identity({seen:{...seen,checkpoint:"old"}});
  const classify = (content, options={}) => {
    const continuation = evaluateProductionContinuation(content,activity(content,value),{now});
    return classifyGuard({ok:false,stateIssues:continuation.issues,graphIssues:[],continuation},content,options);
  };
  const first = classify(content);
  assert.equal(first.action,"WAKE");
  value.failedRestorations = [{turnId:"repair-1",evidence:"same-loss-after-repair"}];
  const unrelated = `${content}\nUnrelated documentation updated.\n`;
  const repeated = classify(unrelated,{wokenIncidentId:first.incidentId});
  assert.equal(repeated.incidentId,first.incidentId);
  assert.equal(repeated.action,"AUDIT_REQUIRED");
  assert.equal(classify(unrelated,{wokenIncidentId:first.incidentId,
    repairIncidentId:first.incidentId,repairAttempts:1}).action,"CONTROL_DEGRADED");
});

test("stale observations and uncertain external work never authorize restoration", () => {
  const content = state(), value = identity({seen:{...seen,revision:"old"}});
  const observation = activity(content,value);
  observation.observedAt = new Date(now-301000).toISOString();
  assert.equal(evaluateProductionContinuation(content,observation,{now}).identityCoverage,"NOT_EVALUATED");
  const unknown = content.replace("| WORKING | worker |","| OUTCOME_UNKNOWN | worker |");
  const blocked = evaluateProductionContinuation(unknown,activity(unknown,value),{now});
  assert.equal(blocked.identityCoverage,"NOT_EVALUATED");
  assert.equal(blocked.signal,null);
});

test("published updater installs the identity route without changing retained work or claiming protection", async t => {
  const repository = fileURLToPath(new URL("../",import.meta.url));
  const baseline = "07150ac37485d57352418cee96b04a0b34ff4559";
  const archive = spawnSync("git",["archive",baseline],{cwd:repository,maxBuffer:16*1024*1024});
  if (archive.status !== 0) return t.skip("Published 1.33.0 source unavailable; no network fetch performed");
  const root = await mkdtemp(path.join(tmpdir(),"vydykhai-task-continuity-"));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const old = path.join(root,"published"), target = path.join(root,"project");
  await mkdir(old); await mkdir(target);
  assert.equal(spawnSync("tar",["-x","-C",old],{input:archive.stdout}).status,0);
  const cli = (entry,...args) => {
    const r = spawnSync(process.execPath,[entry,...args],{cwd:target,encoding:"utf8",timeout:15000});
    assert.equal(r.error,undefined,r.error?.message); assert.equal(r.status,0,r.stderr);
    return r.stdout;
  };
  cli(path.join(old,"scripts/vydykhai.mjs"),"install",target);
  const installed = path.join(target,"scripts/vydykhai.mjs");
  const saved = {"project-state.md":state(true),"candidate.mjs":"export const retained = true;\n",
    "checkpoint.txt":"Current outcome remains unfinished; human pause remains binding.\n"};
  for (const [name,body] of Object.entries(saved)) await writeFile(path.join(target,name),body);
  assert.match(cli(installed,"update",target,"--from",repository),/UNPROVEN_BY_INSTALLER/);
  assert.match(cli(installed,"doctor",target,"--offline"),/Integrity: OK/);
  const plan = JSON.parse(cli(installed,"adoption-plan",target,"--json"));
  assert.equal(plan.activeUse,"UNPROVEN_BY_INSTALLER");
  assert.match(plan.requirements.find(r=>r.id==="unfinished-workers").action,/identity after actual context restoration/);
  assert.match(plan.requirements.find(r=>r.id==="guard-continuity").action,/zero model invocations/);
  const api = await import(pathToFileURL(installed));
  const content = state(), value = identity({seen:{...seen,contextEpoch:"before-compaction"}});
  const observation = activity(content,value,{terminal:{turnId:"turn-2",status:"RESULT",evidence:"historical-answer"}});
  assert.equal(api.evaluateProductionContinuation(content,observation,{now}).nextAction,"RESTORE_CURRENT_TASK");
  value.failedRestorations = [{turnId:"repair-1",evidence:"repeat-after-targeted-restore"}];
  assert.equal(api.evaluateProductionContinuation(content,observation,{now}).nextAction,"REBRIEF_FRESH_CONTEXT");
  const pause = api.evaluateProductionContinuation(state(true),activity(state(true),value),{now});
  assert.equal(pause.nextAction,null); assert.equal(pause.identityCoverage,"NOT_EVALUATED");
  value.seen = {...seen};
  assert.equal(api.evaluateProductionContinuation(content,observation,{now}).nextAction,"RECONCILE_RESULT");
  const working = activity(content,value,{status:"ACTIVE"});
  const continuation = api.evaluateProductionContinuation(content,working,{now});
  for (let i=0;i<20;i++) assert.equal(api.classifyGuard({ok:true,stateIssues:[],graphIssues:[],continuation},content).action,"NOOP");
  cli(installed,"update",target,"--from",repository);
  assert.equal(JSON.parse(cli(installed,"adoption-plan",target,"--json")).id,plan.id);
  for (const [name,body] of Object.entries(saved)) assert.equal(await readFile(path.join(target,name),"utf8"),body);
  t.diagnostic("Real published updater and installed classifier; simulated observations, not native compaction or host protection.");
});
