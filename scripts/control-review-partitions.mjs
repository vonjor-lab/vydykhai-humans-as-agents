// Pure wire helpers only. The parent owns dispatch and final global admission.
import {controlCatalog, controlCheckIds} from "./control-catalog.mjs";
import {decodeReviewAnswer} from "./control-review-wire.mjs";
import {validateControlFindings, validAffectedTasks} from "./control-findings.mjs";
import {checkFindingHistory} from "./finding-history.mjs";

const schema = "control.review-answer.v2";
const checks = new Map(controlCatalog.flatMap(g => g.checks.map(c => [c.id, c])));
const need = (value, code) => {if (!value) throw Error(code);};
const filled = value => typeof value === "string" && !!value.trim();
const instant = value => filled(value) && Number.isFinite(Date.parse(value));
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const uniqueRecords = rows => Array.isArray(rows) && Array.from(rows).every(r => filled(r?.id)) &&
  new Set(rows.map(r => r.id)).size === rows.length;

function assignedIds(ids) {
  need(Array.isArray(ids) && ids.length > 0 && ids.length <= checks.size &&
    Array.from(ids).every(id => checks.has(id)) && new Set(ids).size === ids.length,
  "MODEL_REVIEW_PART_IDS_INVALID");
  return new Set(ids);
}

function exactRows(rows, assigned) {
  need(Array.isArray(rows) && rows.length === assigned.size &&
    Array.from(rows).every(row => assigned.has(row?.id)) &&
    new Set(rows.map(row => row.id)).size === assigned.size, "MODEL_REVIEW_PART_COVERAGE_INVALID");
}

function wirePart(answer, assigned) {
  need(answer?.schema === schema, "MODEL_REVIEW_PART_V2_REQUIRED");
  need(Object.keys(answer).every(k => ["schema", "rowGroups", "newFindings", "resolutions", "transitions", "terminalDisposition", "healthDomain"].includes(k)) &&
    Array.isArray(answer.rowGroups) && answer.rowGroups.length > 0 && answer.rowGroups.length <= assigned.size &&
    uniqueRecords(answer.newFindings) && uniqueRecords(answer.resolutions) &&
    (answer.transitions===undefined||uniqueRecords(answer.transitions)), "MODEL_REVIEW_PART_WIRE_INVALID");
  const rows = [];
  for (const group of answer.rowGroups) {
    need(group && Array.isArray(group.ids) && group.ids.length > 0 && group.ids.length <= assigned.size,
      "MODEL_REVIEW_ROW_GROUP_INVALID");
    rows.push(...group.ids.map(id => ({id})));
  }
  exactRows(rows, assigned);
  need(!Object.hasOwn(answer,"terminalDisposition") || assigned.has("C20.03"), "MODEL_REVIEW_TERMINAL_UNASSIGNED");
  need(!Object.hasOwn(answer,"healthDomain") || assigned.has("C05.02"),"MODEL_REVIEW_DOMAIN_UNASSIGNED");
  need(answer.newFindings.every(f => assigned.has(f.checkId)), "MODEL_REVIEW_PART_FINDING_UNASSIGNED");
}

/** Frozen, deterministic whole-group partitions; count is an integer in [1, 4].
 * Catalog-order groups go to the least-loaded part, ties to the lowest index.
 * Criteria inside each part retain catalog order. No applicability is inferred.
 */
export function reviewPartitions(count = 1) {
  need(Number.isInteger(count) && count >= 1 && count <= 4, "MODEL_REVIEW_PART_COUNT_INVALID");
  const parts = Array.from({length: count}, () => []);
  for (const group of controlCatalog) {
    let target = 0;
    for (let i = 1; i < count; i++) if (parts[i].length < parts[target].length) target = i;
    parts[target].push(...group.checks.map(check => check.id));
  }
  return Object.freeze(parts.map(part => Object.freeze(part)));
}

export function frozenReviewPartitions(partitions) {
  need(Array.isArray(partitions) && partitions.length >= 2 && partitions.length <= 20,
    "MODEL_REVIEW_PARTS_INVALID");
  const assigned = Array.from(partitions, assignedIds);
  exactRows(partitions.flatMap(ids => ids.map(id => ({id}))), new Set(controlCheckIds));
  for (const group of controlCatalog)
    need(assigned.some(ids => group.checks.every(check => ids.has(check.id))), "MODEL_REVIEW_PART_GROUP_SPLIT");
  return Object.freeze(partitions.map(ids => Object.freeze([...ids])));
}

