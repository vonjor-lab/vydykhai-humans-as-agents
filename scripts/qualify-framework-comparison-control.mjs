// Maintainer-only host bridge. Private callbacks still require native-driver binding.
import { readFile, writeFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { loadControlRuntime, verifyControlRuntime } from "./control-runtime.mjs";
import { localControlSandbox } from "./local-control-sandbox.mjs";
import { fixedComparisonLaunch } from "./qualify-framework-comparison-command.mjs";
import { verifyComparisonRecovery } from "./qualify-framework-comparison-recovery.mjs";

const need = (v, code) => { if (!v) throw Error(code); };
const hash = v => sha256(canonicalJson(v));
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const id = v => typeof v === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(v);
async function workspaceBytes(workspace, relative) {
  const file = path.resolve(workspace, relative);
  need(file.startsWith(workspace + path.sep), "COMPARISON_REQUEST_FILE_UNSAFE");
  const stat = await lstat(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4 * 1024 * 1024 &&
    await realpath(file) === file, "COMPARISON_REQUEST_FILE_UNSAFE");
  return readFile(file);
}
async function pinnedBytes(workspace, ref) {
  need(ref && typeof ref.path === "string" && digest(ref.sha256), "COMPARISON_REQUEST_FILE_UNSAFE");
  const bytes = await workspaceBytes(workspace, ref.path);
  need(sha256(bytes) === ref.sha256, "COMPARISON_REQUEST_FILE_CHANGED");
  return bytes;
}
const pinnedJson = async (workspace, ref) => JSON.parse(await pinnedBytes(workspace, ref));

// Use this SAME external composition for B and C. The old synthetic API remains
// unchanged; it is not evidence that the native baseline has adopted this wrapper.
export async function comparisonSandboxLaunch({ fixed, helper, helperSha256, controlRoot }) {
  fixed = structuredClone(fixed);
  need(path.isAbsolute(helper) && helper.startsWith(fixed.workspace + path.sep), "COMPARISON_HELPER_UNSAFE");
  const stat = await lstat(helper);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4 * 1024 * 1024 &&
    await realpath(helper) === helper && digest(helperSha256) &&
    sha256(await readFile(helper)) === helperSha256, "COMPARISON_HELPER_UNSAFE");
  const outer = await localControlSandbox({ workspace: fixed.workspace, controlRoot });
  return spec => outer(fixedComparisonLaunch(fixed, spec, { helper, helperSha256 }));
}

