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
  node scripts/vydykhai.mjs control-check --state <project-state.md> --graph <project-memory-graph.md> [--outbox <durable-outbox.md>] [--expect-state-sha <sha256>] [--expect-graph-sha <sha256>] [--json]
  node scripts/vydykhai.mjs guard-check --state <project-state.md> --graph <project-memory-graph.md> [--outbox <durable-outbox.md>] [--activity <fresh-observation.json>] [--accepted-incident <semantic-id>] [--json]
  node scripts/vydykhai.mjs update [target-repo] [--from <framework-repo>] [--force]
`;
}

function parseArgs(argv) {
  const positionals = [];
  const flags = {
    force: false,
    offline: false,
    json: false,
    from: null,
    state: null,
    graph: null,
    outbox: null,
    activity: null,
    acceptedIncident: null,
    expectStateSha: null,
    expectGraphSha: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--force") flags.force = true;
    else if (value === "--offline") flags.offline = true;
    else if (value === "--json") flags.json = true;
    else if (value === "--from") {
      flags.from = argv[i + 1];
      i += 1;
      if (!flags.from) throw new Error("--from requires a framework repository path");
    } else if (
      ["--state", "--graph", "--outbox", "--activity", "--accepted-incident", "--expect-state-sha", "--expect-graph-sha"].includes(
        value,
      )
    ) {
      const key = {
        "--state": "state",
        "--graph": "graph",
        "--outbox": "outbox",
        "--activity": "activity",
        "--accepted-incident": "acceptedIncident",
        "--expect-state-sha": "expectStateSha",
        "--expect-graph-sha": "expectGraphSha",
      }[value];
      flags[key] = argv[i + 1];
      i += 1;
      if (!flags[key]) throw new Error(`${value} requires a value`);
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
    manifest.orchestratorAdvisoryPolicy &&
    (manifest.orchestratorAdvisoryPolicy.policy !== "control-only-advisory" ||
      manifest.orchestratorAdvisoryPolicy.guardSignal !== "unowned-project-work")
  ) {
    throw new Error(`Invalid orchestrator advisory policy in ${file}`);
  }
  if (
    manifest.controlLoopPolicy &&
    (manifest.controlLoopPolicy.policy !== "governor-audited-event-loop" ||
      manifest.controlLoopPolicy.projectStateVersion !== 2)
  ) {
    throw new Error(`Invalid control loop policy in ${file}`);
  }
  if (
    manifest.controlStatePublicationPolicy &&
    (manifest.controlStatePublicationPolicy.policy !== "validate-publish-readback-or-restore" ||
      manifest.controlStatePublicationPolicy.failedWriteState !== "never-current")
  ) {
    throw new Error(`Invalid control state publication policy in ${file}`);
  }
  if (
    manifest.projectGuardPolicy &&
    (manifest.projectGuardPolicy.policy !== "external-event-and-schedule" ||
      manifest.projectGuardPolicy.healthyPath !== "deterministic-no-model" ||
      manifest.projectGuardPolicy.anomalyProfile !== "maximum-available" ||
      (manifest.projectGuardPolicy.incidentIdentity &&
        manifest.projectGuardPolicy.incidentIdentity !== "semantic-condition-set"))
  ) {
    throw new Error(`Invalid project guard policy in ${file}`);
  }
  if (
    manifest.humanAttentionPolicy &&
    (manifest.humanAttentionPolicy.policy !== "durable-single-manager-attention" ||
      manifest.humanAttentionPolicy.unchangedGuardAction !== "silent" ||
      manifest.humanAttentionPolicy.completion !== "restore-or-explicitly-supersede" ||
      manifest.humanAttentionPolicy.orchestratorAvailability !== "release-after-observable-dispatch")
  ) {
    throw new Error(`Invalid human attention policy in ${file}`);
  }
  if (manifest.executionLeasePolicy?.policy && manifest.executionLeasePolicy.policy !== "one-work-one-owning-context") {
    throw new Error(`Invalid execution lease policy in ${file}`);
  }
  if (manifest.continuationPolicy &&
      (manifest.continuationPolicy.policy !== "evidence-backed-next-action" ||
       manifest.continuationPolicy.activityMaxAgeSeconds !== 300)) {
    throw new Error(`Invalid continuation policy in ${file}`);
  }
  if (
    manifest.taskReturnPolicy?.policy &&
    (manifest.taskReturnPolicy.policy !== "durable-outbox-native-wakeup" ||
      manifest.taskReturnPolicy.terminalReceipt !== "return-sync" ||
      manifest.taskReturnPolicy.actionReceiptSubstitutes !== false ||
      manifest.taskReturnPolicy.nativeWakeup !== "required-attempt" ||
      manifest.taskReturnPolicy.nativeThreadRead !== "non-authoritative" ||
      manifest.taskReturnPolicy.guardFallback !== "discover-unrouted-durable-return" ||
      (manifest.taskReturnPolicy.machineFormat &&
        manifest.taskReturnPolicy.machineFormat !== "marked-return-sync-and-route-v1"))
  ) {
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
    orchestratorAdvisoryPolicy: manifest.orchestratorAdvisoryPolicy,
    projectActivationPolicy: manifest.projectActivationPolicy,
    controlLoopPolicy: manifest.controlLoopPolicy,
    controlStatePublicationPolicy: manifest.controlStatePublicationPolicy,
    projectGuardPolicy: manifest.projectGuardPolicy,
    humanAttentionPolicy: manifest.humanAttentionPolicy,
    continuationPolicy: manifest.continuationPolicy,
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
  if (result.orchestratorAdvisoryPolicy?.policy) {
    console.log(
      `Orchestrator advisory: ${result.orchestratorAdvisoryPolicy.policy}; ` +
        `guard=${result.orchestratorAdvisoryPolicy.guardSignal}`,
    );
  } else {
    console.log("Orchestrator advisory: not declared by installed version");
  }
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
  if (result.controlStatePublicationPolicy?.policy) {
    console.log(`Control state publication: ${result.controlStatePublicationPolicy.policy}`);
  } else {
    console.log("Control state publication: not declared by installed version");
  }
  if (result.projectGuardPolicy?.policy) {
    console.log(
      `Project Guard: ${result.projectGuardPolicy.policy}; healthy=${result.projectGuardPolicy.healthyPath}; ` +
        `anomaly=${result.projectGuardPolicy.anomalyProfile}; incident=${result.projectGuardPolicy.incidentIdentity || "legacy"}`,
    );
  } else {
    console.log("Project Guard: not declared by installed version");
  }
  if (result.humanAttentionPolicy?.policy) {
    console.log(
      `Human attention: ${result.humanAttentionPolicy.policy}; ` +
        `guard=${result.humanAttentionPolicy.unchangedGuardAction}; ` +
        `completion=${result.humanAttentionPolicy.completion}`,
    );
  } else {
    console.log("Human attention: not declared by installed version");
  }
  console.log(`Production continuation: ${result.continuationPolicy?.policy || "not declared by installed version"}`);
  if (result.executionLeasePolicy?.policy) {
    console.log(`Execution leases: ${result.executionLeasePolicy.policy}`);
  } else {
    console.log("Execution leases: not declared by installed version");
  }
  if (result.taskReturnPolicy?.policy) {
    console.log(
      `Task returns: ${result.taskReturnPolicy.policy}; ` +
        `terminal=${result.taskReturnPolicy.terminalReceipt}; ` +
        `fallback=${result.taskReturnPolicy.guardFallback}`,
    );
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
    `Memory: ${result.memoryPolicy.policy} v${result.memoryPolicy.graphVersion}; ${result.memoryPolicy.contextRoutingPolicy ? "complete goal-to-evidence context; no fixed node cap" : `task brief <= ${result.memoryPolicy.taskBriefMaxNodes} executable nodes`}`,
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markedBlocks(content, kind, label) {
  const startMarker = `<!-- vydykhai:${kind} v1 -->`;
  const endMarker = `<!-- vydykhai:${kind}:end -->`;
  const issues = [];
  const startCount = countExact(content, startMarker);
  const endCount = countExact(content, endMarker);
  if (startCount !== endCount) {
    issues.push(`Durable outbox: ${label} marker count differs (${startCount} start / ${endCount} end)`);
  }
  const pattern = new RegExp(`${escapeRegExp(startMarker)}([\\s\\S]*?)${escapeRegExp(endMarker)}`, "g");
  const blocks = [...content.matchAll(pattern)].map((match) => match[1]);
  if (blocks.length !== startCount || blocks.some((block) => /<!-- vydykhai:return-(?:sync|route)(?: v1|:end) -->/.test(block))) {
    issues.push(`Durable outbox: ${label} framing is incomplete or nested`);
  }
  return {
    blocks,
    issues,
  };
}

function blockField(block, name) {
  return block.match(new RegExp(`^${escapeRegExp(name)}:[\\t ]*([^\\r\\n]*)$`, "m"))?.[1]?.trim() || "";
}

// Shared by the CLI and host adapters; only complete, unambiguous pairs close returns.
export function validateDurableOutbox(content) {
  const returnBlocks = markedBlocks(content, "return-sync", "Return Sync");
  const routeBlocks = markedBlocks(content, "return-route", "Return Route");
  const issues = [...returnBlocks.issues, ...routeBlocks.issues];
  const unframed = content
    .replace(/<!-- vydykhai:return-sync v1 -->[\s\S]*?<!-- vydykhai:return-sync:end -->/g, "")
    .replace(/<!-- vydykhai:return-route v1 -->[\s\S]*?<!-- vydykhai:return-route:end -->/g, "");
  if (/(^|\n)Return receipt id:/.test(unframed)) {
    issues.push("Durable outbox: unmarked Return Sync data requires canonical v1 framing");
  }
  if (/(^|\n)Return lifecycle:[\t ]*RECEIVED/.test(unframed)) {
    issues.push("Durable outbox: unmarked Return Route data requires canonical v1 framing");
  }
  const returns = new Map();
  const routes = new Map();
  const ambiguousReturns = new Set();
  const ambiguousRoutes = new Set();
  const framingValid = returnBlocks.issues.length === 0 && routeBlocks.issues.length === 0;

  for (const block of returnBlocks.blocks) {
    const issueStart = issues.length;
    const id = blockField(block, "Return receipt id");
    const status = blockField(block, "Status");
    const lifecycle = blockField(block, "Return lifecycle");
    const required = [
      ["Status", status],
      ["Return receipt id", id],
      ["Return lifecycle", lifecycle],
      ["Task / context / PR / commit / artifact", blockField(block, "Task / context / PR / commit / artifact")],
      ["Memory candidates", blockField(block, "Memory candidates")],
      ["Artifact disposition", blockField(block, "Artifact disposition")],
      ["Recommended orchestrator next action", blockField(block, "Recommended orchestrator next action")],
    ];
    for (const [field, value] of required) {
      if (!value || /<.*>/.test(value)) issues.push(`Durable outbox: Return Sync ${id || "<missing>"} lacks ${field}`);
      if (countExact(block, new RegExp(`^${escapeRegExp(field)}:`, "gm")) > 1) {
        issues.push(`Durable outbox: Return Sync ${id || "<missing>"} repeats ${field}`);
      }
    }
    if (
      status &&
      ![
        "BLOCKED_BEFORE_START",
        "NEEDS_REBRIEF",
        "CHECKPOINT_READY",
        "ACCEPT",
        "ACCEPT_WITH_FOLLOWUPS",
        "NEEDS_FIXES",
        "BLOCKED",
        "OUTCOME_UNKNOWN",
      ].includes(status)
    ) {
      issues.push(`Durable outbox: Return Sync ${id || "<missing>"} has invalid status ${status}`);
    }
    if (lifecycle && !/^WRITTEN(?:\s*->\s*SENT)?$/.test(lifecycle)) {
      issues.push(`Durable outbox: Return Sync ${id || "<missing>"} lifecycle must be WRITTEN or WRITTEN -> SENT`);
    }
    if (!id) continue;
    if (returns.has(id)) {
      issues.push(`Durable outbox: duplicate Return Sync ${id}`);
      ambiguousReturns.add(id);
    }
    returns.set(id, { id, fields: Object.fromEntries(required), valid: framingValid && issues.length === issueStart });
  }

  for (const block of routeBlocks.blocks) {
    const issueStart = issues.length;
    const id = blockField(block, "Return receipt id");
    const lifecycle = blockField(block, "Return lifecycle");
    const required = [
      ["Return receipt id", id],
      ["Return lifecycle", lifecycle],
      ["Consumer", blockField(block, "Consumer")],
      ["Routed next action", blockField(block, "Routed next action")],
      ["Evidence", blockField(block, "Evidence")],
    ];
    for (const [field, value] of required) {
      if (!value || /<.*>/.test(value)) issues.push(`Durable outbox: Return Route ${id || "<missing>"} lacks ${field}`);
      if (countExact(block, new RegExp(`^${escapeRegExp(field)}:`, "gm")) > 1) {
        issues.push(`Durable outbox: Return Route ${id || "<missing>"} repeats ${field}`);
      }
    }
    if (lifecycle && !/^RECEIVED\s*->\s*CONSUMED\s*->\s*ROUTED$/.test(lifecycle)) {
      issues.push(`Durable outbox: Return Route ${id || "<missing>"} lifecycle is not RECEIVED -> CONSUMED -> ROUTED`);
    }
    if (!id) continue;
    if (routes.has(id)) {
      issues.push(`Durable outbox: duplicate Return Route ${id}`);
      ambiguousRoutes.add(id);
    }
    routes.set(id, { id, fields: Object.fromEntries(required), valid: framingValid && issues.length === issueStart });
  }

  for (const id of ambiguousReturns) returns.get(id).valid = false;
  for (const id of ambiguousRoutes) routes.get(id).valid = false;
  const routedReturnIds = [...returns.keys()].filter((id) => returns.get(id).valid && routes.get(id)?.valid);
  const routedIds = new Set(routedReturnIds);
  const pendingReturnIds = [...returns.keys()].filter((id) => !routedIds.has(id));
  for (const id of returns.keys()) {
    if (!routedIds.has(id)) issues.push(`Durable outbox: return ${id} requires routing`);
  }
  for (const id of routes.keys()) {
    if (!returns.has(id)) issues.push(`Durable outbox: Return Route ${id} has no matching Return Sync`);
  }

  return {
    issues,
    returnCount: returns.size,
    routeCount: routes.size,
    routedCount: routedReturnIds.length,
    pendingReturnIds,
    routedReturnIds,
    returns: [...returns.values()],
    routes: [...routes.values()],
  };
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
    "Human attention:",
    "Orchestrator health:",
    "Work origin:",
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
  const attentionLines = content.match(/^Human attention:.*$/gm) || [];
  if (attentionLines.length !== 1) {
    issues.push(`${label}: expected exactly one Human attention state`);
  } else {
    const attentionLine = attentionLines[0];
    const attentionState = attentionLine.match(/^Human attention:\s*(NONE|PENDING|RESURFACE_DUE)\b/)?.[1];
    if (!attentionState) {
      issues.push(`${label}: human attention state is missing or unresolved`);
    } else if (attentionState !== "NONE") {
      const fields = [
        ["id", /\|\s*ID:\s*([^|]+)/],
        ["request", /\|\s*Request:\s*([^|]+)/],
        ["source", /\|\s*Source:\s*([^|]+)/],
        ["raised at", /\|\s*Raised:\s*([^|]+)/],
        ["resume after", /\|\s*Resume after:\s*([^|]+)/],
      ];
      for (const [field, pattern] of fields) {
        const value = attentionLine.match(pattern)?.[1]?.trim();
        if (!value || /<.*>/.test(value)) issues.push(`${label}: human attention ${field} is missing or unresolved`);
      }
      const attentionId = attentionLine.match(/\|\s*ID:\s*([^|]+)/)?.[1]?.trim() || "unknown";
      if (attentionState === "RESURFACE_DUE") {
        issues.push(`${label}: human attention ${attentionId} requires resurfacing`);
      }
    }
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
  const workOriginLine = content.match(/^Work origin:.*$/m)?.[0] || "";
  const workOriginState = workOriginLine.match(/^Work origin:\s*(PASS|REVIEW|UNOWNED_PROJECT_WORK)\b/)?.[1];
  if (!workOriginState) issues.push(`${label}: work origin is missing or unresolved`);
  else if (workOriginState !== "PASS") issues.push(`${label}: work origin requires ${workOriginState}`);
  for (const [field, pattern] of [
    ["advisory contract", /\|\s*Advisory contract:\s*([^|]+)/],
    ["accepted evidence owner", /\|\s*Accepted evidence owner:\s*([^|]+)/],
    ["last checked", /\|\s*Last checked:\s*([^|]+)/],
  ]) {
    const value = workOriginLine.match(pattern)?.[1]?.trim();
    if (!value || /<.*>/.test(value)) issues.push(`${label}: work origin ${field} is missing or unresolved`);
  }
  const dodLine = content.match(/^DOD Control Line:\s*(.+)$/m)?.[1]?.trim();
  if (!dodLine || /<.*>/.test(dodLine)) issues.push(`${label}: DOD Control Line is unresolved`);
  const continuation = manifest.continuationPolicy ? readProductionContinuation(content) : null;
  if (continuation) issues.push(...continuation.issues);
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
    // A durable prepared lease is valid before dispatch; fresh activity decides whether it stalled.
    const ready = continuation?.issues.length === 0 && continuation.value.state === "READY" &&
      (work === continuation.value.work || work.startsWith(`${continuation.value.work} `));
    if (state === "PREPARED" && ready) continue;
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

function concreteLine(value) {
  return typeof value === "string" && Boolean(value.trim()) && !/[\r\n]/.test(value) &&
    !/<[^>]*>/.test(value) && value.trim().toLowerCase() !== "none";
}

// Bind observations to the next action and its owner, not unrelated graph/state edits.
export function readProductionContinuation(content) {
  const issues = [];
  const fail = (reason) => issues.push(`Production continuation: ${reason}`);
  const body = section(content, "## Next-Best-Action", ["<!-- vydykhai:project-state:end -->"]);
  const blocks = [...body.matchAll(/^```json\s*\n([\s\S]*?)^```\s*$/gm)];
  let value;
  try {
    if (blocks.length !== 1) throw new Error("one JSON record required");
    value = JSON.parse(blocks[0][1]);
    if (!value || Array.isArray(value) || typeof value !== "object") throw new Error("object required");
  } catch {
    fail("Next-Best-Action needs one valid JSON record");
    return { value: null, key: null, issues };
  }
  for (const field of ["id", "work", "action", "owner", "state", "evidence"]) {
    if (!concreteLine(value[field])) fail(`${field} is missing or unresolved`);
  }
  if (value.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (!["READY", "WORKING", "WAITING"].includes(value.state)) fail("state must be READY, WORKING, or WAITING");
  if (value.state === "WAITING" && !concreteLine(value.resumeWhen)) fail("WAITING needs a concrete resumeWhen");
  const orchestrator = content.match(/^Orchestrator health:.*\|\s*Context:\s*([^|\n]+)/m)?.[1]?.trim();
  if (!concreteLine(orchestrator)) fail("current orchestrator context is unresolved");
  if (value.state === "READY" && value.owner !== orchestrator) fail("READY must belong to the current orchestrator");
  const leases = tableRows(section(content, "## Execution Leases", ["## Pending Return Inbox"]), /^Work$/i);
  const matches = leases.filter(([work]) => work === value.work || work.startsWith(`${value.work} `));
  if (matches.length > 1) fail("work resolves to more than one lease");
  const lease = matches[0];
  const taskOwner = lease?.[2]?.split(/\s+\/\s+/).includes(value.owner);
  if (value.state === "WORKING" &&
      (!lease || !["STARTED", "WORKING"].includes(lease[1]) ||
       !taskOwner || value.owner === orchestrator)) {
    fail("WORKING needs its matching started task lease and context");
  }
  if (value.state === "WAITING" && value.owner !== orchestrator && !taskOwner) {
    fail("WAITING needs the current orchestrator or its matching task owner");
  }
  if (lease?.[1] === "OUTCOME_UNKNOWN") fail("uncertain work needs reconciliation before continuation");
  const record = Object.fromEntries(["schemaVersion", "id", "work", "action", "owner", "state", "evidence", "resumeWhen"]
    .map((field) => [field, value[field] ?? null]));
  return { value: record, orchestrator, issues,
    key: issues.length ? null : sha256(JSON.stringify({ record, orchestrator, lease: lease?.slice(0, 3) ?? null })) };
}

export function evaluateProductionContinuation(content, activity, { now = Date.now(), maxAgeSeconds = 300 } = {}) {
  const record = readProductionContinuation(content);
  const limited = (reason) => ({ ...record, coverage: "LIMITED", signal: null, orchestratorActive: false,
    issues: [...record.issues, `Production continuation: activity LIMITED (${reason})`] });
  if (record.issues.length) return limited("invalid next action");
  if (!activity || activity.schemaVersion !== 1 || activity.continuationKey !== record.key) return limited("missing or stale action binding");
  const observed = typeof activity.observedAt === "string" ? Date.parse(activity.observedAt) : NaN;
  if (!Number.isFinite(observed) || observed > now + 5000 || now - observed > maxAgeSeconds * 1000) return limited("observation is not fresh");
  const known = (view, context) => view?.context === context && ["ACTIVE", "IDLE"].includes(view.status) &&
    concreteLine(view.evidence);
  if (!known(activity.orchestrator, record.orchestrator)) return limited("orchestrator activity unavailable");
  const orchestratorActive = activity.orchestrator.status === "ACTIVE";
  let signal = null;
  if (record.value.state === "READY" && !orchestratorActive) signal = "ready step has no active coordinator";
  if (record.value.state === "WORKING") {
    if (!known(activity.owner, record.value.owner)) return limited("task activity unavailable");
    if (activity.owner.status === "IDLE") signal = "task is idle without a routed continuation";
  }
  if (record.value.state === "WAITING") {
    if (!["PENDING", "CHANGED"].includes(activity.wait?.status) ||
        !concreteLine(activity.wait.evidence)) return limited("wait condition unavailable");
    if (activity.wait.status === "CHANGED") signal = "wait condition changed";
  }
  return { ...record, coverage: "COVERED", signal, orchestratorActive,
    issues: signal ? [`Production continuation: ${record.value.id} requires routing (${signal})`] : [] };
}

export function readLeaseActivityScope(content) {
  const orchestrator = content.match(/^Orchestrator health:.*\|\s*Context:\s*([^|\n]+)/m)?.[1]?.trim();
  const rows = tableRows(section(content, "## Execution Leases", ["## Pending Return Inbox"]), /^Work$/i);
  return { key: sha256(JSON.stringify({ orchestrator, rows })),
    leases: rows.map(([work, state, owner]) => ({ work, state, owner })) };
}

// Optional whole-lease observation uses the existing timer, not a second control loop.
export function evaluateLeaseActivity(content, activity, { now = Date.now(), maxAgeSeconds = 300 } = {}) {
  const scope = readLeaseActivityScope(content);
  const result = (coverage, issues = []) => ({ key: scope.key, coverage, issues,
    signal: coverage === "COVERED" && issues.length > 0 });
  if (!activity || !Object.hasOwn(activity, "leases")) return result("NOT_REQUESTED");
  const limited = (reason) => result("LIMITED", [`Lease activity: LIMITED (${reason})`]);
  const observed = typeof activity.observedAt === "string" ? Date.parse(activity.observedAt) : NaN;
  if (activity.schemaVersion !== 1 || activity.leaseKey !== scope.key) return limited("missing or stale lease binding");
  if (!Number.isFinite(observed) || observed > now + 5000 || now - observed > maxAgeSeconds * 1000) {
    return limited("observation is not fresh");
  }
  if (!Array.isArray(activity.leases)) return limited("leases must be an array");
  const live = scope.leases.filter((lease) => ["STARTED", "WORKING", "WAITING"].includes(lease.state));
  const resolve = (work) => concreteLine(work)
    ? scope.leases.filter((lease) => lease.work === work || lease.work.startsWith(`${work} `)) : [];
  const entries = new Map();
  for (const view of activity.leases) {
    const matches = resolve(view?.work);
    if (matches.length !== 1 || !live.includes(matches[0])) return limited("unknown or inactive lease");
    const lease = matches[0];
    if (entries.has(lease.work)) return limited("duplicate lease observation");
    if (!concreteLine(view.context) || !lease.owner?.split(/\s+\/\s+/).includes(view.context) ||
        !["ACTIVE", "IDLE"].includes(view.status) || !concreteLine(view.evidence)) {
      return limited(`activity unavailable for ${lease.work}`);
    }
    if (activity.owner?.context === view.context && activity.owner.status !== view.status) {
      return limited(`conflicting activity for ${lease.work}`);
    }
    const dependencies = [];
    if (lease.state === "WAITING") {
      if (!["PENDING", "CHANGED"].includes(view.wait?.status) || !concreteLine(view.wait.evidence) ||
          !concreteLine(view.wait.resumeWhen) || !Array.isArray(view.wait.dependsOn)) {
        return limited(`wait condition unavailable for ${lease.work}`);
      }
      for (const dependency of view.wait.dependsOn) {
        const targets = resolve(dependency);
        if (targets.length !== 1 || dependencies.includes(targets[0].work)) {
          return limited(`ambiguous wait dependency for ${lease.work}`);
        }
        dependencies.push(targets[0].work);
      }
    }
    entries.set(lease.work, { lease, view, dependencies });
  }
  if (entries.size !== live.length) return limited("not all live leases were observed");
  const issues = [];
  for (const { lease, view, dependencies } of entries.values()) {
    if (lease.state !== "WAITING" && view.status === "IDLE") {
      issues.push(`Lease activity: ${lease.work} requires routing (idle without a wait)`);
    } else if (lease.state === "WAITING" && (view.wait.status === "CHANGED" || dependencies.some((work) =>
      scope.leases.some((target) => target.work === work && target.state === "CLOSED")))) {
      issues.push(`Lease activity: ${lease.work} requires routing (wait condition changed)`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const cycles = new Set();
  function visit(work, path = []) {
    if (visiting.has(work)) {
      cycles.add(path.slice(path.indexOf(work)).sort().join(" / "));
      return;
    }
    if (visited.has(work)) return;
    visiting.add(work);
    const entry = entries.get(work);
    if (entry?.lease.state === "WAITING" && entry.view.wait.status === "PENDING") {
      for (const dependency of [...entry.dependencies].sort()) visit(dependency, [...path, work]);
    }
    visiting.delete(work);
    visited.add(work);
  }
  for (const work of [...entries.keys()].sort()) visit(work);
  for (const cycle of [...cycles].sort()) issues.push(`Lease activity: circular wait ${cycle}`);
  return result("COVERED", issues);
}

export function validateMemoryGraph(content, manifest) {
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
  const anchorRows = tableRows(anchorSection, /^ID$/i);
  const anchorIds = anchorRows.map((row) => row[0]);
  const duplicateAnchors = duplicateValues(anchorIds);
  if (duplicateAnchors.length) issues.push(`${label}: duplicate anchor ${duplicateAnchors.join(", ")}`);

  const present = (value) => Boolean(value?.trim()) && !/^<[^>]*>$/.test(value.trim());
  for (const row of anchorRows) {
    if (!/^ENT-[A-Za-z0-9_-]+$/.test(row[0]) || row.length !== 5 || row.some((value) => !present(value))) {
      issues.push(`${label}: incomplete anchor row ${row[0] || "(unnamed)"}`);
    } else if (!manifest.memoryPolicy.anchorKinds.includes(row[1].toLowerCase())) {
      issues.push(`${label}: unknown anchor kind ${row[1]}`);
    }
  }

  // This checks records and references, not whether their meaning is correct.
  const knownIds = new Set([...anchorIds, ...nodeIds]);
  for (const record of nodeSection.split(/^### /m).slice(1)) {
    const [heading, ...lines] = record.split(/\r?\n/);
    const id = heading.match(/^(MEM-[A-Za-z0-9_-]+)(?:\s|$)/)?.[1];
    if (!id) {
      issues.push(`${label}: invalid node heading ${heading}`);
      continue;
    }
    const fields = new Map();
    for (const line of lines) {
      // Emphasis changes presentation, not field identity; values remain untouched.
      const plainLabel = line.replace(/^- \*\*([^*:\r\n]+):\*\*/, "- $1:")
        .replace(/^- \*\*([^*:\r\n]+)\*\*:/, "- $1:");
      const field = plainLabel.match(/^- ([^:]+):[ \t]*(.*)$/);
      if (!field) continue;
      const key = field[1].trim();
      if (fields.has(key)) issues.push(`${label}: ${id} duplicate field ${key}`);
      fields.set(key, field[2].trim().replace(/^`|`$/g, ""));
    }
    const missing = ["Type / status", "About", "Because", "Apply", "Avoid", "Verify", "Applies / exceptions", "Relations", "Source / checked"]
      .filter((name) => !present(fields.get(name)));
    const legacyLayout = fields.has("Current meaning") && (fields.has("Why / change") || fields.has("Sources / aliases"));
    if (legacyLayout && missing.length) {
      issues.push(`${label}: ${id} legacy field layout requires reconciliation; missing canonical fields: ${missing.join(", ")}`);
    } else {
      for (const name of missing) issues.push(`${label}: ${id} missing ${name}`);
    }
    for (const name of ["Because", "Apply", "Verify", "Source / checked"]) {
      if (/^(none|tbd|unknown)$/i.test(fields.get(name) || "")) issues.push(`${label}: ${id} unresolved ${name}`);
    }
    const [type, status, ...extra] = (fields.get("Type / status") || "").split(/\s*\/\s*/);
    if (present(fields.get("Type / status")) && (!manifest.memoryPolicy.nodeTypes.includes(type.toLowerCase()) || extra.length ||
        !["ACTIVE", "PROVISIONAL", "CONFLICT", "DORMANT", "SUPERSEDED", "RETIRED"].includes(status))) {
      issues.push(`${label}: ${id} invalid Type / status`);
    }
    const about = present(fields.get("About")) ? fields.get("About").split(/\s*[,;]\s*/) : [];
    for (const anchor of about) {
      if (!anchorIds.includes(anchor)) issues.push(`${label}: ${id} unknown anchor ${anchor || "(missing)"}`);
    }
    const relations = fields.get("Relations");
    if (relations && relations !== "none") {
      for (const relation of relations.split(/\s*;\s*/)) {
        const parsed = relation.match(/^([a-z-]+)\s*(?:->|\u2192)\s*((?:MEM|ENT)-[A-Za-z0-9_-]+(?:\s*,\s*(?:MEM|ENT)-[A-Za-z0-9_-]+)*)$/);
        if (!parsed || !manifest.memoryPolicy.relationTypes.includes(parsed[1])) {
          issues.push(`${label}: ${id} invalid relation ${relation}`);
        } else {
          for (const target of parsed[2].split(/\s*,\s*/)) {
            if (!knownIds.has(target)) issues.push(`${label}: ${id} unknown relation target ${target}`);
            else if (target === id) issues.push(`${label}: ${id} self-referencing relation ${parsed[1]}`);
          }
        }
      }
    }
  }

  const probes = section(content, "## Live Retrieval Probes", ["## Legacy Source Map"]);
  for (const probe of ["CURRENT", "NEXT", "PRIOR_MISS"]) {
    const rows = tableRows(probes, /^Slot$/i).filter((row) => row[0] === probe);
    if (!rows.length) issues.push(`${label}: missing ${probe} retrieval probe`);
    else if (rows.length > 1) issues.push(`${label}: duplicate ${probe} retrieval probe`);
    else if (!/^PASS(?:\s|$)/.test(rows[0][4] || "")) issues.push(`${label}: ${probe} retrieval probe has not passed`);
    if (rows.some((row) => row.length !== 6 || row.some((value) => !present(value)))) {
      issues.push(`${label}: incomplete ${probe} retrieval probe`);
    }
  }

  const pendingEvents = section(content, "## Pending Memory Events", ["## Live Retrieval Probes"]);
  for (const row of tableRows(pendingEvents, /^Event$/i)) {
    if (row.at(-1) === "PENDING") issues.push(`${label}: memory event ${row[0]} is still pending`);
  }

  return issues;
}

async function controlCheck(
  statePath,
  graphPath,
  { outboxPath = null, expectStateSha = null, expectGraphSha = null, stateContent = null } = {},
) {
  const manifest = await loadManifest(SCRIPT_ROOT);
  const state = stateContent ?? await readFile(statePath, "utf8");
  const graph = await readFile(graphPath, "utf8");
  const stateIssues = validateProjectState(state, manifest);
  const graphIssues = validateMemoryGraph(graph, manifest);
  const stateSha256 = sha256(state);
  const graphSha256 = sha256(graph);
  if (expectStateSha && stateSha256 !== expectStateSha) {
    stateIssues.push(`Project State: readback sha256 ${stateSha256} does not match expected ${expectStateSha}`);
  }
  if (expectGraphSha && graphSha256 !== expectGraphSha) {
    graphIssues.push(`Project Memory Graph: readback sha256 ${graphSha256} does not match expected ${expectGraphSha}`);
  }
  let outbox = null;
  if (outboxPath) {
    const outboxContent = await readFile(outboxPath, "utf8");
    outbox = {
      path: outboxPath,
      sha256: sha256(outboxContent),
      ...validateDurableOutbox(outboxContent),
    };
  }
  return {
    ok: stateIssues.length === 0 && graphIssues.length === 0 && (!outbox || outbox.issues.length === 0),
    policy: manifest.controlLoopPolicy.policy,
    publicationPolicy: manifest.controlStatePublicationPolicy?.policy || null,
    continuationPolicy: manifest.continuationPolicy || null,
    projectStateVersion: manifest.controlLoopPolicy.projectStateVersion,
    memoryGraphVersion: manifest.memoryPolicy.graphVersion,
    memoryValidationScope: "structure-and-references-only",
    statePath,
    graphPath,
    stateSha256,
    graphSha256,
    outbox,
    stateIssues,
    graphIssues,
  };
}

function semanticIssueKey(issue) {
  if (/Project State: Project Guard incident .* requires reconciliation/.test(issue)) return null;
  if (/Project State: Governor audited .* but current snapshot is .*/.test(issue)) {
    return "Project State: Governor audited event differs from current snapshot";
  }
  if (/Project State: independent check required after \d+ compaction\/context-loss signals/.test(issue)) {
    return "Project State: independent check required after compaction/context-loss threshold";
  }
  if (/Project State: same-class failure threshold reached \(\d+\)/.test(issue)) {
    return "Project State: same-class failure threshold reached";
  }
  return issue;
}

export function classifyGuard(result, stateContent, { acceptedIncidentId = null } = {}) {
  if (result.ok) {
    return {
      action: "NOOP",
      incidentId: null,
      incidentIdentity: "semantic-condition-set",
      recordedIncidentId: null,
      incidentChanged: false,
    };
  }
  const wakeOnly = [
    /unresolved transition (PREPARED|RETURNED)/,
    /pending return .* requires reconciliation/,
    /Durable outbox: return .* requires routing/,
    /detour .* is due for return/,
    /memory event .* is still pending/,
    /human attention .* requires resurfacing/,
    /^Production continuation: .* requires routing/,
    /^Lease activity: .* requires routing/,
  ];
  const issues = [...result.stateIssues, ...result.graphIssues, ...(result.outbox?.issues || [])];
  const requiredAction = issues.length > 0 && issues.every((issue) => wakeOnly.some((pattern) => pattern.test(issue)))
    ? "WAKE"
    : "AUDIT_REQUIRED";
  const recordedIncident = stateContent.match(/^Project Guard:.*\|\s*Incident:\s*([^|\n]+)/m)?.[1]?.trim();
  const recordedIncidentId = recordedIncident && recordedIncident.toLowerCase() !== "none" && !/<.*>/.test(recordedIncident)
    ? recordedIncident
    : null;
  const semanticConditions = issues.map(semanticIssueKey).filter(Boolean).sort();
  if (!semanticConditions.length) semanticConditions.push("Project State: recorded incident requires reconciliation");
  const incidentId = `guard-${sha256(JSON.stringify({ semanticConditions })).slice(0, 16)}`;
  const deduplicated = Boolean(acceptedIncidentId && acceptedIncidentId === incidentId && !recordedIncidentId &&
    !result.continuation?.signal && !result.leaseActivity?.signal);
  const deferred = requiredAction === "WAKE" && result.continuation?.orchestratorActive === true;
  return {
    action: deduplicated || deferred ? "NOOP" : requiredAction,
    requiredAction,
    incidentId,
    incidentIdentity: "semantic-condition-set",
    semanticConditions,
    recordedIncidentId,
    incidentChanged: Boolean(recordedIncidentId && recordedIncidentId !== incidentId),
    acceptedIncidentId,
    deduplicated,
    deferred,
  };
}

async function guardCheck(statePath, graphPath, options = {}) {
  const stateContent = await readFile(statePath, "utf8");
  const result = await controlCheck(statePath, graphPath, { ...options, stateContent });
  if (result.continuationPolicy) {
    const activity = options.activityPath ? await readJson(options.activityPath).catch(() => null) : null;
    result.continuation = evaluateProductionContinuation(stateContent, activity, {
      maxAgeSeconds: result.continuationPolicy.activityMaxAgeSeconds,
    });
    result.leaseActivity = evaluateLeaseActivity(stateContent, activity, {
      maxAgeSeconds: result.continuationPolicy.activityMaxAgeSeconds,
    });
    result.stateIssues = [...new Set([...result.stateIssues, ...result.continuation.issues, ...result.leaseActivity.issues])];
    result.ok = result.ok && result.continuation.issues.length === 0 && result.leaseActivity.issues.length === 0;
  }
  return { ...result, ...classifyGuard(result, stateContent, options) };
}

function printGuardCheck(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Project Guard action: ${result.action}`);
  if (result.incidentId) console.log(`Incident: ${result.incidentId}`);
  console.log(`Control check: ${result.ok ? "PASS" : "MISMATCH"}`);
  if (result.continuation) console.log(`Production continuation: ${result.continuation.coverage}`);
  if (result.leaseActivity) console.log(`Lease activity: ${result.leaseActivity.coverage}`);
  for (const issue of [...result.stateIssues, ...result.graphIssues, ...(result.outbox?.issues || [])]) console.log(`- ${issue}`);
}