export function validateReviewEpisode({episodeGroups, episodeMaxDurationMs, episodeMaxUsageTokens}) {
  need(Array.isArray(episodeGroups) && episodeGroups.length >= 2 && episodeGroups.length <= 20 &&
    Array.from(episodeGroups).every(groups => Array.isArray(groups) && groups.length > 0 &&
      Array.from(groups).every(id => controlCatalog.some(g => g.id === id))) &&
    Number.isSafeInteger(episodeMaxDurationMs) && episodeMaxDurationMs >= 1 && episodeMaxDurationMs <= 86400000 &&
    Number.isSafeInteger(episodeMaxUsageTokens) && episodeMaxUsageTokens >= 1,
    "MODEL_REVIEW_EPISODE_CONFIG_INVALID");
  const partitions = frozenReviewPartitions(episodeGroups.map(groups => groups.flatMap(id =>
    controlCatalog.find(g => g.id === id).checks.map(c => c.id))));
  return Object.freeze({partitions, maxPartsPerTick: 1, maxDurationMs: episodeMaxDurationMs,
    maxUsageTokens: episodeMaxUsageTokens});
}

/** Decode and strictly validate only assigned criteria, throwing on rejection.
 * A partial catalog requires v2; a full single part also accepts legacy wire.
 * Returns detached {rows, findings}, retaining all original findings unchanged
 * outside this part. This is structural proof, not semantic/global acceptance.
 * Options use the existing decoder envelope: offer.input.previousFindings.
 */
