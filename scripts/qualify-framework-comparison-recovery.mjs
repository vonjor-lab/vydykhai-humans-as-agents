// Pure historical evidence validation, never a command grant or journal restore.
// The caller pins checkpoint/owner records from trusted private storage, reads
// currentFiles from the actual successor workspace, and atomically consumes
// evidence.id. Relocation never attributes the historical action to a new root.
import path from "node:path";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { validateNativeTrace } from "./qualify-framework-comparison-native.mjs";

const hash = x => sha256(canonicalJson(x));
const need = (ok, code) => { if (!ok) throw Error(code); };
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const id = x => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(x);
const keys = (x, names) => x && equal(Object.keys(x).sort(), [...names].sort());
const json = raw => { need(typeof raw === "string" && Buffer.byteLength(raw) <= 8 * 1024 * 1024,
  "RECOVERY_BYTES_INVALID"); return JSON.parse(raw); };
function file(files, name, digest) {
  need(typeof name === "string" && !name.includes("\\") && !name.startsWith("/") &&
    name.split("/").every(p => p && p !== "." && p !== "..") && Object.hasOwn(files, name), "RECOVERY_FILE_MISSING");
  const raw = files[name];
  need(typeof raw === "string" && Buffer.byteLength(raw) <= 8 * 1024 * 1024 &&
    (digest === undefined || sha256(raw) === digest), "RECOVERY_FILE_CHANGED");
  return raw;
}
function pinned(files, ref) {
  need(typeof ref?.sha256 === "string" && /^[a-f0-9]{64}$/.test(ref.sha256), "RECOVERY_REF_INVALID");
  return json(file(files, ref.path, ref.sha256));
}
function native(bundle, role) {
  const allocation = json(bundle.allocation), receipt = json(bundle.receipt), trace = json(bundle.trace);
  need(receipt.status === "RECORDED" && allocation.arm === "candidate" && allocation.role === role &&
    receipt.role === role && receipt.arm === allocation.arm && receipt.number === allocation.number &&
    receipt.budgetId === allocation.budgetId && receipt.allocatedAtMs === allocation.allocatedAtMs &&
    receipt.timeoutMs === allocation.timeoutMs && receipt.allocationSha256 === hash(allocation) &&
    receipt.traceSha256 === hash(trace) && receipt.intentSha256 === hash(allocation.intent) &&
    allocation.intentSha256 === hash(allocation.intent) && allocation.kind === "ROLE_DISPATCH" &&
    equal(receipt.sourceRevision, allocation.sourceRevision) &&
    allocation.sourceSnapshot.digest === hash(allocation.sourceSnapshot.rows), "RECOVERY_NATIVE_BINDING_INVALID");
  const parsed = validateNativeTrace(trace, allocation);
  need(equal(parsed.modelOutput, receipt.modelOutput) && parsed.modelOutputSha256 === receipt.modelOutputSha256 &&
    parsed.modelOutputText === receipt.modelOutputText && equal(parsed.acquiredSources, receipt.acquiredSources),
  "RECOVERY_NATIVE_BINDING_INVALID");
  return { allocation, receipt, parsed };
}
const acquired = (n, digest) => n.parsed.acquiredSources.some(r => r.sha256 === digest);

/** checkpoint: {schema, workspace, files (UTF-8 workspace bytes), stage (raw),
 * request (raw original resume), action (raw), verification (raw failed accept),
 * journal (raw rows from revision zero), reviewer/worker/observer (native bundles)}.
 * successor: {workspace (explicit when relocating), request (accept object),
 * files (UTF-8 packet and retained checkpoint bytes), packagePath,
 * ownerRecord (native bundle), expectedOwnerRecordSha256}. No expiry is extended:
 * these records prove past authorship only; fresh execution admission is separate.
 */
export function verifyComparisonRecovery(options) {
  return checkRecovery(options, "ACK_VERIFICATION");
}

// Readiness input only. It cannot replace final verification or import a
// completed task; the bridge must still call verifyComparisonRecovery after ACK.
export function inspectComparisonRecovery(options) {
  return checkRecovery(options, "PRE_ACK_INSPECTION");
}

