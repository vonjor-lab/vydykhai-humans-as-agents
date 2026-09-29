// Maintainer-only input freezing/staging. Never invokes a model or scores behavior.
import { readFile, readdir, lstat, realpath, mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "./memory-brief.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = "tests/fixtures/framework-behavior";
const FREEZE = `${FIXTURE}/freeze.json`;
const INPUTS = ["cases.json", "rubric.json", "prompt.md", "README.md"].map(p => `${FIXTURE}/${p}`)
  .concat("scripts/prepare-framework-eval.mjs");
const TOP = ["docs/AGENTS_CORE.md", "docs/FRAMEWORK.md", "docs/FRAMEWORK_RU.md", "docs/VYDYKHAI_NOTICE.md", "vydykhai.json"];
const DIRS = ["docs/workflows", ".agents/skills"];
const hash = value => sha256(canonicalJson(value));
const need = (value, code) => { if (!value) throw new Error(code); };
const string = value => typeof value === "string" && value.trim().length > 0;
const unique = values => new Set(values).size === values.length;
const keys = (value, names) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).sort().join() === [...names].sort().join();
const jsonBytes = value => Buffer.from(JSON.stringify(value, null, 2) + "\n");
const included = name => TOP.includes(name) || (name.endsWith(".md") && DIRS.some(d => name.startsWith(d + "/")));
const records = files => [...files].sort(([a], [b]) => a.localeCompare(b, "en")).map(([name, bytes]) => ({
  path: name, sha256: sha256(bytes), bytes: bytes.length,
}));
const git = (root, args) => execFileSync("git", ["--no-replace-objects", "-C", root, ...args], { maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });

async function localFile(root, name) {
  const target = path.join(root, name), stat = await lstat(target);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2 * 1024 * 1024 &&
    await realpath(target) === target, "EVAL_SOURCE_FILE_INVALID");
  return readFile(target);
}

export function validateCases(cases, rubric) {
  need(keys(cases, ["schema", "cases"]) && cases.schema === "framework.behavior-cases.v1" && Array.isArray(cases.cases) && cases.cases.length === 8, "EVAL_CASES_INVALID");
  need(keys(rubric, ["schema", "scoring", "cases"]) && rubric.schema === "framework.behavior-rubric.v1" && Array.isArray(rubric.cases) &&
    rubric.cases.length === cases.cases.length && string(rubric.scoring), "EVAL_RUBRIC_INVALID");
  need(unique(cases.cases.map(c => c.id)) && unique(rubric.cases.map(c => c.id)), "EVAL_DUPLICATE_CASE");
  for (const c of cases.cases) {
    need(keys(c, ["id", "role", "task", "events", "evidence"]) && /^C\d{2}$/.test(c.id) && ["execution", "orchestrator"].includes(c.role) && string(c.task) &&
      Array.isArray(c.events) && c.events.length > 0 && Array.isArray(c.evidence) && c.evidence.length > 0, "EVAL_CASE_INVALID");
    const facts = [...c.events, ...c.evidence];
    need(facts.every(f => keys(f, ["id", "source", "text"]) && /^[HE]\d+$/.test(f.id) && string(f.source) && string(f.text)) &&
      unique(facts.map(f => f.id)), "EVAL_FACT_INVALID");
    const r = rubric.cases.find(r => r.id === c.id);
    need(keys(r, ["id", "checks"]) && Array.isArray(r.checks) && r.checks.length >= 3 && unique(r.checks.map(check => check.id)), "EVAL_CHECKS_INVALID");
    for (const check of r.checks) need(keys(check, ["id", "kind", "sources", "criterion"]) && string(check.id) && string(check.criterion) &&
      ["safety", "effectiveness"].includes(check.kind) && Array.isArray(check.sources) && check.sources.length > 0 &&
      unique(check.sources) && check.sources.every(id => facts.some(f => f.id === id)), "EVAL_CHECK_SOURCE_INVALID");
    need(["safety", "effectiveness"].every(kind => r.checks.some(check => check.kind === kind)), "EVAL_CHECK_BALANCE_INVALID");
  }
}

async function snapshot(root, revision) {
  const files = new Map();
  if (revision) {
    need(/^[a-f0-9]{40}$/.test(revision), "EVAL_EXACT_REVISION_REQUIRED");
    const names = git(root, ["ls-tree", "-rz", "--name-only", revision, "--", ...TOP, ...DIRS])
      .toString().split("\0").filter(name => name && included(name));
    for (const name of names) files.set(name, git(root, ["show", `${revision}:${name}`]));
  } else {
    const walk = async name => {
      const stat = await lstat(path.join(root, name));
      need(!stat.isSymbolicLink(), "EVAL_SOURCE_SYMLINK");
      if (stat.isDirectory()) for (const child of (await readdir(path.join(root, name))).sort()) await walk(`${name}/${child}`);
      else if (included(name)) files.set(name, await localFile(root, name));
    };
    for (const name of [...TOP, ...DIRS]) await walk(name);
  }
  need(TOP.every(name => files.has(name)), "EVAL_INSTRUCTION_FILE_MISSING");
  return files;
}

async function inputs(root) {
  const files = new Map();
  for (const name of INPUTS) files.set(name, await localFile(root, name));
  validateCases(JSON.parse(files.get(`${FIXTURE}/cases.json`)), JSON.parse(files.get(`${FIXTURE}/rubric.json`)));
  return files;
}

