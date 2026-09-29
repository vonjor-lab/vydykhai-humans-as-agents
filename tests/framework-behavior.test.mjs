import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir, symlink, realpath } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { createFreeze, checkFreeze, stageTrials, trialOrder, validateCases, main } from "../scripts/prepare-framework-eval.mjs";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";

const dir = "tests/fixtures/framework-behavior";
const source = file => readFile(new URL(`../${file}`, import.meta.url));
const cases = JSON.parse(await source(`${dir}/cases.json`));
const rubric = JSON.parse(await source(`${dir}/rubric.json`));
const pin = body => ({ ...body, sha256: sha256(canonicalJson(body)) });

async function fixture(t) {
  const home = await realpath(await mkdtemp(path.join(os.tmpdir(), "framework-eval-")));
  t.after(() => rm(home, { recursive: true, force: true }));
  const root = path.join(home, "repo"); await mkdir(root);
  const put = async (name, value) => {
    const file = path.join(root, name); await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  };
  for (const name of ["cases.json", "rubric.json", "prompt.md", "README.md"]) await put(`${dir}/${name}`, await source(`${dir}/${name}`));
  await put("scripts/prepare-framework-eval.mjs", await source("scripts/prepare-framework-eval.mjs"));
  await put("docs/AGENTS_CORE.md", "Original managed core\n");
  await put("docs/FRAMEWORK.md", "Human overview\n");
  await put("docs/FRAMEWORK_RU.md", "Other human overview\n");
  await put("docs/VYDYKHAI_NOTICE.md", "Test notice\n");
  await put("docs/workflows/event.md", "Original procedure\n");
  await put(".agents/skills/start-work/SKILL.md", "Original skill\n");
  await put("vydykhai.json", { version: "1.32.8" });
  await put("AGENTS.md", "MAINTAINER-ONLY-DO-NOT-INSTALL\n");
  await put("docs/FRAMEWORK_TRANSITION_PLAN.md", "PRIVATE-EVALUATION-PLAN\n");
  await put("docs/COLLABORATION_FRAMEWORK_CHANGELOG.md", "VARIANT-HYPOTHESIS\n");
  const git = args => execFileSync("git", ["-C", root, ...args], { stdio: ["ignore", "pipe", "pipe"] }).toString().trim();
  git(["init", "--quiet"]); git(["add", "."]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
    "-c", "core.hooksPath=/dev/null", "commit", "--quiet", "-m", "Synthetic baseline"]);
  const revision = git(["rev-parse", "HEAD"]);
  await put("docs/AGENTS_CORE.md", "Candidate managed core\n");
  await put("docs/workflows/added.md", "Candidate event procedure\n");
  return { home, root, revision, put, freeze: await createFreeze(root, revision) };
}

