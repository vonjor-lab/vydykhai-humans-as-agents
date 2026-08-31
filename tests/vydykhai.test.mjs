import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cli = path.join(root, "scripts/vydykhai.mjs");

function run(args, cwd = root) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
  });
}

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
    assert.equal(lock.installedVersion, "1.21.1");
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
    assert.match(doctor.stdout, /Agent routing: latest-available-flagship \/ role-routed/);
    assert.match(doctor.stdout, /ORCHESTRATOR=maximum-available/);
    assert.match(doctor.stdout, /DISCOVERY=deep-bounded/);
    assert.match(doctor.stdout, /EXECUTION=efficient-bounded/);
    assert.match(doctor.stdout, /Project activation: evidence-backed-project-activation; 8 live checks via project-launch/);
    assert.match(doctor.stdout, /Control loop: governor-audited-event-loop; Project State v2/);
    assert.match(doctor.stdout, /Execution leases: one-work-one-owning-context/);
    assert.match(doctor.stdout, /Task returns: durable-outbox-native-wakeup/);
    assert.match(doctor.stdout, /Rotation: independent-health-gated; independent check after 2 compactions or 24 active hours/);
    assert.match(doctor.stdout, /Memory: project-memory-graph v3; task brief <= 7 executable nodes/);
    assert.match(doctor.stdout, /Action receipts: critical-transition-readback; 7 critical boundaries/);
    assert.match(doctor.stdout, /Tracker: task-contract-with-event-driven-projection/);
    assert.match(doctor.stdout, /Creator: Alexander Rozhnov \(@vonjor-lab\)/);
    assert.match(doctor.stdout, /License: PolyForm-Small-Business-1\.0\.0/);

    const legacyManifestPath = path.join(target, "vydykhai.json");
    const legacyManifest = JSON.parse(await readFile(legacyManifestPath, "utf8"));
    delete legacyManifest.actionReceiptPolicy;
    delete legacyManifest.projectActivationPolicy;
    delete legacyManifest.controlLoopPolicy;
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
    assert.equal(legacyDoctor.status, 0, legacyDoctor.stderr);
    assert.match(legacyDoctor.stdout, /Vydykhai 1\.18\.0/);
    assert.match(legacyDoctor.stdout, /Project activation: not declared by installed version/);
    assert.match(legacyDoctor.stdout, /Control loop: not declared by installed version/);
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
    assert.match(await readFile(corePath, "utf8"), /Version: 1\.21\.1/);
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
  assert.equal(manifest.controlLoopPolicy.policy, "governor-audited-event-loop");
  assert.equal(manifest.controlLoopPolicy.projectStateVersion, 2);
  assert.deepEqual(manifest.controlLoopPolicy.states, ["healthy", "repair", "rotate"]);
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("current-dod-line"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("pending-return-inbox"));
  assert.ok(manifest.controlLoopPolicy.requiredChecks.includes("actual-orchestrator-context"));
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
  assert.deepEqual(manifest.taskReturnPolicy.states, ["written", "sent", "received", "consumed", "routed"]);
  assert.equal(manifest.rotationPolicy.policy, "independent-health-gated");
  assert.equal(manifest.rotationPolicy.maxCompactionsWithoutIndependentCheck, 2);
  assert.equal(manifest.rotationPolicy.sameClassFailureLimit, 2);
  assert.equal(manifest.rotationPolicy.activeReviewHours, 24);
  assert.equal(manifest.defaultScopeFreshnessDays, 7);
  assert.equal(manifest.memoryPolicy.policy, "project-memory-graph");
  assert.equal(manifest.memoryPolicy.graphVersion, 3);
  assert.ok(manifest.memoryPolicy.anchorKinds.includes("entity"));
  assert.ok(manifest.memoryPolicy.nodeTypes.includes("lesson"));
  assert.ok(manifest.memoryPolicy.relationTypes.includes("learned-from"));
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
  assert.equal(manifest.memoryPolicy.taskBriefMaxNodes, 7);
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
  assert.match(core, /complete id mapping is not semantic coverage/);
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
  assert.match(projectState, /Audited event:/);
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
  assert.match(taskHandoff, /Return lifecycle:/);
  assert.match(taskHandoff, /OUTCOME_UNKNOWN/);
  assert.match(taskHandoff, /Consult when:/);
  assert.match(taskHandoff, /Boundary consultation:/);
  assert.match(taskHandoff, /Progress continuity:/);
  assert.match(taskHandoff, /Recipient proof:/);
  assert.match(taskHandoff, /schema\/migration revision/);
  assert.match(taskHandoff, /Artifact disposition:/);
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
  assert.match(orchestratorWorkflow, /side-by-side read-only candidate/);
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
  assert.match(orchestratorWorkflow, /ordinary future-work queries/);
  assert.match(orchestratorWorkflow, /Governor Check/);
  assert.match(orchestratorWorkflow, /EXECUTION_STALLED/);
  assert.match(orchestratorWorkflow, /WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED/);
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
  assert.match(handoff, /first write the complete receipt to the durable task\/tracker outbox/);
});

test("control-check closes DOD, lease, return, detour, and memory transitions", async () => {
  const target = await mkdtemp(path.join(tmpdir(), "vydykhai-control-"));
  const statePath = path.join(target, "state.md");
  const graphPath = path.join(target, "graph.md");
  const healthyState = `<!-- vydykhai:project-state v2 -->
# Project State: Example
Snapshot as of: event-7
## Control Snapshot
Governor: HEALTHY | Receipt: gov-7 | Trigger: dispatch | Audited event: event-7 | Route: deterministic check
Orchestrator health: HEALTHY | Context: current | Profile: ORCHESTRATOR / maximum / current | Last compaction/context-loss signal: 0 / none
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
- consume the next durable event
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
    const healthy = run(["control-check", "--state", statePath, "--graph", graphPath, "--json"]);
    assert.equal(healthy.status, 0, healthy.stderr);
    assert.equal(JSON.parse(healthy.stdout).ok, true);

    const mismatches = [
      [healthyState.replace("| WORK-1 [DOD] — close actor flow | WORKING |", "| WORK-1 [DOD] — close actor flow | PREPARED |"), healthyGraph, /unresolved transition PREPARED/],
      [healthyState.replace("Receipt: gov-7", "Receipt: <missing>"), healthyGraph, /Governor receipt is missing or unresolved/],
      [healthyState.replace("Trigger: dispatch", "Trigger: <missing>"), healthyGraph, /Governor trigger is missing or unresolved/],
      [healthyState.replace("Audited event: event-7", "Audited event: event-6"), healthyGraph, /Governor audited event-6 but current snapshot is event-7/],
      [healthyState.replace("Profile: ORCHESTRATOR / maximum / current", "Profile: ORCHESTRATOR / medium / current"), healthyGraph, /orchestrator profile is not explicitly ORCHESTRATOR \/ maximum/],
      [healthyState.replace("Last compaction/context-loss signal: 0 / none", "Last compaction/context-loss signal: 2 / now"), healthyGraph, /independent check required after 2 compaction\/context-loss signals/],
      [healthyState.replace("Same-class failures since repair: 0", "Same-class failures since repair: <missing>"), healthyGraph, /same-class failure count is missing or unresolved/],
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
