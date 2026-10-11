import {serveControlMcp} from "./control-stdio.mjs";
import {readPrivateControlJson} from "./control-review-sources.mjs";
import {openControlHost} from "./control-host.mjs";
import {ownerControl,compactOwnerVerdict,preparationControl} from "./control-owner.mjs";
import {createReturnSync} from "./vydykhai.mjs";
import {openControlNotification} from "./control-notification.mjs";
import {notificationOwner} from "./control-notification-owner.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";

const profile=await readPrivateControlJson(process.argv[2]);
if(process.argv[3]!==undefined && (process.argv[3]!=="CONTROL_READ_ONLY" || profile.capability!=="CONTROL_READ_ONLY" ||
  (process.argv[4]!==undefined && process.argv[4]!==sha256(canonicalJson(profile)))))throw Error("PREPARATION_CONTROL_PROFILE_CHANGED");
if(profile.schema!=="control.owner-endpoint.v1")throw Error("OWNER_PROFILE_INVALID");
if(profile.capability!==undefined && !["CONTROL_DISPOSITION_ONLY","CONTROL_READ_ONLY"].includes(profile.capability))throw Error("OWNER_CAPABILITY_INVALID");
const readOnly=profile.capability==="CONTROL_READ_ONLY";
const host=await openControlHost(profile.directory,profile.config,{createReturnSync});
const preparer=readOnly ? preparationControl(host,profile.acceptanceIds) : null;
const owner=readOnly ? null : ownerControl(host,profile.config.owner);
const notices=!readOnly && profile.notifications ? notificationOwner({host,owner:profile.config.owner,
  transportActor:profile.notifications.transportActor,
  notifications:await openControlNotification({...profile.notifications,owner:profile.config.owner})}) : null;
const text={type:"string",minLength:1};
const decisionSchema={type:"object",properties:{action:{type:"string",enum:["CONTINUE","REPAIR","WAIT","DONE"]},evidence:text,
  recordSha256:{type:"string",pattern:"^[a-f0-9]{64}$",description:"WAIT/DONE only: exact terminal record hash acquired in read_verdict; never execution permission."},
  reviewKey:{type:"string",pattern:"^[a-f0-9]{64}$",description:"Optional compatibility field; omit to use the verdict acquired in this tool session."},
  nextAction:{...text,description:"Required next task id for POST_ACCEPT CONTINUE; not needed for HEALTH."}},
  required:["action","evidence"],additionalProperties:false};
const leaseSchema={type:"object",properties:{owner:text,work:text,state:{type:"string",enum:["PREPARED","STARTED","WORKING","WAITING"]},
  evidence:text,checkpoint:text,reviewAt:{type:"string",format:"date-time"},resumeWhen:text},
  required:["owner","work","state","evidence","checkpoint","reviewAt"],additionalProperties:false};
