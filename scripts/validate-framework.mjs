#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

async function text(relative) {
  return readFile(path.join(root, relative), "utf8");
}

function fail(message) {
  errors.push(message);
}

function lineCount(value) {
  return value.trimEnd().split("\n").length;
}

const manifest = JSON.parse(await text("vydykhai.json"));
if (manifest.schemaVersion !== 1) fail("vydykhai.json schemaVersion must be 1");
if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) fail("vydykhai.json version must be semantic");
if (!existsSync(path.join(root, "BOOTSTRAP.md"))) fail("BOOTSTRAP.md is missing");
if (manifest.defaultAgentProfile?.modelPolicy !== "latest-available-flagship") {
  fail("Default model policy must be latest-available-flagship");
}
if (manifest.defaultAgentProfile?.reasoningPolicy !== "deepest-bounded") {
  fail("Default reasoning policy must be deepest-bounded");
}
if (manifest.defaultAgentProfile?.reasoningEffort !== "xhigh") {
  fail("Compatibility reasoningEffort must remain xhigh for older updaters");
}
if (manifest.defaultAgentProfile?.refreshDays !== 7) fail("Default agent profile refreshDays must be 7");
if (manifest.agentRoutingPolicy?.policy !== "role-routed") fail("Agent routing policy must be role-routed");
if (manifest.agentRoutingPolicy?.modelPolicy !== "latest-available-flagship") {
  fail("Agent routing model policy must be latest-available-flagship");
}
if (manifest.agentRoutingPolicy?.profiles?.orchestrator?.reasoningPolicy !== "maximum-available") {
  fail("Orchestrator reasoning policy must be maximum-available");
}
if (manifest.agentRoutingPolicy?.profiles?.orchestrator?.preferredEffortWhenAvailable !== "ultra") {
  fail("Orchestrator preferred effort mapping must be ultra");
}
if (manifest.agentRoutingPolicy?.profiles?.discovery?.reasoningPolicy !== "deep-bounded") {
  fail("Discovery reasoning policy must be deep-bounded");
}
if (manifest.agentRoutingPolicy?.profiles?.discovery?.preferredEffortWhenAvailable !== "xhigh") {
  fail("Discovery preferred effort mapping must be xhigh");
}
if (manifest.agentRoutingPolicy?.profiles?.execution?.reasoningPolicy !== "efficient-bounded") {
  fail("Execution reasoning policy must be efficient-bounded");
}
if (manifest.agentRoutingPolicy?.profiles?.execution?.preferredEffortWhenAvailable !== "low") {
  fail("Execution preferred effort mapping must be low");
}
if (manifest.agentRoutingPolicy?.refreshDays !== 7) fail("Agent routing refreshDays must be 7");
if (manifest.orchestratorAdvisoryPolicy?.policy !== "control-only-advisory") {
  fail("Orchestrator advisory policy must be control-only-advisory");
}
for (const field of [
  "control-decision",
  "available-sources",
  "expected-orchestration-output",
  "route-to-focused-context-when",
]) {
  if (!manifest.orchestratorAdvisoryPolicy?.requiredPromptFields?.includes(field)) {
    fail(`Orchestrator advisory policy is missing prompt field: ${field}`);
  }
}
for (const result of ["control-only", "route-to-focused-context"]) {
  if (!manifest.orchestratorAdvisoryPolicy?.results?.includes(result)) {
    fail(`Orchestrator advisory policy is missing result: ${result}`);
  }
}
for (const source of ["human-decision", "durable-source", "focused-context-receipt"]) {
  if (!manifest.orchestratorAdvisoryPolicy?.acceptedProjectEvidenceSources?.includes(source)) {
    fail(`Orchestrator advisory policy is missing project evidence source: ${source}`);
  }
}
if (manifest.orchestratorAdvisoryPolicy?.guardSignal !== "unowned-project-work") {
  fail("Orchestrator advisory policy is missing the unowned-project-work Guard signal");
}
if (manifest.projectActivationPolicy?.policy !== "evidence-backed-project-activation") {
  fail("Project activation policy must be evidence-backed-project-activation");
}
for (const check of [
  "target-repository-and-framework",
  "shared-repo-and-tracker",
  "participant-readiness",
  "coordination-input-route",
  "current-operational-route",
  "compass-and-first-dod",
  "orchestrator-and-return-sync",
  "first-route-and-next-best-action",
]) {
  if (!manifest.projectActivationPolicy?.requiredChecks?.includes(check)) {
    fail(`Project activation policy is missing check: ${check}`);
  }
}
for (const result of ["project-ready", "project-ready-with-limits", "needs-decision", "blocked-by-access"]) {
  if (!manifest.projectActivationPolicy?.results?.includes(result)) {
    fail(`Project activation policy is missing result: ${result}`);
  }
}
if (manifest.defaultScopeFreshnessDays !== 7) fail("Default scope freshness must be 7 days");
if (manifest.controlLoopPolicy?.policy !== "governor-audited-event-loop") {
  fail("Control loop policy must use governor-audited-event-loop");
}
if (manifest.controlLoopPolicy?.projectStateVersion !== 2) fail("Project State schema must be version 2");
for (const state of ["healthy", "repair", "rotate"]) {
  if (!manifest.controlLoopPolicy?.states?.includes(state)) fail(`Control loop policy is missing state: ${state}`);
}
for (const check of [
  "current-dod-line",
  "execution-leases",
  "pending-return-inbox",
  "detour-return-gates",
  "memory-coverage",
  "actual-orchestrator-context",
  "work-origin",
  "orchestrator-health",
  "human-attention-continuity",
]) {
  if (!manifest.controlLoopPolicy?.requiredChecks?.includes(check)) {
    fail(`Control loop policy is missing check: ${check}`);
  }
}
if (manifest.controlStatePublicationPolicy?.policy !== "validate-publish-readback-or-restore") {
  fail("Control state publication must validate, publish, read back, or restore");
}
for (const stage of [
  "render-candidate",
  "validate-candidate",
  "publish-once",
  "readback-exact",
  "restore-last-accepted-on-mismatch",
]) {
  if (!manifest.controlStatePublicationPolicy?.stages?.includes(stage)) {
    fail(`Control state publication is missing stage: ${stage}`);
  }
}
for (const evidence of [
  "accepted-state-reference",
  "candidate-state-sha256",
  "candidate-validation",
  "readback-state-sha256",
  "readback-validation",
]) {
  if (!manifest.controlStatePublicationPolicy?.requiredEvidence?.includes(evidence)) {
    fail(`Control state publication is missing evidence: ${evidence}`);
  }
}
if (manifest.controlStatePublicationPolicy?.failedWriteState !== "never-current") {
  fail("A failed control-state write must never become current");
}
if (manifest.projectGuardPolicy?.policy !== "external-event-and-schedule") {
  fail("Project Guard policy must use external-event-and-schedule");
}
if (
  manifest.projectGuardPolicy?.defaultIntervalMinutes !== 30 ||
  manifest.projectGuardPolicy?.healthyPath !== "deterministic-no-model" ||
  manifest.projectGuardPolicy?.anomalyProfile !== "maximum-available"
) {
  fail("Project Guard cost or anomaly profile is invalid");
}
if (
  manifest.projectGuardPolicy?.incidentIdentity !== "semantic-condition-set" ||
  manifest.projectGuardPolicy?.snapshotHashRole !== "evidence-only" ||
  manifest.projectGuardPolicy?.acceptedSameIncidentAction !== "silent-no-model" ||
  manifest.projectGuardPolicy?.changedConditionAction !== "audit-required"
) {
  fail("Project Guard incident identity or deduplication policy is invalid");
}
for (const action of ["noop", "wake", "audit-required"]) {
  if (!manifest.projectGuardPolicy?.actions?.includes(action)) fail(`Project Guard is missing action: ${action}`);
}
for (const capability of [
  "independent-trigger",
  "durable-state-read",
  "active-context-read",
  "orchestrator-work-origin-read",
  "native-wakeup",
  "fresh-context-start",
  "idempotent-incident",
  "pending-human-action-read",
  "durable-outbox-discovery",
]) {
  if (!manifest.projectGuardPolicy?.requiredCapabilities?.includes(capability)) {
    fail(`Project Guard is missing capability: ${capability}`);
  }
}
if (manifest.humanAttentionPolicy?.policy !== "durable-single-manager-attention") {
  fail("Human attention policy must use durable-single-manager-attention");
}
for (const state of ["none", "pending", "resurface-due"]) {
  if (!manifest.humanAttentionPolicy?.states?.includes(state)) fail(`Human attention policy is missing state: ${state}`);
}
for (const field of ["id", "request", "source", "raised-at", "resume-after"]) {
  if (!manifest.humanAttentionPolicy?.requiredFields?.includes(field)) {
    fail(`Human attention policy is missing field: ${field}`);
  }
}
if (
  manifest.humanAttentionPolicy?.unchangedGuardAction !== "silent" ||
  manifest.humanAttentionPolicy?.incidentDelivery !== "single-bounded-wakeup" ||
  manifest.humanAttentionPolicy?.completion !== "restore-or-explicitly-supersede" ||
  manifest.humanAttentionPolicy?.orchestratorAvailability !== "release-after-observable-dispatch"
) {
  fail("Human attention delivery or orchestrator availability policy is invalid");
}
if (manifest.continuationPolicy?.policy !== "evidence-backed-next-action" ||
    JSON.stringify(manifest.continuationPolicy.states) !== JSON.stringify(["ready", "working", "waiting"]) ||
    manifest.continuationPolicy.activityMaxAgeSeconds !== 300 ||
    manifest.continuationPolicy.interruption !== "resume-or-explicitly-supersede" ||
    manifest.continuationPolicy.turnRelease !== "productive-handoff-or-concrete-wait" ||
    manifest.continuationPolicy.unknownActivity !== "limited-not-stopped" ||
    manifest.continuationPolicy.wakeup !== "reconcile-existing-owner-never-duplicate") {
  fail("Production continuation must retain the next action and use bounded fresh activity without duplicate work");
}
if (manifest.executionLeasePolicy?.policy !== "one-work-one-owning-context") {
  fail("Execution lease policy must use one-work-one-owning-context");
}
for (const state of ["prepared", "started", "working", "waiting", "returned", "closed", "outcome-unknown"]) {
  if (!manifest.executionLeasePolicy?.states?.includes(state)) fail(`Execution lease policy is missing state: ${state}`);
}
for (const field of ["work-id", "owner-and-context", "project-and-repository", "worktree-and-branch", "baseline-and-candidate", "role-and-profile", "dod-contribution", "next-receipt-or-review-by", "return-route"]) {
  if (!manifest.executionLeasePolicy?.requiredFields?.includes(field)) {
    fail(`Execution lease policy is missing field: ${field}`);
  }
}
if (manifest.taskReturnPolicy?.policy !== "durable-outbox-native-wakeup") {
  fail("Task return policy must use durable-outbox-native-wakeup");
}
if (
  manifest.taskReturnPolicy?.terminalReceipt !== "return-sync" ||
  manifest.taskReturnPolicy?.actionReceiptSubstitutes !== false ||
  manifest.taskReturnPolicy?.nativeWakeup !== "required-attempt" ||
  manifest.taskReturnPolicy?.nativeThreadRead !== "non-authoritative" ||
  manifest.taskReturnPolicy?.guardFallback !== "discover-unrouted-durable-return"
) {
  fail("Task return terminal receipt or durable fallback is invalid");
}
if (manifest.taskReturnPolicy?.machineFormat !== "marked-return-sync-and-route-v1") {
  fail("Task return machine format must pair marked Return Sync and Return Route receipts");
}
if (manifest.taskReturnPolicy?.adapterParser !== "scripts/vydykhai.mjs#validateDurableOutbox") {
  fail("Task return adapters must reuse the canonical parser");
}
for (const check of [
  "real-emitted-return-format",
  "matching-route-receipt",
  "scheduled-noop-after-routing",
  "malformed-or-mismatched-route-audits",
  "older-pending-survives-newer-routed",
  "bounded-source-refresh-preserves-edits-and-pending",
  "pending-wakeup-survives-unrelated-change-and-recipient-handoff",
]) {
  if (!manifest.taskReturnPolicy?.adapterAcceptance?.includes(check)) {
    fail(`Task return adapter acceptance is missing: ${check}`);
  }
}
for (const state of ["written", "sent", "received", "consumed", "routed"]) {
  if (!manifest.taskReturnPolicy?.states?.includes(state)) fail(`Task return policy is missing state: ${state}`);
}
for (const trigger of ["return-sync-written", "orchestrator-cold-path", "governor-check", "active-timer"]) {
  if (!manifest.taskReturnPolicy?.reconcileOn?.includes(trigger)) fail(`Task return policy is missing reconciliation: ${trigger}`);
}
if (manifest.rotationPolicy?.policy !== "independent-health-gated") {
  fail("Rotation policy must use independent-health-gated");
}
if (manifest.rotationPolicy?.maxCompactionsWithoutIndependentCheck !== 2) {
  fail("Rotation policy must check independently after two compactions");
}
if (manifest.rotationPolicy?.sameClassFailureLimit !== 2 || manifest.rotationPolicy?.activeReviewHours !== 24) {
  fail("Rotation policy failure or active-review threshold is invalid");
}
if (!manifest.rotationPolicy?.hardSignals?.includes("unowned-project-work-after-repair")) {
  fail("Rotation policy is missing repeated unowned-project-work");
}
if (manifest.memoryPolicy?.policy !== "project-memory-graph") {
  fail("Memory policy must use the Project Memory Graph");
}
if (manifest.memoryPolicy?.graphVersion !== 3) fail("Project Memory Graph schema must be version 3");
for (const kind of ["outcome", "actor", "entity", "surface", "contract", "data", "operation"]) {
  if (!manifest.memoryPolicy?.anchorKinds?.includes(kind)) fail(`Memory policy is missing anchor kind: ${kind}`);
}
if (!manifest.memoryPolicy?.nodeTypes?.includes("lesson")) fail("Memory policy is missing LESSON nodes");
for (const relation of ["about", "requires", "constrains", "supersedes", "conflicts", "learned-from", "verified-by"]) {
  if (!manifest.memoryPolicy?.relationTypes?.includes(relation)) fail(`Memory policy is missing relation: ${relation}`);
}
for (const miss of ["absent", "retrieval-miss", "application-miss", "verification-miss"]) {
  if (!manifest.memoryPolicy?.memoryMissTypes?.includes(miss)) fail(`Memory policy is missing miss type: ${miss}`);
}
for (const field of [
  "owner",
  "protected-reference",
  "environment-and-scope",
  "allowed-non-destructive-route",
  "last-safe-check",
  "expiry-or-reentry-condition",
]) {
  if (!manifest.memoryPolicy?.protectedPointerRequiredFields?.includes(field)) {
    fail(`Memory policy is missing protected pointer field: ${field}`);
  }
}
for (const field of [
  "current-meaning",
  "source",
  "capability-aliases-and-trigger",
  "applicability-timing-and-checkpoint",
  "pending-human-question",
]) {
  if (!manifest.memoryPolicy?.recallCommitmentRequiredFields?.includes(field)) {
    fail(`Memory policy is missing recall commitment field: ${field}`);
  }
}
if (manifest.memoryPolicy?.taskBriefMaxNodes !== 7) fail("Task Memory Brief maximum must be 7 nodes");
if (manifest.actionReceiptPolicy?.policy !== "critical-transition-readback") {
  fail("Action Receipt policy must use critical-transition-readback");
}
for (const boundary of ["task-launch", "task-resume", "return-sync", "memory-reflection-and-detour", "protected-access", "acceptance-and-live-action", "side-effect-reconciliation"]) {
  if (!manifest.actionReceiptPolicy?.boundaries?.includes(boundary)) {
    fail(`Action Receipt policy is missing boundary: ${boundary}`);
  }
}
for (const [boundary, owner] of Object.entries({
  "task-launch": "orchestrator",
  "task-resume": "orchestrator",
  "return-sync": "orchestrator",
  "memory-reflection-and-detour": "orchestrator",
  "protected-access": "acting-context",
  "acceptance-and-live-action": "owning-task",
  "side-effect-reconciliation": "owning-task",
})) {
  if (manifest.actionReceiptPolicy?.boundaryOwners?.[boundary] !== owner) {
    fail(`Action Receipt boundary ${boundary} must be owned by ${owner}`);
  }
}
for (const field of ["trigger", "retrieved-rule", "expected-action", "observed-action", "evidence", "result"]) {
  if (!manifest.actionReceiptPolicy?.fields?.includes(field)) fail(`Action Receipt policy is missing field: ${field}`);
}
for (const result of ["pass", "mismatch", "unverified", "outcome-unknown"]) {
  if (!manifest.actionReceiptPolicy?.results?.includes(result)) fail(`Action Receipt policy is missing result: ${result}`);
}
if (manifest.trackerPolicy?.policy !== "task-contract-with-event-driven-projection") {
  fail("Tracker policy must use the event-driven task projection");
}
if (!String(manifest.bootstrap || "").endsWith("/BOOTSTRAP.md")) fail("Manifest bootstrap URL is invalid");
if (
  manifest.creator?.name !== "Alexander Rozhnov" ||
  manifest.creator?.nameRu !== "Александр Рожнов" ||
  manifest.creator?.github !== "vonjor-lab"
) {
  fail("Manifest creator metadata is invalid");
}
if (manifest.license !== "PolyForm-Small-Business-1.0.0") fail("Manifest license is invalid");
if (manifest.canonicalSource !== "https://github.com/vonjor-lab/vydykhai-humans-as-agents") {
  fail("Manifest canonical source is invalid");
}
if (!String(manifest.requiredNotice || "").startsWith("Required Notice:")) {
  fail("Manifest required notice is invalid");
}

