import test from "node:test";
import assert from "node:assert/strict";
import {gradeCurrentRecall} from "../scripts/qualify-control-current-recall.mjs";
import {cycleAnswer} from "../scripts/qualify-control-cycle.mjs";
test("verified preparation parsing does not upgrade unverified or incomplete native turns",()=>{
  const run={status:"PREPARATION_STATUS_VERIFIED",nativeStatus:"CLI_EXIT_OK",preparation:{status:"VERIFIED"},
    output:[{type:"item.completed",item:{type:"agent_message",text:'{"ok":true}'}},{type:"turn.completed"}].map(JSON.stringify).join("\n")};
  assert.deepEqual(cycleAnswer(run),{ok:true});
  for(const delta of [{status:"PREPARATION_UNVERIFIED"},{nativeStatus:"OUTCOME_UNKNOWN"},{preparation:{}},
    {output:run.output+'\n'+JSON.stringify({type:"turn.failed"})}])assert.throws(()=>cycleAnswer({...run,...delta}),/NATIVE_TURN_NOT_COMPLETE/);
});
const projection={paused:false,rows:[{historicalAcceptance:{status:"ACCEPTED"},currentControl:{productAcceptance:"PRESERVED",enrollment:"CLOSED",assessedAction:"CONTROL_CONFIRMED"},
  retention:{complete:true},findings:[{id:"remaining"}]}]};
const answer={recipe:{entrypoint:"buildBundle",revision:"bundle-r2",preprocess:"none",format:"json",producerEdits:[]},
  rejectedApproachIds:["keep-last"],deferredRecall:{id:"CSV",disposition:"ASK_OWNER_NOT_IMPLEMENT"},
  current:{historicalAcceptance:"ACCEPTED",productAcceptance:"PRESERVED",controlEnrollment:"CLOSED",assessedAction:"CONTROL_CONFIRMED",paused:false,
    retentionComplete:true,openFindingIds:["remaining"],executionAuthorized:false}};
test("current context cannot promote acceptance-time pending or missing persistence over current evidence",()=>{
  assert.deepEqual(gradeCurrentRecall(answer,projection),[]);
  for(const delta of [{historicalAcceptance:"PRESERVED"},{productAcceptance:"ACCEPTED"},
    {controlEnrollment:"PENDING"},{assessedAction:"REVIEW_DUE"},{paused:true},
    {retentionComplete:false},{openFindingIds:[]},{executionAuthorized:true}])
    assert.ok(gradeCurrentRecall({...answer,current:{...answer.current,...delta}},projection).includes("current"));
});
test("current status does not excuse forgotten decisions or silently implemented ideas",()=>{
  for(const delta of [{recipe:{...answer.recipe,preprocess:"lowercase"}}, {rejectedApproachIds:[]},
    {deferredRecall:{id:"CSV",disposition:"IMPLEMENT"}}])assert.ok(gradeCurrentRecall({...answer,...delta},projection).length);
  // Narrative correctness remains independently reviewed, never certified by this wire grader.
  assert.deepEqual(gradeCurrentRecall({...answer,context:"not graded here"},projection),[]);
});
