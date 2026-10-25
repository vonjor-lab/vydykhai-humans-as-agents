// One bounded host tick, independent of manager turns. The caller supplies the
// actual scheduler and fresh reviewer transport; no role can make its own verdict.
import {MAX_CONTROL_WORK_MS} from "./control-child.mjs";
export async function runControlTick(host, {review, maxReviews = 1, timeoutMs = 30000, episode} = {}) {
  if (!Number.isSafeInteger(maxReviews) || maxReviews < 0 || maxReviews > 4 ||
      !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_CONTROL_WORK_MS) throw Error("CONTROL_TICK_BUDGET_INVALID");
  const due = await host.due(), results = [];
  let calls = 0;
  for (const item of due) {
    if (!["REVIEW_DUE", "REPAIR_REVIEW_DUE", "REVIEW_EPISODE_DUE"].includes(item.action) || calls >= maxReviews ||
        (episode && calls>=1) || typeof review !== "function") {
      results.push({...item, invoked: false}); continue;
    }
    let offer;
    try {offer = await host.claimReview(item.id, {episode});} catch {results.push({id: item.id, action: "RECONCILE_CLAIM", invoked: false}); continue;}
    calls++;
    let timer;
    const abort = new AbortController();
    try {
      const verdict = await Promise.race([Promise.resolve().then(() => review(offer, {signal: abort.signal})),
        new Promise((_, reject) => {timer = setTimeout(() => {abort.abort(); reject(Error("REVIEW_TIMEOUT"));}, timeoutMs);})]);
      if(verdict?.status==="REVIEW_EPISODE_PROGRESS") {
        await host.deferReview(item.id,offer);
        results.push({id:item.id,action:"REVIEW_EPISODE_DUE",invoked:true});
      } else {
        await host.review(item.id, offer, verdict);
        results.push({id: item.id, action: "OWNER_DISPOSITION_DUE", invoked: true});
      }
    } catch {
      // Preserve ownership and the uncertain run; neither timer nor restart retries it.
      await host.reviewFailure(item.id, offer.runId);
      results.push({id: item.id, action: "REVIEW_RECONCILIATION_REQUIRED", invoked: true});
    } finally {clearTimeout(timer);}
  }
  return {calls, results};
}