function checkRecovery({ checkpoint, expectedCheckpointSha256, currentFiles,
  successor, consumedEvidenceIds = [] }, phase) {
  need(Buffer.byteLength(canonicalJson(checkpoint)) <= 32 * 1024 * 1024 &&
    hash(checkpoint) === expectedCheckpointSha256 && checkpoint.schema === "comparison.recovery-checkpoint.v1",
  "RECOVERY_CHECKPOINT_CHANGED");
  need(Buffer.byteLength(canonicalJson(successor)) <= 32 * 1024 * 1024, "RECOVERY_SUCCESSOR_TOO_LARGE");
  const c = checkpoint, stage = json(c.stage), old = json(c.request);
  need(["action.mjs", "candidate.mjs", "consumer-input.json", "oracle.json", "verify.mjs"]
    .every(name => typeof stage.files?.[name] === "string"), "RECOVERY_INPUT_INVENTORY_INCOMPLETE");
  need(stage.workspace === c.workspace && stage.arm === "candidate" && old.workspace === c.workspace &&
    old.operation === "resume" && old.readback, "RECOVERY_PREDECESSOR_INVALID");
  for (const [name, digest] of Object.entries(stage.files)) {
    file(c.files, name, digest); file(currentFiles, name, digest);
  }
  for (const [name, raw] of Object.entries(c.files)) file(currentFiles, name, sha256(raw));
  const task = pinned(c.files, old.task), capsule = pinned(c.files, old.capsule);
  const module = pinned(c.files, task.module), ack = pinned(c.files, old.readback);
  const pkgBytes = file(c.files, "native-package.json"), pkg = json(pkgBytes);
  const recipeSha256 = sha256(file(c.files, "recipe.json"));
  need(task.workspace === c.workspace && capsule.taskSha256 === old.task.sha256 &&
    ack.taskSha256 === old.task.sha256 && ack.capsuleSha256 === old.capsule.sha256 && ack.worker === task.owner,
  "RECOVERY_PREDECESSOR_INVALID");
  const action = json(c.action), failed = json(c.verification);
  need(action.status === "ACTION_COMPLETED" && action.operation === "resume" &&
    action.enforcement === "controlled-command-boundary" && action.action.exitCode === 0 &&
    action.stats.commands === 1 && action.stats.dependentCommands === 1 && action.stats.verificationCommands === 0,
  "RECOVERY_ACTION_NOT_COMPLETED");
  need(failed.status === "BLOCKED" && failed.code === "VERIFICATION_SOURCE_MISSING" &&
    failed.actionOutcome === "NOT_INVOKED" && failed.stats.commands === 0 && failed.stats.verificationCommands === 0,
  "RECOVERY_VERIFICATION_OUTCOME_UNKNOWN");
  need(Array.isArray(c.journal) && c.journal.length >= 4 && c.journal.length <= 256, "RECOVERY_JOURNAL_INVALID");
  const rows = c.journal.map(json);
  rows.forEach((row, i) => need(row.revision === i && row.parent === (rows[i - 1]?.digest ?? null) &&
    row.digest === hash({ revision: i, parent: row.parent, state: row.state }) &&
    row.state.configKey === rows[0].state.configKey, "RECOVERY_JOURNAL_INVALID"));
  const state = rows.at(-1).state, reservations = Object.values(state.reservations);
  need(reservations.length === 1 && reservations[0].status === "COMPLETED", "RECOVERY_RESERVATION_UNRESOLVED");
  const reservation = reservations[0], grant = state.grants[reservation.grantId], binding = grant?.binding;
  need(binding && grant.bindingSha256 === hash(binding) && reservation.bindingSha256 === hash(binding) &&
    reservation.resultSha256 === hash(action.action) && equal(grant.dependencies, []) &&
    equal(reservation.dependencies, []) && binding.operation === "resume" && binding.kind === "dependent" &&
    binding.taskSha256 === old.task.sha256 && binding.taskId === task.id &&
    binding.capsuleSha256 === old.capsule.sha256 && binding.cwd === c.workspace &&
    binding.commandSha256 === hash(task.action) && binding.commandSha256 === action.action.commandSha256 &&
    binding.executable === action.action.executable && binding.cwd === action.action.cwd &&
    binding.sourceDigest === capsule.sourceDigest && binding.dependencyDigest === capsule.dependencyDigest,
  "RECOVERY_ACTION_BINDING_INVALID");
  need(rows.some(row => row.state.reservations?.[reservation.reservationId]?.status === "IN_FLIGHT"),
    "RECOVERY_RESERVATION_HISTORY_MISSING");
  const reviewer = native(c.reviewer, "readiness-reviewer"), worker = native(c.worker, "worker");
  for (const [n, decision] of [[reviewer, "APPROVE"], [worker, "AUTHORIZE_SUPERVISOR_ACTION"]]) {
    const commands = n.allocation.intent.commands;
    need(commands.length === 1 && commands[0].requestId === "resume" &&
      commands[0].bindingSha256 === hash(binding) && commands[0].dependenciesSha256 === hash([]) &&
      commands[0].requestSha256 === hash({ ...old, readback: null }) &&
      n.allocation.intent.task.sha256 === old.task.sha256 && acquired(n, old.task.sha256) && acquired(n, old.capsule.sha256) &&
      acquired(n, recipeSha256) && acquired(n, sha256(pkgBytes)) &&
      n.parsed.modelOutput.commands?.length === 1 && n.parsed.modelOutput.commands[0].requestId === "resume" &&
      n.parsed.modelOutput.commands[0].decision === decision, "RECOVERY_NATIVE_ACTION_MISMATCH");
  }
  need(reviewer.allocation.freezeDigest === worker.allocation.freezeDigest &&
    reviewer.allocation.budgetId === worker.allocation.budgetId && reviewer.allocation.number < worker.allocation.number &&
    equal(reviewer.allocation.sourceRevision, worker.allocation.sourceRevision) &&
    equal(reviewer.allocation.intent.context, worker.allocation.intent.context) &&
    worker.parsed.modelOutput.commands[0].readback === file(c.files, ack.evidenceRef.path, ack.evidenceRef.sha256),
  "RECOVERY_WORKER_EVIDENCE_MISMATCH");
  const observer = native(c.observer, "readiness-reviewer"), artifactSha256 = sha256(file(c.files, "consumer-output.json"));
  need(observer.allocation.freezeDigest === worker.allocation.freezeDigest &&
    observer.allocation.budgetId === worker.allocation.budgetId && observer.allocation.number > worker.allocation.number &&
    observer.allocation.sourceRevision.sequence > worker.allocation.sourceRevision.sequence &&
    observer.allocation.intent.task.sha256 === old.task.sha256 && acquired(observer, old.task.sha256) &&
    acquired(observer, artifactSha256) && acquired(observer, sha256(pkgBytes)) &&
    observer.allocation.sourceSnapshot.rows.some(r => r.id === "artifact" && r.sha256 === artifactSha256),
  "RECOVERY_OUTPUT_NOT_OBSERVED");
  const owner = native(successor.ownerRecord, "owner");
  need(hash(successor.ownerRecord) === successor.expectedOwnerRecordSha256, "RECOVERY_OWNER_RECORD_CHANGED");
  const repair = owner.parsed.modelOutput;
  need(keys(repair, ["decision", "renames", "reason"]) && repair.decision === "approved" &&
    typeof repair.reason === "string" && repair.reason.trim() && acquired(owner, sha256(pkgBytes)) &&
    acquired(owner, artifactSha256) && acquired(owner, old.task.sha256) &&
    owner.allocation.intent.task.sha256 === old.task.sha256 && equal(owner.allocation.intent.commands, []) &&
    owner.allocation.allocatedAtMs > observer.allocation.allocatedAtMs,
  "RECOVERY_REPAIR_NOT_AUTHORED");
  need(Array.isArray(repair.renames) && repair.renames.length === 3,
    "RECOVERY_RENAME_INVALID");
  const ids = new Set(pkg.classifications.flatMap(c => c.assertions.map(a => a.id))), rename = new Map();
  const oracle = pinned(c.files, module.oracle);
  const requiredIds = new Set(oracle.examples.filter(e => [...module.retainedExampleIds, ...task.newExampleIds].includes(e.id))
    .flatMap(e => e.sourceAssertionRefs));
  for (const row of repair.renames) {
    const classification = pkg.classifications.find(c => c.sourceId === row.sourceId && c.eventId === row.eventId);
    const assertion = classification?.assertions.find(a => a.id === row.from);
    need(keys(row, ["from", "to", "sourceId", "eventId", "quote"]) && id(row.from) && id(row.to) && row.from !== row.to &&
      requiredIds.has(row.to) && row.to.startsWith(row.eventId + ":") && assertion?.quote === row.quote &&
      ids.has(row.from) && !ids.has(row.to) && !rename.has(row.from) && ![...rename.values()].includes(row.to),
    "RECOVERY_RENAME_INVALID");
    rename.set(row.from, row.to);
  }
  const expected = structuredClone(pkg);
  for (const c of expected.classifications) for (const a of c.assertions) {
    a.id = rename.get(a.id) ?? a.id;
  }
  // This checkpoint has no references to the renamed IDs. Do not silently grow
  // into a generic graph rewrite when another packet requires additional repair.
  for (const from of rename.keys()) need(!canonicalJson(expected).includes(from), "RECOVERY_REFERENCED_ID_UNSUPPORTED");
  need(equal(json(file(successor.files, successor.packagePath)), expected), "RECOVERY_SEMANTICS_CHANGED");
  const request = successor.request;
  const successorWorkspace = successor.workspace ?? c.workspace;
  const absoluteRoot = value => typeof value === "string" && path.isAbsolute(value) &&
    path.resolve(value) === value && path.dirname(value) !== value;
  need(absoluteRoot(c.workspace) && absoluteRoot(successorWorkspace) && request?.workspace === successorWorkspace &&
    (successorWorkspace === c.workspace ||
      (!successorWorkspace.startsWith(c.workspace + path.sep) && !c.workspace.startsWith(successorWorkspace + path.sep))),
    "RECOVERY_WORKSPACE_INVALID");
  need(request?.operation === "accept" &&
    request.task.path !== old.task.path, "RECOVERY_ACCEPT_ONLY");
  if (phase === "PRE_ACK_INSPECTION") need(request.readback === null, "RECOVERY_ACK_MUST_BE_PENDING");
  else need(request.readback, "RECOVERY_ACK_REQUIRED");
  const next = pinned(successor.files, request.task), nextCapsule = pinned(successor.files, request.capsule);
  const plan = json(file(successor.files, next.packageApproval.plan));
  const approval = json(file(successor.files, next.packageApproval.approval));
  need(approval.decision === "approved" && approval.owner === pkg.owner &&
    approval.planSha256 === sha256(file(successor.files, next.packageApproval.plan)) &&
    plan.workspace === successorWorkspace && plan.owner === pkg.owner &&
    plan.artifacts.some(r => equal(r, request.task)) &&
    plan.inputFiles.some(r => r.path === successor.packagePath && r.sha256 === sha256(file(successor.files, successor.packagePath))),
    "RECOVERY_SUCCESSOR_PLAN_INVALID");
  for (const ref of [...plan.artifacts, ...plan.inputFiles]) {
    need(keys(ref, ["path", "sha256"]) && /^[a-f0-9]{64}$/.test(ref.sha256 ?? ""), "RECOVERY_PLAN_REF_UNSUPPORTED");
    file(successor.files, ref.path, ref.sha256);
  }
  for (const [name, raw] of Object.entries(c.files))
    need(file(successor.files, name) === raw, "RECOVERY_SOURCE_SHADOWED");
  need(equal(plan.semanticPackage, expected) && equal(pinned(successor.files, next.module), module) &&
    next.workspace === successorWorkspace &&
    nextCapsule.taskSha256 === request.task.sha256 && nextCapsule.render === capsule.render &&
    nextCapsule.sourceDigest === capsule.sourceDigest && nextCapsule.dependencyDigest === capsule.dependencyDigest,
  "RECOVERY_SUCCESSOR_PACKET_INVALID");
  need(equal({ ...nextCapsule, taskSha256: capsule.taskSha256,
    ...(Object.hasOwn(capsule, "meaningDigest") ? { meaningDigest: capsule.meaningDigest } : {}) }, capsule),
    "RECOVERY_CAPSULE_CHANGED");
  let ackSha256 = null, workerEvidenceSha256 = null;
  if (phase === "ACK_VERIFICATION") {
    const nextAck = pinned(successor.files, request.readback);
    need(nextAck.taskSha256 === request.task.sha256 && nextAck.capsuleSha256 === request.capsule.sha256 &&
      nextAck.worker === next.owner, "RECOVERY_SUCCESSOR_PACKET_INVALID");
    need(typeof nextAck.evidenceRef?.sha256 === "string" && /^[a-f0-9]{64}$/.test(nextAck.evidenceRef.sha256),
      "RECOVERY_REF_INVALID");
    file(successor.files, nextAck.evidenceRef.path, nextAck.evidenceRef.sha256);
    ackSha256 = request.readback.sha256;
    workerEvidenceSha256 = nextAck.evidenceRef.sha256;
  }
  const normalized = structuredClone(next);
  // Only the new task's root is relocated. Historical packets, command fields,
  // source text and module semantics are neither rebased nor rewritten.
  normalized.workspace = task.workspace;
  for (const k of ["identity", "module", "memoryReview", "packageApproval", "sourceSet", "classifications", "dependencies"])
    normalized[k] = task[k];
  const inverse = new Map([...rename].map(([a, b]) => [b, a]));
  const oldClassifications = json(file(c.files, task.classifications));
  const newClassifications = json(file(successor.files, next.classifications));
  need(newClassifications.records.length === oldClassifications.records.length, "RECOVERY_CLASSIFICATIONS_CHANGED");
  for (let i = 0; i < newClassifications.records.length; i++) {
    const record = newClassifications.records[i], prior = oldClassifications.records[i];
    pinned(successor.files, record.review); pinned(successor.files, record.integration);
    record.review = prior.review; record.integration = prior.integration;
    for (const a of record.assertions) a.id = inverse.get(a.id) ?? a.id;
  }
  need(equal(newClassifications, oldClassifications), "RECOVERY_CLASSIFICATIONS_CHANGED");
  for (const item of normalized.memory.items) item.sourceAssertionRefs = item.sourceAssertionRefs.map(r => inverse.get(r) ?? r);
  need(equal(normalized, task), "RECOVERY_TASK_CHANGED");
  const known = new Set(expected.classifications.flatMap(c => c.assertions.map(a => a.id)));
  need(oracle.examples.filter(e => [...module.retainedExampleIds, ...task.newExampleIds].includes(e.id))
    .every(e => e.sourceAssertionRefs.every(r => known.has(r))), "RECOVERY_ORACLE_LINKAGE_MISSING");
  const evidence = { schema: "comparison.historical-action-evidence.v1", checkpointSha256: expectedCheckpointSha256,
    phase, ackSha256, workerEvidenceSha256, preAckRequestSha256: hash({ ...request, readback: null }),
    historicalWorkspace: c.workspace, successorWorkspace, relocated: successorWorkspace !== c.workspace,
    semantics: { change: "ASSERTION_IDS_ONLY", predecessorPackageSha256: sha256(pkgBytes),
      successorPackageSha256: sha256(file(successor.files, successor.packagePath)),
      retainedFilesSha256: hash(Object.fromEntries(Object.entries(c.files).map(([name, raw]) => [name, sha256(raw)]))) },
    predecessorTaskSha256: old.task.sha256, successorTaskSha256: request.task.sha256, artifactSha256,
    hostHead: rows.at(-1).digest, bindingSha256: hash(binding), actionSha256: sha256(c.action),
    outputLinkage: { kind: "POST_ACTION_NATIVE_OBSERVATION", actionResultSha256: reservation.resultSha256,
      observerAllocationSha256: hash(observer.allocation), observerReceiptSha256: sha256(c.observer.receipt),
      observerTraceSha256: hash(json(c.observer.trace)), sourceRevision: observer.allocation.sourceRevision,
      artifactSource: observer.allocation.sourceSnapshot.rows.find(r => r.id === "artifact" && r.sha256 === artifactSha256),
      limit: "Output observed in a later native source snapshot; action receipt itself has no output digest." },
    ownerRecordSha256: hash(successor.ownerRecord), renames: repair.renames };
  evidence.id = hash(evidence);
  need(Array.isArray(consumedEvidenceIds) && !consumedEvidenceIds.includes(evidence.id), "RECOVERY_ALREADY_CONSUMED");
  return { status: phase === "PRE_ACK_INSPECTION" ? "HISTORICAL_LINKAGE_VERIFIED_ACK_PENDING" : "HISTORICAL_LINKAGE_VERIFIED_ACK_BOUND",
    successorTaskSha256: request.task.sha256, artifactSha256, evidence,
    historicalActionOnly: true, resumeAllowed: false, freshAdmissionRequired: true, semanticAcceptance: "NOT_ESTABLISHED" };
}
