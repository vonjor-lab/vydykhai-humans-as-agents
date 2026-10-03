// Read-only evidence coverage over existing participant packets and shared receipts.
import { canonicalJson, sha256 } from "./memory-brief.mjs";

const concrete = v => typeof v === "string" && !!v.trim() && !/[\r\n]|<[^>]*>/.test(v) &&
  !/^(none|unknown|pending|tbd)$/i.test(v.trim());
const unique = values => new Set(values).size === values.length;
const refsValid = refs => Array.isArray(refs) && refs.every(r => r && concrete(r.id) && concrete(r.revision)) &&
  unique(refs.map(r => r.id));

export function assessTeamSync(value, { required = false } = {}) {
  const limits = { evidence: "DECLARED_RECEIPTS_ONLY", participantIdentity: "NOT_AUTHENTICATED",
    independentWork: "CONTINUE_WITHIN_EXISTING_AUTHORITY" };
  if (value === undefined) return { status: required ? "MISSING" : "NOT_REQUESTED", key: null,
    gaps: required ? [{ participant: null, reason: "shared participant/artifact scope missing" }] : [], ...limits };
  if (!value || !concrete(value.scope) || !concrete(value.registrySource) || !refsValid(value.artifacts) ||
      !value.artifacts.length || value.artifacts.some(a => !concrete(a.source)) ||
      !Array.isArray(value.participants) || !value.participants.length ||
      !unique(value.participants.map(p => p?.id)) || value.participants.some(p => !p ||
        !concrete(p.id) || !concrete(p.sourceRange) || !Array.isArray(p.artifacts) || !p.artifacts.length ||
        !unique(p.artifacts) || p.artifacts.some(id => !value.artifacts.some(a => a.id === id))) ||
      !Array.isArray(value.receipts) || !unique(value.receipts.map(r => r?.participant)) ||
      value.receipts.some(r => !r || !value.participants.some(p => p.id === r.participant))) {
    throw new Error("Invalid team sync input");
  }
  const projection = value.participants.map(p => ({ id: p.id, sourceRange: p.sourceRange,
    artifacts: value.artifacts.filter(a => p.artifacts.includes(a.id)).sort((a, b) => a.id.localeCompare(b.id))
  })).sort((a, b) => a.id.localeCompare(b.id));
  const key = sha256(canonicalJson({ scope: value.scope, registrySource: value.registrySource, participants: projection }));
  const gaps = [], participants = [];
  for (const p of projection) {
    const missing = [], r = value.receipts.find(r => r.participant === p.id);
    const current = refs => refsValid(refs) && refs.length === p.artifacts.length &&
      p.artifacts.every(a => refs.some(ref => ref.id === a.id && ref.revision === a.revision));
    const contribution = r?.contribution;
    if (!contribution || !["DELTA", "NO_CHANGE"].includes(contribution.disposition) ||
        !concrete(contribution.evidence) || contribution.sourceRange !== p.sourceRange ||
        !current(contribution.artifacts) ||
        (contribution.disposition === "DELTA" && !concrete(contribution.integration))) {
      missing.push("current contribution/integration evidence missing");
    }
    const readback = r?.readback;
    if (!readback || !current(readback.artifacts) || !concrete(readback.evidence) ||
        !concrete(readback.retrieval) || !concrete(readback.application)) {
      missing.push("participant retrieval/application readback missing or stale");
    }
    participants.push({ id: p.id, status: missing.length ? "PENDING" : "CURRENT" });
    gaps.push(...missing.map(reason => ({ participant: p.id, reason })));
  }
  return { status: gaps.length ? "PENDING" : "CURRENT", key, participants, gaps, ...limits };
}