for (const managedPath of manifest.managedPaths || []) {
  if (!existsSync(path.join(root, managedPath))) fail(`Managed path is missing: ${managedPath}`);
}
if (manifest.managedPaths.includes("LICENSE.md") || manifest.managedPaths.includes("NOTICE.md")) {
  fail("Root legal files must not overwrite a target project's own license or notice");
}
if (!manifest.managedPaths.includes("docs/VYDYKHAI_NOTICE.md")) {
  fail("Managed framework notice is missing from the manifest");
}
if (!manifest.managedPaths.includes("docs/workflows") || manifest.managedPaths.includes("docs/codex-workflows")) {
  fail("Managed workflows must use the environment-neutral docs/workflows path");
}

const coreEn = await text("docs/FRAMEWORK.md");
const coreRu = await text("docs/FRAMEWORK_RU.md");
const bootstrap = await text("BOOTSTRAP.md");
const changelog = await text("docs/COLLABORATION_FRAMEWORK_CHANGELOG.md");
const readme = await text("README.md");
const compatibilityEn = await text("docs/COLLABORATION_FRAMEWORK_2026-06-10.md");
const compatibilityRu = await text("docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md");
const projectStateTemplate = await text("docs/workflows/project-state-template.md");
const projectMemoryGraphTemplate = await text("docs/workflows/project-memory-graph-template.md");
const ideaMemoryTemplate = await text("docs/workflows/idea-memory-template.md");
const intentTrailTemplate = await text("docs/workflows/intent-trail-template.md");
const orchestratorWorkflow = await text("docs/workflows/framework-orchestrator.md");
const projectGuardWorkflow = await text("docs/workflows/project-guard.md");
const projectLaunchWorkflow = await text("docs/workflows/project-launch.md");
const dailyAlignmentWorkflow = await text("docs/workflows/daily-alignment.md");
const taskHandoffTemplate = await text("docs/workflows/task-context-handoff-template.md");
const acceptWorkflow = await text("docs/workflows/accept-work.md");
const agentsCore = await text("docs/AGENTS_CORE.md");
const orchestratorSkill = await text(".agents/skills/framework-orchestrator/SKILL.md");
const projectLaunchSkill = await text(".agents/skills/project-launch/SKILL.md");
const dailyAlignmentSkill = await text(".agents/skills/daily-alignment/SKILL.md");
const acceptWorkSkill = await text(".agents/skills/accept-work/SKILL.md");
const license = await text("LICENSE.md");
const notice = await text("NOTICE.md");
const managedNotice = await text("docs/VYDYKHAI_NOTICE.md");
const citation = await text("CITATION.cff");
const provenance = await text("docs/PROVENANCE.md");
if (!coreEn.includes(`Version: ${manifest.version}`)) fail("English core version differs from manifest");
if (!coreRu.includes(`Версия: ${manifest.version}`)) fail("Russian core version differs from manifest");
if (!coreEn.includes("DOD Focus And Project Memory Graph")) {
  fail("English core is missing DOD Focus and Project Memory Graph");
}
if (!coreRu.includes("Фокус на DOD и Project Memory Graph")) {
  fail("Russian core is missing DOD Focus and Project Memory Graph");
}
if (!coreEn.includes("Proactive Guardrails") || !coreRu.includes("Проактивные правила")) {
  fail("Core is missing Proactive Guardrails");
}
if (
  !coreEn.includes("The orchestrator decides what, why, when, and who") ||
  !coreRu.includes("Оркестратор решает, что, зачем, когда и кем") ||
  !coreEn.includes("hot path") ||
  !coreRu.includes("hot path") ||
  !coreEn.includes("One accepted increment has one owning execution context") ||
  !coreRu.includes("У одного принятого инкремента есть один owning execution context")
) {
  fail("Core is missing control/execution ownership or the lightweight continue path");
}
if (
  !coreEn.includes("Governor Check") ||
  !coreRu.includes("Governor Check") ||
  !coreEn.includes("DOD Control Line") ||
  !coreRu.includes("DOD Control Line") ||
  !coreEn.includes("Execution Lease") ||
  !coreRu.includes("Execution Lease") ||
  !coreEn.includes("durable task/tracker outbox") ||
  !coreRu.includes("durable task/tracker outbox") ||
  !coreEn.includes("EXECUTION_STALLED") ||
  !coreRu.includes("EXECUTION_STALLED")
) {
  fail("Core is missing the independently checked DOD, lease, or durable-return loop");
}
if (!coreEn.includes("Scope Freshness") || !coreRu.includes("Актуальность scope")) {
  fail("Core is missing Scope Freshness");
}
if (
  !coreEn.includes("Work Hygiene Check") ||
  !coreRu.includes("Work Hygiene Check") ||
  !coreEn.includes("ACTIVE`, `WAITING`, `FINISH`, `SALVAGE`, or `RETIRE") ||
  !coreRu.includes("ACTIVE`, `WAITING`, `FINISH`, `SALVAGE` или `RETIRE")
) {
  fail("Core is missing Work Hygiene Check or its artifact dispositions");
}
if (!coreEn.includes("One Success Line") || !coreRu.includes("Одна линия успеха")) {
  fail("Core is missing One Success Line");
}
if (!coreEn.includes("Shared Sync Contract") || !coreRu.includes("Контракт общей синхронизации")) {
  fail("Core is missing Shared Sync Contract");
}
if (
  !coreEn.includes("Project Activation Receipt") ||
  !coreRu.includes("Project Activation Receipt") ||
  !coreEn.includes("PROJECT_READY_WITH_LIMITS") ||
  !coreRu.includes("PROJECT_READY_WITH_LIMITS")
) {
  fail("Core is missing evidence-backed project activation");
}
if (
  !coreEn.includes("Role-Routed Agent Profiles") ||
  !coreRu.includes("Профили по роли") ||
  !coreEn.includes("Low-ready") ||
  !coreRu.includes("Low-ready")
) {
  fail("Core is missing role-routed reasoning or the Low-ready gate");
}
if (!coreEn.includes("Expansion Check") || !coreRu.includes("Проверка разрастания")) {
  fail("Core is missing Expansion Check");
}
if (
  !coreEn.includes("<work-id> [<track>] [<mode>] — <short outcome>") ||
  !coreRu.includes("<work-id> [<track>] [<mode>] — <короткий результат>") ||
  !coreEn.includes("never a bare task, PR, or context number") ||
  !coreRu.includes("Голые номера task, PR или context не используются")
) {
  fail("Core is missing canonical context names or meaningful human-facing work references");
}
if (!coreEn.includes("CONSULT") || !coreRu.includes("CONSULT")) {
  fail("Core is missing boundary consultation");
}
if (
  !coreEn.includes("Touch Set") ||
  !coreRu.includes("Touch Set") ||
  !coreEn.includes("Memory Brief") ||
  !coreRu.includes("Memory Brief") ||
  !coreEn.includes("MEMORY_COVERAGE_GAP") ||
  !coreRu.includes("MEMORY_COVERAGE_GAP") ||
  !coreEn.includes("RETRIEVAL_MISS") ||
  !coreRu.includes("RETRIEVAL_MISS") ||
  !coreEn.includes("Because / Apply / Avoid / Verify / Source") ||
  !coreRu.includes("Because / Apply / Avoid / Verify / Source") ||
  !coreEn.includes("recall commitment") ||
  !coreRu.includes("обязательством памяти") ||
  !coreEn.includes("complete id mapping is not semantic coverage") ||
  !coreRu.includes("полная карта id не доказывает semantic coverage")
) {
  fail("Core is missing executable memory retrieval or miss reflection");
}
for (const value of [
  "<!-- vydykhai:project-state v2 -->",
  "Project Memory Graph:",
  "Last memory delta:",
  "Tracker projection:",
  "Operational sources:",
  "Shared Sync:",
  "Governor:",
  "Project Guard:",
  "Human attention:",
  "Audited event:",
  "Orchestrator health:",
  "Last independent check:",
  "DOD Control Line:",
  "Memory coverage:",
  "Agent routing:",
  "Coordination inputs:",
  "Environment adapter:",
  "Orchestrator rotation:",
  "Scope freshness:",
  "## Execution Leases",
  "## Pending Return Inbox",
  "## Detours And Recall",
]) {
  if (!projectStateTemplate.includes(value)) fail(`Project State is missing control field: ${value}`);
}
if (!projectStateTemplate.includes("## Project Activation Receipt")) {
  fail("Project State is missing the Project Activation Receipt");
}
if (
  !projectStateTemplate.includes("Readiness receipt") ||
  !projectStateTemplate.includes("Decision scope / backup") ||
  !projectStateTemplate.includes("Active orchestrator / agent environment")
) {
  fail("Project State is missing participant role or self-readiness evidence");
}
if (!projectStateTemplate.includes("Baseline -> Candidate")) fail("Project State is missing the Success Line pointer");
if (!projectStateTemplate.includes("Task return mapping:") || !projectStateTemplate.includes("WRITTEN / SENT / RECEIVED / CONSUMED")) {
  fail("Project State is missing durable task return state");
}
if (!projectStateTemplate.includes("PREPARED / STARTED / WORKING / WAITING / RETURNED / CLOSED / OUTCOME_UNKNOWN")) {
  fail("Project State is missing execution lease states");
}
if (!projectStateTemplate.includes("RESURFACE_DUE") || !projectStateTemplate.includes("explicitly supersede")) {
  fail("Project State is missing durable human attention continuity");
}
if (
  !projectStateTemplate.includes("Snapshot as of:") ||
  !projectStateTemplate.includes("Rebuild its body atomically") ||
  !projectStateTemplate.includes("Render and validate a complete Candidate") ||
  !projectStateTemplate.includes("--expect-state-sha") ||
  !projectStateTemplate.includes("restore and verify the exact last accepted body")
) {
  fail("Project State is missing atomic current-snapshot hygiene");
}
if (
  !projectStateTemplate.includes("<!-- vydykhai:return-route v1 -->") ||
  !projectStateTemplate.includes("Return lifecycle: RECEIVED -> CONSUMED -> ROUTED") ||
  !taskHandoffTemplate.includes("<!-- vydykhai:return-sync v1 -->") ||
  !taskHandoffTemplate.includes("<!-- vydykhai:return-sync:end -->")
) {
  fail("Return Sync and Return Route machine-readable formats are incomplete");
}
if ((projectStateTemplate.match(/^## Next-Best-Action$/gm) || []).length !== 1) {
  fail("Project State must contain exactly one Next-Best-Action section");
}
if (!projectStateTemplate.includes("Latest seen:") || !projectStateTemplate.includes("Update:")) {
  fail("Project State is missing framework update discovery state");
}
if (!ideaMemoryTemplate.includes("Idea Memory is not a backlog")) fail("Idea Memory migration template is missing its scope guard");
if (!ideaMemoryTemplate.includes("legacy/read-only")) fail("Idea Memory migration does not end in read-only evidence");
if (!ideaMemoryTemplate.includes("Freeze new writes")) fail("Idea Memory migration may keep accepting new writes");
if (
  !ideaMemoryTemplate.includes("Owner question / timing") ||
  !ideaMemoryTemplate.includes("Id coverage alone is insufficient")
) {
  fail("Idea Memory migration may lose recall commitments during semantic compression");
}
if (
  !intentTrailTemplate.includes("migration") ||
  !intentTrailTemplate.includes("Freeze new writes") ||
  !intentTrailTemplate.includes("Touch keys") ||
  !intentTrailTemplate.includes("Never store credentials")
) {
  fail("Intent Trail migration is missing lineage, retrieval, or secret-safety rules");
}
if (
  !projectMemoryGraphTemplate.includes("INVARIANT") ||
  !projectMemoryGraphTemplate.includes("DECISION") ||
  !projectMemoryGraphTemplate.includes("LESSON") ||
  !projectMemoryGraphTemplate.includes("IDEA") ||
  !projectMemoryGraphTemplate.includes("POINTER") ||
  !projectMemoryGraphTemplate.includes("Anchor Index") ||
  !projectMemoryGraphTemplate.includes("Apply:") ||
  !projectMemoryGraphTemplate.includes("Avoid:") ||
  !projectMemoryGraphTemplate.includes("Memory Reflection") ||
  !projectMemoryGraphTemplate.includes("Pending Memory Events") ||
  !projectMemoryGraphTemplate.includes("Live Retrieval Probes") ||
  !projectMemoryGraphTemplate.includes("CURRENT") ||
  !projectMemoryGraphTemplate.includes("NEXT") ||
  !projectMemoryGraphTemplate.includes("PRIOR_MISS") ||
  !projectMemoryGraphTemplate.includes("RETRIEVAL_MISS") ||
  !projectMemoryGraphTemplate.includes("Watermark:") ||
  !projectMemoryGraphTemplate.includes("Legacy Source Map") ||
  !projectMemoryGraphTemplate.includes("no more than seven executable") ||
  !projectMemoryGraphTemplate.includes("Protected pointer (POINTER only)") ||
  !projectMemoryGraphTemplate.includes("Owner gate:") ||
  !projectMemoryGraphTemplate.includes("Raw trigger") ||
  !projectMemoryGraphTemplate.includes("Historical reconstruction may repair the node but is not a successful current-memory lookup") ||
  !projectMemoryGraphTemplate.includes("zero secret read") ||
  !projectMemoryGraphTemplate.includes("Never store credentials")
) {
  fail("Project Memory Graph is missing anchors, atomic nodes, reflection, executable retrieval, evaluation, lineage, or secret-safety rules");
}
if (!orchestratorWorkflow.includes("Return Sync")) fail("Orchestrator workflow is missing closed-loop task return");
if (
  !projectLaunchWorkflow.includes("bounded read-only memory backfill") ||
  !projectLaunchSkill.includes("bounded read-only memory backfill") ||
  !projectLaunchWorkflow.includes("ordinary future-work questions")
) {
  fail("Existing-project launch is missing economical historical memory reconciliation");
}
if (
  !bootstrap.includes("Project Activation Receipt") ||
  !bootstrap.includes("Project State v2") ||
  !bootstrap.includes("Project Memory Graph v3") ||
  !bootstrap.includes("control-check") ||
  !bootstrap.includes("guard-check") ||
  !bootstrap.includes("Project Guard") ||
  !bootstrap.includes("one machine cannot certify another") ||
  !projectLaunchWorkflow.includes("doctor` proves framework integrity only") ||
  !projectLaunchWorkflow.includes("Never create disposable probe issues") ||
  !projectLaunchWorkflow.includes("Operations for the first DOD") ||
  !projectLaunchWorkflow.includes("current deployed baseline or revision") ||
  !projectLaunchWorkflow.includes("never by leaving two active contexts") ||
  !projectLaunchWorkflow.includes("PROJECT_READY_WITH_LIMITS") ||
  !projectLaunchWorkflow.includes("independent scheduler") ||
  !projectLaunchWorkflow.includes("Project Guard") ||
  !projectLaunchSkill.includes("one machine cannot certify another") ||
  !projectLaunchSkill.includes("Project Guard") ||
  !projectLaunchSkill.includes("never leave two active contexts") ||
  !orchestratorSkill.includes("Project Activation Receipt") ||
  !orchestratorWorkflow.includes("Project Activation gates pass")
) {
  fail("Project activation is missing live evidence, participant ownership, or first-dispatch enforcement");
}
if (
  !taskHandoffTemplate.includes("Role: EXECUTION") ||
  !taskHandoffTemplate.includes("Agent profile: EXECUTION") ||
  !taskHandoffTemplate.includes("Execution Lease:") ||
  !taskHandoffTemplate.includes("DOD Control Line contribution:") ||
  !taskHandoffTemplate.includes("Continue from:") ||
  !taskHandoffTemplate.includes("Applicable Memory Brief:") ||
  !taskHandoffTemplate.includes("Authority / safety envelope:") ||
  !taskHandoffTemplate.includes("Consult when:") ||
  !taskHandoffTemplate.includes("Return triggers:") ||
  !taskHandoffTemplate.includes("Learning / approach evidence:") ||
  !taskHandoffTemplate.includes("Memory Brief result:") ||
  !taskHandoffTemplate.includes("Memory candidates:") ||
  !taskHandoffTemplate.includes("Artifact disposition:") ||
  !taskHandoffTemplate.includes("Return receipt id:") ||
  !taskHandoffTemplate.includes("Return lifecycle:") ||
  !taskHandoffTemplate.includes("OUTCOME_UNKNOWN") ||
  !taskHandoffTemplate.includes("Boundary consultation:") ||
  !taskHandoffTemplate.includes("Progress continuity:") ||
  !taskHandoffTemplate.includes("Recipient proof:")
) {
  fail("Task contract is missing execution, continuation, safety, return, memory, or receipt fields");
}
const startupContract = taskHandoffTemplate.split("## Startup")[1]?.split("## Execution Rules")[0] || "";
if (startupContract.includes("Touch Set:") || startupContract.includes("Project State:")) {
  fail("Task startup leaks project-wide orchestration state");
}
if (
  !taskHandoffTemplate.includes('Do not run `$project-launch`, `$start-work`, `$daily-alignment`, or `$framework-orchestrator` here') ||
  !taskHandoffTemplate.includes("Do not send routine progress")
) {
  fail("Task contract is missing the execution-only hot path");
}
if (!orchestratorWorkflow.includes("Boundary consultation (`CONSULT`)")) {
  fail("Orchestrator workflow is missing boundary consultation");
}
if (
  !orchestratorWorkflow.includes("Work Hygiene Check") ||
  !orchestratorWorkflow.includes("one machine cannot certify the team") ||
  !orchestratorSkill.includes("Work Hygiene Check") ||
  !projectStateTemplate.includes("Work hygiene:") ||
  !acceptWorkflow.includes("Artifact disposition") ||
  !acceptWorkSkill.includes("Artifact disposition")
) {
  fail("Framework is missing work-hygiene ownership, state, or terminal disposition rules");
}
if (
  !orchestratorWorkflow.includes("Choose Hot Or Cold Path") ||
  !orchestratorWorkflow.includes("Do not run Daily Alignment") ||
  !orchestratorWorkflow.includes("Material external delta") ||
  !orchestratorWorkflow.includes("Do not wake unaffected work")
) {
  fail("Orchestrator workflow is missing hot-path continuity or targeted external-delta routing");
}
if (
  !orchestratorWorkflow.includes("Governor Check") ||
  !orchestratorWorkflow.includes("`HEALTHY`, `REPAIR`, or `ROTATE`") ||
  !orchestratorWorkflow.includes("DOD Control Line") ||
  !orchestratorWorkflow.includes("Execution Lease") ||
  !orchestratorWorkflow.includes("`PREPARED` lease") ||
  !orchestratorWorkflow.includes("first safe observable action") ||
  !orchestratorWorkflow.includes("EXECUTION_STALLED") ||
  !orchestratorWorkflow.includes("Pending Return Inbox") ||
  !orchestratorWorkflow.includes("write one marked terminal Return Sync to the durable outbox") ||
  !orchestratorWorkflow.includes("An Action Receipt never substitutes for terminal Return Sync") ||
  !orchestratorWorkflow.includes("WRITTEN -> SENT -> RECEIVED -> CONSUMED -> ROUTED") ||
  !orchestratorWorkflow.includes("OUTCOME_UNKNOWN") ||
  !orchestratorWorkflow.includes("detour")
) {
  fail("Orchestrator workflow is missing the closed Governor, lease, DOD, detour, or return loop");
}
if (
  !projectGuardWorkflow.includes("operation, not a permanent agent or conversation") ||
  !projectGuardWorkflow.includes("`NOOP`") ||
  !projectGuardWorkflow.includes("`WAKE`") ||
  !projectGuardWorkflow.includes("`AUDIT_REQUIRED`") ||
  !projectGuardWorkflow.includes("fresh ephemeral evaluator") ||
  !projectGuardWorkflow.includes("idempotent incident") ||
  !projectGuardWorkflow.includes("newer human command with no observable action") ||
  !projectGuardWorkflow.includes("UNOWNED_PROJECT_WORK") ||
  !projectGuardWorkflow.includes("CONTROL_ONLY") ||
  !projectGuardWorkflow.includes("Pending Human Action") ||
  !projectGuardWorkflow.includes("restore or explicitly supersede") ||
  !projectGuardWorkflow.includes("must not wake the orchestrator") ||
  !projectGuardWorkflow.includes("discover newly written Return Sync receipts directly from the durable outbox") ||
  !projectGuardWorkflow.includes("native task or thread read is empty") ||
  !projectGuardWorkflow.includes("semantic incident id") ||
  !projectGuardWorkflow.includes("not the snapshot hash") ||
  !projectGuardWorkflow.includes("two real boundary tests") ||
  !projectGuardWorkflow.includes("no queued message, and no model call") ||
  !projectGuardWorkflow.includes("focused service task") ||
  !orchestratorWorkflow.includes("external Project Guard") ||
  !orchestratorWorkflow.includes("productive handoff or concrete wait") ||
  !projectGuardWorkflow.includes("--activity") ||
  !orchestratorSkill.includes("production-continuation.md") ||
  !orchestratorSkill.includes("project-owned Project Guard") ||
  !orchestratorSkill.includes("semantic condition set") ||
  !orchestratorSkill.includes("focused service task") ||
  !orchestratorSkill.includes("Pending Human Action")
) {
  fail("Project Guard is missing independent liveness, silent healthy path, attention continuity, or anomaly escalation");
}
if (
  !orchestratorWorkflow.includes("derive a Touch Set") ||
  !orchestratorWorkflow.includes("Memory Brief") ||
  !orchestratorWorkflow.includes("graph watermark") ||
  !orchestratorWorkflow.includes("tracker projection") ||
  !orchestratorWorkflow.includes("representative current, upcoming, and prior-miss Touch Sets") ||
  !orchestratorWorkflow.includes("Memory Reflection") ||
  !orchestratorWorkflow.includes("memory-reflection/detour receipts") ||
  !orchestratorWorkflow.includes("APPLICATION_MISS") ||
  !orchestratorWorkflow.includes("side-by-side read-only candidate") ||
  !orchestratorWorkflow.includes("non-destructive access check") ||
  !orchestratorWorkflow.includes("last safe check time/result/source") ||
  !orchestratorWorkflow.includes("MEMORY_COVERAGE_GAP / BLOCKED") ||
  !orchestratorWorkflow.includes("Action Receipt") ||
  !orchestratorWorkflow.includes("Only `PASS` closes the transition") ||
  !orchestratorWorkflow.includes("stale healthy receipt cannot close a newer triggered transition") ||
  !orchestratorWorkflow.includes("canonical title plus actual link, role/profile, base, and route")
) {
  fail("Orchestrator workflow is missing memory retrieval or rotation proof");
}
if (
  !orchestratorWorkflow.includes("PR #<pr> → <canonical work reference>") ||
  !orchestratorWorkflow.includes("Bare task, PR, and context numbers are not meaningful references") ||
  !orchestratorSkill.includes("Never substitute a PR or context id for work identity") ||
  !projectLaunchWorkflow.includes("[ORCHESTRATOR] <project> — Vydykhai <version>") ||
  !projectLaunchSkill.includes("[ORCHESTRATOR] <project> — Vydykhai <version>") ||
  !taskHandoffTemplate.includes("Title: <work-id> [<track>] [<mode>] — <short outcome")
) {
  fail("Context naming or human-facing reference contract is incomplete");
}
if (
  !orchestratorWorkflow.includes("[FW <version>] [SYSTEM] [MAINT] — Adopt") ||
  !orchestratorWorkflow.includes("[GUARD <incident>] [SYSTEM] [MAINT] — Repair control loop") ||
  !orchestratorWorkflow.includes("never reuse the Project State issue") ||
  !projectGuardWorkflow.includes("Project-goal task titles remain") ||
  !projectLaunchWorkflow.includes("Preserve this number-first format for every project-goal task") ||
  !projectLaunchWorkflow.includes("Only service work that maintains the coordination system")
) {
  fail("Control-plane naming exception is missing or affects ordinary task titles");
}
if (
  !coreEn.includes("Control decision / Available sources / Expected orchestration output / Route to focused context when") ||
  !coreEn.includes("The boundary is the owned result") ||
  !coreEn.includes("UNOWNED_PROJECT_WORK") ||
  !coreRu.includes("Control decision / Available sources / Expected orchestration output / Route to focused context when") ||
  !orchestratorWorkflow.includes("CONTROL_ONLY") ||
  !orchestratorWorkflow.includes("ROUTE_TO_FOCUSED_CONTEXT") ||
  !orchestratorWorkflow.includes("focused-context receipt") ||
  !orchestratorSkill.includes("control cycle") ||
  !agentsCore.includes("project evidence") ||
  !projectStateTemplate.includes("Work origin:")
) {
  fail("Framework is missing the bounded orchestrator advisory or work-origin contract");
}
if (
  !orchestratorWorkflow.includes("open recall commitments") ||
  !orchestratorWorkflow.includes("bounded read-only memory backfill") ||
  !orchestratorWorkflow.includes("id counts and mapping completeness alone are insufficient") ||
  !orchestratorSkill.includes("open recall commitments") ||
  !orchestratorSkill.includes("ordinary future-work queries")
) {
  fail("Orchestrator is missing recall-commitment retrieval or semantic backfill proof");
}
if (!orchestratorWorkflow.includes("first active use") || !orchestratorWorkflow.includes("installed < release <= latest")) {
  fail("Orchestrator workflow is missing active framework update discovery");
}
if (!orchestratorWorkflow.includes("one concise delta per release") || !orchestratorWorkflow.includes("never omit a skipped release")) {
  fail("Orchestrator workflow may lose skipped framework releases");
}
if (!orchestratorWorkflow.includes("newer than the last Return Sync")) {
  fail("Orchestrator workflow may overwrite newer task-local human direction");
}
if (!orchestratorWorkflow.includes("no context message, no-op trace, or model wake-up")) {
  fail("Orchestrator monitor is not truly silent while unchanged");
}
if (
  !dailyAlignmentWorkflow.includes("Task-local debugging") ||
  !dailyAlignmentWorkflow.includes("Leave unaffected tasks asleep") ||
  !dailyAlignmentWorkflow.includes("Task contexts never read the raw transcript")
) {
  fail("Daily Alignment may leak into task execution or wake unaffected work");
}
if (
  !orchestratorSkill.includes("Do not use for task-local implementation") ||
  !dailyAlignmentSkill.includes("Do not use for task-local failures") ||
  !acceptWorkSkill.includes("do not perform project-wide orchestration")
) {
  fail("Skill descriptions do not enforce context ownership");
}
if (!acceptWorkflow.includes("Rejected Candidate")) fail("Acceptance is missing rejected-candidate handling");
if (!acceptWorkflow.includes("Unexpectedly changed")) fail("Acceptance is missing inheritance classification");
if (!acceptWorkflow.includes("recipient-side exact-artifact/revision proof")) {
  fail("Acceptance is missing recipient-side handoff proof");
}
if (!acceptWorkflow.includes("schema/migration revision") || !acceptWorkflow.includes("reproducible safe data source")) {
  fail("Acceptance is missing reproducible recipient-side data proof");
}
if (!acceptWorkflow.includes("zero-spend or no-mutation contract")) {
  fail("Acceptance is missing runtime capability protection");
}
if (
  !acceptWorkflow.includes("Memory candidates") ||
  !acceptWorkflow.includes("applied / missed / contradicted / not exercised") ||
  !acceptWorkflow.includes("least-privilege access") ||
  !acceptWorkflow.includes("never a credential") ||
  !acceptWorkflow.includes("Acceptance, merge, and deploy are separate authorities")
) {
  fail("Acceptance is missing memory return or safe operational verification");
}
if (
  !acceptWorkflow.includes("Do not reconstruct unrelated Project State") ||
  !acceptWorkflow.includes("orchestrator decides parent closure")
) {
  fail("Acceptance does not preserve task-local proof and orchestrator-owned parent closure");
}
if (
  !acceptWorkflow.includes("durable task/tracker outbox") ||
  !acceptWorkflow.includes("RECEIVED -> CONSUMED -> ROUTED") ||
  !acceptWorkflow.includes("OUTCOME_UNKNOWN") ||
  !acceptWorkSkill.includes("durable task/tracker outbox")
) {
  fail("Acceptance is missing durable return or uncertain-side-effect handling");
}
if (!changelog.includes(`## ${manifest.version} -`)) fail("Changelog is missing current version");
if (changelog.match(/^## (\d+\.\d+\.\d+) -/m)?.[1] !== manifest.version) {
  fail("Latest changelog entry differs from manifest");
}
if (!readme.includes(`Current version: \`${manifest.version}\``)) fail("README version differs from manifest");
if (!compatibilityEn.includes(`version ${manifest.version}`)) fail("English compatibility pointer differs from manifest");
if (!compatibilityRu.includes(`версия ${manifest.version}`)) fail("Russian compatibility pointer differs from manifest");
if (!license.includes(manifest.requiredNotice)) fail("LICENSE.md is missing the required notice");
if (!notice.includes(manifest.requiredNotice)) fail("NOTICE.md is missing the required notice");
if (!managedNotice.includes(manifest.requiredNotice)) fail("Managed notice is missing the required notice");
if (!managedNotice.includes("polyformproject.org/licenses/small-business/1.0.0")) {
  fail("Managed notice is missing the license URL");
}
if (!license.includes("PolyForm Small Business License 1.0.0")) fail("LICENSE.md has the wrong license text");
if (!citation.includes(`version: ${manifest.version}`)) fail("CITATION.cff version differs from manifest");
if (!citation.includes("family-names: Rozhnov")) fail("CITATION.cff is missing the creator");
if (!citation.includes(`license: ${manifest.license}`)) fail("CITATION.cff license differs from manifest");
if (!provenance.includes("Alexander Rozhnov")) fail("Provenance is missing the creator");
if (lineCount(coreEn) > 320) fail(`English core exceeds 320 lines (${lineCount(coreEn)})`);
if (lineCount(coreRu) > 320) fail(`Russian core exceeds 320 lines (${lineCount(coreRu)})`);

const enHeadings = coreEn.match(/^## /gm)?.length || 0;
const ruHeadings = coreRu.match(/^## /gm)?.length || 0;
if (enHeadings !== ruHeadings) fail(`Core heading counts differ: EN ${enHeadings}, RU ${ruHeadings}`);

const skillsRoot = path.join(root, ".agents/skills");
for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const relative = `.agents/skills/${entry.name}`;
  const skillFile = `${relative}/SKILL.md`;
  const skill = await text(skillFile);
  if (!skill.startsWith("---\n")) fail(`${skillFile} has no YAML frontmatter`);
  if (!skill.includes(`name: ${entry.name}\n`)) fail(`${skillFile} name does not match directory`);
  if (!/description: .+/.test(skill)) fail(`${skillFile} has no description`);
  if (!skill.includes("docs/FRAMEWORK.md")) fail(`${skillFile} does not load the stable framework core`);
  if (!skill.includes("docs/workflows/")) fail(`${skillFile} does not load an environment-neutral workflow`);
  if (skill.includes("COLLABORATION_FRAMEWORK_2026-06-10")) fail(`${skillFile} still loads the dated framework path`);
  if (lineCount(skill) > 100) fail(`${skillFile} exceeds 100 lines (${lineCount(skill)})`);

  const openaiFile = `${relative}/agents/openai.yaml`;
  if (existsSync(path.join(root, openaiFile))) {
    const yaml = await text(openaiFile);
    if (!yaml.includes(`$${entry.name}`)) fail(`${openaiFile} default prompt does not mention $${entry.name}`);
  }
}

const runtimeFiles = [
  "AGENTS.md",
  "BOOTSTRAP.md",
  "README.md",
  "LICENSE.md",
  "NOTICE.md",
  "COMMERCIAL-LICENSING.md",
  "TRADEMARKS.md",
  "CONTRIBUTING.md",
  "docs/PROVENANCE.md",
  "docs/VYDYKHAI_NOTICE.md",
  "docs/AGENTS_CORE.md",
  "docs/FRAMEWORK.md",
  "docs/FRAMEWORK_RU.md",
  "docs/COLLABORATION_FRAMEWORK_2026-06-10.md",
  "docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md",
  ...(await readdir(path.join(root, "docs/workflows"))).map((name) => `docs/workflows/${name}`),
  ...(await readdir(skillsRoot)).map((name) => `.agents/skills/${name}/SKILL.md`),
];

const historicalVersionFiles = new Set([
  "docs/PROVENANCE.md",
  "docs/COLLABORATION_FRAMEWORK_2026-06-10.md",
  "docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md",
]);
for (const relative of runtimeFiles) {
  if (historicalVersionFiles.has(relative) || !existsSync(path.join(root, relative))) continue;
  const lines = (await text(relative)).split("\n");
  for (const [index, line] of lines.entries()) {
    const versionLine = line
      .replace(/PolyForm(?:[- ]Small[- ]Business(?:[- ]License)?)[- ]1\.0\.0/gi, "")
      .replace(/small-business\/1\.0\.0/gi, "");
    for (const match of versionLine.matchAll(/\bv?(\d+\.\d+(?:\.\d+)?)\b/g)) {
      if (match[1] !== manifest.version) {
        fail(`Unexpected historical version ${match[0]} in active file ${relative}:${index + 1}`);
      }
    }
  }
}

const agentContextUriPattern = /\b[a-z][a-z0-9+.-]*:\/\/(?:threads?|tasks?|sessions?|contexts?)\//i;
const agentContextIdPattern = /\b01[0-9a-f]{6}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const localWorkspacePathPattern = /(?:^|[\s`("'=])(?:\/Users\/|\/home\/[^/\s]+\/|\/private\/(?:tmp|var\/folders)\/|\/var\/folders\/|[A-Za-z]:\\Users\\)/m;
const issueCommentIdPattern = /\bissuecomment-\d{5,}\b/i;
const canonicalRepoSlug = new URL(manifest.canonicalSource).pathname.replace(/^\/|\/$/g, "").toLowerCase();
const hardcodedModelPattern = /gpt-\d+(?:\.\d+)+/i;
const vendorLockedRuntimePattern = /\bCodex\b|docs\/codex-workflows|\.codex\//i;
for (const relative of runtimeFiles) {
  if (!existsSync(path.join(root, relative))) continue;
  const value = await text(relative);
  if (agentContextUriPattern.test(value)) fail(`Agent-context URI found in public artifact ${relative}`);
  if (agentContextIdPattern.test(value)) fail(`Agent-context identifier found in public artifact ${relative}`);
  if (localWorkspacePathPattern.test(value)) fail(`Local workspace path found in public artifact ${relative}`);
  if (issueCommentIdPattern.test(value)) fail(`Project issue-comment identifier found in public artifact ${relative}`);
  for (const match of value.matchAll(/https?:\/\/(?:www\.)?github\.com\/([^/\s)>"'`]+)\/([^/\s)#>"'`]+)/gi)) {
    const slug = `${match[1]}/${match[2].replace(/[.,;:]+$/, "").replace(/\.git$/i, "")}`.toLowerCase();
    if (slug !== canonicalRepoSlug) fail(`Non-canonical GitHub repository link found in public artifact ${relative}`);
  }
  for (const match of value.matchAll(/https?:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\//gi)) {
    const slug = `${match[1]}/${match[2].replace(/\.git$/i, "")}`.toLowerCase();
    if (slug !== canonicalRepoSlug) fail(`Non-canonical raw GitHub repository link found in public artifact ${relative}`);
  }
  if (hardcodedModelPattern.test(value)) fail(`Hardcoded model version found in ${relative}`);
  if (vendorLockedRuntimePattern.test(value)) fail(`Vendor-locked runtime wording found in ${relative}`);
  if (relative.startsWith("docs/workflows/") && lineCount(value) > 150) {
    fail(`${relative} exceeds 150 lines (${lineCount(value)})`);
  }

  for (const match of value.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
    const href = match[1].trim();
    if (!href || /^(?:https?:|mailto:|#)/.test(href)) continue;
    const local = href.split("#", 1)[0];
    if (!local) continue;
    const resolved = path.resolve(root, path.dirname(relative), local);
    if (!existsSync(resolved)) fail(`Broken local link in ${relative}: ${href}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Vydykhai ${manifest.version} validation passed.`);
