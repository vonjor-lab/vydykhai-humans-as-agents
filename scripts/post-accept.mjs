// Candidate host API. Identity/source authenticity belongs to the trusted adapter,
// not to caller-provided actor names. Product acceptance and control closure differ.
import {readFile, open, link, unlink, realpath, lstat} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {sha256, canonicalJson} from "./memory-brief.mjs";
import {checkFindingLeases} from "./finding-history.mjs";
import {validateControlFindings} from "./control-findings.mjs";
import {artifactRef, artifactHash, parseContextJson} from "./context-run.mjs";
import {validateReviewSourceScope} from "./control-review-sources.mjs";

const filled = v => typeof v === "string" && v.trim().length > 0;
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const ref = artifactRef;
const instant = v => filled(v) && Number.isFinite(Date.parse(v));
const unique = rows => Array.isArray(rows) && Array.from(rows).every(r => filled(r?.id)) &&
  new Set(rows.map(r => r.id)).size === rows.length;
const hash = v => sha256(canonicalJson(v));
export const retentionKinds = Object.freeze(["memory", "map", "tracker", "custody"]);
export const acceptanceSourceKinds = Object.freeze(["producerReturn", "artifact", "technicalProof", "goal"]);
const retentionChecks = {memory: "C16.03", map: "C14.02", tracker: "C18.01", custody: "C12.03"};
const acceptanceChecks = {producerReturn:"C20.01",artifact:"C10.02",technicalProof:"C19.01",goal:"C01.01"};

export function validProductAcceptance(a) {
  return a?.schema === "work.product-acceptance.v1" && typeof a.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(a.id) &&
    [a.project, a.task, a.owner, a.executor].every(filled) && a.owner !== a.executor &&
    a.status === "ACCEPTED" && instant(a.acceptedAt) && ref(a.producerReturn) && ref(a.artifact) &&
    ref(a.technicalProof) && ref(a.goal) && unique(a.retention) && a.retention.length === retentionKinds.length &&
    a.retention.every(r => retentionKinds.includes(r.id) && typeof r.required === "boolean" &&
      (r.required ? ref(r.expected) : filled(r.reason)));
}

// One immutable file contains both acceptance and its canonical review enrollment.
// A crash cannot leave a stored acceptance whose enrollment must be remembered later.
export async function recordProductAcceptance(directory, acceptance, {createReturnSync} = {}) {
  if (!validProductAcceptance(acceptance)) throw Error("INVALID_PRODUCT_ACCEPTANCE");
  if (typeof createReturnSync !== "function") throw Error("RETURN_ADAPTER_REQUIRED");
  const root = await realpath(directory), stat = await lstat(directory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || root !== path.resolve(directory)) throw Error("UNSAFE_CONTROL_STORAGE");
  const key = hash(acceptance), receiptId = `post-accept-${key}`;
  const file = path.join(root, `${acceptance.id}.md`);
  const enrollment = createReturnSync({status: "CHECKPOINT_READY", returnReceiptId: receiptId,
    taskContextArtifact: `Product acceptance ${acceptance.id}; record ${key}`,
    memoryCandidates: "Read actual retention evidence; acceptance is not integration proof",
    artifactDisposition: "Accepted artifact preserved; independent post-accept control pending",
    recommendedNextAction: "Run fresh post-accept REVIEW, then record the orchestrator disposition"});
  const body = `${enrollment}\n\n<!-- vydykhai:product-acceptance v1 -->\n${canonicalJson(acceptance)}\n<!-- vydykhai:product-acceptance:end -->\n`;
  const existing = async () => {
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || await readFile(file, "utf8") !== body) throw Error("ACCEPTANCE_ID_CONFLICT");
      return true;
    } catch (e) { if (e.code === "ENOENT") return false; throw e; }
  };
  if (await existing()) return {file, key, receiptId, status: "REUSED", controlClosure: "NOT_CONFIRMED"};
  const temp = path.join(root, `.${acceptance.id}.${randomUUID()}.pending`);
  const handle = await open(temp, "wx", 0o600);
  try { await handle.writeFile(body); await handle.sync(); } finally { await handle.close(); }
  try { await link(temp, file); }
  catch (e) { if (e.code !== "EEXIST" || !await existing()) throw e; }
  finally { await unlink(temp); }
  const dir = await open(root, "r");
  try { await dir.sync(); } finally { await dir.close(); }
  return {file, key, receiptId, status: "RECORDED", controlClosure: "NOT_CONFIRMED"};
}

