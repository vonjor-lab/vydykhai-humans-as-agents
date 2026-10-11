// Maintainer-only application of exact owner-authored bytes. No semantic repair.
import { mkdir, readFile, writeFile, realpath, lstat, readdir, open } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { openReviewSources } from "./control-review-sources.mjs";
import { readCompletedRoleOutput, verifyNativeComparison, readTurnSources } from "./qualify-framework-comparison-native.mjs";
import { verifyComparisonPreflight, verifyComparisonScenario, invokeComparisonAdapter } from "./qualify-framework-comparison.mjs";
import { validProductAcceptance } from "./post-accept.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (value, code) => { if (!value) throw Error(code); };
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
const encode = value => canonicalJson(value) + "\n";
const schema = "comparison.owner-application.v1";
const status = "RETENTION_APPLIED_HOST_ACCEPTANCE_PENDING";
const kinds = ["producerReturn", "artifact", "technicalProof", "goal"];
const digest = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...keys].sort().join();

// readExecution is a trusted same-instance driver callback, NOT a model-provided
// VERIFIED object. This validator checks its contract, not independent execution.
export function validateBaselineOwnerExecution(value, expected) {
  need(exactKeys(value, ["schema", "id", "arm", "sourceFreeze", "scenarioDigest", "request", "requestSha256",
    "authorization", "observation", "observationSha256", "consumerCheck"]), "BASELINE_EXECUTION_CONTRACT_INVALID");
  const { request, authorization: auth, observation: seen, consumerCheck } = value;
  need(value.schema === "comparison.baseline-execution.v1" && value.arm === "baseline" && value.id === expected.id &&
    value.sourceFreeze === expected.sourceFreeze && value.scenarioDigest === expected.scenarioDigest &&
    request?.schema === "context.request.v1" && request.operation === "accept" && request.workspace === expected.workspace &&
    value.requestSha256 === hash(request) && value.observationSha256 === hash(seen), "BASELINE_EXECUTION_BINDING_INVALID");
  need(auth?.arm === "baseline" && auth.role === "worker" && auth.state === "COMPLETED" &&
    auth.decision === "AUTHORIZE_SUPERVISOR_ACTION" && auth.sourceRoot === expected.workspace &&
    auth.runtimeDigest === expected.armDigest && auth.requestSha256 === value.requestSha256 && hash(auth.request) === hash(request) &&
    ["traceSha256", "allocationSha256", "bindingSha256", "dependenciesSha256", "transportSha256",
      "sourceRegistrySha256", "sourceSnapshotDigest"].every(key => digest(auth[key])), "BASELINE_EXECUTION_AUTH_INVALID");
  need(seen?.arm === "baseline" && seen.armDigest === expected.armDigest && hash(seen.neutralAdapter) === hash(expected.neutralAdapter) &&
    seen.modelDispatch === "ABSENT" && seen.actionExecution === "PINNED_CALLER_COMMAND_SHARED_SANDBOX" &&
    seen.semanticEvidence === false && seen.wholeChainComparatorReady === false && seen.modelsLaunched === 0 &&
    seen.result?.status === "VERIFIED" && seen.result.receipt?.schema === "context.verification.v1" &&
    seen.result.receipt.taskSha256 === request.task?.sha256 && seen.result.receipt.capsuleSha256 === request.capsule?.sha256 &&
    typeof seen.result.returnSync === "string" && seen.result.returnSync.trim() &&
    seen.commands?.length === 1 && seen.commands[0].script === "verify.mjs", "BASELINE_EXECUTION_VERIFICATION_INVALID");
  need(exactKeys(consumerCheck, ["status", "artifact"]) && consumerCheck.status === "PASS" &&
    exactKeys(consumerCheck.artifact, ["path", "sha256"]) && consumerCheck.artifact.path === "consumer-output.json" &&
    digest(consumerCheck.artifact.sha256) && seen.after?.[consumerCheck.artifact.path] === consumerCheck.artifact.sha256 &&
    seen.before?.[consumerCheck.artifact.path] === consumerCheck.artifact.sha256, "BASELINE_CONSUMER_PROOF_REQUIRED");
  return structuredClone(value);
}
const expires = record => record.allocatedAtMs + record.timeoutMs + 300000;
const live = record => need(Number.isSafeInteger(expires(record)) && expires(record) > Date.now(), "OWNER_NATIVE_AUTH_EXPIRED");
async function file(workspace, ref, privateFile = false) {
  need(ref && typeof ref.path === "string" && !path.isAbsolute(ref.path) &&
    !ref.path.split(/[\\/]/).some(part => !part || part === "." || part === "..") &&
    /^[a-f0-9]{64}$/.test(ref.sha256 ?? ""), "OWNER_REFERENCE_INVALID");
  const name = path.resolve(workspace, ref.path), stat = await lstat(name);
  need(name.startsWith(workspace + path.sep) && stat.isFile() && !stat.isSymbolicLink() &&
    (!privateFile || !(stat.mode & 0o077)) && stat.size <= 2 * 1024 * 1024 && await realpath(name) === name,
    "OWNER_REFERENCE_INVALID");
  const bytes = await readFile(name);
  need(bytes.length <= 2 * 1024 * 1024 && sha256(bytes) === ref.sha256, "OWNER_REFERENCE_CHANGED");
  return bytes;
}
async function workspaceRoot(workspace) {
  need(typeof workspace === "string" && path.isAbsolute(workspace) && path.resolve(workspace) === workspace &&
    await realpath(workspace) === workspace && (await lstat(workspace)).isDirectory(), "OWNER_WORKSPACE_UNSAFE");
}
async function privateRoot(directory, workspace) {
  need(typeof directory === "string" && path.isAbsolute(directory) && path.resolve(directory) === directory &&
    await realpath(directory) === directory && directory !== workspace &&
    !directory.startsWith(workspace + path.sep) && !workspace.startsWith(directory + path.sep), "OWNER_APPLICATION_ROOT_UNSAFE");
  const stat = await lstat(directory);
  need(stat.isDirectory() && !(stat.mode & 0o077), "OWNER_APPLICATION_ROOT_UNSAFE");
}
async function contextOf({ sourceFile, runtimeDigest, fixed, helperSha256 }) {
  const sources = await openReviewSources(sourceFile), bytes = await readFile(sourceFile), config = JSON.parse(bytes);
  need(config.workspace === sources.workspace && hash(config.sources) === hash(await sources.list()), "OWNER_REGISTRY_CHANGED");
  const snapshot = await sources.snapshot();
  need(sha256(await readFile(sourceFile)) === sha256(bytes), "OWNER_REGISTRY_CHANGED");
  return { snapshot, context: { runtimeDigest, sourceRoot: sources.workspace,
    sourceRegistrySha256: sha256(bytes), sourceSnapshotDigest: snapshot.digest,
    transportSha256: hash({ fixed, helperSha256 }) } };
}
function acquired(record, before, ref) {
  const rows = before.rows.filter(row => row.path === ref.path && row.status === "AVAILABLE" && row.sha256 === ref.sha256);
  return rows.length === 1 && record.acquiredSources.some(source => source.id === rows[0].id && source.sha256 === ref.sha256);
}

