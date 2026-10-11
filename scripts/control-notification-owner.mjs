// Owner readback transport. A returned packet is only an attempted delivery;
// a subsequent exact token proves consumption, not application of its findings.
import {randomUUID} from "node:crypto";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {checkFindingLeases} from "./finding-history.mjs";
const hash=v=>sha256(canonicalJson(v));
const filled=v=>typeof v === "string" && v.trim().length>0;
const recordFor=(state,id)=>id === "@health" ? state.health : state.acceptances?.[id];
export function notificationOwner({notifications,host,owner,transportActor}) {
  const delivered=new Map();
  async function recordApplications() {
    const outbox=await notifications.snapshot(), applied=[];
    for(const n of outbox.state.notices) {
      if(n.supersededBy || !n.transportObserved || n.ownerApplied)continue;
      const state=await host.snapshot();
      if(state.paused !== false)continue;
      const rows=n.body.actionable,dispositions=[],records=[];
      const consumed=rows.length && rows.every(item=>{
        if(item.action!=="OWNER_DISPOSITION_DUE" || item.followup || !item.reviewKey || !item.id)return false;
        const record=recordFor(state,item.id),decision=record?.disposition;
        if(!record?.review || record.reviewLease || hash(record.review)!==item.reviewKey ||
          decision?.reviewKey!==item.reviewKey || decision.owner!==owner || !filled(decision.evidence) ||
          !["CONTINUE","REPAIR","WAIT","DONE"].includes(decision.action) || !Array.isArray(record.findings) ||
          checkFindingLeases(record.findings,record.repairLeases))return false;
        if(decision.action==="CONTINUE" && (record.findings.some(f=>f.status==="OPEN" && f.blocksResume) ||
          item.id!=="@health" && !filled(decision.nextAction)))return false;
        if(["WAIT","DONE"].includes(decision.action) && (item.id==="@health" || record.enrollment!=="CLOSED" ||
          record.findings.some(f=>f.status==="OPEN" && f.blocksResume) ||
          decision.terminalEvidence!==`host-terminal:${decision.recordSha256}`))return false;
        const enrolled=item.id==="@health" ? ["SETTLED","REPAIR_DUE"] : ["CONTINUATION_OR_REPAIR_DUE","FINAL_READBACK_DUE","CLOSED"];
        if(!enrolled.includes(record.enrollment))return false;
        records.push(record);dispositions.push(decision);return true;
      });
      if(!consumed)continue;
      // A stored response is not application to a now-stale source/review obligation.
      const due=await host.due();
      if(rows.some(item=>due.some(d=>d.id===item.id &&
        !["CONTINUATION_OR_REPAIR_DUE","FINAL_READBACK_DUE","REPAIR_DUE","CADENCE_OBSERVATION_DUE"].includes(d.action))))continue;
      const currentState=await host.snapshot();
      if(currentState.paused !== false || rows.some((item,i)=>hash(recordFor(currentState,item.id)??null)!==hash(records[i])))continue;
      // Read sources after the last host-state sample, bound to the consumed
      // record. Torn/unknown readback keeps this return pending, without retry.
      let terminalCurrent=true;
      try {
        for(let i=0;i<rows.length;i++) {
          if(!["WAIT","DONE"].includes(dispositions[i].action))continue;
          const assessed=await host.assess(rows[i].id,{expectedRecordSha256:hash(records[i])});
          if(assessed.action!==`CONTROL_${dispositions[i].action}_CONFIRMED`) {terminalCurrent=false;break;}
        }
      } catch {terminalCurrent=false;}
      if(!terminalCurrent)continue;
      const current=n.attempts.at(-1);
      await notifications.recordOwnerApplied({id:n.body.id,noticeHash:n.noticeHash,attemptId:current.id,
        actor:owner,evidence:`host-observed-dispositions:${hash(dispositions)}:HISTORICAL_APPLICATION_AT_READBACK_NOT_CURRENT_CONTROL`});
      applied.push(n.body.id);
    }
    return applied;
  }
  return {recordApplications,
    async readNotices() {
      const rows=[];
      for(const n of (await notifications.snapshot()).state.notices.filter(n=>!n.supersededBy && !n.ownerApplied)) {
        let attemptId=n.attempts.at(-1)?.id;
        if(!n.transportObserved && n.attempts.at(-1)?.status!=="STARTED") {
          attemptId=(await notifications.beginDelivery({id:n.body.id,noticeHash:n.noticeHash,actor:transportActor})).attemptId;
        }
        // Re-reading a lost local response reuses the original delivery attempt.
        // No external effect, new notice, retry allocation or closure occurs.
        const token=randomUUID();
        delivered.set(n.body.id,{token,noticeHash:n.noticeHash,attemptId});
        rows.push({notice:n.body,noticeHash:n.noticeHash,deliveryToken:token,
          applicationTemporalScope:"HISTORICAL_DISPOSITION_READBACK_NOT_CURRENT_CONTROL"});
      }
      return rows;
    },
    async acknowledge({id,deliveryToken}) {
      const binding=delivered.get(id);
      if(!binding || binding.token!==deliveryToken)throw Error("CONTROL_NOTICE_READBACK_REQUIRED");
      await notifications.recordTransportObserved({id,noticeHash:binding.noticeHash,attemptId:binding.attemptId,
        actor:transportActor,evidence:`owner-exact-readback:${binding.noticeHash}`});
      delivered.delete(id);
      const applied=await recordApplications();
      return {id,status:"TRANSPORT_OBSERVED",ownerApplied:applied.includes(id),
        applicationTemporalScope:"HISTORICAL_DISPOSITION_READBACK_NOT_CURRENT_CONTROL"};
    }
  };
}
