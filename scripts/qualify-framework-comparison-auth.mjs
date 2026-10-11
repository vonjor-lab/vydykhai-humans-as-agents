// Maintainer-only command provenance. Never derives authority from callback expectations.
import { readFile, lstat, realpath } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { openReviewSources } from "./control-review-sources.mjs";
import { readCompletedRoleOutput } from "./qualify-framework-comparison-native.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (v, code) => { if (!v) throw Error(code); };
const id = value => typeof value === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(value);
async function pinned(workspace, ref) {
  need(ref && typeof ref.path === "string" && /^[a-f0-9]{64}$/.test(ref.sha256 ?? ""), "NATIVE_AUTH_REFERENCE_INVALID");
  const file = path.resolve(workspace, ref.path);
  need(file.startsWith(workspace + path.sep) && await realpath(file) === file, "NATIVE_AUTH_REFERENCE_INVALID");
  const stat = await lstat(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2 * 1024 * 1024, "NATIVE_AUTH_REFERENCE_INVALID");
  const bytes = await readFile(file);
  need(bytes.length <= 2 * 1024 * 1024 && sha256(bytes) === ref.sha256, "NATIVE_AUTH_REFERENCE_CHANGED");
  return bytes;
}

// bindings are registered by the trusted driver, not the model: one exact request
// and (for workers) actual delivered-package source per dispatch id. A generated
// ack may be attached after the worker returns; its own evidence must match bytes
// authored by that worker in the retained native trace.
// Optional sourceBefore is the ORIGINAL host snapshot bound by intent.context.
// A reviewer may name workerNumber to derive that worker's ack, never impersonate it.
export function nativeCommandAuthenticator({ directory, expectedDigest, arm = "candidate", workspace, sourceFile,
  runtimeDigest, fixed, helperSha256, bindings }) {
  need(["baseline", "candidate"].includes(arm) && path.isAbsolute(workspace) && path.resolve(workspace) === workspace && Array.isArray(bindings), "NATIVE_AUTH_CONFIG_INVALID");
  fixed = structuredClone(fixed);
  const registered = new Map();
  for (const entry of structuredClone(bindings)) {
    need(id(entry.id) && !registered.has(entry.id) && id(entry.requestId) &&
      Number.isSafeInteger(entry.number) && entry.number > 0 && entry.request?.workspace === workspace &&
      (entry.workerNumber === undefined || Number.isSafeInteger(entry.workerNumber) && entry.workerNumber > 0) &&
      Array.isArray(entry.dependencies) && entry.dependencies.every(id) && new Set(entry.dependencies).size === entry.dependencies.length &&
      ["resume", "accept"].includes(entry.request.operation), "NATIVE_AUTH_BINDING_INVALID");
    registered.set(entry.id, entry);
  }
  const readBound = async (selected, number) => {
    const record = await readCompletedRoleOutput({ directory, expectedDigest, arm, number });
    need(["worker", "readiness-reviewer"].includes(record.role), "NATIVE_AUTH_ROLE_INVALID");
    const request = selected.request;
    const task = JSON.parse(await pinned(workspace, request.task));
    need(record.intent.task.sha256 === request.task.sha256 && record.acquiredSources.some(source =>
      source.id === record.intent.task.id && source.sha256 === request.task.sha256), "NATIVE_AUTH_TASK_NOT_ACQUIRED");
    const command = record.intent.commands.find(value => value.requestId === selected.requestId);
    need(command && command.dependenciesSha256 === hash(selected.dependencies) &&
      command.requestSha256 === hash({ ...request, readback: null }), "NATIVE_AUTH_COMMAND_NOT_BOUND");
    const expiresAt = record.allocatedAtMs + record.timeoutMs + 300000;
    need(Number.isFinite(expiresAt) && expiresAt > Date.now(), "NATIVE_AUTH_EXPIRED");
    const decisions = record.modelOutput.commands;
    need(Array.isArray(decisions) && decisions.length > 0 && decisions.length <= 3 &&
      decisions.every(row => id(row?.requestId)) && new Set(decisions.map(row => row.requestId)).size === decisions.length,
    "NATIVE_AUTH_DECISION_INVALID");
    const decision = decisions.find(row => row.requestId === selected.requestId);
    const expectedDecision = record.role === "worker" ? "AUTHORIZE_SUPERVISOR_ACTION" : "APPROVE";
    need(decision?.decision === expectedDecision, "NATIVE_AUTH_COMMAND_NOT_AUTHORIZED");
    return { record, command, decision, task, expiresAt, number };
  };
  const workerEvidence = async (selected, worker) => {
    const { record, task, decision } = worker, request = selected.request;
    need(record.role === "worker", "NATIVE_AUTH_ACK_WORKER_INVALID");
    await pinned(workspace, request.capsule);
    need(selected.delivery?.sha256 === request.capsule.sha256 && record.acquiredSources.some(source => source.id === selected.delivery.id &&
      source.sha256 === selected.delivery.sha256), "NATIVE_AUTH_DELIVERY_NOT_ACQUIRED");
    const receipt = JSON.parse(await pinned(workspace, request.readback));
    need(Object.keys(receipt).sort().join() === "capability,capsuleSha256,evidenceRef,schema,taskSha256,worker" &&
      receipt.schema === "context.readback.v1" && receipt.worker === task.owner && receipt.capability === "retained-progress-v1" &&
      receipt.taskSha256 === request.task.sha256 && receipt.capsuleSha256 === request.capsule.sha256,
      "NATIVE_AUTH_ACK_MISMATCH");
    const evidence = await pinned(workspace, receipt.evidenceRef);
    need(typeof decision.readback === "string" && decision.readback.trim() &&
      evidence.equals(Buffer.from(decision.readback, "utf8")), "NATIVE_AUTH_WORKER_EVIDENCE_MISMATCH");
    return [request.readback, receipt.evidenceRef];
  };
  return async dispatchId => {
    const selected = registered.get(dispatchId);
    need(selected, "NATIVE_AUTH_DISPATCH_UNREGISTERED");
    const bound = await readBound(selected, selected.number), { record, command, decision } = bound;
    const request = selected.request;
    let expiresAt = bound.expiresAt;
    const sources = await openReviewSources(sourceFile), after = await sources.snapshot();
    const context = { runtimeDigest, sourceRoot: sources.workspace,
      sourceRegistrySha256: sha256(await readFile(sourceFile)), sourceSnapshotDigest: after.digest,
      transportSha256: hash({ fixed, helperSha256 }) };
    let sourceDelta = null;
    if (selected.sourceBefore !== undefined) {
      const before = selected.sourceBefore;
      need(before && Array.isArray(before.rows) && hash(before.rows) === before.digest &&
        before.digest === record.intent.context?.sourceSnapshotDigest, "NATIVE_AUTH_SOURCE_BEFORE_INVALID");
      need(hash({ ...context, sourceSnapshotDigest: before.digest }) === hash(record.intent.context), "NATIVE_AUTH_CONTEXT_CHANGED");
      let worker = bound;
      if (record.role === "readiness-reviewer") {
        need(Number.isSafeInteger(selected.workerNumber) && selected.workerNumber !== selected.number, "NATIVE_AUTH_ACK_WORKER_REQUIRED");
        worker = await readBound(selected, selected.workerNumber);
      } else need(selected.workerNumber === undefined || selected.workerNumber === selected.number, "NATIVE_AUTH_ACK_WORKER_INVALID");
      need(worker.record.role === "worker" && hash(worker.record.intent.context) === hash(record.intent.context) &&
        hash(worker.command) === hash(command), "NATIVE_AUTH_ACK_WORKER_INVALID");
      const refs = await workerEvidence(selected, worker);
      need(refs[0].path !== refs[1].path && refs.every(ref => before.rows.filter(row => row.path === ref.path).length === 1),
        "NATIVE_AUTH_SOURCE_DELTA_INVALID");
      // Exactly two new files. No replacement, deletion, arbitrary drift, or
      // action output is authorized here, even if a previous command created it.
      const derived = before.rows.map(row => {
        const ref = refs.find(value => value.path === row.path);
        if (!ref) return row;
        need(row.status === "MISSING" && !Object.hasOwn(row, "sha256"), "NATIVE_AUTH_SOURCE_DELTA_INVALID");
        return { ...row, status: "AVAILABLE", sha256: ref.sha256 };
      });
      need(hash(derived) === after.digest, "NATIVE_AUTH_SOURCE_DELTA_INVALID");
      expiresAt = Math.min(expiresAt, worker.expiresAt);
      sourceDelta = { kind: "ACK_EVIDENCE_ONLY", sourceBeforeDigest: before.digest, sourceAfterDigest: after.digest,
        workerNumber: worker.number, workerAllocationSha256: worker.record.allocationSha256,
        workerTraceSha256: worker.record.traceSha256, refs };
    } else {
      need(hash(context) === hash(record.intent.context), "NATIVE_AUTH_CONTEXT_CHANGED");
      if (record.role === "worker") await workerEvidence(selected, bound);
    }
    need((await sources.snapshot()).digest === after.digest && sha256(await readFile(sourceFile)) === context.sourceRegistrySha256,
      "NATIVE_AUTH_CONTEXT_CHANGED");
    // These fields come from the immutable allocation, observed source state and
    // original model decision, not a caller-supplied expected record.
    return { ...context, id: dispatchId, arm: record.arm, role: record.role, state: "COMPLETED",
      bindingSha256: command.bindingSha256, dependenciesSha256: command.dependenciesSha256,
      requestSha256: hash(record.role === "worker" ? request : { ...request, readback: null }),
      decision: decision.decision, ...(record.role === "worker" ? { request, readback: decision.readback } : {}),
      expiresAt, sourceDelta, traceSha256: record.traceSha256, allocationSha256: record.allocationSha256,
      provenanceKind: record.provenanceKind, sourceRevision: record.sourceRevision,
      evidenceLevel: "NATIVE_OUTPUT_BOUND_NOT_SEMANTIC_APPROVAL" };
  };
}
