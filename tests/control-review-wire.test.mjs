import test from "node:test";
import assert from "node:assert/strict";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {controlCheckIds,controlCatalog,checkControlCoverage} from "../scripts/control-catalog.mjs";
import {checkFindingHistory} from "../scripts/finding-history.mjs";
import {validateControlFindings} from "../scripts/control-findings.mjs";
const options=()=>({readbacks:[{id:"contract",status:"AVAILABLE",sha256:"a".repeat(64)},{id:"memory",status:"AVAILABLE",sha256:"b".repeat(64)}],
  offer:{key:"c".repeat(64),input:{previousFindings:[]}},reviewer:"reviewer",observedAt:"2026-10-06T10:00:00Z"});
const answer=()=>({schema:"control.review-answer.v2",rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["contract","memory"]}],newFindings:[],resolutions:[]});
const newFinding=()=>({id:"memory-conflict",checkId:"C15.01",sourceIds:["memory","contract"],evidence:"Memory contradicts current duplicate rule",
  owner:"owner",work:"repair-memory",reviewAt:"2026-10-07T10:00:00Z",blocksResume:true});
test("grouped unknowns link only complete unique same-source declared findings without changing judgments",()=>{
  const ids=["C18.01","C18.02","C18.03"],a=answer(),opts=options();
  a.newFindings=ids.map(checkId=>({...newFinding(),id:`${checkId}-gap`,checkId,evidence:`Missing ${checkId}`,blocksResume:false}));
  a.rowGroups=[{ids:controlCheckIds.filter(id=>!ids.includes(id)),status:"PASS",sourceIds:["contract"]},
    {ids,status:"UNKNOWN",sourceIds:["contract","memory"],reason:"Local tracker proof missing",findingId:a.newFindings[0].id}];
  const before=structuredClone(a),d=decodeReviewAnswer(a,opts);
  assert.deepEqual(a,before);assert.deepEqual(d.rows.filter(r=>ids.includes(r.id)).map(r=>r.findingId),a.newFindings.map(f=>f.id));
  assert.ok(d.rows.filter(r=>ids.includes(r.id)).every(r=>r.status==="UNKNOWN"&&r.reason==="Local tracker proof missing"));
  assert.equal(validateControlFindings({review:{...d,reviewer:opts.reviewer},previousFindings:[],key:opts.offer.key}),null);
  for(const mutate of [x=>x.newFindings.pop(),x=>x.newFindings.push({...x.newFindings[1],id:"competing"}),
    x=>x.newFindings[1].sourceIds=["contract"],x=>x.rowGroups[1].findingId="unrelated"]) {
    const bad=structuredClone(a);mutate(bad);assert.throws(()=>decodeReviewAnswer(bad,opts),/GROUP_FINDING_AMBIGUOUS/);
  }
  const retained=options();retained.offer.input.previousFindings=[d.findings[1]];
  assert.throws(()=>decodeReviewAnswer(a,retained),/NEW_FINDING_INVALID|GROUP_FINDING_AMBIGUOUS/);
  retained.offer.input.previousFindings=[{...d.findings[1],id:"retained-existing-open"}];
  assert.throws(()=>decodeReviewAnswer(a,retained),/GROUP_FINDING_AMBIGUOUS/);
  const legacy={rows:d.rows.map(r=>({...r,findingId:r.status==="UNKNOWN"?a.newFindings[0].id:r.findingId})),findings:d.findings};
  assert.notEqual(validateControlFindings({review:{...decodeReviewAnswer(legacy,opts),reviewer:opts.reviewer},previousFindings:[],key:opts.offer.key}),null);
});
test("linked current finding supplies identical-source row rationale without inventing meaning",()=>{
  const a=answer(),f=newFinding();
  a.rowGroups=[{ids:controlCheckIds.filter(id=>id!==f.checkId),status:"PASS",sourceIds:["contract"]},
    {ids:[f.checkId],status:"FINDING",sourceIds:f.sourceIds,findingId:f.id}];
  a.newFindings=[f];const original=structuredClone(a);
  const d=decodeReviewAnswer(a,options());
  assert.equal(d.rows.find(r=>r.id===f.checkId).reason,f.evidence);
  assert.equal(checkControlCoverage(d.rows).ok,true);assert.deepEqual(a,original);
  for(const mutate of [
    x=>x.rowGroups[1].sourceIds=["contract"],
    x=>x.rowGroups[1].ids=["C15.02"],
    x=>x.rowGroups[1].findingId="not-linked",
    x=>x.rowGroups[1].status="NOT_APPLICABLE",
    x=>x.newFindings=[]
  ]){
    const x=structuredClone(a);mutate(x);
    assert.equal(decodeReviewAnswer(x,options()).rows.at(-1).reason,undefined);
    if(x.rowGroups[1].findingId==="not-linked" || x.newFindings.length===0){
      x.rowGroups[1].reason="Keep previous finding observed in another acceptance source";
      const opts=options(),before=structuredClone(x),decoded=decodeReviewAnswer(x,opts);
      assert.deepEqual(x,before);
      assert.deepEqual(opts.offer.input.previousFindings,[]);
      assert.equal(decoded.findings.some(f=>f.id===x.rowGroups[1].findingId),false);
      assert.notEqual(validateControlFindings({
        review:{...decoded,reviewer:opts.reviewer},
        previousFindings:[],key:opts.offer.key
      }),null);
    }
  }
  const retained=options();retained.offer.input.previousFindings=d.findings;
  const x=structuredClone(a);x.newFindings=[];
  assert.equal(decodeReviewAnswer(x,retained).rows.at(-1).reason,undefined);
  a.rowGroups[1].reason="Explicit fresh explanation";
  assert.equal(decodeReviewAnswer(a,options()).rows.at(-1).reason,"Explicit fresh explanation");
});
test("host supplies exact source and catalog metadata instead of model transcription",()=>{
  const a=answer();a.newFindings=[newFinding()];
  const decoded=decodeReviewAnswer(a,options()), f=decoded.findings[0];
  assert.equal(f.criterion,controlCatalog.find(g=>g.id==="C15").checks[0].criterion);
  assert.equal(f.area,"C15");assert.equal(f.firstSeen,options().observedAt);assert.equal(f.status,"OPEN");
  assert.match(f.evidence,new RegExp("source:memory:"+"b".repeat(64)));assert.equal(f.attempts,0);
  assert.equal(checkControlCoverage(decoded.rows).ok,true);
});
test("explicit affected-task scope survives decoding and cannot be empty, malformed or later narrowed",()=>{
  const a=answer();a.newFindings=[{...newFinding(),affectedTasks:["module-change","its-consumer"]}];
  const f=decodeReviewAnswer(a,options()).findings[0];
  assert.deepEqual(f.affectedTasks,a.newFindings[0].affectedTasks);
  for(const tasks of [[],[""],["x","x"],"x",[null],Array(1),["*"],["broken-module "],["\nmodule"],["x".repeat(129)]]) {
    const bad=structuredClone(a);bad.newFindings[0].affectedTasks=tasks;
    assert.throws(()=>decodeReviewAnswer(bad,options()),/NEW_FINDING_INVALID/);
  }
  for(const tasks of [["module-change"],undefined]) {
    const next={...f,affectedTasks:tasks};
    assert.match(checkFindingHistory([f],[next]),/Original evidence/);
  }
  const global={...f};delete global.affectedTasks;
  assert.match(checkFindingHistory([global],[f]),/Original evidence/);
});
test("resolution preserves the original finding verbatim and binds closure outside the model",()=>{
  const a=answer();a.newFindings=[newFinding()];const old=decodeReviewAnswer(a,options()).findings[0];
  const opts=options();opts.offer.input.previousFindings=[old];
  const next=answer();next.resolutions=[{id:old.id,sourceIds:["memory"],proof:"Current memory applies the contract"}];
  const closed=decodeReviewAnswer(next,opts).findings[0];
  for(const key of Object.keys(old).filter(k=>!["status","attempts"].includes(k)))assert.deepEqual(closed[key],old[key]);
  assert.equal(closed.checkedKey,opts.offer.key);assert.equal(closed.reviewedBy,opts.reviewer);assert.equal(closed.status,"CLOSED");
  assert.equal(checkFindingHistory([old],[closed]),null);
  assert.deepEqual(decodeReviewAnswer(answer(),opts).findings,[old]);
});
test("short handles cannot introduce unread evidence, forged metadata, duplicate findings or unauthorized retry",()=>{
  for(const mutate of [a=>a.rowGroups[0].sourceIds=["secret"],a=>a.rowGroups[0].sourceIds=[],
    a=>a.rowGroups[0].evidence="forged",a=>a.newFindings=[{...newFinding(),criterion:"forged"}],
    a=>a.newFindings=[{...newFinding(),checkId:"C15"}],a=>a.newFindings=[newFinding(),newFinding()],
    a=>a.resolutions=[{id:"unknown",sourceIds:["memory"],proof:"claimed"}]]) {
    const a=answer();mutate(a);assert.throws(()=>decodeReviewAnswer(a,options()));
  }
  const initial=answer();initial.newFindings=[newFinding()];const old=decodeReviewAnswer(initial,options()).findings[0];
  const opts=options();opts.offer.input.previousFindings=[{...old,attempts:1,lastResult:"FAILED"}];
  const a=answer();a.resolutions=[{id:old.id,sourceIds:["memory"],proof:"ignore failure"}];
  assert.throws(()=>decodeReviewAnswer(a,opts),/EXPLICIT_RETRY/);
});