export async function readProductAcceptance(file, {validateDurableOutbox} = {}) {
  if (typeof validateDurableOutbox !== "function") throw Error("RETURN_ADAPTER_REQUIRED");
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw Error("INVALID_ACCEPTANCE_FILE");
  const body = await readFile(file, "utf8");
  const matches = [...body.matchAll(/<!-- vydykhai:product-acceptance v1 -->\n([^\n]+)\n<!-- vydykhai:product-acceptance:end -->/g)];
  if (matches.length !== 1) throw Error("ACCEPTANCE_RECORD_MISSING");
  const acceptance = JSON.parse(matches[0][1]);
  if (!validProductAcceptance(acceptance)) throw Error("INVALID_PRODUCT_ACCEPTANCE");
  const enrollment = validateDurableOutbox(body);
  const id = `post-accept-${hash(acceptance)}`;
  // An enrolled review is deliberately pending, not falsely routed on creation.
  const structuralIssues = enrollment.issues.filter(issue => issue !== `Durable outbox: return ${id} requires routing`);
  if (structuralIssues.length || enrollment.returns.length !== 1 || !enrollment.returns[0].valid ||
      enrollment.returns[0].id !== id || enrollment.returns[0].fields.Status !== "CHECKPOINT_READY" ||
      enrollment.returns[0].fields["Return lifecycle"] !== "WRITTEN") throw Error("ACCEPTANCE_ENROLLMENT_MISMATCH");
  return acceptance;
}

// Host observation reads actual bytes. Missing/stale files remain evidence gaps.
export async function observeRetention(root, acceptance) {
  if (!validProductAcceptance(acceptance)) throw Error("INVALID_PRODUCT_ACCEPTANCE");
  const base = await realpath(root), rows = [];
  for (const item of acceptance.retention) {
    if (!item.required) { rows.push({id: item.id, status: "NOT_REQUIRED", reason: item.reason}); continue; }
    const relative = item.expected.path;
    if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw Error("UNSAFE_RETENTION_PATH");
    const target = path.resolve(base, relative);
    if (!target.startsWith(base + path.sep)) throw Error("UNSAFE_RETENTION_PATH");
    try {
      if (await realpath(target) !== target) throw Error("UNSAFE_RETENTION_PATH");
      const stat = await lstat(target);
      if (!stat.isFile() || stat.size > 2 * 1024 * 1024) throw Error("INVALID_RETENTION_FILE");
      const actual = artifactHash(item.expected, await readFile(target));
      rows.push({id: item.id, status: actual === item.expected.sha256 ? "MATCH" : "MISMATCH", sha256: actual});
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
      rows.push({id: item.id, status: "MISSING"});
    }
  }
  return rows;
}

export async function observeAcceptanceSources(root, acceptance) {
  const rows=await observeRetention(root,{...acceptance,retention:retentionKinds.map((id,i)=>
    ({id,required:true,expected:acceptance[acceptanceSourceKinds[i]]}))});
  return rows.map((row,i)=>({...row,id:acceptanceSourceKinds[i]}));
}

