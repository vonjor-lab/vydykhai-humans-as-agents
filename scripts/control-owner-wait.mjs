// Durable turn handoff inside the existing owner-delivery journal. This module
// never launches a model, accepts work, or changes a host permission.
import path from "node:path";
import {randomUUID} from "node:crypto";
import {readPrivateControlJson} from "./control-review-sources.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(`CONTROL_OWNER_WAIT_${c}`);};
const uuid=v=>typeof v==="string"&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
export function ownerWait(config,{store,read,host,observeControl,expiresAt}) {
  if(config===undefined)return null;
  need(config?.schema==="control.owner-wait.v1"&&Number.isSafeInteger(config.maxTurns)&&
    config.maxTurns>0&&config.maxTurns<=64&&config.events&&Object.keys(config.events).length<=64&&
    (config.eventDriven===undefined||typeof config.eventDriven==='boolean'),"CONFIG_INVALID");
  for(const [id,e]of Object.entries(config.events))need(/^[a-zA-Z0-9_-]{1,100}$/.test(id)&&
    ["CONTROL","FILE","OBSERVATION"].includes(e.kind)&&Number.isSafeInteger(e.timeoutMs)&&e.timeoutMs>0&&e.timeoutMs<=86400000&&
    (e.kind==="CONTROL"?typeof e.id==="string"&&e.id.length>0:typeof e.file==="string"&&path.isAbsolute(e.file)),"EVENT_INVALID");
  need(!Object.values(config.events).some(e=>e.kind==="CONTROL")||typeof observeControl==="function","CONTROL_READER_REQUIRED");
  const state=async()=>{const {state:s}=await read();return s.ownerSession??{sessionId:null,turns:[],active:null,waiting:null,done:false};};
  const change=async update=>{await read();return store.transact(s=>{s.ownerSession??={sessionId:null,turns:[],active:null,waiting:null,done:false};update(s.ownerSession);return s;});};
  const current=async()=>!(await host.snapshot()).paused&&Date.now()<Date.parse(expiresAt);
  async function event(e,waiting) {
    if(e.kind==="CONTROL") {
      const result=await observeControl(e.id);
      return result.status==="PENDING"?null:result;
    }
    let value;
    try{value=await readPrivateControlJson(e.file);}catch(error){if(error.code==="ENOENT")return null;throw error;}
    const digest=hash(value);
    if(e.kind==="OBSERVATION") {
      if(digest===waiting?.afterDigest||!["COMPLETED","FAILED"].includes(value.stage))return null;
      need(value.schema==="control.observer-readback.v1","RECEIPT_INVALID");
      if(value.paused)return null;
      const attention=reason=>({status:"OWNER_ATTENTION_REQUIRED",reason,kind:e.kind,file:e.file,
        digest,receipt:value,executionInterrupted:false});
      if(value.stage==="FAILED"||value.status!=="ONE_TICK_OBSERVED"||value.unknownRuns!==0||
        value.ownerCapacity?.unknownRuns!==0||(value.unknownActions??0)!==0)
        return attention("OBSERVATION_UNRESOLVED");
      if(value.calls!==0||value.ownerDelivery?.calls!==0||
        (value.continuation&&value.continuation.calls!==0))return null;
      if(value.inboxCount!==0||!value.actions||typeof value.actions!=="object"||
        Array.isArray(value.actions)||Object.keys(value.actions).length||
        value.ownerDelivery.status!=="QUIET"||value.notificationRoute!=="QUIET"||
        (value.continuation&&value.continuation.results?.length!==0))
        return attention("OBSERVATION_NOT_QUIET");
    }
    return {status:"EVENT_AVAILABLE",kind:e.kind,file:e.file,digest,...(e.kind==="OBSERVATION"?{receipt:value}:{})};
  }
  return {
    snapshot:state,
    async begin() {
      need(await current(),"PAUSED_OR_EXPIRED");
      const runId=randomUUID();let result;
      await change(s=>{
        need(!s.done&&!s.active,"ACTIVE_OR_DONE");
        need(s.turns.length<config.maxTurns,"BUDGET_EXHAUSTED");
        need(s.turns.length===0||s.waiting?.state==="READY","EVENT_NOT_READY");
        const trigger=s.waiting?structuredClone(s.waiting):null;
        s.active=runId;s.waiting=null;
        s.turns.push({runId,state:"IN_FLIGHT",startedAt:new Date().toISOString(),trigger});
        result={runId,sessionId:s.sessionId,trigger};
      });
      return result;
    },
    async park({eventId,checkpoint}) {
      need(Object.hasOwn(config.events,eventId)&&typeof checkpoint==="string"&&checkpoint.trim()&&checkpoint.length<=4000,"REQUEST_INVALID");
      need(await current(),"PAUSED_OR_EXPIRED");
      const e=config.events[eventId];let afterDigest=null;
      if(e.kind==="OBSERVATION"){
        try{afterDigest=hash(await readPrivateControlJson(e.file));}catch(error){if(error.code!=="ENOENT")throw error;}
      }
      await change(s=>{
        need(s.active&&!s.waiting&&!s.done,"TURN_NOT_ACTIVE");
        s.waiting={state:"PARKED",eventId,checkpoint,afterDigest,runId:s.active,
          parkedAt:new Date().toISOString(),deadline:Math.min(Date.now()+e.timeoutMs,Date.parse(expiresAt))};
      });
      return {status:"WAIT_SAVED_END_TURN",eventId,executionInterrupted:false};
    },
    async complete() {
      await change(s=>{need(s.active&&!s.waiting&&!s.done,"TURN_NOT_ACTIVE");s.completionRequested=true;});
      return {status:"COMPLETION_RECORDED_AWAIT_NATIVE_EXIT"};
    },
    async stopped({runId,sessionId,code,reason=null,timedOut=false,usage=null}) {
      need(uuid(runId)&&uuid(sessionId),"NATIVE_RECEIPT_INVALID");
      const receipt={runId,sessionId,code,reason,timedOut,usage};
      await change(s=>{
        const turn=s.turns.find(t=>t.runId===runId);need(turn,"TURN_UNKNOWN");
        if(turn.receipt){need(hash(turn.receipt)===hash(receipt),"RECEIPT_CHANGED");return;}
        need(s.active===runId&&(!s.sessionId||s.sessionId===sessionId),"SESSION_CHANGED");
        turn.receipt=receipt;turn.finishedAt=new Date().toISOString();
        if(code!==0||reason||timedOut){turn.state="UNKNOWN";return;}
        s.sessionId=sessionId;turn.state="STOPPED";s.active=null;
        if(s.completionRequested){s.done=true;return;}
        if(s.waiting?.runId!==runId){turn.state="CHECKPOINT_MISSING";return;}
        s.waiting.state="WAITING";
      });
      // Preserve the native exit and usage before reporting a missing handoff.
      // It is neither a running model nor permission to start another turn.
      need((await state()).turns.find(t=>t.runId===runId).state!=="CHECKPOINT_MISSING","CHECKPOINT_MISSING");
      // Catch completion that arrived while the native owner was still exiting.
      // Observation waits intentionally remain timer-owned (a real quiet interval).
      if(config.eventDriven && config.events[(await state()).waiting?.eventId]?.kind !== 'OBSERVATION')
        await this.observe();
      return state();
    },
    async observe() {
      const s=await state();
      if(!await current())return {status:"PAUSED_OR_EXPIRED",calls:0};
      if(s.active||s.done||s.waiting?.state!=="WAITING")return {status:"UNCHANGED",calls:0};
      let proof;
      try{proof=await event(config.events[s.waiting.eventId],s.waiting);}
      catch(error){proof={status:"OWNER_ATTENTION_REQUIRED",reason:String(error.message).slice(0,512)};}
      if(!proof&&Date.now()>=s.waiting.deadline)proof={status:"OWNER_ATTENTION_REQUIRED",reason:"EVENT_DEADLINE",executionInterrupted:false};
      if(!proof)return {status:"WAITING",calls:0};
      await change(next=>{
        if(next.active||next.waiting?.state!=="WAITING"||next.waiting.runId!==s.waiting.runId)return;
        next.waiting.state="READY";next.waiting.proof=proof;next.waiting.readyAt=new Date().toISOString();
      });
      return {status:"EVENT_RECORDED",calls:0};
    }
  };
}
