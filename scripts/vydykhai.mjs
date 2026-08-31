#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCK_FILE = ".vydykhai-lock.json";
const AGENTS_START = "<!-- vydykhai:managed:start -->";
const AGENTS_END = "<!-- vydykhai:managed:end -->";
const CANONICAL_UPSTREAM = "https://github.com/vonjor-lab/vydykhai-humans-as-agents.git";
const CANONICAL_MANIFEST = "https://raw.githubusercontent.com/vonjor-lab/vydykhai-humans-as-agents/main/vydykhai.json";
const CANONICAL_SOURCE = "https://github.com/vonjor-lab/vydykhai-humans-as-agents";
const FRAMEWORK_CREATOR = "Alexander Rozhnov";
const FRAMEWORK_LICENSE = "PolyForm-Small-Business-1.0.0";

function usage() {
  return `Vydykhai framework manager

Usage:
  node scripts/vydykhai.mjs install <target-repo> [--force]
  node scripts/vydykhai.mjs doctor [target-repo] [--offline] [--json]
  node scripts/vydykhai.mjs control-check --state <project-state.md> --graph <project-memory-graph.md> [--json]
  node scripts/vydykhai.mjs guard-check --state <project-state.md> --graph <project-memory-graph.md> [--json]
  node scripts/vydykhai.mjs update [target-repo] [--from <framework-repo>] [--force]
`;
}

function parseArgs(argv) {
  const positionals = [];
  const flags = { force: false, offline: false, json: false, from: null, state: null, graph: null };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--force") flags.force = true;
    else if (value === "--offline") flags.offline = true;
    else if (value === "--json") flags.json = true;
    else if (value === "--from") {
      flags.from = argv[i + 1];
      i += 1;
      if (!flags.from) throw new Error("--from requires a framework repository path");
    } else if (value === "--state" || value === "--graph") {
      const key = value.slice(2);
      flags[key] = argv[i + 1];
      i += 1;
      if (!flags[key]) throw new Error(`${value} requires a file path`);
    } else if (value.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    } else {
      positionals.push(value);
    }
  }

  return { positionals, flags };
}

function normalizeManagedPath(value) {
  const normalized = value.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.split("/").includes("..")) {
    throw new Error(`Unsafe managed path: ${value}`);
  }
  return normalized;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function loadManifest(root) {
  const file = path.join(root, "vydykhai.json");
  if (!existsSync(file)) throw new Error(`Missing framework manifest: ${file}`);
  const manifest = await readJson(file);
  if (manifest.schemaVersion !== 1 || !manifest.version || !Array.isArray(manifest.managedPaths)) {
    throw new Error(`Invalid framework manifest: ${file}`);
  }
  if (manifest.name !== "vydykhai") throw new Error(`Unexpected framework name in ${file}`);
  if (manifest.creator?.name !== FRAMEWORK_CREATOR) throw new Error(`Invalid framework creator in ${file}`);
  if (manifest.license !== FRAMEWORK_LICENSE) throw new Error(`Invalid framework license in ${file}`);
  if (manifest.canonicalSource !== CANONICAL_SOURCE) throw new Error(`Invalid canonical source in ${file}`);
  if (!String(manifest.requiredNotice || "").startsWith("Required Notice:")) {
    throw new Error(`Invalid required notice in ${file}`);
  }
  if (
    manifest.defaultAgentProfile?.modelPolicy !== "latest-available-flagship" ||
    manifest.defaultAgentProfile?.reasoningPolicy !== "deepest-bounded" ||
    manifest.defaultAgentProfile?.reasoningEffort !== "xhigh"
  ) {
    throw new Error(`Invalid default agent profile in ${file}`);
  }
  const routing = manifest.agentRoutingPolicy;
  if (
    routing?.policy !== "role-routed" ||
    routing?.modelPolicy !== "latest-available-flagship" ||
    routing?.profiles?.orchestrator?.reasoningPolicy !== "maximum-available" ||
    routing?.profiles?.orchestrator?.preferredEffortWhenAvailable !== "ultra" ||
    routing?.profiles?.discovery?.reasoningPolicy !== "deep-bounded" ||
    routing?.profiles?.discovery?.preferredEffortWhenAvailable !== "xhigh" ||
    routing?.profiles?.execution?.reasoningPolicy !== "efficient-bounded" ||
    routing?.profiles?.execution?.preferredEffortWhenAvailable !== "low"
  ) {
    throw new Error(`Invalid agent routing policy in ${file}`);
  }
  if (
    manifest.controlLoopPolicy &&
    (manifest.controlLoopPolicy.policy !== "governor-audited-event-loop" ||
      manifest.controlLoopPolicy.projectStateVersion !== 2)
  ) {
    throw new Error(`Invalid control loop policy in ${file}`);
  }
  if (
    manifest.projectGuardPolicy &&
    (manifest.projectGuardPolicy.policy !== "external-event-and-schedule" ||
      manifest.projectGuardPolicy.healthyPath !== "deterministic-no-model" ||
      manifest.projectGuardPolicy.anomalyProfile !== "maximum-available")
  ) {
    throw new Error(`Invalid project guard policy in ${file}`);
  }
  if (manifest.executionLeasePolicy?.policy && manifest.executionLeasePolicy.policy !== "one-work-one-owning-context") {
    throw new Error(`Invalid execution lease policy in ${file}`);
  }
  if (manifest.taskReturnPolicy?.policy && manifest.taskReturnPolicy.policy !== "durable-outbox-native-wakeup") {
    throw new Error(`Invalid task return policy in ${file}`);
  }
  if (manifest.rotationPolicy?.policy && manifest.rotationPolicy.policy !== "independent-health-gated") {
    throw new Error(`Invalid rotation policy in ${file}`);
  }
  manifest.managedPaths = manifest.managedPaths.map(normalizeManagedPath);
  return manifest;
}