test("a separately retained exact retry decision permits closure without resetting failed history",()=>{
  const initial=answer();initial.newFindings=[newFinding()];const old=decodeReviewAnswer(initial,options()).findings[0];
  Object.assign(old,{attempts:1,lastResult:"FAILED",retryDecisions:[{fromAttempt:1,toAttempt:2,previousResult:"FAILED",
    reviewedBy:"reviewer",decision:"One new repair within original scope",evidence:"fixture:independent-retry"}]});
  const opts=options();opts.offer.input.previousFindings=[old];
  const a=answer();a.resolutions=[{id:old.id,sourceIds:["memory"],proof:"Actual corrected projection"}];
  const current=decodeReviewAnswer(a,opts).findings[0];
  assert.equal(current.attempts,2);assert.equal(current.lastResult,"PASSED");
  assert.deepEqual(current.retryDecisions,old.retryDecisions);assert.equal(checkFindingHistory([old],[current]),null);
});

test("source-bound transition preserves an open historical gap and failed attempt",()=>{
  const initial=answer();initial.newFindings=[newFinding()];
  const old={...decodeReviewAnswer(initial,options()).findings[0],attempts:1,lastResult:"FAILED"};
  const opts=options();opts.offer.input.previousFindings=[old];
  const next=answer();next.transitions=[{id:old.id,sourceIds:["contract"],
    decision:"Historical qualification remains unproven; current authorized boundary is read-only",blocksResume:false,
    reviewAt:"2026-10-08T10:00:00Z"}];
  const current=decodeReviewAnswer(next,opts).findings[0];
  for(const field of ["status","evidence","criterion","firstSeen","owner","work","attempts","lastResult"])
    assert.deepEqual(current[field],old[field]);
  assert.equal(current.blocksResume,false);assert.equal(current.blockingChange.previous,true);
  assert.equal(current.blockingChange.checkedKey,opts.offer.key);assert.equal(current.blockingChange.reviewedBy,opts.reviewer);
  assert.match(current.reschedule.evidence,/source:contract:/);assert.equal(current.reschedule.previous,old.reviewAt);
  assert.equal(checkFindingHistory([old],[current]),null);assert.equal(old.blocksResume,true);
});