function printControlCheck(result, asJson) {
  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`Control check: ${result.ok ? "PASS" : "MISMATCH"}`);
  console.log(`Policy: ${result.policy}`);
  console.log(`Project State: v${result.projectStateVersion}${result.stateIssues.length ? " / FAILED" : " / PASS"}`);
  console.log(`Memory Graph: v${result.memoryGraphVersion}${result.graphIssues.length ? " / FAILED" : " / PASS"} (structure and references only; semantic coverage requires reviewed retrieval evidence)`);
  console.log(`Project State sha256: ${result.stateSha256}`);
  console.log(`Memory Graph sha256: ${result.graphSha256}`);
  if (result.outbox) {
    console.log(
      `Durable outbox: ${result.outbox.returnCount} returns / ${result.outbox.routedCount} routed / ` +
        `${result.outbox.issues.length ? "FAILED" : "PASS"}`,
    );
  }
  for (const issue of [...result.stateIssues, ...result.graphIssues, ...(result.outbox?.issues || [])]) console.log(`- ${issue}`);
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
    const result = await controlCheck(statePath, graphPath, {
      outboxPath: flags.outbox ? path.resolve(flags.outbox) : null,
      expectStateSha: flags.expectStateSha,
      expectGraphSha: flags.expectGraphSha,
    });
    printControlCheck(result, flags.json);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "guard-check") {
    if (!flags.state || !flags.graph) throw new Error(`guard-check requires --state and --graph\n\n${usage()}`);
    const statePath = path.resolve(flags.state);
    const graphPath = path.resolve(flags.graph);
    const result = await guardCheck(statePath, graphPath, {
      outboxPath: flags.outbox ? path.resolve(flags.outbox) : null,
      acceptedIncidentId: flags.acceptedIncident,
      activityPath: flags.activity ? path.resolve(flags.activity) : null,
    });
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

const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entryPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Vydykhai: ${error.message}`);
    process.exitCode = 1;
  });
}