const exactKeys = (v, keys) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).sort().join() === [...keys].sort().join();
export const terminalActions = Object.freeze(["WAIT", "DONE"]);
export const confirmedControlActions = Object.freeze(["CONTROL_CONFIRMED", "CONTROL_WAIT_CONFIRMED", "CONTROL_DONE_CONFIRMED"]);
// Product acceptance is a manager claim. Use needs a separate, source-bound
// independent judgment; finding-level holds cannot substitute for that judgment.
export function reviewedResultUse(review, acceptance) {
  const decision = review?.resultUse;
  if (decision === undefined) return "UNKNOWN"; // Retain legacy history, never upgrade its authority.
  if (!exactKeys(decision, ["status", "acceptanceSha256", "evidence", "findingIds"]) ||
      !["ALLOW", "REJECT", "UNKNOWN"].includes(decision.status) ||
      decision.acceptanceSha256 !== hash(acceptance) || !filled(decision.evidence) ||
      !Array.isArray(decision.findingIds) || new Set(decision.findingIds).size !== decision.findingIds.length ||
      !decision.findingIds.every(id => filled(id) && review.findings?.some(f => f.id === id && f.status === "OPEN")) ||
      (decision.status === "ALLOW" ? decision.findingIds.length !== 0 ||
        !review.rows?.some(r => r.id === "C20.02" && r.status === "PASS") ||
        review.rows.some(r => ["C07.03", "C19.01"].includes(r.id) &&
          !["PASS", "NOT_APPLICABLE"].includes(r.status)) : decision.findingIds.length === 0))
    return "INVALID";
  return decision.status;
}
export function validTerminalDisposition(record, acceptance) {
  const common = ["schema", "acceptanceSha256", "owner", "action", "evidence", "producerReturn"];
  return validProductAcceptance(acceptance) && terminalActions.includes(record?.action) &&
    exactKeys(record, [...common, ...(record.action === "WAIT" ?
      ["waitOwner", "trigger", "returnCondition", "reviewAt"] : ["acceptedScope", "dod"])]) &&
    record.schema === "control.terminal-disposition.v1" && record.acceptanceSha256 === hash(acceptance) &&
    record.owner === acceptance.owner && filled(record.evidence) &&
    ref(record.producerReturn) && hash(record.producerReturn) === hash(acceptance.producerReturn) &&
    (record.action === "WAIT" ? [record.waitOwner, record.trigger, record.returnCondition].every(filled) &&
      instant(record.reviewAt) && Date.parse(record.reviewAt) > Date.parse(acceptance.acceptedAt) :
      ref(record.acceptedScope) && ref(record.dod) && hash(record.acceptedScope) === hash(acceptance.goal) &&
      hash(record.dod) === hash(acceptance.technicalProof)) &&
    Buffer.byteLength(canonicalJson(record)) <= 16384;
}

// This is an ordinary durable owner record, not an execution or completion command.
// The host reads its bytes; the independent reviewer judges the stated disposition.
export async function observeTerminalDisposition(root, acceptance, artifact) {
  if (!exactKeys(artifact, ["path", "sha256"]) || !ref(artifact)) throw Error("TERMINAL_ARTIFACT_INVALID");
  const base = await realpath(root), relative = artifact.path;
  if (path.isAbsolute(relative) || relative.split(/[\\/]/).includes("..")) throw Error("UNSAFE_TERMINAL_PATH");
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep)) throw Error("UNSAFE_TERMINAL_PATH");
  try {
    if (await realpath(target) !== target) throw Error("UNSAFE_TERMINAL_PATH");
    const stat = await lstat(target);
    if (!stat.isFile() || stat.size > 16384) throw Error("TERMINAL_ARTIFACT_INVALID");
    const bytes = await readFile(target), sha = sha256(bytes);
    if (bytes.length > 16384) throw Error("TERMINAL_ARTIFACT_INVALID");
    if (sha !== artifact.sha256) return {artifact, status: "MISMATCH", sha256: sha};
    let record;
    try {record = parseContextJson(bytes);} catch {return {artifact, status: "INVALID", sha256: sha};}
    return {artifact, status: validTerminalDisposition(record, acceptance) ? "MATCH" : "INVALID", sha256: sha, record};
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
    return {artifact, status: "MISSING"};
  }
}

export function reviewedTerminalDisposition(input, action, recordSha256) {
  const observation = input.terminalObservation, verdict = input.review?.terminalDisposition;
  return observation?.status === "MATCH" && digest(recordSha256) && observation.sha256 === recordSha256 &&
    observation.artifact?.sha256 === recordSha256 && validTerminalDisposition(observation.record, input.acceptance) &&
    observation.record.action === action && exactKeys(verdict, ["action", "recordSha256", "evidence"]) &&
    verdict.action === action && verdict.recordSha256 === recordSha256 && filled(verdict.evidence);
}