export async function createFreeze(root, revision) {
  root = await realpath(root);
  const baseline = await snapshot(root, revision), candidate = await snapshot(root), sources = await inputs(root);
  const baseManifest = JSON.parse(baseline.get("vydykhai.json"));
  need(baseManifest.version === "1.32.8", "EVAL_BASELINE_VERSION_CHANGED");
  const record = { schema: "framework.behavior-freeze.v1", baseline: { revision, files: records(baseline) },
    candidate: { files: records(candidate) }, inputs: records(sources) };
  return { ...record, sha256: hash(record) };
}

export async function checkFreeze(root, freeze) {
  root = await realpath(root);
  const { sha256: frozenHash, ...body } = freeze;
  need(body.schema === "framework.behavior-freeze.v1" && frozenHash === hash(body), "EVAL_FREEZE_INVALID");
  const baseline = await snapshot(root, body.baseline.revision), candidate = await snapshot(root), sources = await inputs(root);
  need(hash(records(baseline)) === hash(body.baseline.files), "EVAL_BASELINE_DRIFT");
  need(hash(records(candidate)) === hash(body.candidate.files), "EVAL_CANDIDATE_DRIFT");
  need(hash(records(sources)) === hash(body.inputs), "EVAL_INPUT_DRIFT");
  return { baseline, candidate, sources };
}

export function trialOrder(cases) {
  return cases.flatMap((c, i) => (i % 2 ? ["candidate", "baseline"] : ["baseline", "candidate"])
    .map((arm, j) => ({ id: `trial-${String(i * 2 + j + 1).padStart(2, "0")}`, caseId: c.id, arm })));
}

export async function stageTrials(root, freeze, output) {
  root = await realpath(root);
  need(path.isAbsolute(output), "EVAL_ABSOLUTE_OUTPUT_REQUIRED");
  const destination = path.join(await realpath(path.dirname(output)), path.basename(output));
  need(destination !== root && !destination.startsWith(root + path.sep), "EVAL_OUTPUT_MUST_BE_EXTERNAL");
  // Reuse the verified bytes, not files reread after validation.
  const verified = await checkFreeze(root, freeze);
  await mkdir(destination); // Exclusive directory creation; never overwrite another run.
  const write = async (name, bytes) => {
    const file = path.join(destination, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx" });
  };
  const cases = JSON.parse(verified.sources.get(`${FIXTURE}/cases.json`)).cases;
  const prompt = verified.sources.get(`${FIXTURE}/prompt.md`), trials = trialOrder(cases);
  for (const trial of trials) {
    const dir = `${trial.id}/`, files = verified[trial.arm];
    for (const [name, bytes] of files) await write(dir + name, bytes);
    await write(dir + "AGENTS.md", files.get("docs/AGENTS_CORE.md"));
    await write(dir + "SCENARIO.json", jsonBytes(cases.find(c => c.id === trial.caseId)));
    await write(dir + "PROMPT.md", prompt);
  }
  await write("review/rubric.json", verified.sources.get(`${FIXTURE}/rubric.json`));
  await write("review/freeze.json", jsonBytes(freeze));
  await write("review/run-index.json", jsonBytes({ schema: "framework.behavior-runs.v1", freezeSha256: freeze.sha256,
    status: "STAGED_NOT_RUN", modelBudget: "NOT_APPROVED", trials }));
  await write("review/score-template.json", jsonBytes({ schema: "framework.behavior-review.v1", freezeSha256: freeze.sha256,
    reviewer: null, priorArmKnowledge: null, trials: trials.map(({ id, caseId }) => ({ id, caseId, status: "NOT_RUN",
      responseSha256: null, model: null, effort: null, host: null, elapsedMs: null, inputTokens: null, cachedInputTokens: null,
      outputTokens: null, attributableAllowance: null, ceilingBreach: null, checks: [] })) }));
  const words = files => files.get("docs/AGENTS_CORE.md").toString().trim().split(/\s+/u).length;
  return { status: "STAGED_NOT_RUN", output: destination, trials: trials.length, modelCalls: 0, freezeSha256: freeze.sha256,
    residentCoreWords: { baseline: words(verified.baseline), candidate: words(verified.candidate) } };
}

export async function main(args, root = ROOT) {
  if (args.length === 3 && args[0] === "freeze" && args[1] === "--baseline") {
    const freeze = await createFreeze(root, args[2]);
    await writeFile(path.join(root, FREEZE), jsonBytes(freeze), { flag: "wx" });
    return { status: "INPUTS_FROZEN", sha256: freeze.sha256 };
  }
  const freeze = JSON.parse(await readFile(path.join(root, FREEZE)));
  if (args.length === 1 && args[0] === "check") {
    await checkFreeze(root, freeze);
    return { status: "FROZEN_INPUTS_VALID", sha256: freeze.sha256, behavior: "NOT_TESTED", modelCalls: 0 };
  }
  if (args.length === 3 && args[0] === "stage" && args[1] === "--output") return stageTrials(root, freeze, args[2]);
  throw new Error("EVAL_ARGUMENTS_INVALID");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.stdout.write(JSON.stringify(await main(process.argv.slice(2)), null, 2) + "\n"); }
  catch (error) { process.stderr.write((error.code || error.message) + "\n"); process.exitCode = 1; }
}
