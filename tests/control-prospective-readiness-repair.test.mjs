import test from "node:test";
import assert from "node:assert/strict";
import {validateReadinessRepairDecision,prospectiveDependencyApplication} from "../scripts/repair-prospective-readiness.mjs";
import {sha256} from "../scripts/memory-brief.mjs";
test("readiness repair is one explicit additive allocation, never a verdict override or refund",()=>{
  const expected={reviewer:"independent",actors:["owner","worker"],planSha256:"a".repeat(64),
    bindings:{failed:{path:"/failed",sha256:"b".repeat(64)}},codeHashes:{script:"c".repeat(64)}};
  const d={schema:"qualification.prospective-readiness-repair.v1",decision:"ALLOW_ONE_READ_ONLY_RECHECK",reviewer:expected.reviewer,
    planSha256:expected.planSha256,bindings:expected.bindings,codeHashes:expected.codeHashes,priorAttempts:31,maxNewCalls:1,
    originalMaximum:44,amendedMaximum:45,remainingLaterSlots:13,retries:0,noRefund:true,oldVerdictPreserved:true,
    executionGranted:false,historicalClosure:false,releaseReady:false,evidence:["exact failed result and corrected visibility"]};
  assert.doesNotThrow(()=>validateReadinessRepairDecision(d,expected));
  for(const patch of [{reviewer:"owner"},{priorAttempts:30},{maxNewCalls:2},{amendedMaximum:44},{retries:1},{noRefund:false},
    {oldVerdictPreserved:false},{executionGranted:true},{historicalClosure:true},{releaseReady:true},{evidence:[]},
    {planSha256:"d".repeat(64)},{codeHashes:{}},{bindings:{}}])
    assert.throws(()=>validateReadinessRepairDecision({...d,...patch},expected),/INDEPENDENT_DECISION_REQUIRED/);
  assert.throws(()=>validateReadinessRepairDecision(d,{...expected,planSha256:""}),/INDEPENDENT_DECISION_REQUIRED/);
});
test("public application retains the verified independent decision bytes, not a later substituted body with an old hash",()=>{
  const bytes=Buffer.from(JSON.stringify({decision:"INDEPENDENT_NEW_CONSUMPTION_ONLY",executionGranted:false})),digest=sha256(bytes);
  const value=prospectiveDependencyApplication(bytes,digest,"a".repeat(64));
  assert.equal(value.originalDecision.executionGranted,false);assert.equal(value.originalDecisionSha256,digest);
  assert.equal(value.executionAuthorized,false);
  assert.throws(()=>prospectiveDependencyApplication(Buffer.from('{"executionGranted":true}'),digest,"a".repeat(64)),/DEPENDENCY_CHANGED/);
});
