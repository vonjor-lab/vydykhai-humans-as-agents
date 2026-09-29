import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm, realpath, readdir, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { stageModulePilot } from "../scripts/prepare-module-pilot.mjs";
import { createFreeze } from "../scripts/prepare-framework-eval.mjs";
import { validateDurableOutbox } from "../scripts/vydykhai.mjs";
import { rawCases } from "./fixtures/module-transition/cases.mjs";

const source = name => readFile(new URL(`../${name}`, import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

async function fixture(t) {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "module-pilot-")));
  t.after(() => rm(home, { recursive: true, force: true }));
  const root = path.join(home, "repo"); await mkdir(root);
  const put = async (name, bytes) => {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, typeof bytes === "string" || Buffer.isBuffer(bytes) ? bytes : JSON.stringify(bytes));
  };
  for (const name of ["cases.json", "rubric.json", "README.md", "prompt.md"]) {
    const file = `tests/fixtures/framework-behavior/${name}`; await put(file, await source(file));
  }
  for (const name of ["README.md", "contract.md"]) {
    const file = `tests/fixtures/module-transition/${name}`; await put(file, await source(file));
  }
  for (const name of ["prepare-framework-eval", "prepare-module-pilot", "vydykhai", "memory-brief", "context-run",
    "context-prepare", "context-navigation", "context-cost", "module-access", "adoption-plan", "checkpoint-review"]) {
    const file = `scripts/${name}.mjs`; await put(file, await source(file));
  }
  for (const name of ["AGENTS_CORE", "FRAMEWORK", "FRAMEWORK_RU", "VYDYKHAI_NOTICE"]) await put(`docs/${name}.md`, `${name}\n`);
  await put("docs/workflows/event.md", "Managed procedure\n");
  await put(".agents/skills/start-work/SKILL.md", "Managed skill\n");
  await put("vydykhai.json", { version: "1.32.8" });
  await put("AGENTS.md", "PRIVATE-MAINTAINER-INSTRUCTIONS\n");
  const git = args => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  git(["init", "--quiet"]); git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
    "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "Synthetic baseline"]);
  await put("tests/fixtures/framework-behavior/freeze.json", await createFreeze(root, git(["rev-parse", "HEAD"])));
  return { home, root, put };
}

test("raw module cases retain explicit pending and routed invariants on legacy input", () => {
  const cases = rawCases("INDEPENDENT");
  assert.equal(cases.length, 16);
  assert.equal(new Set(cases.map(c => c.id)).size, 16);
  for (const c of cases) {
    const actual = validateDurableOutbox(c.text);
    assert.deepEqual(actual.pendingReturnIds, c.pending, c.id);
    assert.deepEqual(actual.routedReturnIds, c.routed, c.id);
  }
});

test("staging freezes sources, isolates review material and grants no paid budget", async t => {
  const f = await fixture(t), output = path.join(f.home, "pilot");
  const result = await stageModulePilot(f.root, output);
  assert.equal(result.status, "STAGED_NOT_RUN");
  assert.equal(result.modelCalls, 0);
  assert.equal(result.attempts, 4);
  const budget = JSON.parse(await readFile(path.join(output, "review/budget-template.json")));
  assert.equal(budget.status, "NOT_APPROVED");
  assert.equal(budget.tokenMetric, "GROSS_INPUT_PLUS_OUTPUT");
  assert.equal(budget.enforcement, "UNVERIFIED");
  const { sha256, ...freeze } = JSON.parse(await readFile(path.join(output, "review/freeze.json")));
  assert.equal(sha256, hash(JSON.stringify(freeze, null, 2) + "\n"));
  for (const record of freeze.records) {
    const bytes = await readFile(path.join(output, record.path));
    assert.equal(hash(bytes), record.sha256);
    assert.equal(bytes.length, record.bytes);
    if (!record.path.startsWith("review/")) assert.ok(!bytes.includes("INDEPENDENT-20260929"));
  }
  for (const worker of ["producer", "consumer-a", "consumer-b"]) {
    assert.deepEqual(await readdir(path.join(output, worker, "work")), []);
    assert.equal(await readFile(path.join(output, worker, "AGENTS.md"), "utf8"), "AGENTS_CORE\n");
  }
  const prompt = await readFile(path.join(output, "producer/TASK.md"), "utf8");
  assert.match(prompt, /no existing module-map file/);
  assert.match(prompt, /nongit isolated copy/);
  assert.equal(freeze.sourceScriptSha256, hash(await source("scripts/prepare-module-pilot.mjs")));
});

test("staging rejects relative, internal, aliased internal and occupied outputs", async t => {
  const f = await fixture(t);
  await assert.rejects(stageModulePilot(f.root, "relative"), /PILOT_ABSOLUTE_OUTPUT_REQUIRED/);
  await assert.rejects(stageModulePilot(f.root, path.join(f.root, "pilot")), /PILOT_EXTERNAL_OUTPUT_REQUIRED/);
  await symlink(f.root, path.join(f.home, "alias"));
  await assert.rejects(stageModulePilot(f.root, path.join(f.home, "alias", "pilot")), /PILOT_EXTERNAL_OUTPUT_REQUIRED/);
  const output = path.join(f.home, "occupied"); await mkdir(output);
  await writeFile(path.join(output, "sentinel"), "retained");
  await assert.rejects(stageModulePilot(f.root, output), { code: "EEXIST" });
  assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "retained");
});

test("changed candidate instructions prevent staging before any output is created", async t => {
  const f = await fixture(t), output = path.join(f.home, "stale");
  await f.put("docs/AGENTS_CORE.md", "Changed candidate\n");
  await assert.rejects(stageModulePilot(f.root, output), /EVAL_CANDIDATE_DRIFT/);
  await assert.rejects(readdir(output), { code: "ENOENT" });
});

test("module pilot evidence stays maintainer-only and does not hide missing usage", async () => {
  const manifest = JSON.parse(await source("vydykhai.json"));
  for (const file of ["scripts/prepare-module-pilot.mjs", "tests/fixtures/module-transition", "docs/evidence"]) {
    assert.ok(!manifest.managedPaths.some(root => file === root || file.startsWith(root + "/")));
  }
  const evidence = JSON.parse(await source("docs/evidence/module-transition-2026-09-29.json"));
  assert.equal(evidence.attemptsUsed, evidence.approvedAttempts);
  assert.equal(evidence.remainingAttempts.length, 0);
  assert.equal(evidence.budget.enforcement, "NOT_ENFORCED");
  assert.equal(evidence.budget.subscriptionAllowance, "UNKNOWN");
  assert.equal(evidence.producer.combinedTokens, evidence.producer.inputTokens + evidence.producer.outputTokens);
  const measured = [evidence.producer, ...evidence.consumerAttempts].filter(a => typeof a.inputTokens === "number");
  assert.equal(measured.length, evidence.knownUsageOnly.attemptsWithUsage);
  for (const key of ["inputTokens", "cachedInputTokens", "outputTokens"])
    assert.equal(evidence.knownUsageOnly[key], measured.reduce((sum, a) => sum + a[key], 0));
  assert.equal(evidence.knownUsageOnly.fullPilotTokenTotal, "UNKNOWN");
});