const tools=readOnly ? [
  {name:"read_status",description:"Read actual current control and source readback for the registered acceptance IDs. Historical acceptance is not current control. This receipt DOES_NOT_GRANT_EXECUTION. Re-read with expectedDigest to refuse changes during preparation.",
    inputSchema:{type:"object",properties:{expectedDigest:{type:"string",pattern:"^[a-f0-9]{64}$"}},additionalProperties:false},
    annotations:{readOnlyHint:true}}
] : [
  ...(notices ? [
    {name:"read_notices",description:"Read retained control notifications. Delivery is not application. Application is historical disposition readback, not current control clearance. Acknowledge the exact returned deliveryToken; then handle actual obligations through inbox and read_verdict.",inputSchema:{type:"object",properties:{},additionalProperties:false}},
    {name:"acknowledge_notice",description:"Confirm receipt only, not success or resolution. Any ownerApplied result is historical readback, not current control clearance; the host independently reobserves due sources.",inputSchema:{type:"object",properties:{id:text,deliveryToken:text},required:["id","deliveryToken"],additionalProperties:false}}
  ] : []),
  {name:"inbox",description:"Read pending control obligations for the configured owner.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"read_control",description:"Read selected owned acceptances' current assessed action and historical closure through source readback. Bounded observation, not a writer lock, independent verdict acquisition or execution permission. Re-read with expectedDigest to refuse changes.",
    inputSchema:{type:"object",properties:{acceptanceIds:{type:"array",minItems:1,maxItems:32,uniqueItems:true,
      items:{type:"string",maxLength:100,pattern:"^[A-Za-z0-9_-]+$"}},expectedDigest:{type:"string",pattern:"^[a-f0-9]{64}$"}},
      required:["acceptanceIds"],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"read_verdict",description:"Acquire a compact view of the exact retained verdict: all findings, criterion statuses and repair groups. The host retains the full verdict and binds your next response to it.",inputSchema:{type:"object",properties:{id:text},required:["id"],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:"respond",description:"After read_verdict, record CONTINUE or REPAIR, or apply the explicit independent terminalDisposition with WAIT/DONE and its recordSha256. No guessed fields or execution permission. Supply ONE repair lease per distinct owner/work pair in repairGroups, NOT one per finding. Use that group's earliest reviewAt or sooner. Host supplies owner and acquired review hash; terminal closure is a host readback event, not an owner completion claim. Cannot close findings, approve commands or fabricate continuation.",
    inputSchema:{type:"object",properties:{id:text,decision:decisionSchema,repairLeases:{type:"array",uniqueItems:true,items:leaseSchema}},required:["id","decision"],additionalProperties:false},annotations:{readOnlyHint:false}},
  {name:"record_retention_repair",description:"Record observed replacement bytes for the same required writes after an owned repair. Always enrolls fresh independent review; never closes findings.",
    inputSchema:{type:"object",properties:{id:{type:"string"},repair:{type:"object"}},required:["id","repair"],additionalProperties:false},annotations:{readOnlyHint:false}},
  {name:"request_health_repair_review",description:"Submit named health repairs to fresh review; cannot clear findings or authorize retries.",
    inputSchema:{type:"object",properties:{evidence:{type:"string"},findingIds:{type:"array",items:{type:"string"}}},required:["evidence","findingIds"],additionalProperties:false},annotations:{readOnlyHint:false}},
  {name:"propose_health_domain",description:"Request fresh independent HEALTH approval for one already approved confined command. Does not approve a domain, submit effects or grant execution. Reviewer must acquire the exact registered authority sources; read_verdict and CONTINUE apply its explicit approval.",
    inputSchema:{type:"object",properties:{grantId:{type:"string",pattern:"^[a-f0-9]{64}$"},sourceIds:{type:"array",minItems:1,maxItems:500,uniqueItems:true,items:text}},
      required:["grantId","sourceIds"],additionalProperties:false},annotations:{readOnlyHint:false}}
].filter(t=>profile.capability!=="CONTROL_DISPOSITION_ONLY" ||
  !["record_retention_repair","request_health_repair_review","propose_health_domain"].includes(t.name));
const errors={OWNER_VERDICT_READBACK_REQUIRED:"Read the exact verdict in this session before respond; omit reviewKey or use the returned reviewKey.",
  OWNER_ARGUMENT_INVALID:"Use the declared tool schema only. decision requires action and evidence; repairLeases are unique by owner/work.",
  HEALTH_DISPOSITION_INVALID:"Health decision requires action CONTINUE or REPAIR and evidence after current read_verdict.",
  HEALTH_REPAIR_OWNER_REQUIRED:"Supply one complete repair lease per owner/work group, with reviewAt no later than the earliest finding in it.",
  HEALTH_SOURCE_CHANGED:"Sources changed after review. Fresh independent review is required; do not force continuation.",
  HEALTH_REPAIR_REQUIRED:"Blocking findings require action REPAIR. Owner response cannot close findings.",
  CONTROL_PAUSED:"Human pause is active. Do not resume or retry around it."};
await serveControlMcp({name:"vydykhai-control-owner",tools,
 errorMessage:e=>Object.hasOwn(errors,e?.message??"")?`${e.message}: ${errors[e.message]}`:"CONTROL_REQUEST_REFUSED",
 invoke:async(name,args)=>{
  if(!tools.some(t=>t.name===name))throw Error("OWNER_CAPABILITY_REFUSED");
  if(name==="read_status")return preparer.readStatus(args);
  if(name==="read_control") {
    if(Object.keys(args).some(k=>!["acceptanceIds","expectedDigest"].includes(k)))throw Error("OWNER_ARGUMENT_INVALID");
    return owner.readControl(args.acceptanceIds, args.expectedDigest === undefined ? {} : {expectedDigest:args.expectedDigest});
  }
  if(name==="read_notices" && notices && Object.keys(args).length===0)return notices.readNotices();
  if(name==="acknowledge_notice" && notices && Object.keys(args).every(k=>["id","deliveryToken"].includes(k)))return notices.acknowledge(args);
  const allowed=name==="inbox"?[]:name==="propose_health_domain"?["grantId","sourceIds"]:name==="request_health_repair_review"?["evidence","findingIds"]:name==="read_verdict"?["id"]:name==="record_retention_repair"?["id","repair"]:["id","decision","repairLeases"];
  if(Object.keys(args).some(k=>!allowed.includes(k)))throw Error("OWNER_ARGUMENT_INVALID");
  if(name==="inbox")return owner.inbox();
  if(name==="read_verdict") {
    const packet=await owner.readVerdict(args.id);
    return {...compactOwnerVerdict(packet),...(packet.verdict.terminalDisposition ?
      {terminalDisposition:packet.verdict.terminalDisposition} : {}),...(packet.verdict.healthDomain ?
      {healthDomain:packet.verdict.healthDomain} : {})};
  }
  if(name==="record_retention_repair")return owner.recordRetentionRepair(args.id,args.repair);
  if(name==="request_health_repair_review") {
    if(!owner.requestHealthRepairReview)throw Error("HEALTH_NOT_CONFIGURED");
    return owner.requestHealthRepairReview(args);
  }
  if(name==="propose_health_domain") {
    if(!owner.proposeHealthDomain)throw Error("HEALTH_NOT_CONFIGURED");
    return owner.proposeHealthDomain(args);
  }
  if(!args.decision || !["CONTINUE","REPAIR","WAIT","DONE"].includes(args.decision.action) ||
    typeof args.decision.evidence!=="string" || !args.decision.evidence.trim() ||
    Object.keys(args.decision).some(k=>!Object.hasOwn(decisionSchema.properties,k)) ||
    (args.repairLeases!==undefined&&(!Array.isArray(args.repairLeases)||args.repairLeases.some(l=>!l||
      Object.keys(l).some(k=>!Object.hasOwn(leaseSchema.properties,k))||leaseSchema.required.some(k=>!l[k])))))throw Error("OWNER_ARGUMENT_INVALID");
  const result=await owner.respond(args.id,{...args.decision,owner:profile.config.owner},args.repairLeases??[]);
  if(notices)await notices.recordApplications();
  return result;
}});
