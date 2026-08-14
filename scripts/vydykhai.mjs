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
  node scripts/vydykhai.mjs update [target-repo] [--from <framework-repo>] [--force]
`;
}

function parseArgs(argv) {
  const positionals = [];
  const flags = { force: false, offline: false, json: false, from: null };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--force") flags.force = true;
    else if (value === "--offline") flags.offline = true;
    else if (value === "--json") flags.json = true;
    else if (value === "--from") {
      flags.from = argv[i + 1];
      i += 1;
      if (!flags.from) throw new Error("--from requires a framework repository path");
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
