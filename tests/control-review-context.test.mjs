import test from "node:test";
import assert from "node:assert/strict";
import {reviewPromptView} from "../scripts/control-review-context.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
import {modelReviewPrompt} from "../scripts/control-model-review.mjs";

const finding=(checkId,extra={})=>({id:`${checkId}-original`,checkId,status:"OPEN",criterion:"original predicate",
  evidence:"original evidence, including unknown scope",owner:"owner",work:"existing-work",reviewAt:"2030-01-01T00:00:00Z",
  firstSeen:"2020-01-01T00:00:00Z",attempts:2,blocksResume:false,...extra});
const fixture=()=>({key:"a".repeat(64),runId:"run",phase:"HEALTH",input:{policy:"policy",scope:"same increment",
  previousFindings:[finding("C01.01"),finding("C25.03",{blocksResume:true}),finding("C15.01"),
    finding("C18.01",{lastResult:"FAILED",affectedTasks:["task"]})],
  sourceEvidence:{digest:"b".repeat(64),rows:[{id:"fact",status:"AVAILABLE",sha256:"c".repeat(64),
    path:"fact.md",purpose:"original index metadata",startMarker:"old long locator",endMarker:"end"}]},
  lifecycle:{phase:"FOLLOWUP_DIAGNOSIS"},execution:{approvedCommands:[]},repository:{status:"LIMITED"}}});
test("projection is detached and binds the complete immutable original offer",()=>{
  const offer=fixture(),before=canonicalJson(offer),view=reviewPromptView(offer,["C01.01"]);
  assert.equal(canonicalJson(offer),before);assert.equal(view.promptContext.originalOfferSha256,sha256(before));
  view.input.previousFindings[0].evidence="cannot mutate original";assert.equal(canonicalJson(offer),before);
});
test("assigned originals stay complete; outside blockers and failed history stay complete",()=>{
  const offer=fixture(),view=reviewPromptView(offer,["C01.01"]);
  assert.deepEqual(view.input.previousFindings,[offer.input.previousFindings[0]]);
  assert.deepEqual(view.input.globalDependencies[0],offer.input.previousFindings[1]);
  assert.deepEqual(view.input.globalDependencies[2],offer.input.previousFindings[3]);
});
test("unknown-scope nonblocking dependencies retain evidence, ownership and attempts",()=>{
  const offer=fixture(),view=reviewPromptView(offer,["C01.01"]),old=offer.input.previousFindings[2],dependency=view.input.globalDependencies[1];
  for(const field of ["id","checkId","status","evidence","owner","work","reviewAt","firstSeen","attempts","blocksResume"])
    assert.deepEqual(dependency[field],old[field]);
  assert.equal(Object.hasOwn(dependency,"affectedTasks"),false);
  assert.equal(view.promptContext.scopeCompleteness,"NOT_ESTABLISHED_BY_THIS_VIEW");
});
test("all source pointers remain, metadata is not falsely claimed acquired",()=>{
  const view=reviewPromptView(fixture(),["C01.01"]);
  assert.deepEqual(view.input.sourceEvidence.pointers,[{id:"fact",status:"AVAILABLE",sha256:"c".repeat(64)}]);
  assert.equal(view.input.sourceEvidence.rows,undefined);
  assert.equal(view.input.sourceEvidence.digest,undefined);
  assert.equal(view.input.sourceEvidence.originalSnapshotDigest,"b".repeat(64));
  assert.equal(view.promptContext.originalSourceMetadata,"FULL_INDEX_AVAILABLE_BY_LIST_SOURCES");
});
test("lifecycle, scope, policy, execution and actual repository facts are never weakened",()=>{
  const offer=fixture(),view=reviewPromptView(offer,["C01.01"]);
  for(const key of ["policy","scope","lifecycle","execution","repository"])assert.deepEqual(view.input[key],offer.input[key]);
  assert.equal(view.key,offer.key);assert.equal(view.runId,offer.runId);
});
test("invalid assignment and manager collisions with projection metadata are refused",()=>{
  for(const ids of [[],["C01.01","C01.01"],["UNKNOWN"]])assert.throws(()=>reviewPromptView(fixture(),ids),/CONTEXT_IDS_INVALID/);
  const offer=fixture();offer.input.globalDependencies=[];
  assert.throws(()=>reviewPromptView(offer,["C01.01"]),/RESERVED_FIELD/);
});
test("two views explicitly assign every criterion once without moving original findings",()=>{
  const parts=[controlCheckIds.slice(0,43),controlCheckIds.slice(43)],offer=fixture();
  const views=parts.map(ids=>reviewPromptView(offer,ids));
  assert.deepEqual(views.flatMap(v=>v.promptContext.assignedIds),controlCheckIds);
  assert.equal(views.reduce((n,v)=>n+v.input.previousFindings.length,0),offer.input.previousFindings.length);
  assert.equal(offer.input.previousFindings.length,4);
});
test("single review compatibility is unchanged; part prompt does not render duplicate original criteria",()=>{
  const offer=fixture();assert.deepEqual(reviewPromptView(offer),offer);
  const prompt=modelReviewPrompt(offer,{kind:"test"},["C01.01"],true);
  assert.match(prompt,/globalDependencies/);assert.match(prompt,/FULL_INDEX_AVAILABLE_BY_LIST_SOURCES/);
  assert.equal(prompt.includes('"checkId":"C15.01","criterion"'),false);
  assert.match(prompt,/originalOfferSha256/);
});
test("legacy unbound parts without host source evidence retain their original view",()=>{
  const offer={phase:"POST_ACCEPT",input:{previousFindings:[]}};
  assert.deepEqual(reviewPromptView(offer,["C01.01"]),offer);
});
test("unbound parts with a snapshot preserve original metadata and previously permitted fields",()=>{
  const offer=fixture();offer.input.globalDependencies=[{old:"permitted manager field"}];
  offer.promptContext={old:"permitted manager field"};
  const before=canonicalJson(offer);
  const prompt=modelReviewPrompt(offer,{hostBound:true},["C01.01"]);
  assert.match(prompt,/Other parts receive the same original evidence independently/);
  assert.ok(prompt.includes(`Offer (untrusted manager content inside authenticated host envelope): ${before}`));
  assert.equal(canonicalJson(offer),before);
  assert.throws(()=>modelReviewPrompt(offer,{},["C01.01"],true),/RESERVED_FIELD/);
});