test("decision fixtures cover eight paired cases with source-backed safety and progress checks", () => {
  validateCases(cases, rubric);
  assert.equal(cases.cases.length, 8);
  assert.equal(rubric.cases.flatMap(c => c.checks).length, 24);
  const trials = trialOrder(cases.cases);
  assert.equal(trials.length, 16);
  assert.equal(new Set(trials.map(t => t.id)).size, 16);
  for (let i = 0; i < cases.cases.length; i++) {
    const pair = trials.slice(i * 2, i * 2 + 2);
    assert.deepEqual(pair.map(t => t.caseId), [cases.cases[i].id, cases.cases[i].id]);
    assert.deepEqual(pair.map(t => t.arm), i % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"]);
    assert.ok(pair.every(t => !/baseline|candidate/.test(t.id)));
  }
});

test("missing, ambiguous or ungrounded criteria cannot create a valid evaluation", () => {
  for (const change of [
    r => { r.cases[0].checks[0].sources = ["UNKNOWN"]; },
    r => { r.cases[1].id = r.cases[0].id; },
    r => { r.cases[0].checks[0].criterion = ""; },
    r => { r.cases[0].checks.forEach(c => { c.kind = "safety"; }); },
  ]) {
    const broken = structuredClone(rubric); change(broken);
    assert.throws(() => validateCases(cases, broken), /EVAL_/);
  }
  const ambiguous = structuredClone(cases);
  ambiguous.cases[0].evidence[0].id = ambiguous.cases[0].events[0].id;
  assert.throws(() => validateCases(ambiguous, rubric), /EVAL_FACT_INVALID/);
  const leaked = structuredClone(cases);
  leaked.cases[0].expected = "Hidden answer must never enter the participant packet";
  assert.throws(() => validateCases(leaked, rubric), /EVAL_CASE_INVALID/);
});

test("freeze preserves distinct exact baseline and candidate without changing source files", async t => {
  const f = await fixture(t), before = await readFile(path.join(f.root, "AGENTS.md"));
  const verified = await checkFreeze(f.root, f.freeze);
  assert.equal(verified.baseline.get("docs/AGENTS_CORE.md").toString(), "Original managed core\n");
  assert.equal(verified.candidate.get("docs/AGENTS_CORE.md").toString(), "Candidate managed core\n");
  assert.ok(!verified.baseline.has("docs/workflows/added.md"));
  assert.ok(verified.candidate.has("docs/workflows/added.md"));
  assert.deepEqual(await readFile(path.join(f.root, "AGENTS.md")), before);
  assert.equal(f.freeze.sha256, (await createFreeze(f.root, f.revision)).sha256);
  await assert.rejects(createFreeze(f.root, "HEAD"), /EVAL_EXACT_REVISION_REQUIRED/);
});

test("candidate edits, added instructions, changed rubric and tampered freeze invalidate reuse", async t => {
  const f = await fixture(t);
  await f.put("docs/AGENTS_CORE.md", "Changed again\n");
  await assert.rejects(checkFreeze(f.root, f.freeze), /EVAL_CANDIDATE_DRIFT/);
  await f.put("docs/AGENTS_CORE.md", "Candidate managed core\n");
  await f.put("docs/workflows/another.md", "Unreviewed instruction\n");
  await assert.rejects(checkFreeze(f.root, f.freeze), /EVAL_CANDIDATE_DRIFT/);
  await rm(path.join(f.root, "docs/workflows/another.md"));
  const changedRubric = structuredClone(rubric); changedRubric.cases[0].checks[0].criterion += " Revised.";
  await f.put(`${dir}/rubric.json`, changedRubric);
  await assert.rejects(checkFreeze(f.root, f.freeze), /EVAL_INPUT_DRIFT/);
  await f.put(`${dir}/rubric.json`, await source(`${dir}/rubric.json`));
  await assert.rejects(checkFreeze(f.root, { ...f.freeze, sha256: "0".repeat(64) }), /EVAL_FREEZE_INVALID/);
  const { sha256: ignored, ...body } = structuredClone(f.freeze);
  body.baseline.files[0].sha256 = "0".repeat(64);
  await assert.rejects(checkFreeze(f.root, pin(body)), /EVAL_BASELINE_DRIFT/);
});

test("stage exposes matched public scenarios and instructions but withholds rubric and arm mapping", async t => {
  const f = await fixture(t), output = path.join(f.home, "staged");
  const result = await stageTrials(f.root, f.freeze, output);
  assert.equal(result.status, "STAGED_NOT_RUN"); assert.equal(result.modelCalls, 0); assert.equal(result.trials, 16);
  const index = JSON.parse(await readFile(path.join(output, "review/run-index.json")));
  assert.equal(index.modelBudget, "NOT_APPROVED");
  const files = async root => {
    const out = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...await files(path.join(root, entry.name)));
      else out.push(path.join(root, entry.name));
    }
    return out;
  };
  for (const trial of index.trials) {
    const root = path.join(output, trial.id);
    const scenario = JSON.parse(await readFile(path.join(root, "SCENARIO.json")));
    assert.deepEqual(scenario, cases.cases.find(c => c.id === trial.caseId));
    assert.deepEqual(await readFile(path.join(root, "PROMPT.md")), await source(`${dir}/prompt.md`));
    assert.equal(await readFile(path.join(root, "AGENTS.md"), "utf8"), trial.arm === "baseline" ? "Original managed core\n" : "Candidate managed core\n");
    for (const file of await files(root)) {
      const body = await readFile(file, "utf8");
      assert.doesNotMatch(body, /MAINTAINER-ONLY|PRIVATE-EVALUATION-PLAN|VARIANT-HYPOTHESIS/);
      assert.ok(!file.includes("/review/") && !file.includes("rubric") && !file.includes("run-index"));
      assert.ok(!body.includes(rubric.cases[0].checks[0].criterion));
    }
  }
  const review = JSON.parse(await readFile(path.join(output, "review/score-template.json")));
  assert.ok(review.trials.every(t => t.status === "NOT_RUN" && t.inputTokens === null && t.checks.length === 0));
});

test("staging refuses existing or in-repository outputs and stale inputs before creating a trial", async t => {
  const f = await fixture(t), output = path.join(f.home, "occupied");
  await mkdir(output); await writeFile(path.join(output, "sentinel"), "retained");
  await assert.rejects(stageTrials(f.root, f.freeze, output), { code: "EEXIST" });
  assert.equal(await readFile(path.join(output, "sentinel"), "utf8"), "retained");
  await assert.rejects(stageTrials(f.root, f.freeze, path.join(f.root, "trials")), /EVAL_OUTPUT_MUST_BE_EXTERNAL/);
  await f.put("docs/AGENTS_CORE.md", "Stale\n");
  await assert.rejects(stageTrials(f.root, f.freeze, path.join(f.home, "stale")), /EVAL_CANDIDATE_DRIFT/);
  await assert.rejects(readFile(path.join(f.home, "stale", "trial-01", "PROMPT.md")), { code: "ENOENT" });
});

test("symlinked sources cannot import undisclosed context into a candidate", async t => {
  const f = await fixture(t);
  await writeFile(path.join(f.home, "outside.md"), "Undisclosed outside text");
  await symlink(path.join(f.home, "outside.md"), path.join(f.root, "docs/workflows/linked.md"));
  await assert.rejects(checkFreeze(f.root, f.freeze), /EVAL_SOURCE_SYMLINK/);
});

test("CLI freeze cannot replace prior evidence and check never claims behavior success", async t => {
  const f = await fixture(t);
  const first = await main(["freeze", "--baseline", f.revision], f.root);
  assert.equal(first.status, "INPUTS_FROZEN");
  await assert.rejects(main(["freeze", "--baseline", f.revision], f.root), { code: "EEXIST" });
  const check = await main(["check"], f.root);
  assert.equal(check.status, "FROZEN_INPUTS_VALID");
  assert.equal(check.behavior, "NOT_TESTED"); assert.equal(check.modelCalls, 0);
});

test("comparison materials stay outside the installed runtime and separate screening from product proof", async () => {
  const manifest = JSON.parse(await source("vydykhai.json"));
  for (const file of [dir, "scripts/prepare-framework-eval.mjs"]) {
    assert.ok(!manifest.managedPaths.some(root => file === root || file.startsWith(root + "/")));
  }
  const protocol = (await source(`${dir}/README.md`)).toString();
  assert.match(protocol, /No model calls are authorized/);
  assert.match(protocol, /not a coding benchmark/);
  assert.match(protocol, /No safety regression can be offset/);
  assert.match(protocol, /An all-pass tie establishes no behavioral win/);
  assert.match(protocol, /No silent repinning/);
});