// scopeRef is a public, pre-dispatch source: its hash is in the original host
// snapshot AND its exact native copy must have been read. It binds caller metadata
// without extending native intent or treating callback expectations as authority.
async function validate(pending, record) {
  const { workspace, binding, before, base, retentionTargets, scopeRef, verification, verificationRequestId } = pending;
  need(record.role === "owner", "OWNER_NATIVE_ROLE_REQUIRED"); live(record);
  need(id(pending.dispatchId) && id(verificationRequestId) && verification?.status === "VERIFIED" &&
    typeof verification.returnSync === "string" && verification.receipt?.schema === "context.verification.v1", "OWNER_VERIFICATION_REQUIRED");
  need(before && Array.isArray(before.rows) && hash(before.rows) === before.digest &&
    hash({ runtimeDigest: binding.runtimeDigest, sourceRoot: workspace,
      sourceRegistrySha256: record.intent.context?.sourceRegistrySha256,
      sourceSnapshotDigest: before.digest, transportSha256: hash({ fixed: binding.fixed, helperSha256: binding.helperSha256 }) }) ===
    hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  const proposed = record.modelOutput.acceptance;
  need(proposed?.decision === "ACCEPTED" && typeof proposed.reason === "string" && proposed.reason.trim() &&
    proposed.retention && typeof proposed.retention === "object" && !Array.isArray(proposed.retention), "OWNER_ACCEPTANCE_NOT_AUTHORED");
  need(base && ["id", "project", "task", "owner", "executor"].every(key => id(base[key])) &&
    Object.keys(base).sort().join() === ["id", "project", "task", "owner", "executor", ...kinds, "taskRef"].sort().join() &&
    retentionTargets && Object.keys(retentionTargets).length > 0 && Object.keys(retentionTargets).length <= 8 &&
    Object.keys(retentionTargets).every(id) && Object.keys(retentionTargets).sort().join() === Object.keys(proposed.retention).sort().join(),
    "OWNER_SCOPE_INVALID");
  const scope = JSON.parse(await file(workspace, scopeRef));
  need(hash(scope) === hash({ schema: "comparison.owner-scope.v1", verificationRequestId,
    verificationSha256: hash(verification), base, retentionTargets }), "OWNER_SCOPE_MISMATCH");
  need(acquired(record, before, scopeRef), "OWNER_SCOPE_NOT_ACQUIRED");
  const names = Object.values(retentionTargets);
  need(names.every(name => typeof name === "string" && /^retained-[A-Za-z0-9_-]+\.md$/.test(name)) &&
    new Set(names).size === names.length, "OWNER_RETENTION_PATH_INVALID");
  const retention = [];
  for (const key of Object.keys(retentionTargets).sort()) {
    const name = retentionTargets[key];
    const text = proposed.retention[key];
    need(typeof text === "string" && text.trim() && Buffer.byteLength(text) <= 128 * 1024, "OWNER_RETENTION_NOT_AUTHORED");
    const rows = before.rows.filter(row => row.path === name);
    need(rows.length === 1 && rows[0].status === "MISSING" && !Object.hasOwn(rows[0], "sha256"), "OWNER_RETENTION_NOT_REGISTERED");
    retention.push({ id: key, required: true, expected: { path: name, sha256: sha256(text) } });
  }
  need(Buffer.byteLength(encode(proposed.retention)) <= 512 * 1024, "OWNER_RETENTION_NOT_AUTHORED");
  const originals = {};
  for (const kind of kinds) originals[kind] = await file(workspace, base[kind]);
  need(originals.producerReturn.equals(Buffer.from(verification.returnSync)) &&
    hash(JSON.parse(originals.technicalProof)) === hash(verification.receipt), "OWNER_ORIGINAL_PROOF_MISMATCH");
  need(kinds.every(kind => acquired(record, before, base[kind])), "OWNER_ORIGINAL_PROOF_NOT_ACQUIRED");
  need(base.taskRef?.sha256 === record.intent.task.sha256 && acquired(record, before, base.taskRef) &&
    record.acquiredSources.some(source => source.id === record.intent.task.id && source.sha256 === base.taskRef.sha256), "OWNER_TASK_NOT_ACQUIRED");
  const task = JSON.parse(await file(workspace, base.taskRef));
  need(task.id === base.task && task.owner === base.executor && verification.receipt.taskSha256 === base.taskRef.sha256, "OWNER_TASK_MISMATCH");
  need(validProductAcceptance(authority(pending, record, retention, record.intent.context).payload.acceptance), "OWNER_ACCEPTANCE_SCHEMA_INVALID");
  return retention;
}
function derivedSnapshot(before, retention) {
  return hash(before.rows.map(row => {
    const item = retention.find(item => item.expected.path === row.path);
    return item ? { ...row, status: "AVAILABLE", sha256: item.expected.sha256 } : row;
  }));
}
function authority(pending, record, retention, context) {
  const { taskRef: ignored, ...identity } = pending.base;
  const acceptance = { ...identity, schema: "work.product-acceptance.v1", status: "ACCEPTED", acceptedAt: pending.acceptedAt, retention };
  const payload = { acceptance, verificationRequestId: pending.verificationRequestId, verificationSha256: hash(pending.verification),
    originalReturn: pending.verification.returnSync,
    retention: retention.map(item => ({ id: item.id, bytes: record.modelOutput.acceptance.retention[item.id] })) };
  return { ...context, id: pending.dispatchId, arm: "candidate", role: "owner", state: "COMPLETED", purpose: "OWNING_ACCEPTANCE",
    payload, payloadSha256: hash(payload), traceSha256: record.traceSha256, expiresAt: expires(record),
    provenanceKind: record.provenanceKind, allocationSha256: record.allocationSha256 };
}
async function checkAfter(pending, record, retention) {
  const current = await contextOf(pending.binding);
  need(hash({ ...current.context, sourceSnapshotDigest: pending.before.digest }) === hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  need(current.snapshot.digest === derivedSnapshot(pending.before, retention), "OWNER_RETENTION_DELTA_INVALID");
  for (const item of retention) {
    const bytes = await file(pending.workspace, item.expected);
    need(bytes.equals(Buffer.from(record.modelOutput.acceptance.retention[item.id])), "OWNER_APPLICATION_RETENTION_CHANGED");
  }
  live(record);
  return current.context;
}

export async function applyNativeOwnerAcceptance(options) {
  const { directory, expectedDigest, number, dispatchId, workspace, applicationRoot, sourceFile,
    runtimeDigest, fixed, helperSha256, verificationRequestId, verification, base, retentionTargets, scopeRef } = structuredClone(options);
  await workspaceRoot(workspace); await privateRoot(applicationRoot, workspace);
  const record = await readCompletedRoleOutput({ directory, expectedDigest, arm: "candidate", number });
  need(record.role === "owner", "OWNER_NATIVE_ROLE_REQUIRED"); live(record);
  const binding = { sourceFile, runtimeDigest, fixed, helperSha256 }, before = await contextOf(binding);
  need(hash(before.context) === hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  const pending = { schema, number, dispatchId, nativeDigest: expectedDigest, workspace,
    allocationSha256: record.allocationSha256, modelOutputSha256: record.modelOutputSha256, intentSha256: record.intentSha256,
    before: before.snapshot, binding, base, retentionTargets, verificationRequestId, verification, scopeRef,
    acceptedAt: new Date().toISOString() };
  const retention = await validate(pending, record);
  for (const item of retention) {
    try { await lstat(path.join(workspace, item.expected.path)); throw Error("OWNER_RETENTION_ALREADY_EXISTS"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const pendingBytes = encode(pending);
  need(Buffer.byteLength(pendingBytes) <= 2 * 1024 * 1024, "OWNER_APPLICATION_TOO_LARGE");
  need(hash((await contextOf(binding)).context) === hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  await workspaceRoot(workspace); await privateRoot(applicationRoot, workspace); live(record);
  const root = path.join(applicationRoot, dispatchId);
  try { await mkdir(root, { mode: 0o700 }); }
  catch (error) { if (error.code === "EEXIST") throw Error("OWNER_APPLICATION_EXISTS"); throw error; }
  await writeFile(path.join(root, "pending.json"), pendingBytes, { mode: 0o600, flag: "wx" });
  // A partial/uncertain application stays pending; never retry or overwrite it.
  for (const item of retention) {
    await workspaceRoot(workspace); live(record);
    await writeFile(path.join(workspace, item.expected.path), record.modelOutput.acceptance.retention[item.id], { mode: 0o600, flag: "wx" });
  }
  await validate(pending, record);
  const context = await checkAfter(pending, record, retention), auth = authority(pending, record, retention, context);
  const applied = { schema, status, pendingSha256: sha256(pendingBytes),
    sourceBefore: before.snapshot.digest, sourceAfter: context.sourceSnapshotDigest, auth,
    semanticEvidence: false, wholeChainComparatorReady: false };
  const bytes = encode(applied);
  need(Buffer.byteLength(bytes) <= 2 * 1024 * 1024, "OWNER_APPLICATION_TOO_LARGE");
  await privateRoot(root, workspace); live(record);
  await writeFile(path.join(root, "applied.json"), bytes, { mode: 0o600, flag: "wx" });
  return { acceptance: auth.payload.acceptance, applicationRef: path.join(root, "applied.json"), applicationSha256: sha256(bytes) };
}

export async function readNativeOwnerApplication({ directory, expectedDigest, workspace, applicationRoot, dispatchId, applicationSha256 }) {
  await workspaceRoot(workspace); await privateRoot(applicationRoot, workspace);
  need(id(dispatchId), "OWNER_APPLICATION_ID_INVALID");
  await privateRoot(path.join(applicationRoot, dispatchId), workspace);
  const applied = JSON.parse(await file(applicationRoot, { path: `${dispatchId}/applied.json`, sha256: applicationSha256 }, true));
  const pending = JSON.parse(await file(applicationRoot, { path: `${dispatchId}/pending.json`, sha256: applied.pendingSha256 }, true));
  need(pending.schema === schema && applied.schema === schema && pending.nativeDigest === expectedDigest &&
    pending.dispatchId === dispatchId && pending.workspace === workspace && applied.status === status &&
    applied.semanticEvidence === false && applied.wholeChainComparatorReady === false, "OWNER_APPLICATION_BINDING_MISMATCH");
  const record = await readCompletedRoleOutput({ directory, expectedDigest, arm: "candidate", number: pending.number });
  need(record.allocationSha256 === pending.allocationSha256 && record.modelOutputSha256 === pending.modelOutputSha256 &&
    record.intentSha256 === pending.intentSha256 && Number.isFinite(Date.parse(pending.acceptedAt)) &&
    Date.parse(pending.acceptedAt) >= record.allocatedAtMs && Date.parse(pending.acceptedAt) < expires(record), "OWNER_APPLICATION_BINDING_MISMATCH");
  const retention = await validate(pending, record), context = await checkAfter(pending, record, retention);
  const auth = authority(pending, record, retention, context);
  need(applied.sourceBefore === pending.before.digest && applied.sourceAfter === context.sourceSnapshotDigest &&
    hash(auth) === hash(applied.auth), "OWNER_APPLICATION_BINDING_MISMATCH");
  return auth;
}

// Verdict/scope are immutable native transport copies, not new host review inputs:
// adding a verdict to its own evidence registry would invalidate that verdict.
// readVerdict must be the trusted selected bridge's readOwnerVerdict, never a model
// callback. The bridge independently rechecks this payload before the only effect.
export async function readNativeOwnerDisposition({ readVerdict, ...options }) {
  const { directory, expectedDigest, number, dispatchId, workspace, sourceFile,
    runtimeDigest, fixed, helperSha256, acceptanceId, owner, taskRef, verdictRef, scopeRef } = structuredClone(options);
  need(typeof readVerdict === "function" && [dispatchId, acceptanceId, owner].every(id), "OWNER_DISPOSITION_ARGUMENT_INVALID");
  await workspaceRoot(workspace);
  const record = await readCompletedRoleOutput({ directory, expectedDigest, arm: "candidate", number });
  need(record.role === "owner", "OWNER_NATIVE_ROLE_REQUIRED"); live(record);
  const binding = { sourceFile, runtimeDigest, fixed, helperSha256 }, before = await contextOf(binding);
  need(before.context.sourceRoot === workspace && hash(before.context) === hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  const readTransport = async ref => {
    need(id(ref?.id) && record.acquiredSources.some(source => source.id === ref.id && source.sha256 === ref.sha256),
      "OWNER_DISPOSITION_SOURCE_NOT_ACQUIRED");
    return JSON.parse(await file(workspace, ref));
  };
  const packet = await readTransport(verdictRef), scope = await readTransport(scopeRef);
  need(verdictRef.id !== scopeRef.id && verdictRef.path !== scopeRef.path &&
    hash(scope) === hash({ schema: "comparison.owner-disposition-scope.v1", acceptanceId, owner,
      taskRef, verdictRef, context: before.context }), "OWNER_DISPOSITION_SCOPE_MISMATCH");
  need(packet.id === acceptanceId && packet.reviewKey === hash(packet.verdict) &&
    hash(await readVerdict(acceptanceId)) === hash(packet), "OWNER_DISPOSITION_VERDICT_CHANGED");
  need(taskRef?.sha256 === record.intent.task.sha256 && acquired(record, before.snapshot, taskRef) &&
    record.acquiredSources.some(source => source.id === record.intent.task.id && source.sha256 === taskRef.sha256),
    "OWNER_TASK_NOT_ACQUIRED");
  await file(workspace, taskRef);
  const authored = record.modelOutput.disposition;
  need(authored && Object.keys(authored).sort().join() === "decision,repairLeases" &&
    authored.decision && typeof authored.decision === "object" && !Array.isArray(authored.decision) &&
    authored.decision.owner === owner && authored.decision.reviewKey === packet.reviewKey &&
    ["CONTINUE", "REPAIR"].includes(authored.decision.action) && Array.isArray(authored.repairLeases),
    "OWNER_DISPOSITION_NOT_AUTHORED");
  // Authentication is not semantic approval: even an authored CONTINUE must pass
  // the selected host's unresolved-finding, lease, pause and currentness gates.
  const payload = { acceptanceId, verdictSha256: hash(packet),
    decision: structuredClone(authored.decision), repairLeases: structuredClone(authored.repairLeases) };
  await file(workspace, verdictRef); await file(workspace, scopeRef);
  need(hash((await contextOf(binding)).context) === hash(before.context), "OWNER_CONTEXT_CHANGED");
  need(hash(await readVerdict(acceptanceId)) === hash(packet), "OWNER_DISPOSITION_VERDICT_CHANGED");
  live(record);
  return { ...before.context, id: dispatchId, arm: "candidate", role: record.role, state: "COMPLETED",
    purpose: "CONTROL_DISPOSITION", payload, payloadSha256: hash(payload), traceSha256: record.traceSha256,
    allocationSha256: record.allocationSha256, expiresAt: expires(record), provenanceKind: record.provenanceKind,
    evidenceLevel: "NATIVE_OUTPUT_BOUND_NOT_SEMANTIC_APPROVAL" };
}

async function durableFile(name, bytes) {
  const handle = await open(name, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const parent = await open(path.dirname(name), "r");
  try { await parent.sync(); } finally { await parent.close(); }
}
async function inventory(workspace) {
  const result = {}; let count = 0, size = 0;
  const walk = async relative => {
    for (const name of (await readdir(path.join(workspace, relative))).sort()) {
      const key = relative ? `${relative}/${name}` : name, full = path.join(workspace, key), stat = await lstat(full);
      need(++count <= 4096 && !stat.isSymbolicLink() && await realpath(full) === full, "BASELINE_OWNER_WORKSPACE_UNSAFE");
      if (stat.isDirectory()) await walk(key);
      else {
        need(stat.isFile() && (size += stat.size) <= 32 * 1024 * 1024, "BASELINE_OWNER_WORKSPACE_UNSAFE");
        result[key] = sha256(await readFile(full));
      }
    }
  };
  await walk(""); return result;
}
function freshOutput(name) {
  need(typeof name === "string" && /^[A-Za-z0-9_-]{1,100}\.(md|json)$/.test(name), "BASELINE_OWNER_OUTPUT_INVALID");
  return name;
}

// Baseline has no candidate host. Native provenance authenticates authored bytes;
// archived outbox/integration primitives remain the only protocol interpreters.
// Route consumes an ALREADY prepared next request, never a fabricated future ack.
export async function applyNativeBaselineOwner({ readExecution, ...options }) {
  need(typeof readExecution === "function", "BASELINE_EXECUTION_READER_REQUIRED");
  const { directory, expectedDigest, number, scopeRef, applicationRoot, sourceFile, fixed, helperSha256 } = structuredClone(options);
  const selector = { directory, expectedDigest, arm: "baseline" };
  const freeze = await verifyNativeComparison(directory, expectedDigest);
  const comparison = await verifyComparisonPreflight(freeze.comparisonOutput, freeze.comparisonDigest);
  const workspace = path.join(freeze.comparisonOutput, "workspaces", "baseline");
  await workspaceRoot(workspace); await privateRoot(applicationRoot, workspace);
  const record = await readCompletedRoleOutput({ ...selector, number });
  need(record.role === "owner", "OWNER_NATIVE_ROLE_REQUIRED"); live(record);
  const binding = { sourceFile, runtimeDigest: comparison.baseline.digest, fixed, helperSha256 };
  const before = await contextOf(binding);
  need(before.context.sourceRoot === workspace && hash(before.context) === hash(record.intent.context), "OWNER_CONTEXT_CHANGED");
  const publication = await readTurnSources(selector);
  need(hash(publication.sourceRevision) === hash(record.sourceRevision), "BASELINE_OWNER_PUBLICATION_STALE");
  const readSource = async ref => {
    need(id(ref?.id) && acquired(record, before.snapshot, ref) &&
      record.sourceSnapshot.rows.some(row => row.id === ref.id && row.status === "AVAILABLE" && row.sha256 === ref.sha256) &&
      record.acquiredSources.some(row => row.id === ref.id && row.sha256 === ref.sha256), "BASELINE_OWNER_SOURCE_NOT_ACQUIRED");
    return file(workspace, ref);
  };
  const scope = JSON.parse(await readSource(scopeRef));
  const common = ["schema", "phase", "owner", "executionId", "executionSha256", "workerNumber", "taskRef", "returnRef",
    "resultRef", "artifactRef", "retentionTargets"];
  const routing = ["retentionApplicationSha256", "retentionRefs", "nextRequestRef", "integrationRequestRef", "integrationRef", "routeInputPath", "outboxPath"];
  need(["retain", "route"].includes(scope.phase) && exactKeys(scope, scope.phase === "retain" ? common : [...common, ...routing]) &&
    scope.schema === "comparison.baseline-owner-scope.v1" && id(scope.owner) && id(scope.executionId) && digest(scope.executionSha256) &&
    Number.isSafeInteger(scope.workerNumber) && scope.workerNumber > 0 && scope.workerNumber < number,
    "BASELINE_OWNER_SCOPE_INVALID");
  const expected = { id: scope.executionId, sourceFreeze: freeze.comparisonDigest, scenarioDigest: freeze.scenarioDigest,
    workspace, armDigest: comparison.baseline.digest, neutralAdapter: comparison.adapter };
  const execution = validateBaselineOwnerExecution(await readExecution(scope.executionId), expected);
  need(hash(execution) === scope.executionSha256 && execution.authorization.transportSha256 === before.context.transportSha256,
    "BASELINE_OWNER_EXECUTION_CHANGED");
  const scenario = await verifyComparisonScenario({ output: freeze.comparisonOutput, scenarioDigest: freeze.scenarioDigest });
  const fixedNames = ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"];
  const verifyTransport = async () => {
    try {
      need(fixed?.workspace === workspace && exactKeys(fixed.files, fixedNames) &&
        fixedNames.every(name => fixed.files[name] === scenario.files[name]) &&
        helperSha256 === comparison.adapter.supervisor &&
        execution.observation.commands[0].recipeSha256 === fixed.recipeSha256,
        "BASELINE_OWNER_TRANSPORT_CHANGED");
      for (const ref of [...fixedNames.map(name => ({ path: name, sha256: fixed.files[name] })),
        { path: "recipe.json", sha256: fixed.recipeSha256 }, { path: ".comparison-command.mjs", sha256: helperSha256 }])
        await file(workspace, ref);
    } catch (cause) { throw Error("BASELINE_OWNER_TRANSPORT_CHANGED", { cause }); }
  };
  await verifyTransport();
  const worker = await readCompletedRoleOutput({ ...selector, number: scope.workerNumber });
  const command = worker.intent.commands.find(row => row.requestId === execution.id);
  const decision = worker.modelOutput.commands?.find(row => row.requestId === execution.id);
  need(worker.role === "worker" && worker.traceSha256 === execution.authorization.traceSha256 &&
    worker.allocationSha256 === execution.authorization.allocationSha256 &&
    command?.requestSha256 === hash({ ...execution.request, readback: null }) &&
    command.bindingSha256 === execution.authorization.bindingSha256 && command.dependenciesSha256 === execution.authorization.dependenciesSha256 &&
    decision?.decision === "AUTHORIZE_SUPERVISOR_ACTION" && decision.readback === execution.authorization.readback,
    "BASELINE_OWNER_WORKER_MISMATCH");
  const originals = [scopeRef, scope.taskRef, scope.returnRef, scope.resultRef, scope.artifactRef];
  const task = JSON.parse(await readSource(scope.taskRef));
  const originalReturn = await readSource(scope.returnRef);
  need(scope.taskRef.path === execution.request.task.path && scope.taskRef.sha256 === execution.request.task.sha256 &&
    record.intent.task.id === scope.taskRef.id && record.intent.task.sha256 === scope.taskRef.sha256 &&
    originalReturn.equals(Buffer.from(execution.observation.result.returnSync)) &&
    hash(JSON.parse(await readSource(scope.resultRef))) === hash(execution.observation.result) &&
    scope.artifactRef.path === execution.consumerCheck.artifact.path && scope.artifactRef.sha256 === execution.consumerCheck.artifact.sha256,
    "BASELINE_OWNER_ORIGINAL_MISMATCH");
  await readSource(scope.artifactRef);
  const targets = scope.retentionTargets;
  need(targets && typeof targets === "object" && !Array.isArray(targets) && Object.keys(targets).length > 0 &&
    Object.keys(targets).length <= 8 && Object.keys(targets).every(id) &&
    new Set(Object.values(targets)).size === Object.keys(targets).length, "BASELINE_OWNER_RETENTION_INVALID");
  Object.values(targets).forEach(freshOutput);
  const initial = await inventory(workspace);
  const call = async (operation, name) => {
    const observed = await invokeComparisonAdapter({ output: freeze.comparisonOutput, expectedDigest: freeze.comparisonDigest,
      arm: "baseline", operation, file: name });
    need(observed.commands.length === 0, "BASELINE_OWNER_UNEXPECTED_COMMAND");
    return observed.result;
  };
  const received = await call("outbox", scope.returnRef.path);
  need(received.parsed.returnCount === 1 && received.parsed.returns[0].valid && received.parsed.routedCount === 0 &&
    received.parsed.routeCount === 0 && hash(received.parsed.pendingReturnIds) === hash([received.parsed.returns[0].id]) &&
    hash(received.parsed.issues) === hash([`Durable outbox: return ${received.parsed.returns[0].id} requires routing`]),
    "BASELINE_OWNER_RETURN_INVALID");
  const authored = record.modelOutput.baselineOwner, outputs = {};
  let integration = null, nextPreflight = null;
  if (scope.phase === "retain") {
    need(exactKeys(authored, ["phase", "decision", "retention"]) && authored.phase === "retain" && authored.decision === "ACCEPTED" &&
      exactKeys(authored.retention, Object.keys(targets)), "BASELINE_OWNER_RETENTION_NOT_AUTHORED");
    for (const [key, name] of Object.entries(targets)) {
      const bytes = authored.retention[key];
      need(typeof bytes === "string" && bytes.trim() && Buffer.byteLength(bytes) <= 128 * 1024, "BASELINE_OWNER_RETENTION_NOT_AUTHORED");
      outputs[name] = bytes;
    }
  } else {
    need(exactKeys(authored, ["phase", "decision", "nextTaskId", "route"]) && authored.phase === "route" && authored.decision === "ROUTE" &&
      exactKeys(authored.route, ["returnReceiptId", "consumer", "routedNextAction", "evidence"]) &&
      Object.values(authored.route).every(value => typeof value === "string" && value.trim()) &&
      authored.route.returnReceiptId === received.parsed.returns[0].id && authored.route.consumer === scope.owner,
      "BASELINE_OWNER_ROUTE_NOT_AUTHORED");
    const priorPath = `baseline-${scope.executionId}-retain`, priorRoot = path.join(applicationRoot, priorPath);
    await privateRoot(priorRoot, workspace);
    const prior = JSON.parse(await file(applicationRoot, { path: `${priorPath}/applied.json`, sha256: scope.retentionApplicationSha256 }, true));
    const pending = JSON.parse(await file(applicationRoot, { path: `${priorPath}/pending.json`, sha256: prior.pendingSha256 }, true));
    const priorOwner = await readCompletedRoleOutput({ ...selector, number: pending.number });
    const priorScope = JSON.parse(await file(workspace, pending.scopeRef));
    need(prior.status === "BASELINE_RETENTION_APPLIED" && prior.semanticEvidence === false && prior.wholeChainComparatorReady === false &&
      pending.nativeDigest === expectedDigest && pending.executionSha256 === hash(execution) && pending.phase === "retain" &&
      pending.number < number && priorOwner.role === "owner" && pending.allocationSha256 === priorOwner.allocationSha256 &&
      priorOwner.modelOutput.baselineOwner?.decision === "ACCEPTED" && hash(pending.targets) === hash(targets) &&
      Array.isArray(scope.retentionRefs) && scope.retentionRefs.length === Object.keys(targets).length,
      "BASELINE_OWNER_RETENTION_PROOF_INVALID");
    need(hash(priorScope) === hash(Object.fromEntries(common.map(key => [key, key === "phase" ? "retain" : scope[key]]))) &&
      pending.sourceBefore?.digest === priorOwner.intent.context?.sourceSnapshotDigest &&
      hash(pending.sourceBefore.rows) === pending.sourceBefore.digest &&
      acquired(priorOwner, pending.sourceBefore, pending.scopeRef) &&
      priorOwner.sourceSnapshot.rows.some(row => row.id === pending.scopeRef.id && row.status === "AVAILABLE" && row.sha256 === pending.scopeRef.sha256) &&
      priorOwner.acquiredSources.some(row => row.id === pending.scopeRef.id && row.sha256 === pending.scopeRef.sha256) &&
      prior.executionSha256 === hash(execution) && prior.allocationSha256 === priorOwner.allocationSha256 &&
      exactKeys(prior.outputs, Object.values(targets)) && exactKeys(priorOwner.modelOutput.baselineOwner.retention, Object.keys(targets)),
      "BASELINE_OWNER_RETENTION_PROOF_INVALID");
    for (const [key, name] of Object.entries(targets)) {
      const refs = scope.retentionRefs.filter(ref => ref.path === name), text = priorOwner.modelOutput.baselineOwner.retention[key];
      need(refs.length === 1 && typeof text === "string" && refs[0].sha256 === sha256(text) &&
        prior.outputs[name] === sha256(text), "BASELINE_OWNER_RETENTION_PROOF_INVALID");
      need((await readSource(refs[0])).equals(Buffer.from(text)), "BASELINE_OWNER_RETENTION_PROOF_INVALID");
    }
    const nextRequest = JSON.parse(await readSource(scope.nextRequestRef));
    integration = JSON.parse(await readSource(scope.integrationRef));
    const integrateRequest = JSON.parse(await readSource(scope.integrationRequestRef));
    need(nextRequest.schema === "context.request.v1" && nextRequest.workspace === workspace && nextRequest.operation === "resume" &&
      integration.schema === "context.integration.v1" && hash(integrateRequest) === hash({ ...nextRequest, operation: "integrate",
        capsule: null, readback: null, integrationPlan: integration.plan }), "BASELINE_OWNER_NEXT_REQUEST_INVALID");
    const nextTask = JSON.parse(await file(workspace, nextRequest.task));
    const packagePlan = JSON.parse(await file(workspace, { path: nextTask.packageApproval?.plan, sha256: initial[nextTask.packageApproval?.plan] }));
    const dependencies = JSON.parse(await file(workspace, { path: nextTask.dependencies, sha256: initial[nextTask.dependencies] }));
    need(nextTask.id !== task.id && nextTask.id === authored.nextTaskId &&
      packagePlan.inputFiles?.some(ref => ref.path === scope.artifactRef.path && ref.sha256 === scope.artifactRef.sha256) &&
      dependencies.dependencies?.some(row => row.path === scope.artifactRef.path &&
        Array.isArray(row.scope) && Array.isArray(nextTask.scope) && row.scope.some(value => nextTask.scope.includes(value))) &&
      [scope.returnRef, ...scope.retentionRefs].every(ref => integration.artifacts.some(row => row.path === ref.path && row.sha256 === ref.sha256)),
      "BASELINE_OWNER_NEXT_INTEGRATION_INVALID");
    // This is an archived read-only integration check, not next-worker execution.
    const integrated = await call("context", scope.integrationRequestRef.path);
    need(integrated.status === "VERIFIED" && hash(integrated.receipt) === hash(integration), "BASELINE_OWNER_NEXT_INTEGRATION_INVALID");
    // Invoke only the selected archive's read-only preflight, preserving every
    // request field except operation. No temporary derivative or worker effect.
    nextPreflight = async () => {
      await readSource(scope.nextRequestRef);
      await verifyComparisonPreflight(freeze.comparisonOutput, freeze.comparisonDigest);
      const archived = await import(pathToFileURL(path.join(freeze.comparisonOutput, "baseline", "scripts/context-run.mjs")).href);
      const returns = await import(pathToFileURL(path.join(freeze.comparisonOutput, "baseline", "scripts/vydykhai.mjs")).href);
      const ready = await archived.runContextTransition({ ...nextRequest, operation: "preflight" }, returns);
      need(ready.status === "READY" && ready.stats?.commands === 0, "BASELINE_OWNER_NEXT_PREFLIGHT_REQUIRED");
      await verifyComparisonPreflight(freeze.comparisonOutput, freeze.comparisonDigest);
    };
    await nextPreflight();
    originals.push(...scope.retentionRefs, scope.nextRequestRef, scope.integrationRequestRef, scope.integrationRef);
    freshOutput(scope.routeInputPath); freshOutput(scope.outboxPath);
    need(scope.routeInputPath !== scope.outboxPath, "BASELINE_OWNER_OUTPUT_INVALID");
    outputs[scope.routeInputPath] = encode(authored.route);
  }
  const names = [...Object.keys(outputs), ...(scope.phase === "route" ? [scope.outboxPath] : [])];
  for (const name of names) {
    const rows = before.snapshot.rows.filter(row => row.path === name);
    need(!Object.hasOwn(initial, name) && rows.length === 1 && rows[0].status === "MISSING", "BASELINE_OWNER_OUTPUT_NOT_FRESH");
  }
  const check = async (written = {}) => {
    await verifyTransport();
    for (const ref of originals) await readSource(ref);
    need(hash(await readExecution(scope.executionId)) === hash(execution), "BASELINE_OWNER_EXECUTION_CHANGED");
    need(hash((await readTurnSources(selector)).sourceRevision) === hash(record.sourceRevision), "BASELINE_OWNER_PUBLICATION_STALE");
    const current = await contextOf(binding);
    const rows = before.snapshot.rows.map(row => Object.hasOwn(written, row.path)
      ? { ...row, status: "AVAILABLE", sha256: written[row.path] } : row);
    need(hash({ ...current.context, sourceSnapshotDigest: before.context.sourceSnapshotDigest }) === hash(before.context) &&
      current.snapshot.digest === hash(rows) && hash(await inventory(workspace)) === hash({ ...initial, ...written }),
      "BASELINE_OWNER_SOURCE_DELTA_INVALID");
    live(record);
  };
  await check();
  const root = path.join(applicationRoot, `baseline-${scope.executionId}-${scope.phase}`);
  try { await mkdir(root, { mode: 0o700 }); }
  catch (error) { if (error.code === "EEXIST") throw Error("BASELINE_OWNER_APPLICATION_EXISTS"); throw error; }
  const pending = { schema: "comparison.baseline-owner-attempt.v1", nativeDigest: expectedDigest, number, phase: scope.phase,
    executionSha256: hash(execution), allocationSha256: record.allocationSha256, scopeRef, targets,
    sourceBefore: before.snapshot, workspaceBefore: initial };
  const pendingBytes = encode(pending);
  await durableFile(path.join(root, "pending.json"), pendingBytes);
  // Every subsequent error leaves a durable hold. A new dispatch cannot replay
  // the same execution/phase, including partially written retention or routing.
  const written = {};
  for (const [name, text] of Object.entries(outputs)) {
    await check(written); await durableFile(path.join(workspace, name), text); written[name] = sha256(text);
  }
  if (scope.phase === "route") {
    await check(written);
    await nextPreflight();
    const routed = await call("route", scope.routeInputPath);
    need(typeof routed.route === "string" && routed.route.trim(), "BASELINE_OWNER_ROUTE_INVALID");
    const text = originalReturn.toString("utf8") + "\n" + routed.route;
    await check(written); await durableFile(path.join(workspace, scope.outboxPath), text); written[scope.outboxPath] = sha256(text);
    const consumed = await call("outbox", scope.outboxPath);
    need(consumed.parsed.returnCount === 1 && consumed.parsed.routeCount === 1 && consumed.parsed.routedCount === 1 &&
      consumed.parsed.pendingReturnIds.length === 0 && consumed.parsed.issues.length === 0 &&
      consumed.parsed.routedReturnIds[0] === received.parsed.returns[0].id, "BASELINE_OWNER_ROUTE_INVALID");
  }
  await check(written);
  if (integration) {
    const integrated = await call("context", scope.integrationRequestRef.path);
    need(integrated.status === "VERIFIED" && hash(integrated.receipt) === hash(integration), "BASELINE_OWNER_NEXT_INTEGRATION_INVALID");
    await nextPreflight();
    await check(written);
  }
  const applied = { schema: "comparison.baseline-owner-application.v1", status: scope.phase === "retain" ? "BASELINE_RETENTION_APPLIED" : "BASELINE_RETURN_ROUTED",
    pendingSha256: sha256(pendingBytes), outputs: written, originalReturnSha256: scope.returnRef.sha256,
    executionSha256: hash(execution), allocationSha256: record.allocationSha256,
    evidenceLevel: "NATIVE_AUTHORED_BYTES_ARCHIVED_PROTOCOL_NOT_SEMANTIC_APPROVAL", semanticEvidence: false,
    wholeChainComparatorReady: false, nextExecution: "NOT_PERFORMED" };
  const bytes = encode(applied);
  await durableFile(path.join(root, "applied.json"), bytes);
  return { ...applied, applicationRef: path.join(root, "applied.json"), applicationSha256: sha256(bytes) };
}
