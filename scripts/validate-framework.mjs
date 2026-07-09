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
if (manifest.defaultAgentProfile?.reasoningEffort !== "xhigh") {
  fail("Default reasoning effort must be xhigh");
}
if (manifest.defaultAgentProfile?.refreshDays !== 7) fail("Default agent profile refreshDays must be 7");
if (!String(manifest.bootstrap || "").endsWith("/BOOTSTRAP.md")) fail("Manifest bootstrap URL is invalid");

for (const managedPath of manifest.managedPaths || []) {
  if (!existsSync(path.join(root, managedPath))) fail(`Managed path is missing: ${managedPath}`);
}

const coreEn = await text("docs/FRAMEWORK.md");
const coreRu = await text("docs/FRAMEWORK_RU.md");
const changelog = await text("docs/COLLABORATION_FRAMEWORK_CHANGELOG.md");
if (!coreEn.includes(`Version: ${manifest.version}`)) fail("English core version differs from manifest");
if (!coreRu.includes(`Версия: ${manifest.version}`)) fail("Russian core version differs from manifest");
if (!changelog.includes(`## ${manifest.version} -`)) fail("Changelog is missing current version");
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
  if (skill.includes("COLLABORATION_FRAMEWORK_2026-06-10")) fail(`${skillFile} still loads the dated framework path`);
  if (lineCount(skill) > 100) fail(`${skillFile} exceeds 100 lines (${lineCount(skill)})`);

  const openaiFile = `${relative}/agents/openai.yaml`;
  if (!existsSync(path.join(root, openaiFile))) fail(`${openaiFile} is missing`);
  else {
    const yaml = await text(openaiFile);
    if (!yaml.includes(`$${entry.name}`)) fail(`${openaiFile} default prompt does not mention $${entry.name}`);
  }
}

const runtimeFiles = [
  "AGENTS.md",
  "BOOTSTRAP.md",
  "README.md",
  "docs/AGENTS_CORE.md",
  "docs/FRAMEWORK.md",
  "docs/FRAMEWORK_RU.md",
  "docs/COLLABORATION_FRAMEWORK_2026-06-10.md",
  "docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md",
  ...(await readdir(path.join(root, "docs/codex-workflows"))).map((name) => `docs/codex-workflows/${name}`),
  ...(await readdir(skillsRoot)).map((name) => `.agents/skills/${name}/SKILL.md`),
];

const privatePattern = /Breetho|Brizo|vdhi|Apatov|Апат|Гагарин|Ордж|Саша|Тер-Авакян|codex:\/\/threads|019e|019f/i;
const hardcodedModelPattern = /gpt-\d+(?:\.\d+)+/i;
for (const relative of runtimeFiles) {
  if (!existsSync(path.join(root, relative))) continue;
  const value = await text(relative);
  if (privatePattern.test(value)) fail(`Private/project marker found in ${relative}`);
  if (hardcodedModelPattern.test(value)) fail(`Hardcoded model version found in ${relative}`);
  if (relative.startsWith("docs/codex-workflows/") && lineCount(value) > 150) {
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