async function listFiles(root, relativePath) {
  const absolute = path.join(root, relativePath);
  const info = await stat(absolute);
  if (info.isFile()) return [relativePath];
  if (!info.isDirectory()) throw new Error(`Managed path is not a file or directory: ${relativePath}`);

  const files = [];
  const entries = await readdir(absolute, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    if (entry.name === ".DS_Store") continue;
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(root, child)));
    else if (entry.isFile()) files.push(child);
    else throw new Error(`Managed symlinks or special files are not supported: ${child}`);
  }
  return files;
}

async function managedFiles(root, manifest) {
  const files = [];
  for (const managedPath of manifest.managedPaths) {
    const absolute = path.join(root, managedPath);
    if (!existsSync(absolute)) throw new Error(`Manifest path does not exist: ${managedPath}`);
    files.push(...(await listFiles(root, managedPath)));
  }
  return [...new Set(files)].sort();
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function hashFile(file) {
  return sha256(await readFile(file));
}

async function assertNoTargetSymlink(targetRoot, relativePath) {
  const parts = normalizeManagedPath(relativePath).split("/");
  let current = targetRoot;
  for (const part of parts) {
    current = path.join(current, part);
    if (!existsSync(current)) continue;
    const info = await lstat(current);
    if (info.isSymbolicLink()) {
      throw new Error(`Refusing to write through target symlink: ${path.relative(targetRoot, current)}`);
    }
  }
}

async function sourceRevision(root) {
  try {
    return execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

async function agentsBlock(sourceRoot) {
  const core = (await readFile(path.join(sourceRoot, "docs/AGENTS_CORE.md"), "utf8")).trim();
  return `${AGENTS_START}\n${core}\n${AGENTS_END}`;
}

function extractAgentsBlock(content) {
  const start = content.indexOf(AGENTS_START);
  const end = content.indexOf(AGENTS_END);
  if (start === -1 && end === -1) return null;
  if (start === -1 || end === -1 || end < start) throw new Error("AGENTS.md has a broken Vydykhai managed block");
  return content.slice(start, end + AGENTS_END.length);
}

function replaceAgentsBlock(content, block) {
  const current = extractAgentsBlock(content);
  if (!current) return `${content.trimEnd()}${content.trim() ? "\n\n" : ""}${block}\n`;
  return `${content.slice(0, content.indexOf(current))}${block}${content.slice(content.indexOf(current) + current.length)}`;
}

async function loadLock(targetRoot) {
  const file = path.join(targetRoot, LOCK_FILE);
  if (!existsSync(file)) return null;
  return readJson(file);
}

async function installFrom(sourceRoot, targetRoot, { force = false } = {}) {
  const sourceReal = await realpath(sourceRoot);
  const targetReal = await realpath(targetRoot);
  if (sourceReal === targetReal) throw new Error("Refusing to install the framework into its canonical source repository");

  const manifest = await loadManifest(sourceRoot);
  const files = await managedFiles(sourceRoot, manifest);
  const oldLock = await loadLock(targetRoot);
  const newHashes = {};
  const conflicts = [];

  for (const relative of files) {
    const sourceFile = path.join(sourceRoot, relative);
    const targetFile = path.join(targetRoot, relative);
    await assertNoTargetSymlink(targetRoot, relative);
    const nextHash = await hashFile(sourceFile);
    newHashes[relative] = nextHash;

    if (!existsSync(targetFile)) continue;
    const currentHash = await hashFile(targetFile);
    const previousHash = oldLock?.managedFiles?.[relative];
    const locallyChanged = previousHash ? currentHash !== previousHash : currentHash !== nextHash;
    if (locallyChanged && currentHash !== nextHash) conflicts.push(relative);
  }

  const staleFiles = [];
  for (const [relative, previousHash] of Object.entries(oldLock?.managedFiles || {})) {
    if (relative in newHashes) continue;
    const targetFile = path.join(targetRoot, relative);
    if (!existsSync(targetFile)) continue;
    const currentHash = await hashFile(targetFile);
    if (currentHash !== previousHash) conflicts.push(`${relative} (removed upstream, modified locally)`);
    else staleFiles.push(relative);
  }

  const targetAgents = path.join(targetRoot, "AGENTS.md");
  await assertNoTargetSymlink(targetRoot, "AGENTS.md");
  const currentAgents = existsSync(targetAgents) ? await readFile(targetAgents, "utf8") : "";
  const nextBlock = await agentsBlock(sourceRoot);
  const currentBlock = extractAgentsBlock(currentAgents);
  if (currentBlock) {
    const previousBlockHash = oldLock?.agentsBlockHash;
    const currentBlockHash = sha256(currentBlock);
    if (previousBlockHash && currentBlockHash !== previousBlockHash && currentBlock !== nextBlock) {
      conflicts.push("AGENTS.md managed block");
    } else if (!previousBlockHash && currentBlock !== nextBlock) {
      conflicts.push("AGENTS.md managed block");
    }
  }

  if (conflicts.length && !force) {
    throw new Error(`Refusing to overwrite locally modified framework files:\n- ${conflicts.join("\n- ")}\nReview them or rerun with --force.`);
  }

  for (const relative of files) {
    const targetFile = path.join(targetRoot, relative);
    await mkdir(path.dirname(targetFile), { recursive: true });
    await copyFile(path.join(sourceRoot, relative), targetFile);
  }

  for (const relative of staleFiles) {
    await rm(path.join(targetRoot, relative), { force: true });
  }

  await writeFile(targetAgents, replaceAgentsBlock(currentAgents, nextBlock), "utf8");

  const lock = {
    schemaVersion: 1,
    framework: manifest.name,
    installedVersion: manifest.version,
    creator: manifest.creator,
    copyright: manifest.copyright,
    license: manifest.license,
    canonicalSource: manifest.canonicalSource,
    requiredNotice: manifest.requiredNotice,
    upstream: manifest.upstream,
    sourceRevision: await sourceRevision(sourceRoot),
    managedFiles: newHashes,
    agentsBlockHash: sha256(nextBlock),
  };
  await writeFile(path.join(targetRoot, LOCK_FILE), `${JSON.stringify(lock, null, 2)}\n`, "utf8");

  return { manifest, lock, files, conflicts, staleFiles };
}

async function fetchUpstreamManifest(manifest) {
  if (typeof fetch !== "function") return null;
  const response = await fetch(CANONICAL_MANIFEST, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Upstream manifest returned HTTP ${response.status}`);
  return response.json();
}

async function doctor(targetRoot, { offline = false } = {}) {
  const manifest = await loadManifest(targetRoot);
  const lock = await loadLock(targetRoot);
  const sourceMode = path.resolve(targetRoot) === path.resolve(SCRIPT_ROOT) && !lock;
  const missing = [];
  const modified = [];
  const warnings = [];

  if (!lock && !sourceMode) {
    missing.push(LOCK_FILE);
  }

  if (lock) {
    for (const [relative, expectedHash] of Object.entries(lock.managedFiles || {})) {
      const file = path.join(targetRoot, relative);
      if (!existsSync(file)) missing.push(relative);
      else if ((await hashFile(file)) !== expectedHash) modified.push(relative);
    }

    const agentsFile = path.join(targetRoot, "AGENTS.md");
    if (!existsSync(agentsFile)) missing.push("AGENTS.md managed block");
    else {
      try {
        const block = extractAgentsBlock(await readFile(agentsFile, "utf8"));
        if (!block) missing.push("AGENTS.md managed block");
        else if (sha256(block) !== lock.agentsBlockHash) modified.push("AGENTS.md managed block");
      } catch (error) {
        modified.push(`AGENTS.md managed block (${error.message})`);
      }
    }
  }

  let upstreamVersion = null;
  if (!offline) {
    try {
      upstreamVersion = (await fetchUpstreamManifest(manifest))?.version || null;
    } catch (error) {
      warnings.push(`Upstream check unavailable: ${error.message}`);
    }
  }

  const installedVersion = lock?.installedVersion || manifest.version;
  return {
    ok: missing.length === 0 && modified.length === 0,
    mode: sourceMode ? "canonical-source" : "installed-copy",
    installedVersion,
    upstreamVersion,
    updateAvailable: Boolean(upstreamVersion && upstreamVersion !== installedVersion),
    sourceRevision: lock?.sourceRevision || (await sourceRevision(targetRoot)),
    agentProfilePolicy: manifest.defaultAgentProfile,
    agentRoutingPolicy: manifest.agentRoutingPolicy,
    projectActivationPolicy: manifest.projectActivationPolicy,
    controlLoopPolicy: manifest.controlLoopPolicy,
    projectGuardPolicy: manifest.projectGuardPolicy,
    executionLeasePolicy: manifest.executionLeasePolicy,
    taskReturnPolicy: manifest.taskReturnPolicy,
    rotationPolicy: manifest.rotationPolicy,
    memoryPolicy: manifest.memoryPolicy,
    actionReceiptPolicy: manifest.actionReceiptPolicy,
    trackerPolicy: manifest.trackerPolicy,
    creator: manifest.creator,
    license: manifest.license,
    canonicalSource: manifest.canonicalSource,
    missing,
    modified,
    warnings,
  };
}

function printDoctor(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Vydykhai ${result.installedVersion} (${result.mode})`);
  console.log(`Integrity: ${result.ok ? "OK" : "FAILED"}`);
  const routing = result.agentRoutingPolicy;
  console.log(`Agent routing: ${routing.modelPolicy} / ${routing.policy}`);
  console.log(
    `Profiles: ORCHESTRATOR=${routing.profiles.orchestrator.reasoningPolicy}; ` +
      `DISCOVERY=${routing.profiles.discovery.reasoningPolicy}; ` +
      `EXECUTION=${routing.profiles.execution.reasoningPolicy}`,
  );
  if (result.projectActivationPolicy?.policy && Array.isArray(result.projectActivationPolicy.requiredChecks)) {
    console.log(
      `Project activation: ${result.projectActivationPolicy.policy}; ` +
        `${result.projectActivationPolicy.requiredChecks.length} live checks via project-launch`,
    );
  } else {
    console.log("Project activation: not declared by installed version");
  }
  if (result.controlLoopPolicy?.policy) {
    console.log(
      `Control loop: ${result.controlLoopPolicy.policy}; Project State v${result.controlLoopPolicy.projectStateVersion}`,
    );
  } else {
    console.log("Control loop: not declared by installed version");
  }
  if (result.projectGuardPolicy?.policy) {
    console.log(
      `Project Guard: ${result.projectGuardPolicy.policy}; healthy=${result.projectGuardPolicy.healthyPath}; ` +
        `anomaly=${result.projectGuardPolicy.anomalyProfile}`,
    );
  } else {
    console.log("Project Guard: not declared by installed version");
  }
  if (result.executionLeasePolicy?.policy) {
    console.log(`Execution leases: ${result.executionLeasePolicy.policy}`);
  } else {
    console.log("Execution leases: not declared by installed version");
  }
  if (result.taskReturnPolicy?.policy) {
    console.log(`Task returns: ${result.taskReturnPolicy.policy}`);
  } else {
    console.log("Task returns: not declared by installed version");
  }
  if (result.rotationPolicy?.policy) {
    console.log(
      `Rotation: ${result.rotationPolicy.policy}; independent check after ` +
        `${result.rotationPolicy.maxCompactionsWithoutIndependentCheck} compactions or ${result.rotationPolicy.activeReviewHours} active hours`,
    );
  } else {
    console.log("Rotation: not declared by installed version");
  }
  console.log(
    `Memory: ${result.memoryPolicy.policy} v${result.memoryPolicy.graphVersion}; task brief <= ${result.memoryPolicy.taskBriefMaxNodes} executable nodes`,
  );
  if (result.actionReceiptPolicy?.policy && Array.isArray(result.actionReceiptPolicy.boundaries)) {
    console.log(
      `Action receipts: ${result.actionReceiptPolicy.policy}; ${result.actionReceiptPolicy.boundaries.length} critical boundaries`,
    );
  } else {
    console.log("Action receipts: not declared by installed version");
  }
  console.log(`Tracker: ${result.trackerPolicy.policy}`);
  console.log(`Creator: ${result.creator.name} (@${result.creator.github})`);
  console.log(`License: ${result.license}`);
  console.log(`Canonical source: ${result.canonicalSource}`);
  if (result.upstreamVersion) {
    console.log(`Upstream: ${result.upstreamVersion}${result.updateAvailable ? " (update available)" : " (current)"}`);
  }
  if (result.missing.length) console.log(`Missing:\n- ${result.missing.join("\n- ")}`);
  if (result.modified.length) console.log(`Modified managed files:\n- ${result.modified.join("\n- ")}`);
  for (const warning of result.warnings) console.log(`Warning: ${warning}`);
}

function countExact(content, value) {
  return content.split(value).length - 1;
}

function section(content, heading, nextHeadings) {
  const start = content.indexOf(heading);
  if (start === -1) return "";
  const candidates = nextHeadings
    .map((next) => content.indexOf(next, start + heading.length))
    .filter((index) => index !== -1);
  const end = candidates.length ? Math.min(...candidates) : content.length;
  return content.slice(start + heading.length, end);
}

function tableFirstColumnValues(value) {
  return value
    .split("\n")
    .filter((line) => /^\|/.test(line))
    .map((line) => line.split("|")[1]?.trim())
    .filter((cell) => cell && !/^[-: ]+$/.test(cell) && !/^(Work|Receipt|Task|Item|ID)$/i.test(cell));
}

function tableRows(value, headerPattern) {
  return value
    .split("\n")
    .filter((line) => /^\|/.test(line))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length && !cells.every((cell) => /^[-: ]+$/.test(cell)))
    .filter((cells) => !headerPattern.test(cells[0] || ""))
    .filter((cells) => !cells.every((cell) => /^<.*>$/.test(cell)));
}

function duplicateValues(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

function validateClosedArtifact(content, { label, startMarker, endMarker, requiredHeadings }) {
  const issues = [];
  if (countExact(content, startMarker) !== 1) issues.push(`${label}: expected exactly one ${startMarker}`);
  if (countExact(content, endMarker) !== 1) issues.push(`${label}: expected exactly one ${endMarker}`);

  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start !== -1 && content.slice(0, start).trim()) issues.push(`${label}: content exists before start marker`);
  if (end !== -1 && content.slice(end + endMarker.length).trim()) issues.push(`${label}: content exists after end marker`);
  if (start !== -1 && end !== -1 && end < start) issues.push(`${label}: end marker precedes start marker`);

  for (const heading of requiredHeadings) {
    if (countExact(content, heading) !== 1) issues.push(`${label}: expected exactly one ${heading}`);
  }
  return issues;
}

function validateProjectState(content, manifest) {
  const label = "Project State";
  const issues = validateClosedArtifact(content, {
    label,
    startMarker: `<!-- vydykhai:project-state v${manifest.controlLoopPolicy.projectStateVersion} -->`,
    endMarker: "<!-- vydykhai:project-state:end -->",
    requiredHeadings: [
      "## Control Snapshot",
      "## Current DOD",
      "## Execution Leases",
      "## Pending Return Inbox",
      "## Detours And Recall",
      "## Active Work",
      "## Next-Best-Action",
    ],
  });

  for (const field of [
    "Snapshot as of:",
    "Governor:",
    "Project Guard:",
    "Orchestrator health:",
    "Last independent check:",
    "DOD Control Line:",
    "Memory coverage:",
    "Agent routing:",
    "Coordination inputs:",
    "Environment adapter:",
    "Orchestrator rotation:",
    "Scope freshness:",
  ]) {
    if (!content.includes(field)) issues.push(`${label}: missing ${field}`);
  }

  const governorLine = content.match(/^Governor:.*$/m)?.[0] || "";
  const governorState = governorLine.match(/^Governor:\s*(HEALTHY|REPAIR|ROTATE)\b/)?.[1];
  if (!governorState) issues.push(`${label}: Governor state is missing or unresolved`);
  else if (governorState !== "HEALTHY") issues.push(`${label}: Governor requires ${governorState}`);
  const guardLine = content.match(/^Project Guard:.*$/m)?.[0] || "";
  const guardState = guardLine.match(/^Project Guard:\s*(ACTIVE|LIMITED|MISSING)\b/)?.[1];
  if (!guardState) issues.push(`${label}: Project Guard state is missing or unresolved`);
  else if (guardState !== "ACTIVE") issues.push(`${label}: Project Guard requires ${guardState}`);
  for (const [field, pattern] of [
    ["runner", /\|\s*Runner:\s*([^|]+)/],
    ["event route", /\|\s*Event route:\s*([^|]+)/],
    ["schedule", /\|\s*Schedule:\s*([^|]+)/],
    ["last proof", /\|\s*Last proof:\s*([^|]+)/],
    ["wakeup", /\|\s*Wakeup:\s*([^|]+)/],
    ["incident", /\|\s*Incident:\s*([^|]+)/],
  ]) {
    const value = guardLine.match(pattern)?.[1]?.trim();
    if (!value || /<.*>/.test(value)) issues.push(`${label}: Project Guard ${field} is missing or unresolved`);
  }
  const guardIndependent = guardLine.match(/\|\s*Independent:\s*(YES|NO)\b/)?.[1];
  if (guardIndependent !== "YES") issues.push(`${label}: Project Guard is not independently triggered`);
  const guardIncident = guardLine.match(/\|\s*Incident:\s*([^|]+)/)?.[1]?.trim();
  if (guardIncident && guardIncident.toLowerCase() !== "none" && !/<.*>/.test(guardIncident)) {
    issues.push(`${label}: Project Guard incident ${guardIncident} requires reconciliation`);
  }
  const governorReceipt = governorLine.match(/\|\s*Receipt:\s*([^|]+)/)?.[1]?.trim();
  const governorTrigger = governorLine.match(/\|\s*Trigger:\s*([^|]+)/)?.[1]?.trim();
  if (!governorReceipt || /<.*>/.test(governorReceipt)) issues.push(`${label}: Governor receipt is missing or unresolved`);
  if (!governorTrigger || /<.*>/.test(governorTrigger)) issues.push(`${label}: Governor trigger is missing or unresolved`);
  const snapshotEvent = content.match(/^Snapshot as of:\s*(.+)$/m)?.[1]?.trim();
  const auditedEvent = content.match(/^Governor:.*\|\s*Audited event:\s*([^|]+?)(?:\s*\||$)/m)?.[1]?.trim();
  if (!snapshotEvent || /<.*>/.test(snapshotEvent)) issues.push(`${label}: snapshot event is missing or unresolved`);
  if (!auditedEvent || /<.*>/.test(auditedEvent)) issues.push(`${label}: Governor audited event is missing or unresolved`);
  else if (snapshotEvent && snapshotEvent !== auditedEvent) {
    issues.push(`${label}: Governor audited ${auditedEvent} but current snapshot is ${snapshotEvent}`);
  }
  const orchestratorLine = content.match(/^Orchestrator health:.*$/m)?.[0] || "";
  const orchestratorState = orchestratorLine.match(/^Orchestrator health:\s*(HEALTHY|REVIEW|REPAIR|ROTATE)\b/)?.[1];
  if (!orchestratorState) issues.push(`${label}: orchestrator health is missing or unresolved`);
  else if (orchestratorState !== "HEALTHY") issues.push(`${label}: orchestrator health requires ${orchestratorState}`);
  const orchestratorProfile = orchestratorLine.match(/\|\s*Profile:\s*([^|]+)/)?.[1]?.trim();
  if (!orchestratorProfile || !/\bORCHESTRATOR\b/i.test(orchestratorProfile) || !/\bmaximum\b/i.test(orchestratorProfile)) {
    issues.push(`${label}: orchestrator profile is not explicitly ORCHESTRATOR / maximum`);
  }
  const compactionCount = Number(orchestratorLine.match(/Last compaction\/context-loss signal:\s*(\d+)/)?.[1]);
  if (!Number.isFinite(compactionCount)) issues.push(`${label}: compaction/context-loss count is missing or unresolved`);
  else if (compactionCount >= manifest.rotationPolicy.maxCompactionsWithoutIndependentCheck) {
    issues.push(`${label}: independent check required after ${compactionCount} compaction/context-loss signals`);
  }
  const dodLine = content.match(/^DOD Control Line:\s*(.+)$/m)?.[1]?.trim();
  if (!dodLine || /<.*>/.test(dodLine)) issues.push(`${label}: DOD Control Line is unresolved`);
  const failureMatch = content.match(/Same-class failures since repair:\s*(\d+)/);
  const failureCount = Number(failureMatch?.[1]);
  if (!failureMatch) issues.push(`${label}: same-class failure count is missing or unresolved`);
  else if (failureCount >= manifest.rotationPolicy.sameClassFailureLimit) {
    issues.push(`${label}: same-class failure threshold reached (${failureCount})`);
  }

  const leaseSection = section(content, "## Execution Leases", ["## Pending Return Inbox"]);
  const duplicateLeases = duplicateValues(tableFirstColumnValues(leaseSection));
  if (duplicateLeases.length) issues.push(`${label}: duplicate execution lease ${duplicateLeases.join(", ")}`);
  for (const row of tableRows(leaseSection, /^Work$/i)) {
    const [work, state] = row;
    if (!["PREPARED", "STARTED", "WORKING", "WAITING", "RETURNED", "CLOSED", "OUTCOME_UNKNOWN"].includes(state)) {
      issues.push(`${label}: lease ${work} has invalid state ${state || "missing"}`);
    } else if (["PREPARED", "RETURNED", "OUTCOME_UNKNOWN"].includes(state)) {
      issues.push(`${label}: lease ${work} has unresolved transition ${state}`);
    }
  }

  const returnSection = section(content, "## Pending Return Inbox", ["## Detours And Recall"]);
  const duplicateReturns = duplicateValues(tableFirstColumnValues(returnSection));
  if (duplicateReturns.length) issues.push(`${label}: duplicate pending return ${duplicateReturns.join(", ")}`);
  for (const [receipt] of tableRows(returnSection, /^Receipt$/i)) {
    issues.push(`${label}: pending return ${receipt} requires reconciliation`);
  }

  const detourSection = section(content, "## Detours And Recall", ["## Active Work"]);
  for (const row of tableRows(detourSection, /^ID$/i)) {
    if (row.at(-1) === "RETURN_DUE") issues.push(`${label}: detour ${row[0]} is due for return`);
  }

  return issues;
}

function validateMemoryGraph(content, manifest) {
  const label = "Project Memory Graph";
  const issues = validateClosedArtifact(content, {
    label,
    startMarker: `<!-- vydykhai:project-memory-graph v${manifest.memoryPolicy.graphVersion} -->`,
    endMarker: "<!-- vydykhai:project-memory-graph:end -->",
    requiredHeadings: [
      "## Anchor Index",
      "## Current Memory Nodes",
      "## Pending Memory Events",
      "## Live Retrieval Probes",
      "## Legacy Source Map",
    ],
  });

  for (const field of ["Watermark:", "Declared nodes:", "Last compaction:", "Last retrieval check:"]) {
    if (!content.includes(field)) issues.push(`${label}: missing ${field}`);
  }

  const nodeSection = section(content, "## Current Memory Nodes", ["## Pending Memory Events"]);
  const nodeIds = [...nodeSection.matchAll(/^### (MEM-[A-Za-z0-9_-]+)/gm)].map((match) => match[1]);
  const declared = content.match(/^Declared nodes:\s*(\d+)\s*$/m);
  if (!declared) issues.push(`${label}: declared node count is missing or unresolved`);
  else if (Number(declared[1]) !== nodeIds.length) {
    issues.push(`${label}: declared ${declared[1]} nodes but found ${nodeIds.length}`);
  }
  const duplicateNodes = duplicateValues(nodeIds);
  if (duplicateNodes.length) issues.push(`${label}: duplicate memory node ${duplicateNodes.join(", ")}`);

  const anchorSection = section(content, "## Anchor Index", ["## Current Memory Nodes"]);
  const anchorIds = [...anchorSection.matchAll(/\|\s*(ENT-[A-Za-z0-9_-]+)\s*\|/g)].map((match) => match[1]);
  const duplicateAnchors = duplicateValues(anchorIds);
  if (duplicateAnchors.length) issues.push(`${label}: duplicate anchor ${duplicateAnchors.join(", ")}`);

  const probes = section(content, "## Live Retrieval Probes", ["## Legacy Source Map"]);
  for (const probe of ["CURRENT", "NEXT", "PRIOR_MISS"]) {
    const line = probes.split("\n").find((candidate) => new RegExp(`\\|\\s*${probe}\\s*\\|`).test(candidate));
    if (!line) issues.push(`${label}: missing ${probe} retrieval probe`);
    else if (!/\bPASS\b/.test(line)) issues.push(`${label}: ${probe} retrieval probe has not passed`);
  }

  const pendingEvents = section(content, "## Pending Memory Events", ["## Live Retrieval Probes"]);
  for (const row of tableRows(pendingEvents, /^Event$/i)) {
    if (row.at(-1) === "PENDING") issues.push(`${label}: memory event ${row[0]} is still pending`);
  }

  return issues;
}

async function controlCheck(statePath, graphPath) {
  const manifest = await loadManifest(SCRIPT_ROOT);
  const state = await readFile(statePath, "utf8");
  const graph = await readFile(graphPath, "utf8");
  const stateIssues = validateProjectState(state, manifest);
  const graphIssues = validateMemoryGraph(graph, manifest);
  return {
    ok: stateIssues.length === 0 && graphIssues.length === 0,
    policy: manifest.controlLoopPolicy.policy,
    projectStateVersion: manifest.controlLoopPolicy.projectStateVersion,
    memoryGraphVersion: manifest.memoryPolicy.graphVersion,
    statePath,
    graphPath,
    stateIssues,
    graphIssues,
  };
}

function classifyGuard(result, stateContent) {
  if (result.ok) return { action: "NOOP", incidentId: null };
  const wakeOnly = [
    /unresolved transition (PREPARED|RETURNED)/,
    /pending return .* requires reconciliation/,
    /detour .* is due for return/,
    /memory event .* is still pending/,
  ];
  const issues = [...result.stateIssues, ...result.graphIssues];
  const action = issues.length > 0 && issues.every((issue) => wakeOnly.some((pattern) => pattern.test(issue)))
    ? "WAKE"
    : "AUDIT_REQUIRED";
  const snapshot = stateContent.match(/^Snapshot as of:\s*(.+)$/m)?.[1]?.trim() || "unknown";
  const recordedIncident = stateContent.match(/^Project Guard:.*\|\s*Incident:\s*([^|\n]+)/m)?.[1]?.trim();
  const incidentId = recordedIncident && recordedIncident.toLowerCase() !== "none" && !/<.*>/.test(recordedIncident)
    ? recordedIncident
    : `guard-${sha256(JSON.stringify({ snapshot, issues: [...issues].sort() })).slice(0, 16)}`;
  return { action, incidentId };
}

async function guardCheck(statePath, graphPath) {
  const stateContent = await readFile(statePath, "utf8");
  const result = await controlCheck(statePath, graphPath);
  return { ...result, ...classifyGuard(result, stateContent) };
}

function printGuardCheck(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Project Guard action: ${result.action}`);
  if (result.incidentId) console.log(`Incident: ${result.incidentId}`);
  console.log(`Control check: ${result.ok ? "PASS" : "MISMATCH"}`);
  for (const issue of [...result.stateIssues, ...result.graphIssues]) console.log(`- ${issue}`);
}

function printControlCheck(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Control check: ${result.ok ? "PASS" : "MISMATCH"}`);
  console.log(`Policy: ${result.policy}`);
  console.log(`Project State: v${result.projectStateVersion}${result.stateIssues.length ? " / FAILED" : " / PASS"}`);
  console.log(`Memory Graph: v${result.memoryGraphVersion}${result.graphIssues.length ? " / FAILED" : " / PASS"}`);
  for (const issue of [...result.stateIssues, ...result.graphIssues]) console.log(`- ${issue}`);
}

async function cloneUpstream(upstream) {
  const parent = await mkdtemp(path.join(tmpdir(), "vydykhai-update-"));
  const checkout = path.join(parent, "framework");
  const result = spawnSync("git", ["clone", "--depth", "1", upstream, checkout], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    await rm(parent, { recursive: true, force: true });
    throw new Error(`Unable to clone framework upstream: ${result.stderr.trim() || result.stdout.trim()}`);
  }
  return { parent, checkout };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    console.log(usage());
    return;
  }

  const { positionals, flags } = parseArgs(rest);

  if (command === "install") {
    if (!positionals[0]) throw new Error(`install requires a target repository\n\n${usage()}`);
    const target = path.resolve(positionals[0]);
    if (!existsSync(target)) throw new Error(`Target repository does not exist: ${target}`);
    const result = await installFrom(SCRIPT_ROOT, target, flags);
    console.log(`Installed Vydykhai ${result.manifest.version} into ${target}`);
    console.log(`Managed files: ${result.files.length}; project-specific files were preserved.`);
    return;
  }

  if (command === "doctor") {
    const target = path.resolve(positionals[0] || process.cwd());
    const result = await doctor(target, flags);
    printDoctor(result, flags.json);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "control-check") {
    if (!flags.state || !flags.graph) throw new Error(`control-check requires --state and --graph\n\n${usage()}`);
    const statePath = path.resolve(flags.state);
    const graphPath = path.resolve(flags.graph);
    const result = await controlCheck(statePath, graphPath);
    printControlCheck(result, flags.json);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "guard-check") {
    if (!flags.state || !flags.graph) throw new Error(`guard-check requires --state and --graph\n\n${usage()}`);
    const statePath = path.resolve(flags.state);
    const graphPath = path.resolve(flags.graph);
    const result = await guardCheck(statePath, graphPath);
    printGuardCheck(result, flags.json);
    return;
  }

  if (command === "update") {
    const target = path.resolve(positionals[0] || process.cwd());
    let source = flags.from ? path.resolve(flags.from) : null;
    let temporary = null;
    if (!source) {
      await loadManifest(target);
      temporary = await cloneUpstream(CANONICAL_UPSTREAM);
      source = temporary.checkout;
    }
    try {
      const result = await installFrom(source, target, flags);
      console.log(`Updated Vydykhai to ${result.manifest.version} in ${target}`);
    } finally {
      if (temporary) await rm(temporary.parent, { recursive: true, force: true });
    }
    return;
  }

  throw new Error(`Unknown command: ${command}\n\n${usage()}`);
}

main().catch((error) => {
  console.error(`Vydykhai: ${error.message}`);
  process.exitCode = 1;
});
