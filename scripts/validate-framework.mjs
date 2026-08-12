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
if (manifest.defaultScopeFreshnessDays !== 7) fail("Default scope freshness must be 7 days");
if (manifest.memoryPolicy?.policy !== "project-memory-graph") {
  fail("Memory policy must use the Project Memory Graph");
}
if (manifest.memoryPolicy?.graphVersion !== 2) fail("Project Memory Graph schema must be version 2");
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
if (manifest.memoryPolicy?.taskBriefMaxNodes !== 7) fail("Task Memory Brief maximum must be 7 nodes");
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
const changelog = await text("docs/COLLABORATION_FRAMEWORK_CHANGELOG.md");
const readme = await text("README.md");
const compatibilityEn = await text("docs/COLLABORATION_FRAMEWORK_2026-06-10.md");
const compatibilityRu = await text("docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md");
const projectStateTemplate = await text("docs/workflows/project-state-template.md");
const projectMemoryGraphTemplate = await text("docs/workflows/project-memory-graph-template.md");
const ideaMemoryTemplate = await text("docs/workflows/idea-memory-template.md");
const intentTrailTemplate = await text("docs/workflows/intent-trail-template.md");
const orchestratorWorkflow = await text("docs/workflows/framework-orchestrator.md");
const dailyAlignmentWorkflow = await text("docs/workflows/daily-alignment.md");
const taskHandoffTemplate = await text("docs/workflows/task-context-handoff-template.md");
const acceptWorkflow = await text("docs/workflows/accept-work.md");
const orchestratorSkill = await text(".agents/skills/framework-orchestrator/SKILL.md");
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
if (!coreEn.includes("Scope Freshness") || !coreRu.includes("Актуальность scope")) {
  fail("Core is missing Scope Freshness");
}
if (!coreEn.includes("One Success Line") || !coreRu.includes("Одна линия успеха")) {
  fail("Core is missing One Success Line");
}
if (!coreEn.includes("Shared Sync Contract") || !coreRu.includes("Контракт общей синхронизации")) {
  fail("Core is missing Shared Sync Contract");
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
  !coreRu.includes("Because / Apply / Avoid / Verify / Source")
) {
  fail("Core is missing executable memory retrieval or miss reflection");
}
if (!projectStateTemplate.includes("Project Memory Graph:")) fail("Project State is missing the memory graph pointer");
if (!projectStateTemplate.includes("Last memory delta:")) fail("Project State is missing the memory delta pointer");
if (!projectStateTemplate.includes("Tracker projection:")) fail("Project State is missing the tracker projection");
if (!projectStateTemplate.includes("Operational sources:")) fail("Project State is missing safe operational-source pointers");
if (!projectStateTemplate.includes("Shared Sync:")) fail("Project State is missing Shared Sync readiness");
if (!projectStateTemplate.includes("Baseline -> Candidate")) fail("Project State is missing the Success Line pointer");
if (!projectStateTemplate.includes("Task return mapping:")) fail("Project State is missing the task return mapping");
if (!projectStateTemplate.includes("Snapshot as of:") || !projectStateTemplate.includes("Rebuild its body atomically")) {
  fail("Project State is missing atomic current-snapshot hygiene");
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
  !projectMemoryGraphTemplate.includes("Representative Retrieval Scenarios") ||
  !projectMemoryGraphTemplate.includes("RETRIEVAL_MISS") ||
  !projectMemoryGraphTemplate.includes("matching ids or self-report alone is insufficient") ||
  !projectMemoryGraphTemplate.includes("Watermark:") ||
  !projectMemoryGraphTemplate.includes("Legacy Source Map") ||
  !projectMemoryGraphTemplate.includes("no more than seven nodes") ||
  !projectMemoryGraphTemplate.includes("Never store credentials")
) {
  fail("Project Memory Graph is missing anchors, atomic nodes, reflection, executable retrieval, evaluation, lineage, or secret-safety rules");
}
if (!orchestratorWorkflow.includes("Return Sync")) fail("Orchestrator workflow is missing closed-loop task return");
if (
  !taskHandoffTemplate.includes("Role: EXECUTION") ||
  !taskHandoffTemplate.includes("Agent profile: EXECUTION") ||
  !taskHandoffTemplate.includes("Continue from:") ||
  !taskHandoffTemplate.includes("Applicable Memory Brief:") ||
  !taskHandoffTemplate.includes("Authority / safety envelope:") ||
  !taskHandoffTemplate.includes("Consult when:") ||
  !taskHandoffTemplate.includes("Return triggers:") ||
  !taskHandoffTemplate.includes("Learning / approach evidence:") ||
  !taskHandoffTemplate.includes("Memory Brief result:") ||
  !taskHandoffTemplate.includes("Memory candidates:") ||
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
  !orchestratorWorkflow.includes("Choose Hot Or Cold Path") ||
  !orchestratorWorkflow.includes("Do not run Daily Alignment") ||
  !orchestratorWorkflow.includes("Material external delta") ||
  !orchestratorWorkflow.includes("Do not wake unaffected work")
) {
  fail("Orchestrator workflow is missing hot-path continuity or targeted external-delta routing");
}
if (
  !orchestratorWorkflow.includes("derive a Touch Set") ||
  !orchestratorWorkflow.includes("Memory Brief") ||
  !orchestratorWorkflow.includes("graph watermark") ||
  !orchestratorWorkflow.includes("tracker projection") ||
  !orchestratorWorkflow.includes("representative current, upcoming, and prior-miss Touch Sets") ||
  !orchestratorWorkflow.includes("Memory Reflection") ||
  !orchestratorWorkflow.includes("APPLICATION_MISS") ||
  !orchestratorWorkflow.includes("side-by-side read-only candidate") ||
  !orchestratorWorkflow.includes("non-destructive access check")
) {
  fail("Orchestrator workflow is missing memory retrieval or rotation proof");
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
  !acceptWorkflow.includes("never a credential")
) {
  fail("Acceptance is missing memory return or safe operational verification");
}
if (
  !acceptWorkflow.includes("Do not reconstruct unrelated Project State") ||
  !acceptWorkflow.includes("orchestrator decides parent closure")
) {
  fail("Acceptance does not preserve task-local proof and orchestrator-owned parent closure");
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