export const postAcceptKey = ({acceptance, observation, previousFindings, policy, retentionRevision, sourceScopeRevision, sourceObservation, sourceEvidence, execution, terminalObservation}) =>
  hash({acceptance, observation, previousFindings, policy, ...(retentionRevision ? {retentionRevision} : {}),
    ...(sourceScopeRevision ? {sourceScopeRevision} : {}),
    ...(sourceObservation ? {sourceObservation} : {}),...(sourceEvidence?{sourceEvidence}: {}),
    ...(execution !== undefined ? {execution} : {}), ...(terminalObservation ? {terminalObservation} : {})});

export function assessPostAccept(input) {
  const result = (action, reason, extra = {}) => ({action, reason, ...extra,
    temporalScope: "AT_READBACK_NOT_CURRENT_CONTROL_OR_EXECUTION_PERMISSION",
    productAcceptance: validProductAcceptance(input?.acceptance) ? "PRESERVED" : "NOT_ESTABLISHED",
    mutationAuthorized: false, semanticAcceptance: "HOST_AND_REVIEW_REQUIRED"});
  const a = input?.acceptance;
  if (!validProductAcceptance(a) || !digest(input?.policy) || !unique(input?.previousFindings))
    return result("RECONCILE_INPUT", "Stored acceptance, policy and retained finding history required");
  if(input.sourceEvidence!==undefined&&(!digest(input.sourceEvidence.digest)||!Array.isArray(input.sourceEvidence.rows)))
    return result("RECONCILE_INPUT","Independent source snapshot is invalid");
  if(input.sourceEvidence && Object.hasOwn(input.sourceEvidence, "scope")) {
    try {
      const scope = validateReviewSourceScope(input.sourceEvidence.scope, a);
      const ids = input.sourceEvidence.rows.map(row => row.id);
      if(!unique(input.sourceEvidence.rows) || hash(input.sourceEvidence.rows) !== input.sourceEvidence.digest ||
        ids.length !== scope.sourceIds.length || scope.sourceIds.some(id => !ids.includes(id)))
        throw Error("REVIEW_SOURCE_SCOPE_INCOMPLETE");
    } catch {
      return result("RECONCILE_INPUT", "Accepted source dependency scope is invalid or incomplete");
    }
  }
  const retained = input.retentionRevision?.retention ?? a.retention;
  if (!validProductAcceptance({...a, retention: retained}))
    return result("RECONCILE_INPUT", "A retention repair must preserve the complete retention contract");
  const sources=input.sourceObservation;
  if(sources!==undefined && (!unique(sources)||sources.length!==acceptanceSourceKinds.length||sources.some(s=>
    !acceptanceSourceKinds.includes(s.id)||!["MATCH","MISSING","MISMATCH"].includes(s.status)||
    (s.status!=="MISSING"&&!digest(s.sha256)))))
    return result("RECONCILE_INPUT","Accepted source observation is incomplete");
  const observed = input.observation;
  if (!unique(observed) || observed.length !== retentionKinds.length ||
      observed.some(o => !retentionKinds.includes(o.id) || !["MATCH", "MISSING", "MISMATCH", "NOT_REQUIRED"].includes(o.status) ||
        (["MATCH", "MISMATCH"].includes(o.status) && !digest(o.sha256))))
    return result("OBSERVE_RETENTION", "Actual stored readback is required before review");
  const key = postAcceptKey(input), r = input.review;
  if (!r || r.phase !== "POST_ACCEPT" || r.key !== key || !filled(r.reviewer) ||
      [a.owner, a.executor].includes(r.reviewer) || !filled(r.runId) || !instant(r.observedAt) ||
      Date.parse(r.observedAt) < Date.parse(a.acceptedAt))
    return result("POST_ACCEPT_REVIEW_DUE", "Fresh source-bound review follows orchestrator acceptance", {key});
  const invalid = validateControlFindings({review: r, previousFindings: input.previousFindings, key});
  if (invalid) return result(invalid.action, invalid.reason, {key});
  const resultUse = reviewedResultUse(r, a);
  if (resultUse === "INVALID") return result("RECONCILE_REVIEW", "Independent result-use decision is invalid", {key});
  for (const expected of retained.filter(o => o.required)) {
    const actual = observed.find(o => o.id === expected.id);
    if (actual.status === "MATCH" && actual.sha256 === expected.expected.sha256) continue;
    if (!r.findings.some(f => f.checkId === retentionChecks[expected.id] && f.status === "OPEN" && f.blocksResume))
      return result("RECONCILE_REVIEW", "A missing required write cannot receive a green verdict", {key});
  }
  for(const source of sources??[]) {
    if(source.status==="MATCH"&&source.sha256===a[source.id].sha256)continue;
    if(!r.findings.some(f=>f.checkId===acceptanceChecks[source.id]&&f.status==="OPEN"&&f.blocksResume))
      return result("RECONCILE_REVIEW","A missing or changed accepted source cannot receive a green verdict",{key});
  }
  const d = input.disposition;
  if (!d || d.owner !== a.owner || d.reviewKey !== hash(r) || !filled(d.evidence) ||
      !["CONTINUE", "REPAIR", ...terminalActions].includes(d.action))
    return result("AWAIT_ORCHESTRATOR_DISPOSITION", "Reading the verdict is not observed response", {key, findings: r.findings});
  const leaseError = checkFindingLeases(r.findings, input.repairLeases);
  if (leaseError) return result("RECONCILE_REPAIR_OWNER", leaseError, {key});
  if (r.findings.some(f => f.status === "OPEN" && f.blocksResume))
    return result("REPAIR_REQUIRED", "Preserve acceptance and hold affected dependencies until independent repair readback", {key});
  if (input.paused === true) return result("PRESERVE_PAUSE", "Control verdict cannot override the human pause", {key});
  if (input.externalUnknown === true) return result("RECONCILE_EXTERNAL_OUTCOME", "Do not replay an uncertain action", {key});
  if (["CONTINUE", "DONE"].includes(d.action) && resultUse !== "ALLOW")
    return result(resultUse === "REJECT" ? "RESULT_USE_REJECTED" : "RESULT_USE_UNPROVEN",
      "Independent acceptance does not permit using this result", {key});
  if (d.action === "REPAIR" && resultUse !== "ALLOW")
    return result("REPAIR_REQUIRED", "Owned correction or missing independent result-use judgment remains", {key});
  if (terminalActions.includes(d.action)) {
    if (!reviewedTerminalDisposition(input, d.action, d.recordSha256))
      return result("VERIFY_TERMINAL_DISPOSITION", "Actual durable disposition and explicit independent verdict required", {key});
    if (input.execution?.coverage !== "ACCEPTED_TASK_HOST_REGISTRY_ONLY" ||
        !Array.isArray(input.execution.reservations) || input.execution.reservations.some(r => r.status === "IN_FLIGHT"))
      return result("RECONCILE_EXTERNAL_OUTCOME", "Accepted-task command outcomes must be known", {key});
    if (!sources || sources.some(s => s.status !== "MATCH" || s.sha256 !== a[s.id].sha256) ||
        d.terminalEvidence !== `host-terminal:${d.recordSha256}`)
      return result("VERIFY_TERMINAL_DISPOSITION", "Trusted source and disposition readback required", {key});
    if (d.action === "WAIT" && Date.parse(input.terminalObservation.record.reviewAt) <= Date.now())
      return result("POST_ACCEPT_REVIEW_DUE", "Owned wait return checkpoint is due", {key});
    return result(`CONTROL_${d.action}_CONFIRMED`, "Observed independently reviewed accepted-cycle disposition", {key,
      remainingDebt: r.findings.filter(f => f.status === "OPEN").map(f => f.id)});
  }
  if (d.action !== "CONTINUE" || !filled(d.nextAction) || !filled(d.continuationEvidence))
    return result("VERIFY_CONTINUATION", "A planned next step is not observed continuation", {key});
  return result("CONTROL_CONFIRMED", "Declared control closure; protected host observations still required", {key,
    remainingDebt: r.findings.filter(f => f.status === "OPEN").map(f => f.id)});
}