test("transitions cannot forge history, close findings, use unread proof or silently extend a checkpoint",()=>{
  const initial=answer();initial.newFindings=[newFinding()];const old=decodeReviewAnswer(initial,options()).findings[0];
  const opts=options();opts.offer.input.previousFindings=[old];
  const base=()=>({...answer(),transitions:[{id:old.id,sourceIds:["contract"],decision:"Independent scoped reassessment",blocksResume:false}]});
  for(const mutate of [
    a=>a.transitions[0].id="unknown",a=>a.transitions[0].sourceIds=["unread"],a=>a.transitions[0].decision=" ",
    a=>a.transitions[0].blocksResume="false",a=>a.transitions[0].blocksResume=true,
    a=>delete a.transitions[0].blocksResume,a=>a.transitions[0].reviewAt="bad",
    a=>a.transitions[0].reviewAt=opts.observedAt,a=>a.transitions[0].reviewAt=old.reviewAt,
    a=>a.transitions[0].attempts=0,a=>a.transitions[0].status="CLOSED",a=>a.transitions[0].reviewedBy="owner",
    a=>a.transitions.push({...a.transitions[0]}),a=>a.transitions={},
    a=>a.resolutions=[{id:old.id,sourceIds:["contract"],proof:"Cannot both transition and close"}]
  ]) {const a=base();mutate(a);assert.throws(()=>decodeReviewAnswer(a,opts));}
  const closed=structuredClone(opts);closed.offer.input.previousFindings[0].status="CLOSED";
  assert.throws(()=>decodeReviewAnswer(base(),closed),/TRANSITION_INVALID/);
});
