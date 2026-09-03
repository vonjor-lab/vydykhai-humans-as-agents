import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { readLeaseActivityScope, readProductionContinuation } from "../scripts/vydykhai.mjs";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts/vydykhai.mjs");

function runCli(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}
const run = runCli;

test("install, doctor, conflict protection, and forced repair", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-target-"));
  try {
    await mkdir(path.join(target, ".git"));
    await mkdir(path.join(target, ".agents/skills/project-only"), { recursive: true });
    await writeFile(path.join(target, "AGENTS.md"), "# Product Rules\n\n- Keep this rule.\n");
    await writeFile(path.join(target, "LICENSE.md"), "product license\n");
    await writeFile(path.join(target, "NOTICE.md"), "product notice\n");
    await writeFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "project-only\n");

    const install = run(["install", target]);
    assert.equal(install.status, 0, install.stderr);

    const agents = await readFile(path.join(target, "AGENTS.md"), "utf8");
    assert.match(agents, /Keep this rule/);
    assert.match(agents, /vydykhai:managed:start/);
    assert.match(agents, /Success Line/);
    assert.match(agents, /CONSULT/);
    assert.equal(await readFile(path.join(target, "LICENSE.md"), "utf8"), "product license\n");
    assert.equal(await readFile(path.join(target, "NOTICE.md"), "utf8"), "product notice\n");
    assert.equal(await readFile(path.join(target, ".agents/skills/project-only/SKILL.md"), "utf8"), "project-only\n");
    assert.match(await readFile(path.join(target, "docs/workflows/README.md"), "utf8"), /environment-neutral workflows/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Role: EXECUTION/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Consult when:/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Applicable Memory Brief:/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Memory Brief result:/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Memory candidates:/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Artifact disposition:/);
    assert.match(await readFile(path.join(target, "docs/workflows/project-memory-graph-template.md"), "utf8"), /Legacy Source Map/);
    assert.match(await readFile(path.join(target, "docs/workflows/project-memory-graph-template.md"), "utf8"), /Live Retrieval Probes/);
    assert.match(await readFile(path.join(target, "docs/workflows/task-context-handoff-template.md"), "utf8"), /Recipient proof:/);
    assert.match(await readFile(path.join(target, "docs/workflows/intent-trail-template.md"), "utf8"), /APPROACH_PIVOT/);
    assert.match(await readFile(path.join(target, "docs/workflows/project-state-template.md"), "utf8"), /Task return mapping:/);
    await assert.rejects(readFile(path.join(target, "docs/codex-workflows/README.md"), "utf8"));

    const lock = JSON.parse(await readFile(path.join(target, ".vydykhai-lock.json"), "utf8"));
    assert.equal(lock.installedVersion, "1.27.0");
    assert.match(agents, /three context layers isolated/i);
    assert.match(
      await readFile(path.join(target, ".agents/skills/framework-orchestrator/SKILL.md"), "utf8"),
      /not the canonical framework maintenance context/,
    );
    assert.match(
      await readFile(path.join(target, ".agents/skills/framework-orchestrator/SKILL.md"), "utf8"),
      /Work Hygiene Check/,
    );
    assert.equal(lock.creator.name, "Alexander Rozhnov");
    assert.equal(lock.creator.nameRu, "Александр Рожнов");
    assert.equal(lock.license, "PolyForm-Small-Business-1.0.0");
    assert.equal(lock.canonicalSource, "https://github.com/vonjor-lab/vydykhai-humans-as-agents");
    assert.match(await readFile(path.join(target, "docs/VYDYKHAI_NOTICE.md"), "utf8"), /Alexander Rozhnov/);

    const doctor = run(["doctor", target, "--offline"]);
    assert.equal(doctor.status, 0, doctor.stderr);
    assert.match(doctor.stdout, /Integrity: OK/);
    const installedCli = path.join(target, "scripts/vydykhai.mjs");
    const imported = spawnSync(process.execPath, [
      "--input-type=module", "--eval",
      `const {validateDurableOutbox} = await import(${JSON.stringify(pathToFileURL(installedCli).href)}); console.log(JSON.stringify(validateDurableOutbox("# Return Sync\\nread-only note")));`,
    ], { encoding: "utf8" });
    assert.equal(imported.status, 0, imported.stderr);
    assert.deepEqual(JSON.parse(imported.stdout).pendingReturnIds, []);
    const cliLink = path.join(target, "cli-link.mjs");
    await symlink(installedCli, cliLink);
    const linkedDoctor = spawnSync(process.execPath, [cliLink, "doctor", target, "--offline"], { encoding: "utf8" });
    assert.equal(linkedDoctor.status, 0, linkedDoctor.stderr);
    assert.match(linkedDoctor.stdout, /Integrity: OK/);
    assert.match(doctor.stdout, /Agent routing: latest-available-flagship \/ role-routed/);
    assert.match(doctor.stdout, /ORCHESTRATOR=maximum-available/);
    assert.match(doctor.stdout, /DISCOVERY=deep-bounded/);
    assert.match(doctor.stdout, /EXECUTION=efficient-bounded/);
    assert.match(doctor.stdout, /Orchestrator advisory: control-only-advisory; guard=unowned-project-work/);
    assert.match(doctor.stdout, /Project activation: evidence-backed-project-activation; 8 live checks via project-launch/);
    assert.match(doctor.stdout, /Control loop: single-ledger-anomaly-escalation; Project State v2/);
    assert.match(doctor.stdout, /Control fast path: deterministic-validate-publish-readback; Governor=semantic-anomalies-only; Graph=memory-delta-only/);
    assert.match(doctor.stdout, /Control state publication: validate-publish-readback-or-restore/);
    assert.match(doctor.stdout, /Project Guard: external-event-and-schedule; healthy=deterministic-no-model; anomaly=maximum-available; incident=semantic-condition-set/);
    assert.match(doctor.stdout, /Guard repair: 1 per incident; repeat=control-degraded/);
    assert.match(doctor.stdout, /Human attention: durable-single-manager-attention; guard=silent; completion=restore-or-explicitly-supersede/);
    assert.match(doctor.stdout, /Execution leases: one-work-one-owning-context/);
    assert.match(doctor.stdout, /Task returns: durable-outbox-native-wakeup; terminal=return-sync; fallback=discover-unrouted-durable-return/);
    assert.match(doctor.stdout, /Rotation: independent-health-gated; independent check after 2 compactions or 24 active hours/);
    assert.match(doctor.stdout, /Memory: project-memory-graph v3; complete goal-to-evidence context; no fixed node cap/);
    assert.match(doctor.stdout, /Memory acceptance: ordinary-unhinted-real-task-probes -> targeted-regression -> atomic-shadow-integration -> human-confirmed-cutover/);
    assert.match(doctor.stdout, /Action receipts: critical-transition-readback; 7 critical boundaries/);
    assert.match(doctor.stdout, /Tracker: task-contract-with-event-driven-projection/);
    assert.match(doctor.stdout, /Creator: Alexander Rozhnov \(@vonjor-lab\)/);
    assert.match(doctor.stdout, /License: PolyForm-Small-Business-1\.0\.0/);

    const legacyManifestPath = path.join(target, "vydykhai.json");
    const legacyManifest = JSON.parse(await readFile(legacyManifestPath, "utf8"));
    delete legacyManifest.actionReceiptPolicy;
    delete legacyManifest.memoryPolicy.contextRoutingPolicy;
    delete legacyManifest.memoryPolicy.contextRoutes;
    legacyManifest.memoryPolicy.taskBriefMaxNodes = 7;
    delete legacyManifest.projectActivationPolicy;
    delete legacyManifest.orchestratorAdvisoryPolicy;
    delete legacyManifest.controlLoopPolicy;
    delete legacyManifest.controlStatePublicationPolicy;
    delete legacyManifest.projectGuardPolicy;
    delete legacyManifest.humanAttentionPolicy;
    delete legacyManifest.continuationPolicy;
    delete legacyManifest.executionLeasePolicy;
    delete legacyManifest.taskReturnPolicy;
    delete legacyManifest.rotationPolicy;
    legacyManifest.version = "1.18.0";
    const legacyManifestText = `${JSON.stringify(legacyManifest, null, 2)}\n`;
    await writeFile(legacyManifestPath, legacyManifestText);
    const legacyLockPath = path.join(target, ".vydykhai-lock.json");
    const legacyLock = JSON.parse(await readFile(legacyLockPath, "utf8"));
    legacyLock.installedVersion = "1.18.0";
    legacyLock.managedFiles["vydykhai.json"] = createHash("sha256").update(legacyManifestText).digest("hex");
    await writeFile(legacyLockPath, `${JSON.stringify(legacyLock, null, 2)}\n`);

    const legacyDoctor = run(["doctor", target, "--offline"]);
    assert.match(legacyDoctor.stdout, /Production continuation: not declared by installed version/);
    assert.equal(legacyDoctor.status, 0, legacyDoctor.stderr);
    assert.match(legacyDoctor.stdout, /Vydykhai 1\.18\.0/);
    assert.match(legacyDoctor.stdout, /Memory: project-memory-graph v3; task brief <= 7 executable nodes/);
    assert.match(legacyDoctor.stdout, /Orchestrator advisory: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Project activation: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Control loop: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Control state publication: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Project Guard: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Human attention: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Execution leases: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Task returns: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Rotation: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Action receipts: not declared by installed version/);

    const corePath = path.join(target, "docs/FRAMEWORK.md");
    await writeFile(corePath, "local modification\n");

    const brokenDoctor = run(["doctor", target, "--offline"]);
    assert.equal(brokenDoctor.status, 1);
    assert.match(brokenDoctor.stdout, /Modified managed files/);

    const protectedInstall = run(["install", target]);
    assert.equal(protectedInstall.status, 1);
    assert.match(protectedInstall.stderr, /Refusing to overwrite locally modified framework files/);

    const repaired = run(["install", target, "--force"]);
    assert.equal(repaired.status, 0, repaired.stderr);
    assert.match(await readFile(corePath, "utf8"), /Version: 1\.27\.0/);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("current manifest preserves updater compatibility fields", async () => {
  const manifest = JSON.parse(await readFile(path.join(root, "vydykhai.json"), "utf8"));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.defaultAgentProfile.modelPolicy, "latest-available-flagship");
  assert.equal(manifest.defaultAgentProfile.reasoningEffort, "xhigh");
  assert.equal(manifest.defaultAgentProfile.reasoningPolicy, "deepest-bounded");
  assert.equal(manifest.agentRoutingPolicy.policy, "role-routed");
  assert.equal(manifest.agentRoutingPolicy.profiles.orchestrator.reasoningPolicy, "maximum-available");
  assert.equal(manifest.agentRoutingPolicy.profiles.orchestrator.preferredEffortWhenAvailable, "ultra");
  assert.equal(manifest.agentRoutingPolicy.profiles.discovery.reasoningPolicy, "deep-bounded");
  assert.equal(manifest.agentRoutingPolicy.profiles.discovery.preferredEffortWhenAvailable, "xhigh");
  assert.equal(manifest.agentRoutingPolicy.profiles.execution.reasoningPolicy, "efficient-bounded");
  assert.equal(manifest.agentRoutingPolicy.profiles.execution.preferredEffortWhenAvailable, "low");
  assert.equal(manifest.orchestratorAdvisoryPolicy.policy, "control-only-advisory");
  assert.deepEqual(manifest.orchestratorAdvisoryPolicy.results, ["control-only", "route-to-focused-context"]);
  assert.deepEqual(manifest.orchestratorAdvisoryPolicy.acceptedProjectEvidenceSources, [
    "human-decision",
    "durable-source",
    "focused-context-receipt",
  ]);
  assert.equal(manifest.orchestratorAdvisoryPolicy.guardSignal, "unowned-project-work");
  assert.equal(manifest.projectActivationPolicy.policy, "evidence-backed-project-activation");
  assert.deepEqual(manifest.projectActivationPolicy.requiredChecks, [
    "target-repository-and-framework",
    "shared-repo-and-tracker",
    "participant-readiness",
    "coordination-input-route",
    "current-operational-route",
    "compass-and-first-dod",
    "orchestrator-and-return-sync",
    "first-route-and-next-best-action",
  ]);
  assert.deepEqual(manifest.projectActivationPolicy.results, [
    "project-ready",
    "project-ready-with-limits",
    "needs-decision",
    "blocked-by-access",
  ]);
  assert.equal(manifest.controlLoopPolicy.policy, "single-ledger-anomaly-escalation");
  assert.equal(manifest.controlLoopPolicy.projectStateVersion, 2);
  assert.equal(manifest.controlLoopPolicy.routineTransition, "deterministic-validate-publish-readback");
  assert.equal(manifest.controlLoopPolicy.governorScope, "semantic-anomalies-only");
  assert.equal(manifest.controlLoopPolicy.viewDriftAction, "regenerate-no-model-no-control-event");
  assert.equal(manifest.controlLoopPolicy.graphUpdate, "memory-delta-only");
  assert.deepEqual(manifest.controlLoopPolicy.states, ["healthy", "repair", "rotate"]);
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("current-dod-line"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("pending-return-inbox"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("actual-orchestrator-context"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("work-origin"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("human-attention-continuity"));
  assert.equal(manifest.controlStatePublicationPolicy.policy, "validate-publish-readback-or-restore");
  assert.deepEqual(manifest.controlStatePublicationPolicy.stages, [
    "render-candidate",
    "validate-candidate",
    "publish-once",
    "readback-exact",
    "restore-last-accepted-on-mismatch",
  ]);
  assert.equal(manifest.controlStatePublicationPolicy.failedWriteState, "never-current");
  assert.equal(manifest.projectGuardPolicy.policy, "external-event-and-schedule");
  assert.equal(manifest.projectGuardPolicy.defaultIntervalMinutes, 30);
  assert.equal(manifest.projectGuardPolicy.healthyPath, "deterministic-no-model");
  assert.equal(manifest.projectGuardPolicy.anomalyProfile, "maximum-available");
  assert.equal(manifest.projectGuardPolicy.incidentIdentity, "semantic-condition-set");
  assert.equal(manifest.projectGuardPolicy.snapshotHashRole, "evidence-only");
  assert.equal(manifest.projectGuardPolicy.acceptedSameIncidentAction, "silent-no-model");
  assert.equal(manifest.projectGuardPolicy.changedConditionAction, "audit-required");
  assert.equal(manifest.projectGuardPolicy.settleWindowSeconds, 30);
  assert.equal(manifest.projectGuardPolicy.maxAutomaticRepairsPerIncident, 1);
  assert.equal(manifest.projectGuardPolicy.repeatedRepairAction, "control-degraded");
  assert.deepEqual(manifest.projectGuardPolicy.actions, ["noop", "wake", "audit-required", "control-degraded"]);
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("independent-trigger"));
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("idempotent-incident"));
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("external-incident-ledger"));
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("orchestrator-work-origin-read"));
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("pending-human-action-read"));
  assert.ok(manifest.projectGuardPolicy.requiredCapabilities.includes("durable-outbox-discovery"));
  assert.equal(manifest.humanAttentionPolicy.policy, "durable-single-manager-attention");
  assert.deepEqual(manifest.humanAttentionPolicy.states, ["none", "pending", "resurface-due"]);
  assert.deepEqual(manifest.humanAttentionPolicy.requiredFields, ["id", "request", "source", "raised-at", "resume-after"]);
  assert.equal(manifest.humanAttentionPolicy.unchangedGuardAction, "silent");
  assert.equal(manifest.humanAttentionPolicy.incidentDelivery, "single-bounded-wakeup");
  assert.equal(manifest.humanAttentionPolicy.completion, "restore-or-explicitly-supersede");
  assert.equal(manifest.humanAttentionPolicy.orchestratorAvailability, "release-after-observable-dispatch");
  assert.equal(manifest.continuationPolicy.turnRelease, "productive-handoff-or-concrete-wait");
  assert.equal(manifest.continuationPolicy.policy, "evidence-backed-next-action");
  assert.equal(manifest.continuationPolicy.activityMaxAgeSeconds, 300);
  assert.equal(manifest.executionLeasePolicy.policy, "one-work-one-owning-context");
  assert.deepEqual(manifest.executionLeasePolicy.states, [
    "prepared",
    "started",
    "working",
    "waiting",
    "returned",
    "closed",
    "outcome-unknown",
  ]);
  assert.equal(manifest.taskReturnPolicy.policy, "durable-outbox-native-wakeup");
  assert.equal(manifest.taskReturnPolicy.terminalReceipt, "return-sync");
  assert.equal(manifest.taskReturnPolicy.actionReceiptSubstitutes, false);
  assert.equal(manifest.taskReturnPolicy.nativeWakeup, "required-attempt");
  assert.equal(manifest.taskReturnPolicy.nativeThreadRead, "non-authoritative");
  assert.equal(manifest.taskReturnPolicy.guardFallback, "discover-unrouted-durable-return");
  assert.equal(manifest.taskReturnPolicy.machineFormat, "marked-return-sync-and-route-v1");
  assert.equal(manifest.taskReturnPolicy.adapterParser, "scripts/vydykhai.mjs#validateDurableOutbox");
  assert.deepEqual(manifest.taskReturnPolicy.adapterAcceptance, [
    "real-emitted-return-format",
    "matching-route-receipt",
    "scheduled-noop-after-routing",
    "malformed-or-mismatched-route-audits",
    "older-pending-survives-newer-routed",
    "bounded-source-refresh-preserves-edits-and-pending",
    "pending-wakeup-survives-unrelated-change-and-recipient-handoff",
  ]);
  assert.deepEqual(manifest.taskReturnPolicy.states, ["written", "sent", "received", "consumed", "routed"]);
  assert.deepEqual(manifest.taskReturnPolicy.reconcileOn, ["return-sync-written", "orchestrator-cold-path", "governor-check", "active-timer"]);
  assert.equal(manifest.rotationPolicy.policy, "independent-health-gated");
  assert.equal(manifest.rotationPolicy.maxCompactionsWithoutIndependentCheck, 2);
  assert.equal(manifest.rotationPolicy.sameClassFailureLimit, 2);
  assert.equal(manifest.rotationPolicy.activeReviewHours, 24);
  assert.ok(manifest.rotationPolicy.hardSignals.includes("unowned-project-work-after-repair"));
  assert.equal(manifest.defaultScopeFreshnessDays, 7);
  assert.equal(manifest.memoryPolicy.policy, "project-memory-graph");
  assert.equal(manifest.memoryPolicy.graphVersion, 3);
  assert.ok(manifest.memoryPolicy.anchorKinds.includes("entity"));
  assert.ok(manifest.memoryPolicy.nodeTypes.includes("lesson"));
  assert.ok(manifest.memoryPolicy.relationTypes.includes("learned-from"));
  assert.deepEqual(manifest.memoryPolicy.acceptanceOrder, [
    "ordinary-unhinted-real-task-probes",
    "targeted-regression",
    "atomic-shadow-integration",
    "human-confirmed-cutover",
  ]);
  assert.deepEqual(manifest.memoryPolicy.naturalProbeRange, [3, 4]);
  assert.equal(manifest.memoryPolicy.naturalProbeFailureAction, "stop-before-broad-evaluation");
  assert.ok(manifest.memoryPolicy.memoryMissTypes.includes("retrieval-miss"));
  assert.deepEqual(manifest.memoryPolicy.protectedPointerRequiredFields, [
    "owner",
    "protected-reference",
    "environment-and-scope",
    "allowed-non-destructive-route",
    "last-safe-check",
    "expiry-or-reentry-condition",
  ]);
  assert.deepEqual(manifest.memoryPolicy.recallCommitmentRequiredFields, [
    "current-meaning",
    "source",
    "capability-aliases-and-trigger",
    "applicability-timing-and-checkpoint",
    "pending-human-question",
  ]);
  assert.equal(manifest.memoryPolicy.taskBriefMaxNodes, null);
  assert.equal(manifest.memoryPolicy.contextRoutingPolicy, "goal-to-evidence-completeness");
  assert.deepEqual(manifest.memoryPolicy.contextRoutes, ["execution", "discovery", "correction-and-acceptance"]);
  assert.equal(manifest.actionReceiptPolicy.policy, "critical-transition-readback");
  assert.deepEqual(manifest.actionReceiptPolicy.boundaries, [
    "task-launch",
    "task-resume",
    "return-sync",
    "memory-reflection-and-detour",
    "protected-access",
    "acceptance-and-live-action",
    "side-effect-reconciliation",
  ]);
  assert.deepEqual(manifest.actionReceiptPolicy.boundaryOwners, {
    "task-launch": "orchestrator",
    "task-resume": "orchestrator",
    "return-sync": "orchestrator",
    "memory-reflection-and-detour": "orchestrator",
    "protected-access": "acting-context",
    "acceptance-and-live-action": "owning-task",
    "side-effect-reconciliation": "owning-task",
  });
  assert.ok(manifest.actionReceiptPolicy.fields.includes("observed-action"));
  assert.deepEqual(manifest.actionReceiptPolicy.results, ["pass", "mismatch", "unverified", "outcome-unknown"]);
  assert.equal(manifest.trackerPolicy.policy, "task-contract-with-event-driven-projection");
  assert.ok(manifest.managedPaths.includes("docs/workflows"));
  assert.ok(!manifest.managedPaths.includes("docs/codex-workflows"));
  assert.match(await readFile(path.join(root, "docs/workflows/idea-memory-template.md"), "utf8"), /legacy\/read-only/);
  const core = await readFile(path.join(root, "docs/FRAMEWORK.md"), "utf8");
  assert.match(core, /Shared Sync Contract/);
  assert.match(core, /Expansion Check/);
  assert.match(core, /Project Memory Graph/);
  assert.match(core, /NO_MEMORY_DELTA/);
  assert.match(core, /CONSULT/);
  assert.match(core, /Touch Set/);
  assert.match(core, /Memory Brief/);
  assert.match(core, /MEMORY_COVERAGE_GAP/);
  assert.match(core, /expiry or re-entry condition/);
  assert.match(core, /Action Receipt/);
  assert.match(core, /Memory Reflection/);
  assert.match(core, /RETRIEVAL_MISS/);
  assert.match(core, /Because \/ Apply \/ Avoid \/ Verify \/ Source/);
  assert.match(core, /recall commitment/);
  assert.match(core, /opaque ids alone are invalid/);
  assert.match(core, /Role-Routed Agent Profiles/);
  assert.match(core, /Low-ready/);
  assert.match(core, /Project Activation Receipt/);
  assert.match(core, /PROJECT_READY_WITH_LIMITS/);
  assert.match(core, /24 hours old/);
  assert.match(core, /Work Hygiene Check/);
  assert.match(core, /ACTIVE.*WAITING.*FINISH.*SALVAGE.*RETIRE/);
  assert.match(core, /Governor Check/);
  assert.match(core, /DOD Control Line/);
  assert.match(core, /Execution Lease/);
  assert.match(core, /durable task\/tracker outbox/);
  assert.match(core, /EXECUTION_STALLED/);
  assert.match(core, /The boundary is the owned result/);
  assert.match(core, /UNOWNED_PROJECT_WORK/);
  const agentsCore = await readFile(path.join(root, "docs/AGENTS_CORE.md"), "utf8");
  assert.match(agentsCore, /active orchestrator's own clean cwd/);
  assert.match(agentsCore, /ACTUAL_CONTEXT_COHERENCE/);
  const projectState = await readFile(path.join(root, "docs/workflows/project-state-template.md"), "utf8");
  assert.match(projectState, /Shared Sync:/);
  assert.match(projectState, /Project activation:/);
  assert.match(projectState, /## Project Activation Receipt/);
  assert.match(projectState, /Decision scope \/ backup/);
  assert.match(projectState, /Readiness receipt/);
  assert.match(projectState, /Governor:/);
  assert.match(projectState, /Audited incident:/);
  assert.match(projectState, /Orchestrator health:/);
  assert.match(projectState, /DOD Control Line:/);
  assert.match(projectState, /## Execution Leases/);
  assert.match(projectState, /## Pending Return Inbox/);
  assert.match(projectState, /## Detours And Recall/);
  assert.match(projectState, /Project Memory Graph:/);
  assert.match(projectState, /Last memory delta:/);
  assert.match(projectState, /Tracker projection:/);
  assert.match(projectState, /Operational sources:/);
  assert.match(projectState, /CURRENT\/NEXT\/PRIOR_MISS/);
  assert.match(projectState, /Latest seen:/);
  assert.match(projectState, /Update:/);
  assert.match(projectState, /Framework context readback:/);
  assert.match(projectState, /Snapshot as of:/);
  assert.match(projectState, /Work hygiene:/);
  assert.match(projectState, /--expect-state-sha/);
  assert.match(projectState, /restore and verify the exact last accepted body/);
  assert.match(projectState, /<!-- vydykhai:return-route v1 -->/);
  assert.equal((projectState.match(/^## Next-Best-Action$/gm) || []).length, 1);
  const taskHandoff = await readFile(path.join(root, "docs/workflows/task-context-handoff-template.md"), "utf8");
  assert.match(taskHandoff, /Role: EXECUTION/);
  assert.match(taskHandoff, /Agent profile: EXECUTION/);
  assert.match(taskHandoff, /Execution Lease:/);
  assert.match(taskHandoff, /DOD Control Line contribution:/);
  assert.match(taskHandoff, /Continue from:/);
  assert.match(taskHandoff, /Applicable Memory Brief:/);
  assert.match(taskHandoff, /Memory Brief result:/);
  assert.match(taskHandoff, /Memory candidates:/);
  assert.match(taskHandoff, /Return receipt id:/);
  assert.match(taskHandoff, /CHECKPOINT_READY/);
  assert.match(taskHandoff, /Return triggers: <readiness result/);
  assert.match(taskHandoff, /Return lifecycle:/);
  assert.match(taskHandoff, /OUTCOME_UNKNOWN/);
  assert.match(taskHandoff, /Consult when:/);
  assert.match(taskHandoff, /Boundary consultation:/);
  assert.match(taskHandoff, /Progress continuity:/);
  assert.match(taskHandoff, /Recipient proof:/);
  assert.match(taskHandoff, /schema\/migration revision/);
  assert.match(taskHandoff, /Artifact disposition:/);
  assert.match(taskHandoff, /<!-- vydykhai:return-sync v1 -->/);
  assert.match(taskHandoff, /<!-- vydykhai:return-sync:end -->/);
  const orchestratorWorkflow = await readFile(path.join(root, "docs/workflows/framework-orchestrator.md"), "utf8");
  assert.match(orchestratorWorkflow, /THIS ORCHESTRATOR IS RETIRED - DO NOT CONTINUE HERE/);
  assert.match(orchestratorWorkflow, /ROTATION_CUTOVER_INCOMPLETE/);
  assert.match(orchestratorWorkflow, /Boundary consultation \(`CONSULT`\)/);
  assert.match(orchestratorWorkflow, /first active use/);
  assert.match(orchestratorWorkflow, /installed < release <= latest/);
  assert.match(orchestratorWorkflow, /one concise delta per release/);
  assert.match(orchestratorWorkflow, /never omit a skipped release/);
  assert.match(orchestratorWorkflow, /active orchestrator's own clean cwd/);
  assert.match(orchestratorWorkflow, /maintenance task or a detached verification checkout proves the Candidate, not activation/);
  assert.match(orchestratorWorkflow, /newer than the last Return Sync/);
  assert.match(orchestratorWorkflow, /no context message, no-op trace, or model wake-up/);
  assert.match(orchestratorWorkflow, /representative current, upcoming, and prior-miss Touch Sets/);
  assert.match(orchestratorWorkflow, /Memory Reflection/);
  assert.match(orchestratorWorkflow, /APPLICATION_MISS/);
  assert.match(orchestratorWorkflow, /compare a side-by-side candidate with current memory/);
  assert.match(orchestratorWorkflow, /non-destructive access check/);
  assert.match(orchestratorWorkflow, /last safe check time\/result\/source/);
  assert.match(orchestratorWorkflow, /before history search, human secret re-request, or live action/);
  assert.match(orchestratorWorkflow, /canonical title plus actual link, role\/profile, base, and route/);
  assert.match(orchestratorWorkflow, /<work-id> \[<track>\] \[<mode>\] — <short outcome>/);
  assert.match(orchestratorWorkflow, /PR #<pr> → <canonical work reference>/);
  assert.match(orchestratorWorkflow, /Bare task, PR, and context numbers are not meaningful references/);
  assert.match(orchestratorWorkflow, /Action Receipt/);
  assert.match(orchestratorWorkflow, /Project Activation gates pass/);
  assert.match(orchestratorWorkflow, /Only `PASS` closes the transition/);
  assert.match(orchestratorWorkflow, /owning task owns acceptance\/live and side-effect receipts/);
  assert.match(orchestratorWorkflow, /graph watermark/);
  assert.match(orchestratorWorkflow, /tracker projection/);
  assert.match(orchestratorWorkflow, /Work Hygiene Check/);
  assert.match(orchestratorWorkflow, /one machine cannot certify the team/);
  assert.match(orchestratorWorkflow, /bounded read-only memory backfill/);
  assert.match(orchestratorWorkflow, /ordinary unhinted real-task queries/);
  assert.match(orchestratorWorkflow, /Governor Check/);
  assert.match(orchestratorWorkflow, /EXECUTION_STALLED/);
  assert.match(orchestratorWorkflow, /WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED/);
  assert.match(orchestratorWorkflow, /An Action Receipt never substitutes for Return Sync/);
  assert.match(orchestratorWorkflow, /paired marked Return Route receipt/);
  assert.match(orchestratorWorkflow, /partial or failed write never becomes current truth/);
  const projectGuardWorkflow = await readFile(path.join(root, "docs/workflows/project-guard.md"), "utf8");
  assert.match(projectGuardWorkflow, /discover newly written Return Sync receipts directly from the durable outbox/);
  assert.match(projectGuardWorkflow, /native task or thread read is empty/);
  assert.match(projectGuardWorkflow, /semantic incident id/);
  assert.match(projectGuardWorkflow, /two real boundary tests/);
  assert.match(projectGuardWorkflow, /no queued message, and no model call/);
  const projectLaunch = await readFile(path.join(root, "docs/workflows/project-launch.md"), "utf8");
  assert.match(projectLaunch, /bounded read-only memory backfill/);
  assert.match(projectLaunch, /Do not copy the full transcript or model narration/);
  assert.match(projectLaunch, /doctor` proves framework integrity only/);
  assert.match(projectLaunch, /Never create disposable probe issues/);
  assert.match(projectLaunch, /One machine cannot certify another/);
  assert.match(projectLaunch, /Operations for the first DOD/);
  assert.match(projectLaunch, /PROJECT_READY_WITH_LIMITS/);
  const graphTemplate = await readFile(path.join(root, "docs/workflows/project-memory-graph-template.md"), "utf8");
  assert.match(graphTemplate, /Owner gate:/);
  assert.match(graphTemplate, /Pending Memory Events/);
  assert.match(graphTemplate, /Live Retrieval Probes/);
  assert.match(graphTemplate, /CURRENT/);
  assert.match(graphTemplate, /PRIOR_MISS/);
  const acceptWork = await readFile(path.join(root, "docs/workflows/accept-work.md"), "utf8");
  assert.match(acceptWork, /Unexpectedly changed/);
  assert.match(acceptWork, /recipient-side exact-artifact\/revision proof/);
  assert.match(acceptWork, /reproducible safe data source/);
  assert.match(acceptWork, /zero-spend or no-mutation contract/);
  assert.match(acceptWork, /Memory candidates/);
  assert.match(acceptWork, /least-privilege access/);
  assert.match(acceptWork, /complete protected pointer/);
  assert.match(acceptWork, /Artifact disposition/);
  assert.match(acceptWork, /Acceptance, merge, and deploy are separate authorities/);
  assert.match(acceptWork, /durable task\/tracker outbox/);
  assert.match(acceptWork, /OUTCOME_UNKNOWN/);
  const intentTrail = await readFile(path.join(root, "docs/workflows/intent-trail-template.md"), "utf8");
  assert.match(intentTrail, /protected reference without its value/);
  assert.match(intentTrail, /expiry or re-entry condition/);
});

test("orchestrator and task contexts keep distinct hot and cold paths", async () => {
  const orchestratorSkill = await readFile(
    path.join(root, ".agents/skills/framework-orchestrator/SKILL.md"),
    "utf8",
  );
  const alignmentSkill = await readFile(path.join(root, ".agents/skills/daily-alignment/SKILL.md"), "utf8");
  const acceptSkill = await readFile(path.join(root, ".agents/skills/accept-work/SKILL.md"), "utf8");
  const orchestratorWorkflow = await readFile(path.join(root, "docs/workflows/framework-orchestrator.md"), "utf8");
  const alignmentWorkflow = await readFile(path.join(root, "docs/workflows/daily-alignment.md"), "utf8");
  const handoff = await readFile(path.join(root, "docs/workflows/task-context-handoff-template.md"), "utf8");

  assert.match(orchestratorSkill, /Hot path:[\s\S]*EXECUTION_STALLED/);
  assert.match(orchestratorSkill, /\[ORCHESTRATOR\] <project> — Vydykhai <version>/);
  assert.match(orchestratorSkill, /Never substitute a PR or context id for work identity/);
  assert.match(orchestratorSkill, /Never implement, debug, fix product code/);
  assert.match(orchestratorSkill, /active orchestrator's own working directory/);
  assert.match(orchestratorSkill, /ACTUAL_CONTEXT_COHERENCE/);
  assert.match(alignmentSkill, /Do not use for task-local failures/);
  assert.match(acceptSkill, /owning execution context/);
  assert.match(acceptSkill, /do not perform project-wide orchestration/);

  assert.match(orchestratorWorkflow, /Working inside scope: stay quiet/);
  assert.match(orchestratorWorkflow, /Material external delta:[\s\S]*Do not wake unaffected work/);
  assert.match(orchestratorWorkflow, /Repeated no-progress:[\s\S]*do not restart alignment/);
  assert.match(alignmentWorkflow, /Leave unaffected tasks asleep/);
  assert.match(alignmentWorkflow, /Task contexts never read the raw transcript/);

  const startup = handoff.split("## Startup")[1].split("## Execution Rules")[0];
  assert.match(startup, /Role: EXECUTION/);
  assert.match(startup, /Applicable Memory Brief:/);
  assert.doesNotMatch(startup, /Touch Set:/);
  assert.doesNotMatch(startup, /Project State:/);
  assert.match(handoff, /Resolve ordinary implementation failures autonomously/);
  assert.match(handoff, /Do not run `\$project-launch`, `\$start-work`, `\$daily-alignment`, or `\$framework-orchestrator` here/);
  assert.match(handoff, /first write the complete marked Return Sync above to the durable task\/tracker outbox/);
  assert.match(handoff, /An Action Receipt never substitutes for this Return Sync/);
});

test("control-check closes DOD, lease, return, detour, and memory transitions", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-control-"));
  const statePath = path.join(target, "state.md");
  const graphPath = path.join(target, "graph.md");
  const outboxPath = path.join(target, "outbox.md");
  const activityPath = path.join(target, "activity.json");
  const run = (args) => runCli(args[0] === "guard-check" ? [...args, "--activity", activityPath] : args);
  const healthyState = `<!-- vydykhai:project-state v2 -->
# Project State: Example
Snapshot as of: event-7
## Control Snapshot
Governor: HEALTHY | Receipt: gov-7 | Trigger: activation | Audited incident: none | Basis event: event-1 | Route: deterministic close
Project Guard: ACTIVE | Runner: local-scheduler/guard-example | Independent: YES | Event route: durable-outbox-and-context-watermark | Schedule: every-30-minutes | Last proof: now/PASS/scheduler | Wakeup: active-orchestrator-pointer | Incident: none
Human attention: NONE
Orchestrator health: HEALTHY | Context: current | Profile: ORCHESTRATOR / maximum / current | Last compaction/context-loss signal: 0 / none
Work origin: PASS | Advisory contract: CONTROL_ONLY | Accepted evidence owner: durable source | Last checked: event-7/now/adapter
Last independent check: now / state+graph+tracker / PASS | Same-class failures since repair: 0
DOD Control Line: accepted visible baseline -> close actor flow -> smoke -> continue
Memory coverage: graph v3 / watermark event-6 / CURRENT+NEXT+PRIOR_MISS PASS
Agent routing: latest flagship | Resolved: ORCHESTRATOR maximum / DISCOVERY deep / EXECUTION efficient | Checked: now | Fallback: none
Coordination inputs: shared notes / PASS | Intake: direct | Active alignment / latest delta: none
Environment adapter: native | Context mapping: task
Orchestrator rotation: stable | Candidate / previous: none
Scope freshness: 7 | Last project-level check: now / event-7 / PASS
## Current DOD
- Current DOD: actor completes the flow
## Execution Leases
| Work | State | Owner |
| --- | --- | --- |
| WORK-1 [DOD] — close actor flow | WORKING | task-one |
## Pending Return Inbox
| Receipt | Work / sender | State |
| --- | --- | --- |
## Detours And Recall
| ID | Meaning | State |
| --- | --- | --- |
| DET-1 | revisit copy at review | OPEN |
## Active Work
| Task | State |
| --- | --- |
| WORK-1 [DOD] — close actor flow | In Progress |
## Decisions And Blockers
- none
## Safe Continuation
- task may continue
## Next-Best-Action
\`\`\`json
{"schemaVersion":1,"id":"NEXT-7","work":"WORK-1","action":"Finish the accepted actor flow","owner":"task-one","state":"WORKING","evidence":"launch-7"}
\`\`\`
<!-- vydykhai:project-state:end -->
`;
  const healthyGraph = `<!-- vydykhai:project-memory-graph v3 -->
# Project Memory Graph: Example
Project State: state
Watermark: event-6
Declared nodes: 1
Last compaction: none
Last reflection: none
Last retrieval check: probes-1 / fresh evaluator / PASS
## Anchor Index
| ID | Kind | Canonical name / real-world aliases | Scope | Source |
| --- | --- | --- | --- | --- |
| ENT-01 | OUTCOME | actor flow | project | brief |
## Current Memory Nodes
### MEM-01 — Preserve actor flow
- Type / status: DECISION / ACTIVE
- About: ENT-01
- Recall when: actor flow
- Because: accepted route
- Apply: preserve it
- Avoid: parallel route
- Verify: actor completes it
- Applies / exceptions: project / none
- Owner gate: none
- Protected pointer (POINTER only): none
- Relations: about -> ENT-01
- Source / checked: brief / now
## Pending Memory Events
| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
## Live Retrieval Probes
| Slot | Raw trigger | Expected executable action or gate | Observed brief / evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
| CURRENT | change actor flow | preserve route | brief | PASS now | task |
| NEXT | accept actor flow | verify completion | brief | PASS now | task |
| PRIOR_MISS | prior route drift | avoid parallel route | brief | PASS now | lesson |
## Legacy Source Map
| Previous id or artifact | Current node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
<!-- vydykhai:project-memory-graph:end -->
`;

  try {
    await writeFile(statePath, healthyState);
    await writeFile(graphPath, healthyGraph);
    await writeFile(activityPath, JSON.stringify({ schemaVersion: 1,
      continuationKey: readProductionContinuation(healthyState).key, observedAt: new Date().toISOString(),
      orchestrator: { context: "current", status: "IDLE", evidence: "native-control-state" },
      owner: { context: "task-one", status: "ACTIVE", evidence: "native-task-state" },
    }));
    const healthy = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(healthy.status, 0, healthy.stderr);
    const healthyResult = JSON.parse(healthy.stdout);
    assert.equal(healthyResult.ok, true);
    assert.match(healthyResult.stateSha256, /^[a-f0-9]{64}$/);
    assert.match(healthyResult.graphSha256, /^[a-f0-9]{64}$/);
    assert.equal(healthyResult.memoryValidationScope, "structure-and-references-only");
    const routineState = healthyState.replace("Snapshot as of: event-7", "Snapshot as of: event-8")
      .replace("Last checked: event-7/now/adapter", "Last checked: event-8/now/adapter");
    await writeFile(statePath, routineState);
    const routineCheck = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(routineCheck.status, 0, routineCheck.stderr);
    assert.equal(JSON.parse(routineCheck.stdout).ok, true);
    const staleLegacyView = routineState.replace(
      "| WORK-1 [DOD] — close actor flow | In Progress |",
      "| WORK-1 [DOD] — close actor flow | stale display value |",
    );
    await writeFile(statePath, staleLegacyView);
    const viewCheck = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(viewCheck.status, 0, viewCheck.stderr);
    assert.equal(JSON.parse(viewCheck.stdout).ok, true);
    const compactState = routineState.replace(
      /## Active Work\n[\s\S]*?(?=## Decisions And Blockers)/,
      "",
    ).replace(/## Decisions And Blockers\n[\s\S]*?(?=## Next-Best-Action)/, "");
    await writeFile(statePath, compactState);
    const compactCheck = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(compactCheck.status, 0, compactCheck.stderr);
    assert.equal(JSON.parse(compactCheck.stdout).ok, true);
    await writeFile(statePath, healthyState);
    const exactReadback = run([
      "control-check",
      "--state",
      statePath,
      "--graph",
      graphPath,
      "--expect-state-sha",
      healthyResult.stateSha256,
      "--expect-graph-sha",
      healthyResult.graphSha256,
      "--json",
    ]);
    assert.equal(exactReadback.status, 0, exactReadback.stderr);
    const wrongReadback = run([
      "control-check",
      "--state",
      statePath,
      "--graph",
      graphPath,
      "--expect-state-sha",
      "0".repeat(64),
    ]);
    assert.equal(wrongReadback.status, 1);
    assert.match(wrongReadback.stdout, /readback sha256 .* does not match expected/);

    const healthyGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(healthyGuard.status, 0, healthyGuard.stderr);
    assert.equal(JSON.parse(healthyGuard.stdout).action, "NOOP");
    assert.equal(JSON.parse(healthyGuard.stdout).leaseActivity.coverage, "NOT_REQUESTED");
    const baseActivity = JSON.parse(await readFile(activityPath, "utf8"));
    const wholeActivity = { ...baseActivity, leaseKey: readLeaseActivityScope(healthyState).key,
      owner: { ...baseActivity.owner, status: "IDLE" },
      leases: [{ work: "WORK-1", context: "task-one", status: "IDLE", evidence: "native-idle-owner" }] };
    await writeFile(activityPath, JSON.stringify(wholeActivity));
    const wholeGuard = JSON.parse(run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout);
    assert.equal(wholeGuard.leaseActivity.coverage, "COVERED");
    assert.equal(wholeGuard.action, "WAKE");
    wholeActivity.leases[0].status = "ACTIVE";
    wholeActivity.owner.status = "ACTIVE";
    await writeFile(activityPath, JSON.stringify(wholeActivity));
    assert.equal(JSON.parse(run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout).action, "NOOP");
    await writeFile(activityPath, JSON.stringify(baseActivity));
    const noActivity = JSON.parse(runCli(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout);
    assert.equal(noActivity.action, "AUDIT_REQUIRED");
    assert.equal(noActivity.continuation.coverage, "LIMITED");

    const readyRecord = { ...readProductionContinuation(healthyState).value, state: "READY", owner: "current",
      action: "Dispatch the accepted actor flow", evidence: "accepted-brief-7" };
    const preparedState = healthyState.replace("| WORKING | task-one |", "| PREPARED | task-one |")
      .replace(/```json\n[\s\S]*?\n```/, `\`\`\`json\n${JSON.stringify(readyRecord)}\n\`\`\``);
    await writeFile(statePath, preparedState);
    const preparedCheck = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(preparedCheck.status, 0, preparedCheck.stdout);
    const preparedActivityPath = path.join(target, "prepared-activity.json");
    await writeFile(preparedActivityPath, JSON.stringify({ schemaVersion: 1,
      continuationKey: readProductionContinuation(preparedState).key, observedAt: new Date().toISOString(),
      orchestrator: { context: "current", status: "IDLE", evidence: "native-idle-7" },
    }));
    const preparedGuard = JSON.parse(runCli(["guard-check", "--state", statePath, "--graph", graphPath,
      "--activity", preparedActivityPath, "--json"]).stdout);
    assert.equal(preparedGuard.action, "WAKE");
    assert.equal(preparedGuard.continuation.coverage, "COVERED");
    await writeFile(statePath, healthyState);

    const returnSync = `<!-- vydykhai:return-sync v1 -->
# Return Sync
Status: ACCEPT
Return receipt id: RET-E2E-1
Return lifecycle: WRITTEN -> SENT
Task / context / PR / commit / artifact: WORK-1 / task-one / none / abc123 / result
Memory candidates: NO_MEMORY_DELTA
Artifact disposition: context -> FINISH / clean
Recommended orchestrator next action: close the lease
<!-- vydykhai:return-sync:end -->
`;
    const returnRoute = `<!-- vydykhai:return-route v1 -->
# Return Route
Return receipt id: RET-E2E-1
Return lifecycle: RECEIVED -> CONSUMED -> ROUTED
Consumer: active-orchestrator
Routed next action: lease closed
Evidence: state event-7
<!-- vydykhai:return-route:end -->
`;
    await writeFile(outboxPath, returnSync);
    const outboxWake = JSON.parse(
      run(["guard-check", "--state", statePath, "--graph", graphPath, "--outbox", outboxPath, "--json"]).stdout,
    );
    assert.equal(outboxWake.action, "WAKE");
    assert.match(outboxWake.outbox.issues.join("\n"), /return RET-E2E-1 requires routing/);

    await writeFile(outboxPath, `${returnSync}\n${returnRoute}`);
    const scheduledNoop = run([
      "guard-check",
      "--state",
      statePath,
      "--graph",
      graphPath,
      "--outbox",
      outboxPath,
      "--json",
    ]);
    assert.equal(scheduledNoop.status, 0, scheduledNoop.stderr);
    const scheduledNoopResult = JSON.parse(scheduledNoop.stdout);
    assert.equal(scheduledNoopResult.action, "NOOP");
    assert.deepEqual(
      [scheduledNoopResult.outbox.returnCount, scheduledNoopResult.outbox.routeCount, scheduledNoopResult.outbox.routedCount],
      [1, 1, 1],
    );
    assert.deepEqual(scheduledNoopResult.outbox.issues, []);

    await writeFile(outboxPath, `${returnSync}\n${returnRoute.replace("Evidence: state event-7", "Evidence: <missing>")}`);
    const malformedRoute = JSON.parse(
      run(["guard-check", "--state", statePath, "--graph", graphPath, "--outbox", outboxPath, "--json"]).stdout,
    );
    assert.equal(malformedRoute.action, "AUDIT_REQUIRED");
    assert.match(malformedRoute.outbox.issues.join("\n"), /Return Route RET-E2E-1 lacks Evidence/);
    assert.equal(malformedRoute.outbox.routedCount, 0);
    assert.deepEqual(malformedRoute.outbox.pendingReturnIds, ["RET-E2E-1"]);

    await writeFile(outboxPath, `${returnSync}\n${returnRoute.replaceAll("RET-E2E-1", "RET-OTHER-1")}`);
    const mismatchedRoute = JSON.parse(
      run(["guard-check", "--state", statePath, "--graph", graphPath, "--outbox", outboxPath, "--json"]).stdout,
    );
    assert.equal(mismatchedRoute.action, "AUDIT_REQUIRED");
    assert.match(mismatchedRoute.outbox.issues.join("\n"), /return RET-E2E-1 requires routing/);
    assert.match(mismatchedRoute.outbox.issues.join("\n"), /Return Route RET-OTHER-1 has no matching Return Sync/);

    await writeFile(outboxPath, "# Return Sync\nStatus: ACCEPT\nReturn receipt id: RET-LEGACY-1\n");
    const unmarkedReturn = JSON.parse(
      run(["guard-check", "--state", statePath, "--graph", graphPath, "--outbox", outboxPath, "--json"]).stdout,
    );
    assert.equal(unmarkedReturn.action, "AUDIT_REQUIRED");
    assert.match(unmarkedReturn.outbox.issues.join("\n"), /unmarked Return Sync data requires canonical v1 framing/);

    const limitedState = healthyState.replace("Project Guard: ACTIVE", "Project Guard: LIMITED");
    await writeFile(statePath, limitedState);
    const limitedFirst = JSON.parse(run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout);
    const acceptedLimitedFirst = JSON.parse(
      run([
        "guard-check",
        "--state",
        statePath,
        "--graph",
        graphPath,
        "--accepted-incident",
        limitedFirst.incidentId,
        "--json",
      ]).stdout,
    );
    assert.equal(acceptedLimitedFirst.action, "NOOP");
    assert.equal(acceptedLimitedFirst.requiredAction, "AUDIT_REQUIRED");
    assert.equal(acceptedLimitedFirst.deduplicated, true);
    const limitedLaterState = limitedState.replaceAll("event-7", "event-8");
    await writeFile(statePath, limitedLaterState);
    const limitedLater = JSON.parse(
      run([
        "guard-check",
        "--state",
        statePath,
        "--graph",
        graphPath,
        "--accepted-incident",
        limitedFirst.incidentId,
        "--json",
      ]).stdout,
    );
    assert.notEqual(limitedFirst.stateSha256, limitedLater.stateSha256);
    assert.equal(limitedFirst.incidentId, limitedLater.incidentId);
    assert.equal(limitedLater.incidentIdentity, "semantic-condition-set");
    assert.equal(limitedLater.action, "NOOP");
    assert.equal(limitedLater.deduplicated, true);

    const limitedWithExtraIssue = limitedLaterState.replace(
      "Event route: durable-outbox-and-context-watermark",
      "Event route: <missing>",
    );
    await writeFile(
      statePath,
      limitedWithExtraIssue.replace("Incident: none", `Incident: ${limitedLater.incidentId}`),
    );
    const changedIncident = JSON.parse(
      run([
        "guard-check",
        "--state",
        statePath,
        "--graph",
        graphPath,
        "--accepted-incident",
        limitedFirst.incidentId,
        "--json",
      ]).stdout,
    );
    assert.notEqual(changedIncident.incidentId, limitedLater.incidentId);
    assert.equal(changedIncident.recordedIncidentId, limitedLater.incidentId);
    assert.equal(changedIncident.incidentChanged, true);
    assert.equal(changedIncident.action, "AUDIT_REQUIRED");
    assert.equal(changedIncident.deduplicated, false);

    await writeFile(statePath, healthyState);

    const pendingAttention = healthyState.replace(
      "Human attention: NONE",
      "Human attention: PENDING | ID: HUMAN-7 | Request: Review the accepted demo | Source: task-7 | Raised: event-7 | Resume after: none",
    );
    await writeFile(statePath, pendingAttention);
    const pendingAttentionGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(pendingAttentionGuard.status, 0, pendingAttentionGuard.stderr);
    assert.equal(JSON.parse(pendingAttentionGuard.stdout).action, "NOOP");

    const resurfaceAttention = pendingAttention.replace("Human attention: PENDING", "Human attention: RESURFACE_DUE");
    await writeFile(statePath, resurfaceAttention);
    const resurfaceGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(resurfaceGuard.status, 0, resurfaceGuard.stderr);
    assert.equal(JSON.parse(resurfaceGuard.stdout).action, "WAKE");
    assert.match(resurfaceGuard.stdout, /human attention HUMAN-7 requires resurfacing/);

    const waitingReturn = healthyState.replace(
      "| --- | --- | --- |\n## Detours",
      "| --- | --- | --- |\n| RET-9 | task-one | WRITTEN |\n## Detours",
    );
    await writeFile(statePath, waitingReturn);
    const wakeGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(wakeGuard.status, 0, wakeGuard.stderr);
    const wakeResult = JSON.parse(wakeGuard.stdout);
    assert.equal(wakeResult.action, "WAKE");
    assert.match(wakeResult.incidentId, /^guard-[a-f0-9]{16}$/);
    const wakeAgain = JSON.parse(run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout);
    assert.equal(wakeAgain.incidentId, wakeResult.incidentId);
    await writeFile(statePath, waitingReturn.replace("Incident: none", `Incident: ${wakeResult.incidentId}`));
    const repeatedWake = JSON.parse(run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]).stdout);
    assert.equal(repeatedWake.action, "WAKE");
    const escalatedWake = JSON.parse(run([
      "guard-check", "--state", statePath, "--graph", graphPath,
      "--woken-incident", wakeResult.incidentId, "--json",
    ]).stdout);
    assert.equal(escalatedWake.action, "AUDIT_REQUIRED");
    assert.equal(escalatedWake.incidentId, wakeResult.incidentId);
    assert.equal(escalatedWake.unresolvedWake, true);

    const brokenDod = healthyState.replace(
      "DOD Control Line: accepted visible baseline -> close actor flow -> smoke -> continue",
      "DOD Control Line: <unresolved>",
    );
    await writeFile(statePath, brokenDod);
    const auditGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(auditGuard.status, 0, auditGuard.stderr);
    assert.equal(JSON.parse(auditGuard.stdout).action, "AUDIT_REQUIRED");
    const brokenIncident = JSON.parse(auditGuard.stdout).incidentId;
    const degradedGuard = run([
      "guard-check", "--state", statePath, "--graph", graphPath,
      "--repair-incident", brokenIncident, "--repair-attempts", "1", "--json",
    ]);
    assert.equal(degradedGuard.status, 0, degradedGuard.stderr);
    assert.equal(JSON.parse(degradedGuard.stdout).action, "CONTROL_DEGRADED");
    assert.equal(JSON.parse(degradedGuard.stdout).circuitBroken, true);

    const unownedWork = healthyState.replace("Work origin: PASS", "Work origin: UNOWNED_PROJECT_WORK");
    await writeFile(statePath, unownedWork);
    const unownedGuard = run(["guard-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(unownedGuard.status, 0, unownedGuard.stderr);
    assert.equal(JSON.parse(unownedGuard.stdout).action, "AUDIT_REQUIRED");

    await writeFile(statePath, healthyState);

    const mismatches = [
      [healthyState.replace("| WORK-1 [DOD] — close actor flow | WORKING |", "| WORK-1 [DOD] — close actor flow | PREPARED |"), healthyGraph, /unresolved transition PREPARED/],
      [healthyState.replace("Receipt: gov-7", "Receipt: <missing>"), healthyGraph, /Governor receipt is missing or unresolved/],
      [healthyState.replace("Project Guard: ACTIVE", "Project Guard: LIMITED"), healthyGraph, /Project Guard requires LIMITED/],
      [healthyState.replace("Independent: YES", "Independent: NO"), healthyGraph, /Project Guard is not independently triggered/],
      [healthyState.replace("Trigger: activation", "Trigger: <missing>"), healthyGraph, /Governor trigger is missing or unresolved/],
      [healthyState.replace("Audited incident: none", "Audited incident: <missing>"), healthyGraph, /Governor audit reference is missing or unresolved/],
      [healthyState.replace("Profile: ORCHESTRATOR / maximum / current", "Profile: ORCHESTRATOR / medium / current"), healthyGraph, /orchestrator profile is not explicitly ORCHESTRATOR \/ maximum/],
      [healthyState.replace("Last compaction/context-loss signal: 0 / none", "Last compaction/context-loss signal: 2 / now"), healthyGraph, /independent check required after 2 compaction\/context-loss signals/],
      [healthyState.replace("Work origin: PASS", "Work origin: UNOWNED_PROJECT_WORK"), healthyGraph, /work origin requires UNOWNED_PROJECT_WORK/],
      [healthyState.replace("Accepted evidence owner: durable source", "Accepted evidence owner: <missing>"), healthyGraph, /work origin accepted evidence owner is missing or unresolved/],
      [healthyState.replace("Same-class failures since repair: 0", "Same-class failures since repair: <missing>"), healthyGraph, /same-class failure count is missing or unresolved/],
      [healthyState.replace("Human attention: NONE", "Human attention: PENDING | ID: HUMAN-7 | Request: <missing> | Source: task-7 | Raised: event-7 | Resume after: none"), healthyGraph, /human attention request is missing or unresolved/],
      [healthyState.replace("DOD Control Line: accepted visible baseline -> close actor flow -> smoke -> continue", "DOD Control Line: <unresolved>"), healthyGraph, /DOD Control Line is unresolved/],
      [healthyState.replace("| --- | --- | --- |\n## Detours", "| --- | --- | --- |\n| RET-9 | task-one | SENT |\n## Detours"), healthyGraph, /pending return RET-9 requires reconciliation/],
      [healthyState.replace("| WORK-1 [DOD] — close actor flow | WORKING |", "| WORK-1 [DOD] — close actor flow | OUTCOME_UNKNOWN |"), healthyGraph, /unresolved transition OUTCOME_UNKNOWN/],
      [healthyState.replace("| DET-1 | revisit copy at review | OPEN |", "| DET-1 | revisit copy at review | RETURN_DUE |"), healthyGraph, /detour DET-1 is due for return/],
      [healthyState, healthyGraph.replace("| PRIOR_MISS | prior route drift | avoid parallel route | brief | PASS now | lesson |", "| PRIOR_MISS | prior route drift | avoid parallel route | brief | MISS now | lesson |"), /PRIOR_MISS retrieval probe has not passed/],
      [healthyState, healthyGraph.replace("| --- | --- | --- | --- | --- | --- | --- | --- |\n## Live Retrieval Probes", "| --- | --- | --- | --- | --- | --- | --- | --- |\n| EVT-9 | remember this | old / new / why | ENT-01 | ABSENT | ADD | chat | PENDING |\n## Live Retrieval Probes"), /memory event EVT-9 is still pending/],
      [`${healthyState}stale appended state\n`, healthyGraph, /content exists after end marker/],
    ];

    for (const [state, graph, expected] of mismatches) {
      await writeFile(statePath, state);
      await writeFile(graphPath, graph);
      const result = run(["control-check", "--state", statePath, "--graph", graphPath]);
      assert.equal(result.status, 1);
      assert.match(result.stdout, /Control check: MISMATCH/);
      assert.match(result.stdout, expected);
    }
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("update from a local canonical source preserves project files", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-update-"));
  try {
    await mkdir(path.join(target, ".git"));
    await writeFile(path.join(target, "AGENTS.md"), "# Product\n");
    assert.equal(run(["install", target]).status, 0);

    const projectDoc = path.join(target, "docs/project-only.md");
    await writeFile(projectDoc, "keep\n");

    const update = run(["update", target, "--from", root]);
    assert.equal(update.status, 0, update.stderr);
    assert.equal(await readFile(projectDoc, "utf8"), "keep\n");
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});

test("install refuses target symlinks in managed paths", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-symlink-"));
  const outside = await mkdtemp(path.join(tmpdir(), "vydykhai-outside-"));
  try {
    await mkdir(path.join(target, ".git"));
    await symlink(outside, path.join(target, "docs"));
    const install = run(["install", target]);
    assert.equal(install.status, 1);
    assert.match(install.stderr, /Refusing to write through target symlink/);
  } finally {
    await rm(target, { recursive: true, force: true });
    await rm(outside, { recursive: true, force: true });
  }
});
