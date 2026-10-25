// Explicit delegation for control dispositions only, never a replacement project
// orchestrator. A finite event handler is woken by the existing host scheduler.
import path from "node:path";
import {open} from "node:fs/promises";
import {openControlStore} from "./control-store.mjs";
import {controlDirectory,readActivationJson} from "./control-activation.mjs";
import {runControlledWorker} from "./control-worker-run.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {ownerControl} from "./control-owner.mjs";
import {notificationOwner} from "./control-notification-owner.mjs";
import {ownerWait} from "./control-owner-wait.mjs";

const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(`CONTROL_OWNER_DELIVERY_${c}`);};
const filled=v=>typeof v==="string"&&v.trim().length>0&&v.length<=512;
async function save(file,value) {
  const fd=await open(file,"wx",0o600);
  try{await fd.writeFile(canonicalJson(value)+"\n");await fd.sync();}finally{await fd.close();}
}
export async function openOwnerDelivery(config,{host,notifications,observeControl}) {
  const {directory,endpoint,native,maxCalls,expiresAt,delegation}=config;
  need(endpoint?.schema==="control.owner-endpoint.v1"&&endpoint.capability==="CONTROL_DISPOSITION_ONLY"&&endpoint.notifications&&notifications&&
    ["NATIVE_CONTROL_DISPOSITION","EXACT_CONTROL_DISPOSITION"].includes(delegation?.mode)&&delegation.owner===endpoint.config?.owner&&
    delegation.authorizedBy===endpoint.config.owner&&filled(delegation.evidence)&&
    filled(delegation.nextAction)&&Number.isSafeInteger(maxCalls)&&maxCalls>0&&maxCalls<=20&&
    Number.isFinite(Date.parse(expiresAt)),"CONFIG_INVALID");
  need(native?.role===undefined&&native?.endpointFile===undefined&&native?.prompt===undefined&&
    Number.isSafeInteger(native?.timeoutMs)&&native.timeoutMs>0&&native.timeoutMs<=180000,"NATIVE_INVALID");
  const automatic=delegation.automatic;
  need((delegation.mode==="EXACT_CONTROL_DISPOSITION")===(automatic!==undefined),"AUTOMATIC_POLICY_REQUIRED");
  if(automatic!==undefined)need(automatic&&Object.keys(automatic).every(k=>["healthContinue","nextActions","terminalActions"].includes(k))&&
    typeof automatic.healthContinue==="boolean"&&automatic.nextActions&&typeof automatic.nextActions==="object"&&!Array.isArray(automatic.nextActions)&&
    Object.entries(automatic.nextActions).every(([id,task])=>/^[A-Za-z0-9_-]{1,100}$/.test(id)&&filled(task))&&
    Array.isArray(automatic.terminalActions)&&new Set(automatic.terminalActions).size===automatic.terminalActions.length&&
    automatic.terminalActions.every(a=>["WAIT","DONE"].includes(a)),"AUTOMATIC_POLICY_INVALID");
  const identity=await controlDirectory(directory),store=await openControlStore(directory),configKey=hash(config);
  const endpointFile=path.join(path.dirname(directory),"owner-endpoint.json");
  const check=s=>need(s?.schema==="control.owner-delivery.v1"&&s.configKey===configKey,"CONFIG_MISMATCH");
  const read=async()=>{need(hash(await controlDirectory(directory))===hash(identity),"DIRECTORY_CHANGED");
    const row=await store.read();check(row?.state);return row;};
  const endpointCurrent=async()=>need(hash(await readActivationJson(endpointFile))===hash(endpoint),"ENDPOINT_CHANGED");
  const waiting=ownerWait(config.waits,{store,read,host,observeControl,expiresAt});
  return {
    waiting,
    async initialize() {
      if(await store.read()){await read();await endpointCurrent();return;}
      try{await save(endpointFile,endpoint);}catch(e){if(e.code!=="EEXIST")throw e;await endpointCurrent();}
      await store.initialize({schema:"control.owner-delivery.v1",configKey,calls:0,runs:{}});
    },
    async capacity() {
      const {state}=await read();await endpointCurrent();
      return {used:state.calls,remaining:Date.now()<Date.parse(expiresAt)?Math.max(0,maxCalls-state.calls):0,
        unknownRuns:Object.values(state.runs).filter(r=>r.state!=="STOPPED").length};
    },
    async deliver({signal}={}) {
      await read();await endpointCurrent();
      if((await host.snapshot()).paused)return {status:"PAUSED",calls:0};
      const snapshot=await notifications.snapshot();
      const pending=snapshot.state.notices.filter(n=>!n.supersededBy&&!n.ownerApplied);
      if(!pending.length)return {status:"QUIET",calls:0};
      // Failure/cadence/repair execution needs the real project owner or operator,
      // not a model hired to acknowledge a problem it has no power to repair.
      if(pending.some(n=>!n.body.actionable.length||n.body.actionable.some(a=>
        a.action!=="OWNER_DISPOSITION_DUE"||a.followup||!a.id||!a.reviewKey)))
        return {status:"HOST_ATTENTION_REQUIRED",calls:0};
      const targets=pending.map(n=>({id:n.body.id,noticeHash:n.noticeHash})).sort((a,b)=>a.id.localeCompare(b.id));
      const obligations=[...new Map(pending.flatMap(n=>n.body.actionable.map(a=>[
        hash({id:a.id,reviewKey:a.reviewKey}),{id:a.id,reviewKey:a.reviewKey}]))).entries()]
        .sort(([a],[b])=>a.localeCompare(b)).map(([key,value])=>({key,...value}));
      const owner=automatic?ownerControl(host,endpoint.config.owner):null,decisions=[];
      if(automatic) {
        // Only explicit, current, independently allowed transitions are mechanical.
        // Repair, open debt or ambiguity returns to the existing owner, never a model fallback.
        for(const obligation of obligations) {
          let packet;try{packet=await owner.readVerdict(obligation.id);}catch{return {status:"OWNER_ATTENTION_REQUIRED",calls:0};}
          const v=packet.verdict;
          if(packet.reviewKey!==obligation.reviewKey||v.findings.some(f=>f.status==="OPEN")||
            v.rows.some(r=>["FAIL","UNKNOWN"].includes(r.status)))return {status:"OWNER_ATTENTION_REQUIRED",calls:0};
          let decision;
          if(obligation.id==="@health"&&automatic.healthContinue)
            decision={action:"CONTINUE"};
          else if(v.resultUse?.status==="ALLOW"&&v.terminalDisposition&&automatic.terminalActions.includes(v.terminalDisposition.action))
            decision={action:v.terminalDisposition.action,recordSha256:v.terminalDisposition.recordSha256};
          else if(v.resultUse?.status==="ALLOW"&&!v.terminalDisposition&&Object.hasOwn(automatic.nextActions,obligation.id))
            decision={action:"CONTINUE",nextAction:automatic.nextActions[obligation.id]};
          if(!decision)return {status:"OWNER_ATTENTION_REQUIRED",calls:0};
          decisions.push({id:obligation.id,decision:{...decision,owner:endpoint.config.owner,reviewKey:packet.reviewKey,
            evidence:`Explicit delegated exact application of independent verdict ${packet.reviewKey}`}});
        }
      }
      const key=hash(obligations);let admitted=false,reason;
      await store.transact(s=>{
        check(s);admitted=false;
        const previous=s.runs[key];
        if(previous){reason=previous.state==="STOPPED"?"ALREADY_ATTEMPTED_NO_REPLAY":"UNKNOWN_RECONCILIATION_REQUIRED";return s;}
        if(Object.values(s.runs).some(r=>r.state!=="STOPPED")){reason="UNKNOWN_RECONCILIATION_REQUIRED";return s;}
        if(Object.values(s.runs).some(r=>r.obligations?.some(old=>obligations.some(o=>o.key===old.key)))) {
          reason="ALREADY_ATTEMPTED_NO_REPLAY";return s;
        }
        if((!automatic&&s.calls>=maxCalls)||Date.now()>=Date.parse(expiresAt)){reason="OWNER_BUDGET_EXHAUSTED";return s;}
        if(!automatic)s.calls++;
        s.runs[key]={state:"IN_FLIGHT",targets,obligations,startedAt:new Date().toISOString(),
          ...(automatic?{mode:"EXACT_DELEGATED",modelCalls:0}:{model:native.model,effort:native.effort})};
        admitted=true;return s;
      });
      if(!admitted)return {status:reason,calls:0};
      if(automatic) {
        try {
          await endpointCurrent();
          const notices=notificationOwner({host,notifications,owner:endpoint.config.owner,transportActor:endpoint.notifications.transportActor});
          const acquired=await notices.readNotices();
          for(const target of targets) {
            const n=acquired.find(n=>n.notice.id===target.id&&n.noticeHash===target.noticeHash);
            need(n,"NOTICE_CHANGED");await notices.acknowledge({id:target.id,deliveryToken:n.deliveryToken});
          }
          for(const {id,decision}of decisions)await owner.respond(id,decision);
          await notices.recordApplications();
          const after=await notifications.snapshot();
          const applied=targets.every(t=>after.state.notices.some(n=>n.body.id===t.id&&n.noticeHash===t.noticeHash&&n.ownerApplied));
          need(applied,"APPLICATION_UNVERIFIED");
          await store.transact(s=>{check(s);Object.assign(s.runs[key],{state:"STOPPED",status:"DISPOSITION_OBSERVED",
            finishedAt:new Date().toISOString(),decisions});return s;});
          return {status:"DISPOSITION_OBSERVED",mode:"EXACT_DELEGATED",calls:0,key,continuation:"NOT_CERTIFIED"};
        } catch(e) {
          await store.transact(s=>{check(s);s.runs[key].error=String(e.message).slice(0,512);return s;});
          return {status:"UNKNOWN_RECONCILIATION_REQUIRED",calls:0,key};
        }
      }
      // A persisted claim precedes process launch. Crash/timeout never refills or
      // replays it; an observed failed reply is still a spent, retained attempt.
      let result;
      try {
        await endpointCurrent();
        if((await host.snapshot()).paused)result={state:"NOT_STARTED",reason:"PAUSED",code:null,output:"",errors:""};
        else result=await runControlledWorker({...native,role:"owner-disposition",endpointFile,signal,prompt:
          `You are the explicitly delegated handler of control dispositions for ${endpoint.config.owner}, not a project executor.\n`+
          `Read notices, acknowledge exact delivery tokens, then read inbox and each currently available verdict.\n`+
          `Use REPAIR for blocking findings; retain one complete repair lease per distinct owner/work group with its checkpoint. `+
          `Use CONTINUE only when allowed, preserving leases for nonblocking debt. The authorized next action for POST_ACCEPT is ${delegation.nextAction}.\n`+
          `If read_verdict provides an explicit independent terminalDisposition, apply only its WAIT/DONE and recordSha256, retaining debt leases. This is an accepted-cycle host disposition, not project completion or execution permission. Never invent a terminal verdict or enroll its artifact.\n`+
          `Never approve commands, perform repairs, clear findings, override pauses or claim project completion. `+
          `Do not repeat failed tool calls; report a concrete inability. No external communication.\n`+
          `Process only these notice ids: ${targets.map(t=>t.id).join(", ")}. Finish concisely.`});
      } catch(e) {
        await store.transact(s=>{check(s);s.runs[key].error=String(e.message).slice(0,512);return s;});
        return {status:"UNKNOWN_RECONCILIATION_REQUIRED",calls:1,key};
      }
      const trace={output:result.output,errors:result.errors};
      await save(path.join(directory,`trace-${key}.json`),trace);
      const state=result.state==="CLOSED"||result.state==="NOT_STARTED"?"STOPPED":"UNKNOWN";
      const after=await notifications.snapshot(),applied=targets.every(t=>after.state.notices.some(n=>
        n.body.id===t.id&&n.noticeHash===t.noticeHash&&n.ownerApplied));
      let usage=null;
      try{const turns=result.output.split("\n").filter(Boolean).map(s=>JSON.parse(s)).filter(e=>e.type==="turn.completed");
        if(turns.length===1)usage=turns[0].usage??null;}catch{/* Incomplete transport is not zero usage. */}
      const status=state!=="STOPPED"?"UNKNOWN_RECONCILIATION_REQUIRED":applied?"DISPOSITION_OBSERVED":"OWNER_ATTENTION_REQUIRED";
      await store.transact(s=>{check(s);Object.assign(s.runs[key],{state,status,finishedAt:new Date().toISOString(),
        code:result.code,reason:result.reason??null,usage,traceHash:hash(trace)});return s;});
      return {status,calls:1,key,continuation:"NOT_CERTIFIED"};
    }
  };
}
