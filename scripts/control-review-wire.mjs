// Model judgments use short, checked handles. The host supplies hashes, catalog
// wording and immutable history rather than asking a model to transcribe them.
import {controlCatalog,expandControlRows} from "./control-catalog.mjs";
import {validAffectedTasks} from "./control-findings.mjs";
import {validTerminalDisposition} from "./post-accept.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
const filled=v=>typeof v==="string"&&v.trim();
const checks=new Map(controlCatalog.flatMap(g=>g.checks.map(c=>[c.id,c])));

export function decodeReviewAnswer(answer,{readbacks,offer,reviewer,observedAt}) {
  if(answer?.schema!=="control.review-answer.v2") {
    need(!Object.hasOwn(answer??{},"terminalDisposition"),"MODEL_REVIEW_TERMINAL_V2_REQUIRED");
    need(!Object.hasOwn(answer??{},"healthDomain"),"MODEL_REVIEW_DOMAIN_V2_REQUIRED");
    return {rows:expandControlRows(answer),findings:answer.findings,
    ...(answer.evidence?{evidenceIndex:answer.evidence}:{})};
  }
  need(Array.isArray(answer.rowGroups)&&Array.isArray(answer.newFindings)&&Array.isArray(answer.resolutions),"MODEL_REVIEW_WIRE_INVALID");
  const sources=new Map(readbacks.map(r=>[r.id,r]));
  const references=ids=>{
    need(Array.isArray(ids)&&ids.length>0&&ids.length<=sources.size&&new Set(ids).size===ids.length,"MODEL_REVIEW_SOURCE_HANDLES_INVALID");
    return ids.map(id=>{
      const source=sources.get(id);need(source,"MODEL_REVIEW_UNREAD_EVIDENCE");
      need(source.status==="MISSING"||/^[a-f0-9]{64}$/.test(source.sha256),"MODEL_REVIEW_SOURCE_DIGEST_INVALID");
      const window=source.window;
      return `source:${id}:${source.sha256??"MISSING"}` +
        (window && id!==window.sourceId ?
          ` #original=${window.sourceId}:${window.sourceSha256};range=${window.offset}+${window.length}` : "");
    }).join(" ; ");
  };
  const groups=answer.rowGroups.map(g=>{
    need(g&&Object.keys(g).every(k=>["ids","status","sourceIds","reason","findingId"].includes(k)),"MODEL_REVIEW_ROW_GROUP_INVALID");
    const {sourceIds,...row}=g;return {...row,evidence:references(sourceIds)};
  });
  const rows=groups.flatMap(({ids,...row})=>{
    need(Array.isArray(ids)&&ids.length>0&&ids.length<=checks.size,"MODEL_REVIEW_ROW_GROUP_INVALID");
    return ids.map(id=>({...row,id}));
  });
  const findings=structuredClone(offer.input.previousFindings), originalIds=new Set(findings.map(f=>f.id));
  for(const f of answer.newFindings) {
    need(f&&Object.keys(f).every(k=>["id","checkId","sourceIds","evidence","owner","work","reviewAt","blocksResume","affectedTasks"].includes(k))&&
      validAffectedTasks(f.affectedTasks)&&
      filled(f.id)&&checks.has(f.checkId)&&!originalIds.has(f.id)&&!findings.some(old=>old.id===f.id)&&filled(f.evidence),"MODEL_REVIEW_NEW_FINDING_INVALID");
    const {sourceIds,...meaning}=f;
    findings.push({...meaning,evidence:`${references(sourceIds)} ${f.evidence}`,area:f.checkId.split(".")[0],
      criterion:checks.get(f.checkId).criterion,status:"OPEN",firstSeen:observedAt,attempts:0});
  }
  // A grouped disposition can cite one member while declaring each criterion's
  // finding separately. Link only that complete, unique, same-source new set.
  for(const g of answer.rowGroups.filter(g=>g.ids.length>1&&["FINDING","UNKNOWN","DEFERRED"].includes(g.status))) {
    const members=g.ids.map(id=>answer.newFindings.filter(f=>f.checkId===id));
    need(members.every((list,index)=>list.length===1&&
      hash([...list[0].sourceIds].sort())===hash([...g.sourceIds].sort())&&
      !offer.input.previousFindings.some(f=>f.status==="OPEN"&&f.checkId===g.ids[index]))&&
      members.some(list=>list[0]?.id===g.findingId),"MODEL_REVIEW_GROUP_FINDING_AMBIGUOUS");
    for(const row of rows.filter(r=>g.ids.includes(r.id)))
      row.findingId=members[g.ids.indexOf(row.id)][0].id;
  }
  const updated=new Set();
  need(answer.transitions===undefined||Array.isArray(answer.transitions),"MODEL_REVIEW_TRANSITIONS_INVALID");
  for(const t of answer.transitions??[]) {
    need(t&&Object.keys(t).every(k=>["id","sourceIds","decision","blocksResume","reviewAt"].includes(k))&&
      originalIds.has(t.id)&&!updated.has(t.id)&&filled(t.decision)&&
      (Object.hasOwn(t,"blocksResume")||Object.hasOwn(t,"reviewAt")),"MODEL_REVIEW_TRANSITION_INVALID");
    const f=findings.find(f=>f.id===t.id);
    need(f.status==="OPEN","MODEL_REVIEW_TRANSITION_INVALID");
    const evidence=references(t.sourceIds),identity={decision:t.decision,evidence,reviewedBy:reviewer,checkedKey:offer.key};
    if(Object.hasOwn(t,"blocksResume")) {
      need(typeof t.blocksResume==="boolean"&&t.blocksResume!==f.blocksResume,"MODEL_REVIEW_TRANSITION_INVALID");
      f.blockingChange={...identity,previous:f.blocksResume,next:t.blocksResume};f.blocksResume=t.blocksResume;
    }
    if(Object.hasOwn(t,"reviewAt")) {
      need(filled(t.reviewAt)&&Number.isFinite(Date.parse(t.reviewAt))&&Date.parse(t.reviewAt)>Date.parse(observedAt)&&
        t.reviewAt!==f.reviewAt,"MODEL_REVIEW_TRANSITION_INVALID");
      f.reschedule={...identity,previous:f.reviewAt,next:t.reviewAt};f.reviewAt=t.reviewAt;
    }
    updated.add(t.id);
  }
  for(const r of answer.resolutions) {
    need(r&&Object.keys(r).every(k=>["id","sourceIds","proof"].includes(k))&&originalIds.has(r.id)&&
      !updated.has(r.id)&&filled(r.proof),"MODEL_REVIEW_RESOLUTION_INVALID");updated.add(r.id);
    const f=findings.find(f=>f.id===r.id);
    need(f.status==="OPEN"&&(f.lastResult!=="FAILED"||(f.retryDecisions??[]).some(d=>
      d.fromAttempt===f.attempts&&d.toAttempt===f.attempts+1&&d.previousResult==="FAILED"&&
      filled(d.decision)&&filled(d.evidence)&&filled(d.reviewedBy)&&d.reviewedBy!==f.owner)),"MODEL_REVIEW_RESOLUTION_NEEDS_EXPLICIT_RETRY");
    Object.assign(f,{status:"CLOSED",proof:`${references(r.sourceIds)} ${r.proof}`,reviewedBy:reviewer,
      checkedKey:offer.key,attempts:f.attempts+1,lastResult:"PASSED"});
  }
  // The current finding already contains the model's explanation. Avoid asking
  // it to duplicate that meaning in its linked row; never invent missing proof
  // or borrow an old finding's rationale for a fresh assessment.
  for(const row of rows) {
    if(Object.hasOwn(row,"reason")||!["FINDING","UNKNOWN","DEFERRED"].includes(row.status))continue;
    const current=answer.newFindings.find(f=>f.id===row.findingId&&f.checkId===row.id);
    if(current&&filled(current.evidence)&&references(current.sourceIds)===row.evidence)
      row.reason=current.evidence;
  }
  // Unmentioned original findings remain unchanged, never silently disappear.
  let terminalDisposition;
  if(Object.hasOwn(answer,"terminalDisposition")) {
    const t=answer.terminalDisposition, o=offer.input.terminalObservation;
    need(t && Object.keys(t).sort().join()==="action,evidence,sourceIds" && filled(t.evidence) &&
      o?.status==="MATCH" && o.sha256===o.artifact.sha256 && validTerminalDisposition(o.record,offer.input.acceptance) &&
      t.action===o.record.action && rows.some(r=>r.id==="C20.03" && r.status==="PASS"),"MODEL_REVIEW_TERMINAL_INVALID");
    const evidence=references(t.sourceIds), snapshot=offer.input.sourceEvidence?.rows;
    need(Array.isArray(snapshot),"MODEL_REVIEW_TERMINAL_SOURCE_UNBOUND");
    const cited=t.sourceIds.map(id=>{
      const acquired=sources.get(id), bound=snapshot.find(r=>r.id===id);
      need(bound?.status==="AVAILABLE" && acquired.status==="AVAILABLE" && acquired.sha256===bound.sha256,
        "MODEL_REVIEW_TERMINAL_SOURCE_DRIFT");
      return bound;
    });
    const matches=(row,ref)=>row.path===ref.path && row.sha256===ref.sha256 &&
      row.startMarker===ref.startMarker && row.endMarker===ref.endMarker;
    need([o.artifact,offer.input.acceptance.producerReturn,offer.input.acceptance.goal,
      offer.input.acceptance.technicalProof].every(ref=>cited.some(row=>matches(row,ref))),"MODEL_REVIEW_TERMINAL_SOURCE_UNREAD");
    terminalDisposition={action:t.action,recordSha256:o.sha256,evidence:`${evidence} ${t.evidence}`};
    need(Buffer.byteLength(JSON.stringify(terminalDisposition))<=16384,"MODEL_REVIEW_TERMINAL_CAPACITY");
  }
  let healthDomain;
  if(Object.hasOwn(answer,"healthDomain")) {
    const d=answer.healthDomain,candidate=offer.input.domainCandidate;
    need(offer.phase==="HEALTH" && candidate?.schema==="control.health-domain.v1" &&
      d && Object.keys(d).sort().join()==="evidence,sourceIds" && filled(d.evidence) &&
      rows.some(r=>r.id==="C05.02"&&r.status==="PASS"),"MODEL_REVIEW_DOMAIN_INVALID");
    const evidence=references(d.sourceIds);
    need(candidate.sourceBindings.every(bound=>d.sourceIds.includes(bound.id)&&sources.get(bound.id)?.status==="AVAILABLE"&&
      sources.get(bound.id).sha256===bound.sha256 && offer.input.sourceEvidence.rows.some(r=>hash(r)===hash(bound))),"MODEL_REVIEW_DOMAIN_SOURCE_UNREAD");
    healthDomain={domainSha256:hash(candidate),file:candidate.file,grantId:candidate.grantId,
      sourceBindings:structuredClone(candidate.sourceBindings),
      reviewer,key:offer.key,evidence:`${evidence} ${d.evidence}`};
  }
  return {rows,findings,...(terminalDisposition?{terminalDisposition}:{}),...(healthDomain?{healthDomain}:{})};
}
