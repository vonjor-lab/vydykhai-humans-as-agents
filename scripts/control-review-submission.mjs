// Durable reviewer output is evidence, not authority to execute or close work.
import {open, readFile, mkdir} from "node:fs/promises";
import {openControlStore} from "./control-store.mjs";
import path from "node:path";
import {readPrivateControlJson, validateReviewSourceScope} from "./control-review-sources.mjs";
import {validateWindowAcquisition, completeWindowSources} from "./control-review-acquisition.mjs";
import {validateReviewPart} from "./control-review-partitions.mjs";
import {controlCheckIds} from "./control-catalog.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
export const submissionErrorCode=message=>typeof message==="string" &&
  /^(MODEL_REVIEW_[A-Z_]+|(MISSING_REASON|INVALID_DISPOSITION|UNOWNED_DISPOSITION):C[0-9.]+)$/.test(message)?
  message:"MODEL_REVIEW_SUBMISSION_REJECTED";
export function validateModelReviewAcquisition(before, readbacks, requiredSourceIds, sourceScope, acquisition) {
  if(sourceScope !== undefined) validateReviewSourceScope(sourceScope);
  need(readbacks.length > 0, "MODEL_REVIEW_NO_SOURCE_ACQUISITION");
  if(acquisition) {
    validateWindowAcquisition(before,acquisition.calls,acquisition.originals,acquisition.policy);
    const acquired=acquisition.calls.map(call=>call.value).filter(r=>r.status!=="NEEDS_DISCOVERY");
    const allowed=[...acquired,...completeWindowSources(acquired,acquisition.originals)];
    need(readbacks.every(r=>allowed.some(a=>hash(a)===hash(r))),"MODEL_REVIEW_WINDOW_READBACK_INVALID");
  }
  need(!sourceScope || readbacks.every(r=>sourceScope.sourceIds.includes(r.window?.sourceId??r.id)),
    "MODEL_REVIEW_SOURCE_SCOPE_EXPANSION_REQUIRED");
  if(!acquisition)need(readbacks.every(({text,...r})=>before.rows.some(s=>hash(s)===hash(r)) &&
    (r.status === "MISSING" ? text === undefined : typeof text === "string" && sha256(text) === r.sha256)),
    "MODEL_REVIEW_SOURCE_DRIFT");
  need([...(sourceScope?.sourceIds??[]),...requiredSourceIds].every(id=>readbacks.some(r=>r.id===id &&
    (!r.window || r.window.offset===0 && r.window.length===r.window.characters))),
    "MODEL_REVIEW_REQUIRED_SOURCE_UNREAD");
}
export function hasReviewSubmission(output) {
  return reviewSubmissionCompletion(output)==="RESULT_SUBMITTED";
}
export function reviewSubmissionCompletion(output) {
  // Ignore incomplete transport lines and all prose, including a quoted receipt.
  for(const line of output.split("\n").slice(0,-1)) {
    let event;try{event=JSON.parse(line);}catch{continue;}
    const item=event.item;
    if(event.type!=="item.completed" || item?.type!=="mcp_tool_call" || item.server!=="vydykhai_review" ||
      item.tool!=="submit_review")continue;
    if(item.error || item.result?.isError || item.status!=="completed")return "RESULT_REJECTED";
    const content=item.result?.content;
    if(content?.length!==1 || content[0].type!=="text")return "RESULT_REJECTED";
    try {const ack=JSON.parse(content[0].text);return ack.status==="REVIEW_RECEIVED" && /^[a-f0-9]{64}$/.test(ack.receiptSha256)?"RESULT_SUBMITTED":"RESULT_REJECTED";}
    catch{return "RESULT_REJECTED";}
  }
  return null;
}
export async function openReviewSubmission(file,sources,reader,policy) {
  const context=await readPrivateControlJson(file),calls=[];
  need(context.schema==="control.review-submission-context.v1" &&
    Number.isFinite(Date.parse(context.expiresAt)),"MODEL_REVIEW_SUBMISSION_CONTEXT_INVALID");
  const receiptFile=file+".receipt.json";
  const before=await sources.snapshot(context.before.scope);
  need(hash(before)===hash(context.before),"MODEL_REVIEW_SOURCE_DRIFT");
  let acquisitionStore;
  if(context.retainAcquisition === true) {
    const directory=file+".acquisition";
    await mkdir(directory,{mode:0o700}).catch(e=>{if(e.code!=="EEXIST")throw e;});
    acquisitionStore=await openControlStore(directory);
    if(!await acquisitionStore.read())await acquisitionStore.initialize({context:hash(context),policy:hash(policy??null),calls:[]});
    const saved=(await acquisitionStore.read()).state;
    need(saved.context===hash(context) && saved.policy===hash(policy??null),"MODEL_REVIEW_ACQUISITION_BINDING_INVALID");
    calls.push(...saved.calls);
    if(policy)reader.restoreUsedBytes(Math.max(0,...calls.map(c=>c.value.window?.afterBytes??0)));
  }
  return {
    async read(args) {
      const value=await reader.read(args),call={args:structuredClone(args),value};
      if(acquisitionStore)await acquisitionStore.transact(s=>{s.calls.push(call);return s;});
      calls.push(call);return value;
    },
    async submit(args) {
      need(args && Object.keys(args).join()==="answer" && args.answer?.schema==="control.review-answer.v2",
        "MODEL_REVIEW_SUBMISSION_ARGUMENTS_INVALID");
      need(Date.now()<Date.parse(context.expiresAt),"MODEL_REVIEW_SUBMISSION_EXPIRED");
      const answer=structuredClone(args.answer),originals=new Map();
      const readbacks=calls.map(c=>c.value).filter(r=>r.status!=="NEEDS_DISCOVERY");
      if(policy) {
        for(const {args} of calls)if(!originals.has(args.id))originals.set(args.id,await sources.read({id:args.id}));
        readbacks.push(...completeWindowSources(readbacks,originals));
      }
      validateModelReviewAcquisition(before,readbacks,context.requiredSourceIds,before.scope,
        policy?{calls,originals,policy}:undefined);
      const submittedAt=new Date().toISOString();
      validateReviewPart(answer,context.checkIds??controlCheckIds,
        {readbacks,offer:context.offer,reviewer:context.reviewer,observedAt:submittedAt});
      need(hash(await sources.snapshot(before.scope))===hash(before),"MODEL_REVIEW_SOURCE_DRIFT");
      need(Date.now()<Date.parse(context.expiresAt),"MODEL_REVIEW_SUBMISSION_EXPIRED");
      const receipt={schema:"control.review-submission.v1",contextSha256:hash(context),
        runId:context.offer.runId,key:context.offer.key,sourceDigest:before.digest,submittedAt,answer};
      const bytes=JSON.stringify(receipt);
      let handle;
      try {
        handle=await open(receiptFile,"wx",0o600);
        await handle.writeFile(bytes);await handle.sync();
      } catch(e) {
        if(e.code!=="EEXIST")throw e;
        const prior=JSON.parse(await readFile(receiptFile,"utf8"));
        need(prior.contextSha256===receipt.contextSha256 && hash(prior.answer)===hash(answer),
          "MODEL_REVIEW_SUBMISSION_CONFLICT");
        const dir=await open(path.dirname(receiptFile),"r");
        try{await dir.sync();}finally{await dir.close();}
        return {status:"REVIEW_RECEIVED",receiptSha256:sha256(await readFile(receiptFile)),admission:"HOST_VALIDATION_REQUIRED"};
      } finally {await handle?.close();}
      const dir=await open(path.dirname(receiptFile),"r");
      try{await dir.sync();}finally{await dir.close();}
      return {status:"REVIEW_RECEIVED",receiptSha256:sha256(bytes),admission:"HOST_VALIDATION_REQUIRED"};
    }
  };
}
