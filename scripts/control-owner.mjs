// Owner capability projection. It cannot create a reviewer verdict or a grant.
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {healthId} from "./control-health.mjs";
import {validPreparationAcceptanceIds} from "./control-host.mjs";
const hash=v=>sha256(canonicalJson(v));
export function preparationControl(host, acceptanceIds) {
  if (!validPreparationAcceptanceIds(acceptanceIds)) throw Error("PREPARATION_ACCEPTANCE_IDS_INVALID");
  const selected = [...acceptanceIds];
  return {
    async readStatus(args = {}) {
      if (!args || typeof args !== "object" || Array.isArray(args) ||
        Object.keys(args).some(k => k !== "expectedDigest")) throw Error("OWNER_ARGUMENT_INVALID");
      return host.preparationStatus(selected, args);
    }
  };
}
export function compactOwnerVerdict(packet) {
  const {verdict,...identity}=packet,groups={},repairs=new Map();
  for(const row of verdict.rows)(groups[row.status]??=[]).push(row.id);
  for(const f of verdict.findings.filter(f=>f.status==="OPEN")) {
    const key=JSON.stringify([f.owner,f.work]);
    const group=repairs.get(key)??{owner:f.owner,work:f.work,reviewAt:f.reviewAt,findingIds:[]};
    group.findingIds.push(f.id);
    if(Date.parse(f.reviewAt)<Date.parse(group.reviewAt))group.reviewAt=f.reviewAt;
    repairs.set(key,group);
  }
  return {...identity,view:"COMPACT_EXACT_VERDICT",phase:verdict.phase,runId:verdict.runId,
    observedAt:verdict.observedAt,criteriaByStatus:groups,findings:verdict.findings,repairGroups:[...repairs.values()]};
}
export function ownerControl(host, owner) {
  const delivered = new Map();
  const readControl = async (acceptanceIds, args = {}) => {
    const preparer = preparationControl(host, acceptanceIds), selected = [...acceptanceIds];
    const state = await host.snapshot();
    if (selected.some(id => state.acceptances[id]?.acceptance.owner !== owner))
      throw Error("OWNER_CONTROL_NOT_AVAILABLE");
    return preparer.readStatus(args);
  };
  return {
    async inbox() {
      const state=await host.snapshot(), rows=[];
      if(host.health)for(const due of await host.health.due())rows.push({...due,productAcceptance:"NOT_APPLICABLE",
        reviewKey:state.health.review ? hash(state.health.review) : null});
      for(const [id,row] of Object.entries(state.acceptances)) {
        if(row.acceptance.owner!==owner)continue;
        if(row.reviewEpisode && ["REVIEW_EPISODE_DUE","REVIEW_IN_FLIGHT"].includes(row.enrollment))continue;
        if(row.enrollment==="CLOSED") {
          // Closure is historical. Reuse bounded selected readback, never turn
          // a journal snapshot or a stale closure into current clearance.
          let receipt;
          try {receipt = await readControl([id]);}
          catch {
            rows.push({id, action:"OBSERVATION_UNKNOWN", productAcceptance:row.acceptance.status,
              reviewKey:row.review?hash(row.review):null});
            continue;
          }
          const current = receipt.rows[0].currentControl;
          const confirmed = ["CONTROL_CONFIRMED","CONTROL_WAIT_CONFIRMED","CONTROL_DONE_CONFIRMED"].includes(current.assessedAction);
          const action = current.assessedAction === "PRESERVE_PAUSE" ? "PRESERVE_PAUSE" :
            current.externalOutcomeUnknown ? "RECONCILE_EXTERNAL_OUTCOME" :
            !confirmed ? "REVIEW_DUE" : current.repairReviewOverdue ? "REPAIR_REVIEW_DUE" : null;
          if(action)rows.push({id,action,productAcceptance:row.acceptance.status,
            reviewKey:row.review?hash(row.review):null,currentControl:current,
            observedAt:receipt.observedAt,receipt:receipt.receipt});
          continue;
        }
        rows.push({id,action:row.enrollment,productAcceptance:row.acceptance.status,
          reviewKey:row.review?hash(row.review):null});
      }
      return rows;
    },
    readControl,
    async readVerdict(id) {
      if(id === healthId && host.health) {
        const h = (await host.snapshot()).health;
        if(h.enrollment !== "OWNER_DISPOSITION_DUE" || !h.review || h.reviewLease)throw Error("OWNER_VERDICT_NOT_AVAILABLE");
        const reviewKey = hash(h.review); delivered.set(id,reviewKey);
        return {id,reviewKey,verdict:h.review,productAcceptance:"NOT_APPLICABLE"};
      }
      const state=await host.snapshot(), row=state.acceptances[id];
      if(!row || row.acceptance.owner!==owner || !row.review || row.reviewLease ||
        row.enrollment!=="OWNER_DISPOSITION_DUE")throw Error("OWNER_VERDICT_NOT_AVAILABLE");
      const reviewKey=hash(row.review);delivered.set(id,reviewKey);
      return {id,reviewKey,verdict:row.review,productAcceptance:row.acceptance.status};
    },
    async respond(id,decision,repairLeases=[]) {
      if(!decision || decision.owner!==owner || !delivered.has(id) ||
        (decision.reviewKey!==undefined&&delivered.get(id)!==decision.reviewKey))throw Error("OWNER_VERDICT_READBACK_REQUIRED");
      decision={...decision,reviewKey:delivered.get(id)};
      if(id === healthId && host.health) {
        const result = await host.health.disposition(decision,repairLeases); delivered.delete(id); return result;
      }
      await host.disposition(id,decision,repairLeases);delivered.delete(id);
      return host.assess(id);
    },
    async recordRetentionRepair(id, repair) {
      await host.recordRetentionRepair(id, {...repair, owner});
      return {id, action:"REVIEW_DUE", productAcceptance:"PRESERVED"};
    },
    ...(host.health ? {async proposeHealthDomain(request) {await host.health.proposeDomain({...request,owner});return {id:healthId,action:"REVIEW_DUE"};},
      async requestHealthRepairReview(request) {
      await host.health.requestRepairReview({...request,owner}); return {id:healthId,action:"REVIEW_DUE"};
    }} : {})
  };
}