// Callback assertions are not yet bound to native driver records. Readiness binds
// the pre-ack request; a completed worker explicitly authorizes one exact request
// for supervisor application. No completed model is represented as a live caller.
export async function openComparisonControl({ runtime, profile, fixed, helper, helperSha256, requests, authenticateDispatch,
  sharedBudget = null, initialize = false, historicalRecovery = null }) {
  need(typeof initialize === "boolean" && typeof authenticateDispatch === "function" && Array.isArray(requests) && requests.length > 0,
    "COMPARISON_CONTROL_CONFIG_INVALID");
  runtime = structuredClone(runtime); profile = structuredClone(profile); fixed = structuredClone(fixed);
  need(profile.config.workspace === fixed.workspace && [0, 1].includes(profile.maxReviewsPerTick) &&
    !profile.ownerDelivery && !profile.continuation && !profile.allowance && !profile.config.health &&
    [1, 3].includes(profile.review.partitionCount ?? 1),
    "COMPARISON_CONTROL_PARTIAL_ONLY");
  need(profile.maxReviewsPerTick === 0 || (sharedBudget && digest(sharedBudget.id) &&
    Number.isSafeInteger(sharedBudget.maxCalls) && sharedBudget.maxCalls > 0 && sharedBudget.maxCalls <= 32 &&
    profile.review.maxCalls <= sharedBudget.maxCalls && typeof sharedBudget.reserve === "function" &&
    typeof sharedBudget.settle === "function"), "COMPARISON_SHARED_BUDGET_REQUIRED");
  const budget = sharedBudget && { ...sharedBudget };
  const selected = await loadControlRuntime({ ...runtime, workspace: fixed.workspace });
  const load = name => import(pathToFileURL(path.join(selected.identity.root, "scripts", name)).href);
  const [{ runControlledContextTransition }, returns, { openReviewSources }, { runContextTransition }] = await Promise.all([
    load("controlled-context-run.mjs"), load("vydykhai.mjs"), load("control-review-sources.mjs"), load("context-run.mjs")]);
  const sourceFile = profile.review.sourceFile;
  need(profile.config.evidenceRegistry === sourceFile, "COMPARISON_SOURCE_REGISTRY_REQUIRED");
  const privateAssets = [helper, ...["candidate.mjs", "oracle.json", "verify.mjs"].map(n => path.join(fixed.workspace, n))];
  const readRegistry = async () => {
    const sources = await openReviewSources(sourceFile);
    const bytes = await readFile(sourceFile), registry = await sources.list();
    const captured = JSON.parse(bytes);
    need(sha256(await readFile(sourceFile)) === sha256(bytes) && captured.workspace === sources.workspace &&
      hash(captured.sources) === hash(registry), "COMPARISON_REGISTRY_CHANGED");
    need(registry.every(r => !privateAssets.includes(path.resolve(sources.workspace, r.path))), "COMPARISON_PRIVATE_SOURCE_EXPOSED");
    return { sources, binding: { sourceRoot: sources.workspace, sourceRegistrySha256: sha256(bytes) } };
  };
  const { binding: registryBinding } = await readRegistry();
  const boundSources = async () => {
    const fresh = await readRegistry();
    need(hash(fresh.binding) === hash(registryBinding), "COMPARISON_REGISTRY_CHANGED");
    return fresh.sources;
  };
  const sandboxLaunch = await comparisonSandboxLaunch({ fixed, helper, helperSha256, controlRoot: profile.review.controlRoot });
  const registered = new Map(), verified = new Map(), completedTasks = new Map();
  const register = entry => {
    entry = structuredClone(entry);
    need(id(entry.id) && !registered.has(entry.id) && entry.request?.workspace === fixed.workspace &&
      ["resume", "accept"].includes(entry.request.operation) && Array.isArray(entry.dependencies) &&
      entry.dependencies.every(id) && new Set(entry.dependencies).size === entry.dependencies.length, "COMPARISON_REQUEST_INVALID");
    registered.set(entry.id, entry);
  };
  for (const entry of requests) register(entry);
  const service = await selected.service.openControlService(profile);
  if (initialize) { await service.host.initialize(); await service.review.initialize(); }
  await service.host.snapshot(); await service.review.capacity();
  let recoveredEvidence = null;
  if (historicalRecovery) {
    const recovery = structuredClone(historicalRecovery);
    need(recovery.successor.request.workspace === fixed.workspace && requests.length === 1 &&
      requests[0].request.operation === "accept" && hash(requests[0].request) === hash(recovery.successor.request),
      "COMPARISON_RECOVERY_ACCEPT_ONLY");
    const currentFiles = {}, successorFiles = {};
    for (const name of Object.keys(recovery.checkpoint.files))
      currentFiles[name] = (await workspaceBytes(fixed.workspace, name)).toString("utf8");
    for (const name of Object.keys(recovery.successor.files))
      successorFiles[name] = (await workspaceBytes(fixed.workspace, name)).toString("utf8");
    const checked = verifyComparisonRecovery({ ...recovery, currentFiles,
      successor: { ...recovery.successor, files: successorFiles } });
    await writeFile(path.join(profile.directory, "historical-recovery.json"), canonicalJson(checked.evidence) + "\n",
      { flag: "wx", mode: 0o600 });
    completedTasks.set(checked.successorTaskSha256, checked.artifactSha256);
    recoveredEvidence = checked.evidence;
  }
  const currentSources = async () => {
    await verifyControlRuntime(runtime.packageRoot, runtime.expectedDigest);
    return (await (await boundSources()).snapshot()).digest;
  };
  const commonRecord = sourceSnapshotDigest => ({ ...registryBinding, arm: "candidate",
    runtimeDigest: runtime.expectedDigest, sourceSnapshotDigest, transportSha256: hash({ fixed, helperSha256 }) });
  const authenticateOwner = async (dispatchId, purpose, payload) => {
    need(id(dispatchId), "COMPARISON_DISPATCH_UNVERIFIED");
    const sourceSnapshotDigest = await currentSources();
    const expected = { ...commonRecord(sourceSnapshotDigest), id: dispatchId, role: "owner", state: "COMPLETED",
      purpose, payloadSha256: hash(payload) };
    const record = structuredClone(await authenticateDispatch(dispatchId, Object.freeze(expected)));
    need(record && Object.entries(expected).every(([k, v]) => record[k] === v) &&
      digest(record.traceSha256) && record.expiresAt > Date.now() && Number.isFinite(record.expiresAt) &&
      hash(record.payload ?? null) === hash(payload), "COMPARISON_DISPATCH_UNVERIFIED");
    need(await currentSources() === sourceSnapshotDigest, "COMPARISON_SOURCE_CHANGED");
    return record;
  };
  // The selected service dereferences this public adapter on each tick. Its own
  // journal cap is an additional ceiling, never another source of paid capacity.
  const selectedReview = service.review.review;
  service.review.review = async (offer, { signal } = {}) => {
    need(budget && !signal?.aborted, "COMPARISON_REVIEW_NOT_ALLOCATED");
    const sourceSnapshotDigest = await currentSources();
    const expected = { ...commonRecord(sourceSnapshotDigest), budgetId: budget.id, maxCalls: budget.maxCalls,
      kind: "POST_ACCEPT_REVIEW", runId: offer.runId, offerSha256: hash(offer), calls: profile.review.partitionCount ?? 1,
      nativeConfigSha256: hash(profile.review.native) };
    // reserve must durably consume the SAME arm ledger used by role dispatches,
    // retaining uncertain allocations. It must not invoke a second model itself.
    const allocation = structuredClone(await budget.reserve(Object.freeze(expected), { signal }));
    let entered = false;
    try {
      need(allocation && Object.entries(expected).every(([k, v]) => allocation[k] === v) &&
        allocation.status === "RESERVED" && id(allocation.allocationId) &&
        Number.isSafeInteger(allocation.number) && allocation.number > 0 && allocation.number <= budget.maxCalls &&
        Number.isFinite(allocation.expiresAt) && allocation.expiresAt > Date.now(), "COMPARISON_REVIEW_ALLOCATION_INVALID");
      if (expected.calls === 3) need(Array.isArray(allocation.allocations) && allocation.allocations.length === 3 &&
        allocation.allocations.every((a, i) => a.calls === 1 && a.number === allocation.number + i &&
          a.number <= budget.maxCalls && a.partitionIndex === i && a.runId === offer.runId && a.budgetId === budget.id &&
          a.status === "RESERVED"), "COMPARISON_REVIEW_ALLOCATION_INVALID");
      need(!signal?.aborted && await currentSources() === sourceSnapshotDigest, "COMPARISON_REVIEW_CANCELLED_OR_STALE");
      need(!signal?.aborted, "COMPARISON_REVIEW_CANCELLED_OR_STALE");
      entered = true;
      const verdict = await selectedReview(offer, { signal });
      need(!signal?.aborted, "COMPARISON_REVIEW_CANCELLED_OR_STALE");
      return verdict;
    } finally {
      // Reporting is not a refund, retry, or semantic approval. Unknown stays used.
      const observation = await service.review.observe(offer.runId);
      const settled = await budget.settle({ allocation, entered, observation });
      need(settled?.allocationId === allocation?.allocationId && settled?.status === "RECORDED",
        "COMPARISON_REVIEW_ACCOUNTING_UNKNOWN");
      if (expected.calls === 3) need(settled.outcome === "RECORDED", "COMPARISON_REVIEW_ACCOUNTING_UNKNOWN");
    }
  };
  return {
    historicalRecovery: recoveredEvidence,
    scope: Object.freeze({ status: "INCOMPLETE", semanticEvidence: false,
      nativeDispatchAccounting: "SHARED_ARM_LEDGER_AND_SELECTED_REVIEW_JOURNAL",
      application: "SUPERVISOR_APPLICATION_OF_COMPLETED_WORKER_REQUEST",
      nativeProvenance: "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS",
      remaining: Object.freeze(["native dispatch-record authentication", "same native arm allocator binding",
        "semantic owner/worker/readiness evidence", "comparative retained-outcome evidence"]) }),
    snapshot: () => service.host.snapshot(),
    async acceptOwned({ dispatchId, verificationRequestId, acceptance }) {
      acceptance = structuredClone(acceptance);
      const observed = verified.get(verificationRequestId), entry = registered.get(verificationRequestId);
      need(observed?.status === "VERIFIED" && entry?.request.operation === "accept" &&
        completedTasks.has(entry.request.task.sha256), "COMPARISON_VERIFICATION_REQUIRED");
      const task = await pinnedJson(fixed.workspace, entry.request.task);
      const checkVerification = async () => {
        const current = await runContextTransition({ ...entry.request, operation: "preflight" });
        need(current.status === "READY" && hash(current.coverageBasis) === hash(observed.coverageBasis),
          "COMPARISON_VERIFICATION_STALE");
        for (const ref of [...observed.receipt.candidate.files, observed.receipt.oracle, observed.receipt.script])
          await pinnedBytes(fixed.workspace, ref);
      };
      await checkVerification();
      need(acceptance?.task === task.id && acceptance.owner === profile.config.owner &&
        acceptance.executor === task.owner && acceptance.status === "ACCEPTED", "COMPARISON_ACCEPTANCE_MISMATCH");
      const originalReturn = await pinnedBytes(fixed.workspace, acceptance.producerReturn);
      need(originalReturn.equals(Buffer.from(observed.returnSync, "utf8")) &&
        hash(await pinnedJson(fixed.workspace, acceptance.technicalProof)) === hash(observed.receipt),
        "COMPARISON_ORIGINAL_PROOF_REQUIRED");
      const retention = [];
      need(Array.isArray(acceptance.retention), "COMPARISON_RETENTION_REQUIRED");
      for (const item of acceptance.retention) {
        need(item.required === true, "COMPARISON_RETENTION_REQUIRED");
        retention.push({ id: item.id, bytes: (await pinnedBytes(fixed.workspace, item.expected)).toString("utf8") });
      }
      need(path.resolve(fixed.workspace, acceptance.artifact?.path ?? "") === path.join(fixed.workspace, "consumer-output.json") &&
        acceptance.artifact.sha256 === completedTasks.get(entry.request.task.sha256),
        "COMPARISON_ACCEPTANCE_MISMATCH");
      await pinnedBytes(fixed.workspace, acceptance.artifact);
      await pinnedBytes(fixed.workspace, acceptance.goal);
      await authenticateOwner(dispatchId, "OWNING_ACCEPTANCE", { acceptance, verificationRequestId,
        verificationSha256: hash(observed), originalReturn: originalReturn.toString("utf8"), retention });
      // Re-pin after the untrusted-duration callback; the host also observes refs.
      await checkVerification();
      for (const item of acceptance.retention) await pinnedBytes(fixed.workspace, item.expected);
      await service.host.accept(acceptance);
      return { status: "ACCEPTED_REVIEW_DUE", acceptance: (await service.host.snapshot()).acceptances[acceptance.id],
        nativeProvenance: "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS", wholeChainComparatorReady: false };
    },
    async tick() {
      need(profile.maxReviewsPerTick === 1, "COMPARISON_SHARED_BUDGET_REQUIRED");
      await currentSources();
      return service.tick();
    },
    async readOwnerVerdict(acceptanceId) {
      await currentSources();
      return service.owner.readVerdict(acceptanceId);
    },
    async applyOwnerDisposition({ dispatchId, acceptanceId, decision, repairLeases = [] }) {
      decision = structuredClone(decision); repairLeases = structuredClone(repairLeases);
      const packet = await service.owner.readVerdict(acceptanceId);
      need(decision?.owner === profile.config.owner && decision.reviewKey === packet.reviewKey,
        "COMPARISON_OWNER_VERDICT_MISMATCH");
      await authenticateOwner(dispatchId, "CONTROL_DISPOSITION", { acceptanceId, verdictSha256: hash(packet), decision, repairLeases });
      need(hash(await service.owner.readVerdict(acceptanceId)) === hash(packet), "COMPARISON_OWNER_VERDICT_MISMATCH");
      return service.owner.respond(acceptanceId, decision, repairLeases);
    },
    async registerContinuation(entry) {
      entry = structuredClone(entry);
      need(entry?.request?.operation === "resume" && entry.dependencies?.length > 0, "COMPARISON_CONTINUATION_REQUIRED");
      const task = await pinnedJson(fixed.workspace, entry.request.task), state = await service.host.snapshot();
      need(entry.dependencies.every(key => state.acceptances[key]?.disposition?.action === "CONTINUE" &&
        state.acceptances[key].disposition.nextAction === task.id), "COMPARISON_CONTINUATION_NOT_OWNED");
      register(entry);
      return { status: "REGISTERED_NOT_AUTHORIZED", requestId: entry.id };
    },
    async close(acceptanceId) {
      await currentSources();
      await service.host.close(acceptanceId);
      return { status: "HOST_CONTROL_CLOSED", acceptance: (await service.host.snapshot()).acceptances[acceptanceId],
        nativeProvenance: "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS", wholeChainComparatorReady: false };
    },
    async execute(args) {
      need(args && Object.keys(args).sort().join() === "requestId,reviewDispatchId,workerDispatchId" &&
        registered.has(args.requestId) && id(args.reviewDispatchId) && id(args.workerDispatchId) &&
        args.reviewDispatchId !== args.workerDispatchId, "COMPARISON_EXECUTION_ARGUMENTS_INVALID");
      args = structuredClone(args);
      const { request, dependencies } = registered.get(args.requestId);
      await verifyControlRuntime(runtime.packageRoot, runtime.expectedDigest);
      await boundSources();
      let authorized;
      const provenance = async binding => {
        const fresh = await boundSources();
        const sourceSnapshotDigest = (await fresh.snapshot()).digest;
        const common = { ...registryBinding, arm: "candidate", runtimeDigest: runtime.expectedDigest,
          bindingSha256: hash(binding), dependenciesSha256: hash(dependencies), sourceSnapshotDigest,
          transportSha256: hash({ fixed, helperSha256 }) };
        const records = [];
        for (const [dispatchId, role, state, requestSha256] of [
          [args.reviewDispatchId, "readiness-reviewer", "COMPLETED", hash({ ...request, readback: null })],
          [args.workerDispatchId, "worker", "COMPLETED", hash(request)]]) {
          // Future native authentication must derive these fields from private
          // records, not copy expected values or accept model-supplied actor names.
          const expected = { ...common, id: dispatchId, role, state, requestSha256 };
          const record = structuredClone(await authenticateDispatch(dispatchId, Object.freeze(expected)));
          need(record && Object.entries(expected).every(([k, v]) => record[k] === v) &&
            Number.isFinite(record.expiresAt) && record.expiresAt > Date.now() && digest(record.traceSha256) &&
            (role !== "readiness-reviewer" || record.decision === "APPROVE") &&
            (role !== "worker" || (record.decision === "AUTHORIZE_SUPERVISOR_ACTION" &&
              hash(record.request ?? null) === hash(request) && request.readback !== null)),
            "COMPARISON_DISPATCH_UNVERIFIED");
          if (role === "worker") {
            // ack authors the machine receipt; the worker authors only evidence.
            const task = await pinnedJson(fixed.workspace, request.task);
            const receipt = await pinnedJson(fixed.workspace, request.readback);
            need(receipt.schema === "context.readback.v1" && receipt.worker === task.owner &&
              receipt.worker === profile.config.executor && receipt.taskSha256 === request.task.sha256 &&
              receipt.capsuleSha256 === request.capsule?.sha256 && receipt.capability === "retained-progress-v1",
              "COMPARISON_WORKER_RECEIPT_MISMATCH");
            const evidence = await pinnedBytes(fixed.workspace, receipt.evidenceRef);
            need(typeof record.readback === "string" && evidence.equals(Buffer.from(record.readback, "utf8")) &&
              sha256(record.readback) === receipt.evidenceRef.sha256, "COMPARISON_WORKER_EVIDENCE_MISMATCH");
          }
          records.push(record);
        }
        need((await (await boundSources()).snapshot()).digest === sourceSnapshotDigest, "COMPARISON_SOURCE_CHANGED");
        return records;
      };
      const control = { ...service.host.control,
        async authorize(binding, { signal } = {}) {
          const records = await provenance(binding);
          need(!signal?.aborted, "COMPARISON_ADMISSION_CANCELLED");
          const task = await pinnedJson(fixed.workspace, request.task);
          need(task.owner === profile.config.executor, "COMPARISON_WORKER_IDENTITY_MISMATCH");
          const command = request.operation === "resume" ? task.action :
            (await pinnedJson(fixed.workspace, task.module)).verificationCommand;
          sandboxLaunch({ executable: binding.executable, cwd: binding.cwd, args: command.args });
          need(!signal?.aborted, "COMPARISON_ADMISSION_CANCELLED");
          authorized = { binding, recordsHash: hash(records) };
          await service.host.approveCommand(binding, { reviewer: profile.config.reviewer,
            reviewReceipt: `callback-dispatch:${args.reviewDispatchId}:${hash(records[0])}`,
            dependencies, expiresAt: Math.min(Date.now() + 300000, ...records.map(r => r.expiresAt)) });
          return service.host.control.authorize(binding);
        },
        async reserve(grant, { signal } = {}) {
          need(authorized && hash(await provenance(authorized.binding)) === authorized.recordsHash,
            "COMPARISON_DISPATCH_CHANGED");
          need(!signal?.aborted, "COMPARISON_ADMISSION_CANCELLED");
          return service.host.control.reserve(grant);
        }
      };
      const result = { ...await runControlledContextTransition(request, { ...returns, control, sandboxLaunch }),
        application: "SUPERVISOR_APPLICATION_OF_COMPLETED_WORKER_REQUEST",
        nativeProvenance: "INCOMPLETE_CALLBACK_NOT_BOUND_TO_NATIVE_RECORDS", wholeChainComparatorReady: false };
      if (result.status === "VERIFIED") verified.set(args.requestId, structuredClone(result));
      if (result.status === "ACTION_COMPLETED" && dependencies.length === 0)
        completedTasks.set(request.task.sha256, sha256(await workspaceBytes(fixed.workspace, "consumer-output.json")));
      return result;
    }
  };
}
