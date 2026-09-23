// A comparison aid for the owner, never model-dispatch authority or quota proof.
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, expected) => object(v) && Object.keys(v).sort().join() === [...expected].sort().join();
const text = v => typeof v === "string" && v.trim().length > 0;
const list = v => Array.isArray(v) && v.length > 0 && v.length <= 64;
const nonnegative = v => Number.isFinite(v) && v >= 0;
const tokens = v => Number.isSafeInteger(v) && v >= 0;
const need = (v, code = "COST_INPUT_INVALID") => { if (!v) throw new Error(code); };

export function estimateContextRoutes(input) {
  need(keys(input, ["schema", "owner", "taskId", "rates", "routes"]) && input.schema === "context.cost.v1" &&
    text(input.owner) && text(input.taskId) && list(input.rates) && list(input.routes));
  const rates = new Map();
  for (const r of input.rates) {
    need(keys(r, ["id", "model", "speed", "checkedAt", "source", "input", "cachedInput", "output"]) &&
      text(r.id) && !rates.has(r.id) && text(r.model) && text(r.speed) && text(r.source) &&
      text(r.checkedAt) && Number.isFinite(Date.parse(r.checkedAt)) &&
      [r.input, r.cachedInput, r.output].every(nonnegative), "COST_RATE_INVALID");
    rates.set(r.id, r);
  }
  const ids = new Set();
  const routes = input.routes.map(r => {
    need(keys(r, ["id", "eligible", "evidence", "stages", "unknownCosts"]) && text(r.id) && !ids.has(r.id) &&
      typeof r.eligible === "boolean" && text(r.evidence) && list(r.stages) && Array.isArray(r.unknownCosts) &&
      r.unknownCosts.every(text), "COST_ROUTE_INVALID");
    ids.add(r.id);
    const purposes = new Set();
    const stages = r.stages.map(s => {
      need(keys(s, ["purpose", "rateId", "effort", "inputTokens", "cachedInputTokens", "outputTokens", "basis"]) &&
        ["preparation", "execution", "review", "recovery", "coordination"].includes(s.purpose) &&
        rates.has(s.rateId) && text(s.effort) && text(s.basis) &&
        [s.inputTokens, s.cachedInputTokens, s.outputTokens].every(tokens) && s.cachedInputTokens <= s.inputTokens, "COST_STAGE_INVALID");
      purposes.add(s.purpose);
      const rate = rates.get(s.rateId);
      const credits = ((s.inputTokens - s.cachedInputTokens) * rate.input + s.cachedInputTokens * rate.cachedInput + s.outputTokens * rate.output) / 1e6;
      need(Number.isFinite(credits), "COST_OVERFLOW");
      return { ...s, model: rate.model, credits };
    });
    const unknownCosts = [...r.unknownCosts];
    for (const purpose of ["preparation", "execution", "review", "recovery", "coordination"]) {
      if (!purposes.has(purpose)) unknownCosts.push(`Unestimated ${purpose}`);
    }
    const credits = stages.reduce((sum, s) => sum + s.credits, 0);
    need(Number.isFinite(credits), "COST_OVERFLOW");
    return { id: r.id, eligible: r.eligible, evidence: r.evidence, stages, knownCredits: credits, unknownCosts,
      complete: unknownCosts.length === 0 };
  });
  const comparable = routes.filter(r => r.eligible);
  const complete = comparable.length > 0 && comparable.every(r => r.complete);
  const ranked = [...comparable].sort((a, b) => a.knownCredits - b.knownCredits || a.id.localeCompare(b.id));
  return { status: complete ? "ESTIMATED" : "PARTIAL", metric: "credit-proxy", owner: input.owner, taskId: input.taskId,
    rates: input.rates, routes, bestEstimatedRoute: complete ? ranked[0].id : null,
    subscriptionUsage: "UNKNOWN", ownerReviewRequired: true,
    note: "Eligibility, estimates and source freshness are owner assertions. Include review/recovery/coordination; no automatic dispatch or subscription-savings claim." };
}