export function validateReviewPart(answer, ids, {readbacks, offer, reviewer, observedAt}) {
  const assigned = assignedIds(ids), previous = offer?.input?.previousFindings;
  need(Array.isArray(readbacks) && uniqueRecords(previous) && filled(reviewer) && instant(observedAt) &&
    digest(offer?.key), "MODEL_REVIEW_PART_CONTEXT_INVALID");
  if (answer?.schema === schema) {
    wirePart(answer, assigned);
    const originals = new Map(previous.map(f => [f.id, f]));
    for (const resolution of [...answer.resolutions,...(answer.transitions??[])]) {
      const old = originals.get(resolution.id);
      need(old, "MODEL_REVIEW_RESOLUTION_INVALID");
      need(assigned.has(old.checkId), "MODEL_REVIEW_PART_RESOLUTION_UNASSIGNED");
    }
  } else need(assigned.size === checks.size, "MODEL_REVIEW_PART_V2_REQUIRED");
  const decoded = structuredClone(decodeReviewAnswer(answer, {readbacks, offer, reviewer, observedAt}));
  exactRows(decoded.rows, assigned);
  need(uniqueRecords(decoded.findings), "MODEL_REVIEW_PART_FINDINGS_INVALID");
  for (const row of decoded.rows) {
    need(["PASS", "FINDING", "UNKNOWN", "DEFERRED", "NOT_APPLICABLE"].includes(row.status),
      `INVALID_DISPOSITION:${row.id}`);
    need(filled(row.evidence), `MISSING_EVIDENCE:${row.id}`);
    const citation = /^source:([A-Za-z0-9_-]+):([a-f0-9]{64}|MISSING)(?:$|[\s#])/.exec(row.evidence);
    need(citation && readbacks.some(r => r.id === citation[1] &&
      (r.sha256 ?? r.status) === citation[2]), "MODEL_REVIEW_UNREAD_EVIDENCE");
    if (row.status !== "PASS") need(filled(row.reason), `MISSING_REASON:${row.id}`);
    if (["FINDING", "UNKNOWN", "DEFERRED"].includes(row.status))
      need(filled(row.findingId), `UNOWNED_DISPOSITION:${row.id}`);
  }
  const findings = decoded.findings.filter(f => assigned.has(f.checkId));
  const prior = previous.filter(f => assigned.has(f.checkId));
  // The global validator has no scoped coverage API. Mirror its record checks
  // without synthesizing rows for other parts, then reuse its history contract.
  for (const f of findings) {
    const check = checks.get(f.checkId);
    need(check && f.criterion === check.criterion && f.area === f.checkId.split(".")[0] &&
      [f.evidence, f.owner, f.work].every(filled) && instant(f.firstSeen) && instant(f.reviewAt) &&
      Number.isSafeInteger(f.attempts) && f.attempts >= 0 && typeof f.blocksResume === "boolean" &&
      validAffectedTasks(f.affectedTasks) &&
      ["OPEN", "CLOSED"].includes(f.status) && f.owner !== reviewer &&
      (f.lastResult === undefined || (f.attempts > 0 && ["FAILED", "PASSED"].includes(f.lastResult))) &&
      (f.status !== "CLOSED" || (filled(f.proof) && filled(f.reviewedBy) && digest(f.checkedKey) &&
        (prior.find(old => old.id === f.id)?.status === "CLOSED" ||
          (f.reviewedBy === reviewer && f.checkedKey === offer.key)))), "MODEL_REVIEW_PART_FINDINGS_INVALID");
  }
  const history = checkFindingHistory(prior, findings);
  need(!history, history);
  for (const row of decoded.rows) {
    const open = findings.filter(f => f.checkId === row.id && f.status === "OPEN");
    if (["FINDING", "UNKNOWN", "DEFERRED"].includes(row.status))
      need(open.some(f => f.id === row.findingId), "MODEL_REVIEW_PART_OPEN_FINDING_REQUIRED");
    else need(!open.length, "MODEL_REVIEW_PART_OPEN_FINDING_CONTRADICTION");
  }
  if (assigned.size === checks.size) {
    const error = validateControlFindings({review: {...decoded, reviewer}, previousFindings: previous, key: offer.key});
    need(!error, error?.reason);
  }
  return decoded;
}

/** Merge one raw v2 answer per partition into a detached original v2 envelope.
 * Reject incomplete/split catalog groups, wrong-part rows/new findings and
 * duplicate finding/resolution IDs. Resolution ownership needs the offer and
 * MUST first be checked by validateReviewPart; then globally validate the merge.
 * No PASS/default/N/A rows or finding metadata are generated here.
 */
export function mergeReviewParts(rawAnswers, partitions) {
  need(Array.isArray(partitions) && partitions.length >= 1 && partitions.length <= 20 &&
    Array.isArray(rawAnswers) && rawAnswers.length === partitions.length, "MODEL_REVIEW_PARTS_INVALID");
  const assigned = Array.from(partitions, assignedIds);
  exactRows(partitions.flatMap(ids => ids.map(id => ({id}))), new Set(controlCheckIds));
  for (const group of controlCatalog)
    need(assigned.some(ids => group.checks.every(check => ids.has(check.id))), "MODEL_REVIEW_PART_GROUP_SPLIT");
  const merged = {schema, rowGroups: [], newFindings: [], resolutions: []};
  const newIds = new Set(), resolutionIds = new Set();
  for (let i = 0; i < rawAnswers.length; i++) {
    const answer = rawAnswers[i];
    wirePart(answer, assigned[i]);
    if(Object.hasOwn(answer,"healthDomain")) {
      need(!Object.hasOwn(merged,"healthDomain"),"MODEL_REVIEW_DOMAIN_DUPLICATE");merged.healthDomain=answer.healthDomain;
    }
    if(Object.hasOwn(answer,"terminalDisposition")) {
      need(!Object.hasOwn(merged,"terminalDisposition"),"MODEL_REVIEW_TERMINAL_DUPLICATE");
      merged.terminalDisposition=answer.terminalDisposition;
    }
    for (const f of answer.newFindings) {
      need(!newIds.has(f.id), "MODEL_REVIEW_PART_DUPLICATE_NEW_FINDING");
      newIds.add(f.id);
    }
    for (const r of [...answer.resolutions,...(answer.transitions??[])]) {
      need(!resolutionIds.has(r.id), "MODEL_REVIEW_PART_DUPLICATE_RESOLUTION");
      resolutionIds.add(r.id);
    }
    merged.rowGroups.push(...answer.rowGroups);
    merged.newFindings.push(...answer.newFindings);
    merged.resolutions.push(...answer.resolutions);
    if(answer.transitions?.length)(merged.transitions??=[]).push(...answer.transitions);
  }
  need([...newIds].every(id => !resolutionIds.has(id)), "MODEL_REVIEW_PART_NEW_FINDING_RESOLUTION_CONFLICT");
  return structuredClone(merged);
}
