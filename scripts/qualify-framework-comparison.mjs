// Maintainer-only source/transport preflight. Not a model runner or installed API.
import { mkdir, readFile, readdir, lstat, realpath, writeFile, open } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { inspectControlRuntime } from "./control-runtime.mjs";

export const BASELINE_COMMIT = "b158671788468e6c1f846830245337f3081b497d";
const here = fileURLToPath(import.meta.url);
const probe = fileURLToPath(new URL("./qualify-framework-comparison-probe.mjs", import.meta.url));
const captureScript = fileURLToPath(new URL("./qualify-framework-comparison-scenario.mjs", import.meta.url));
const commandScript = fileURLToPath(new URL("./qualify-framework-comparison-command.mjs", import.meta.url));
const sandboxScript = fileURLToPath(new URL("./local-control-sandbox.mjs", import.meta.url));
const hash = value => sha256(canonicalJson(value));
const need = (value, code) => { if (!value) throw Error(code); };
const inside = (root, file) => file === root || file.startsWith(root + path.sep);
const safeName = name => typeof name === "string" && name.length && !path.isAbsolute(name) &&
  !name.includes("\\") && !name.includes("\0") && !name.split("/").some(p => !p || p === "." || p === "..");
const inputs = ["scripts/qualify-control-cycle.mjs", "tests/context-fixture.mjs",
  "tests/fixtures/retained-progress/events.json", "tests/fixtures/retained-progress/expectations.json"];
const pending = [
  "Wire equivalent external sandbox/tool access and actual policy loading for native arms; no unrestricted legacy shell.",
  "Supply real owner package/decisions and worker readback; caller-supplied identity is not authenticated model provenance.",
  "Wire candidate host admission, post-accept review, owner disposition and controlled continuation; reference-route transport does not satisfy these obligations.",
  "Freeze neutral native task framing: verbatim stageCycle scope/map still describe candidate-specific review/grants and a six-call envelope.",
  "Bind every native dispatch and full-chain usage to the existing allocation records; no dispatch exists here.",
  "Run matched cold cycles; fresh reuse, no-policy calibration and real-owner canary remain separate and NOT RUN."
];

async function directory(name) {
  need(path.isAbsolute(name), "COMPARISON_DIRECTORY_UNSAFE");
  const absolute = path.resolve(name);
  need(await realpath(absolute) === absolute && (await lstat(absolute)).isDirectory(), "COMPARISON_DIRECTORY_UNSAFE");
  return absolute;
}
async function snapshot(root, names = [""]) {
  const contents = new Map();
  async function visit(name) {
    need(name === "" || safeName(name), "COMPARISON_PATH_INVALID");
    const file = path.join(root, name), stat = await lstat(file);
    need(!stat.isSymbolicLink() && await realpath(file) === file, "COMPARISON_SYMLINK_REFUSED");
    if (stat.isDirectory()) {
      for (const child of (await readdir(file)).sort()) await visit(name ? `${name}/${child}` : child);
    } else {
      need(stat.isFile() && stat.size <= 4 * 1024 * 1024, "COMPARISON_FILE_UNSAFE");
      const bytes = await readFile(file);
      need(bytes.length <= 4 * 1024 * 1024, "COMPARISON_FILE_UNSAFE");
      contents.set(name, bytes);
    }
  }
  for (const name of names) await visit(name);
  const files = Object.fromEntries([...contents].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, bytes]) => [name, sha256(bytes)]));
  return { files, contents, digest: hash(files) };
}
async function copySnapshot(root, source) {
  await mkdir(root, { mode: 0o700 });
  for (const [name, bytes] of source.contents) {
    await mkdir(path.dirname(path.join(root, name)), { recursive: true, mode: 0o700 });
    await writeFile(path.join(root, name), bytes, { flag: "wx", mode: 0o400 });
  }
}
function command(binary, args, { cwd, input, env = { PATH: "/usr/bin:/bin", LANG: "C", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" } } = {}) {
  const result = spawnSync(binary, args, { cwd, input, env, timeout: 15000, maxBuffer: 32 * 1024 * 1024 });
  need(!result.error && result.status === 0, `COMPARISON_SUBPROCESS_FAILED:${result.error?.code ?? result.stderr?.toString().slice(0, 2000)}`);
  return result.stdout;
}
async function adapterIdentity() {
  // Pin the helpers actually imported here, not a caller-selected candidate copy.
  // Keep this explicit inventory aligned when adding qualification dependencies.
  const localRoot = path.dirname(path.dirname(here));
  const application = await snapshot(localRoot, ["auth", "owner", "prepare", "control", "native", "ledger", "recovery"]
    .map(name => `scripts/qualify-framework-comparison-${name}.mjs`));
  const runtime = await inspectControlRuntime(localRoot);
  return { adapter: sha256(await readFile(here)), probe: sha256(await readFile(probe)),
    capture: sha256(await readFile(captureScript)), supervisor: sha256(await readFile(commandScript)),
    sandbox: sha256(await readFile(sandboxScript)),
    memoryBrief: sha256(await readFile(new URL("./memory-brief.mjs", import.meta.url))),
    controlRuntime: sha256(await readFile(new URL("./control-runtime.mjs", import.meta.url))),
    applicationFiles: application.files, liveRuntime: runtime.digest };
}
async function candidateSnapshot(root) {
  const runtime = await inspectControlRuntime(root);
  const manifest = JSON.parse(await readFile(path.join(root, "vydykhai.json"), "utf8"));
  need(manifest.name === "vydykhai" && Array.isArray(manifest.managedPaths) && manifest.managedPaths.every(safeName), "COMPARISON_MANIFEST_INVALID");
  const names = [...new Set([...manifest.managedPaths, ...Object.keys(runtime.description.files), "BOOTSTRAP.md", ...inputs])].sort();
  return { ...(await snapshot(root, names)), runtime: runtime.digest };
}

export async function stageComparisonPreflight({ sourceRoot, output }) {
  const source = await directory(sourceRoot);
  need(path.isAbsolute(output) && path.resolve(output) === output, "COMPARISON_OUTPUT_REQUIRED");
  await directory(path.dirname(output));
  need(!inside(source, output) && !inside(output, source), "COMPARISON_SOURCE_OUTPUT_OVERLAP");
  const git = (...args) => command("git", ["--no-replace-objects", "-C", source, ...args]);
  need(git("rev-parse", "v1.34.1^{commit}").toString().trim() === BASELINE_COMMIT, "COMPARISON_BASELINE_IDENTITY_MISMATCH");
  const entries = git("ls-tree", "-rz", BASELINE_COMMIT).toString().split("\0").filter(Boolean);
  need(entries.every(row => /^100(?:644|755) blob [a-f0-9]{40}\t/.test(row) && safeName(row.split("\t")[1])), "COMPARISON_ARCHIVE_TYPE_INVALID");
  const archive = git("archive", "--format=tar", BASELINE_COMMIT);
  const candidate = await candidateSnapshot(source), adapter = await adapterIdentity();
  await mkdir(output, { mode: 0o700 }); // Never reuse or overwrite a previous freeze.
  const baselineRoot = path.join(output, "baseline");
  await mkdir(baselineRoot, { mode: 0o700 });
  command("tar", ["-xf", "-", "-C", baselineRoot], { input: archive });
  const baseline = await snapshot(baselineRoot);
  const old = JSON.parse(baseline.contents.get("vydykhai.json"));
  need(old.name === "vydykhai" && old.version === "1.34.1", "COMPARISON_BASELINE_MANIFEST_INVALID");
  for (const name of ["scripts/control-host.mjs", "scripts/control-service.mjs", "scripts/qualify-control-cycle.mjs"])
    need(!Object.hasOwn(baseline.files, name), "COMPARISON_BASELINE_CONTAMINATED");
  await copySnapshot(path.join(output, "candidate"), candidate);
  await mkdir(path.join(output, "workspaces"), { mode: 0o700 });
  for (const arm of ["baseline", "candidate"]) await mkdir(path.join(output, "workspaces", arm), { mode: 0o700 });
  const current = await candidateSnapshot(source);
  need(current.digest === candidate.digest && current.runtime === candidate.runtime && hash(await adapterIdentity()) === hash(adapter), "COMPARISON_SOURCE_CHANGED_DURING_STAGE");
  const freeze = { schema: "qualification.comparison-preflight.v1", adapter,
    baseline: { commit: BASELINE_COMMIT, archiveSha256: sha256(archive), files: baseline.files, digest: baseline.digest },
    candidate: { kind: "working-tree-not-release", runtime: candidate.runtime, files: candidate.files, digest: candidate.digest },
    inputs: Object.fromEntries(inputs.map(name => [name, candidate.files[name]])),
    inputExposure: "REFERENCE_CARRIERS_ONLY_NOT_MODEL_CONTEXT", pending };
  await writeFile(path.join(output, "freeze.json"), canonicalJson(freeze) + "\n", { flag: "wx", mode: 0o400 });
  return { output, digest: hash(freeze), modelsLaunched: 0, wholeChainComparatorReady: false };
}

export async function verifyComparisonPreflight(output, expectedDigest) {
  await directory(output);
  need(/^[a-f0-9]{64}$/.test(expectedDigest ?? ""), "COMPARISON_FREEZE_DIGEST_REQUIRED");
  const freezePath = path.join(output, "freeze.json");
  need(!(await lstat(freezePath)).isSymbolicLink(), "COMPARISON_SYMLINK_REFUSED");
  const freeze = JSON.parse(await readFile(freezePath, "utf8"));
  need(hash(freeze) === expectedDigest && freeze.schema === "qualification.comparison-preflight.v1" && freeze.baseline.commit === BASELINE_COMMIT,
    "COMPARISON_FREEZE_MISMATCH");
  need(hash(await adapterIdentity()) === hash(freeze.adapter), "COMPARISON_ADAPTER_CHANGED");
  for (const arm of ["baseline", "candidate"]) {
    const actual = await snapshot(path.join(output, arm));
    need(actual.digest === freeze[arm].digest && hash(actual.files) === hash(freeze[arm].files), `COMPARISON_ARM_DRIFT:${arm}`);
  }
  return freeze;
}

// One caller-requested native primitive, no phase scheduling or invented decisions.
// This is trusted maintainer transport, NOT an authenticated model tool endpoint.
export async function invokeComparisonAdapter({ output, expectedDigest, arm, operation = "capabilities", args = [], file = null, scenarioDigest = null, nativeExecution = null }) {
  need(["baseline", "candidate"].includes(arm), "COMPARISON_ARM_INVALID");
  const freeze = await verifyComparisonPreflight(output, expectedDigest);
  const workspace = await directory(path.join(output, "workspaces", arm));
  const root = path.join(output, arm);
  const before = await snapshot(workspace);
  const scenario = scenarioDigest ? await verifyComparisonScenario({ output, scenarioDigest }) : null;
  need(!nativeExecution || (arm === "baseline" && scenario && operation === "context"), "COMPARISON_NATIVE_BASELINE_ONLY");
  if (scenario && !nativeExecution) for (const [name, digest] of Object.entries(scenario.files))
    need(sha256(await readFile(path.join(workspace, name))) === digest, `COMPARISON_SCENARIO_DRIFT:${name}`);
  let fixed = scenario ? { workspace, files: scenario.files, recipeSha256: sha256(canonicalJson(scenario.oracle.recipe) + "\n") } : null;
  let supervision = null;
  if (nativeExecution) {
    need(Object.keys(nativeExecution).sort().join() === "controlRoot,helper,helperSha256,recipeSha256", "COMPARISON_NATIVE_EXECUTION_INVALID");
    const helper = path.join(workspace, ".comparison-command.mjs");
    need(nativeExecution.helper === helper && before.files[".comparison-command.mjs"] === freeze.adapter.supervisor &&
      nativeExecution.helperSha256 === freeze.adapter.supervisor, "COMPARISON_NATIVE_HELPER_MISMATCH");
    need(/^[a-f0-9]{64}$/.test(nativeExecution.recipeSha256 ?? "") &&
      before.files["recipe.json"] === nativeExecution.recipeSha256, "COMPARISON_NATIVE_RECIPE_MISMATCH");
    await directory(nativeExecution.controlRoot);
    need(!inside(workspace, nativeExecution.controlRoot) && !inside(nativeExecution.controlRoot, workspace), "COMPARISON_NATIVE_CONTROL_OVERLAP");
    const files = Object.fromEntries(["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"]
      .map(name => [name, scenario.files[name]]));
    need(Object.entries(files).every(([name, digest]) => digest && before.files[name] === digest), "COMPARISON_NATIVE_INPUT_DRIFT");
    fixed = { workspace, files, recipeSha256: nativeExecution.recipeSha256 };
    supervision = { controlRoot: nativeExecution.controlRoot, helper, helperSha256: nativeExecution.helperSha256 };
  }
  const request = { operation, args, file, fixed, ...(supervision ? { supervision } : {}) };
  const raw = command(process.execPath, ["--permission", ...(fixed ? ["--allow-child-process", `--allow-fs-read=${process.execPath}`] : []),
    ...(supervision ? [`--allow-fs-read=${supervision.controlRoot}`, "--allow-fs-read=/usr/bin/sandbox-exec"] : []),
    `--allow-fs-read=${root}`, `--allow-fs-read=${workspace}`, `--allow-fs-read=${commandScript}`,
    `--allow-fs-read=${sandboxScript}`,
    `--allow-fs-read=${probe}`, `--allow-fs-write=${workspace}`, probe, root, arm],
  { cwd: workspace, input: JSON.stringify(request), env: { PATH: "/usr/bin:/bin", HOME: workspace, LANG: "C" } });
  const observed = JSON.parse(raw);
  await verifyComparisonPreflight(output, expectedDigest);
  const after = await snapshot(workspace);
  if (scenario) for (const [name, digest] of Object.entries(nativeExecution ? fixed.files : scenario.files))
    need(after.files[name] === digest, `COMPARISON_SCENARIO_DRIFT:${name}`);
  return { ...observed, arm, armDigest: freeze[arm].digest, neutralAdapter: freeze.adapter, requestSha256: hash(request),
    before: before.files, after: after.files, callerIdentity: "UNAUTHENTICATED_MAINTAINER_INPUT",
    semanticEvidence: false, modelsLaunched: 0, wholeChainComparatorReady: false };
}

// Trusted qualification driver, not a baseline policy or a candidate host. Only
// observations produced by this instance can be returned to owning acceptance.
// Pending/unknown attempts survive; reopening does not invent execution history.
export async function openNativeBaselineExecution({ output, expectedDigest, scenarioDigest, nativeExecution,
  directory: executionRoot, requests, authenticateDispatch }) {
  need(typeof authenticateDispatch === "function" && Array.isArray(requests) && requests.length > 0,
    "BASELINE_EXECUTION_CONFIG_INVALID");
  const freeze = await verifyComparisonPreflight(output, expectedDigest);
  const scenario = await verifyComparisonScenario({ output, scenarioDigest });
  const workspace = await directory(path.join(output, "workspaces/baseline"));
  nativeExecution = structuredClone(nativeExecution);
  need(nativeExecution && Object.keys(nativeExecution).sort().join() === "controlRoot,helper,helperSha256,recipeSha256" &&
    nativeExecution.helper === path.join(workspace, ".comparison-command.mjs") &&
    nativeExecution.helperSha256 === freeze.adapter.supervisor && /^[a-f0-9]{64}$/.test(nativeExecution.recipeSha256 ?? ""),
    "BASELINE_EXECUTION_CONFIG_INVALID");
  const controlRoot = await directory(nativeExecution.controlRoot);
  need(!((await lstat(controlRoot)).mode & 0o077), "BASELINE_EXECUTION_DIRECTORY_INVALID");
  need(path.isAbsolute(executionRoot) && path.resolve(executionRoot) === executionRoot &&
    inside(controlRoot, executionRoot) && executionRoot !== controlRoot &&
    !inside(workspace, controlRoot) && !inside(controlRoot, workspace), "BASELINE_EXECUTION_DIRECTORY_INVALID");
  await directory(path.dirname(executionRoot));
  const fixed = { workspace, files: Object.fromEntries(
    ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "continuation.mjs", "consumer-input.json"]
      .map(name => [name, scenario.files[name]])), recipeSha256: nativeExecution.recipeSha256 };
  const transportSha256 = hash({ fixed, helperSha256: nativeExecution.helperSha256 });
  const registered = new Map(), completed = new Map();
  for (const entry of structuredClone(requests)) {
    need(/^[A-Za-z0-9_-]{1,100}$/.test(entry.id ?? "") && !registered.has(entry.id) && safeName(entry.file) &&
      entry.request?.workspace === workspace && ["resume", "accept"].includes(entry.request.operation) &&
      /^[a-f0-9]{64}$/.test(entry.bindingSha256 ?? "") && Array.isArray(entry.dependencies) &&
      entry.dependencies.every(value => /^[A-Za-z0-9_-]{1,100}$/.test(value)) &&
      new Set(entry.dependencies).size === entry.dependencies.length, "BASELINE_EXECUTION_REQUEST_INVALID");
    registered.set(entry.id, entry);
  }
  const sync = async dir => {
    const fd = await open(dir, "r"); try { await fd.sync(); } finally { await fd.close(); }
  };
  const save = async (file, value) => {
    const text = canonicalJson(value) + "\n", fd = await open(file, "wx", 0o600);
    try { await fd.writeFile(text); await fd.sync(); } finally { await fd.close(); }
    await sync(path.dirname(file)); return sha256(text);
  };
  await mkdir(executionRoot, { mode: 0o700 }); await sync(path.dirname(executionRoot));
  await save(path.join(executionRoot, "header.json"), { schema: "comparison.baseline-execution-header.v1",
    sourceFreeze: expectedDigest, scenarioDigest, workspace, nativeExecution, requests: [...registered.values()] });
  let busy = false;
  const execute = async ({ requestId, dispatchId }) => {
    need(!busy, "BASELINE_EXECUTION_BUSY"); busy = true;
    try {
      const selected = registered.get(requestId);
      need(selected && /^[A-Za-z0-9_-]{1,100}$/.test(dispatchId ?? ""), "BASELINE_EXECUTION_REQUEST_UNKNOWN");
      const attempt = path.join(executionRoot, requestId);
      try { await lstat(attempt); throw Error("BASELINE_EXECUTION_ALREADY_ATTEMPTED"); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      const authorize = async () => {
        await verifyComparisonPreflight(output, expectedDigest);
        const actual = await snapshot(workspace, [selected.file]);
        need(hash(JSON.parse(actual.contents.get(selected.file))) === hash(selected.request), "BASELINE_EXECUTION_REQUEST_CHANGED");
        if (selected.request.operation === "accept") {
          const actions = [...completed.values()].map(row => row.result).filter(row =>
            row.request.operation === "resume" && hash(row.request.task) === hash(selected.request.task) &&
            hash(row.request.capsule) === hash(selected.request.capsule) &&
            row.observation.result?.status === "ACTION_COMPLETED" && row.consumerCheck.status === "PASS");
          need(actions.length === 1, "BASELINE_EXECUTION_ACTION_NOT_OBSERVED");
          const action = await readExecution(actions[0].id), output = await snapshot(workspace, ["consumer-output.json"]);
          need(output.files["consumer-output.json"] === action.consumerCheck.artifact.sha256 &&
            action.observation.after["consumer-output.json"] === action.consumerCheck.artifact.sha256,
            "BASELINE_EXECUTION_ACTION_OUTPUT_CHANGED");
        }
        const auth = structuredClone(await authenticateDispatch(dispatchId));
        need(auth?.id === dispatchId && auth.arm === "baseline" && auth.role === "worker" && auth.state === "COMPLETED" &&
          auth.decision === "AUTHORIZE_SUPERVISOR_ACTION" && auth.runtimeDigest === freeze.baseline.digest &&
          auth.sourceRoot === workspace && auth.transportSha256 === transportSha256 &&
          auth.requestSha256 === hash(selected.request) && hash(auth.request) === hash(selected.request) &&
          auth.bindingSha256 === selected.bindingSha256 && auth.dependenciesSha256 === hash(selected.dependencies) &&
          [auth.traceSha256, auth.allocationSha256, auth.sourceRegistrySha256, auth.sourceSnapshotDigest]
            .every(value => /^[a-f0-9]{64}$/.test(value ?? "")) &&
          Number.isFinite(auth.expiresAt) && auth.expiresAt > Date.now(), "BASELINE_EXECUTION_NOT_AUTHORIZED");
        return auth;
      };
      const authorization = await authorize();
      await mkdir(attempt, { mode: 0o700 }); await sync(executionRoot);
      const pending = { schema: "comparison.baseline-execution-pending.v1", requestId, dispatchId,
        sourceFreeze: expectedDigest, scenarioDigest, request: selected.request, authorization };
      await save(path.join(attempt, "pending.json"), pending);
      need(hash(await authorize()) === hash(authorization), "BASELINE_EXECUTION_AUTH_CHANGED");
      const observation = await invokeComparisonAdapter({ output, expectedDigest, scenarioDigest,
        nativeExecution, arm: "baseline", operation: "context", file: selected.file });
      let consumerCheck = { status: "NOT_CHECKED" };
      if (["ACTION_COMPLETED", "VERIFIED"].includes(observation.result?.status)) {
        const actual = await snapshot(workspace, ["consumer-output.json"]);
        need(actual.files["consumer-output.json"] === observation.after["consumer-output.json"], "BASELINE_CONSUMER_CHANGED");
        consumerCheck = { status: hash(JSON.parse(actual.contents.get("consumer-output.json"))) === hash(scenario.oracle.retainedOutput)
          ? "PASS" : "FAIL", artifact: { path: "consumer-output.json", sha256: actual.files["consumer-output.json"] } };
      }
      const result = { schema: "comparison.baseline-execution.v1", id: requestId, arm: "baseline",
        sourceFreeze: expectedDigest, scenarioDigest, request: selected.request, requestSha256: hash(selected.request),
        authorization, observation, observationSha256: hash(observation), consumerCheck };
      const resultSha256 = await save(path.join(attempt, "result.json"), result);
      completed.set(requestId, { result, resultSha256, pendingSha256: hash(pending) });
      return structuredClone(result);
    } finally { busy = false; }
  };
  const readExecution = async requestId => {
    const observed = completed.get(requestId);
    need(observed, "BASELINE_EXECUTION_NOT_OBSERVED");
    await verifyComparisonPreflight(output, expectedDigest);
    const current = await snapshot(executionRoot, [`${requestId}/pending.json`, `${requestId}/result.json`]);
    need(current.files[`${requestId}/result.json`] === observed.resultSha256 &&
      hash(JSON.parse(current.contents.get(`${requestId}/pending.json`))) === observed.pendingSha256,
      "BASELINE_EXECUTION_RECORD_CHANGED");
    return structuredClone(observed.result);
  };
  return { execute, readExecution };
}

export async function materializeComparisonScenario({ output, expectedDigest }) {
  const freeze = await verifyComparisonPreflight(output, expectedDigest), root = path.join(output, "candidate");
  const captured = JSON.parse(command(process.execPath, ["--experimental-vm-modules", "--permission",
    `--allow-fs-read=${root}`, `--allow-fs-read=${captureScript}`, captureScript, root]));
  const { fixture } = await import(pathToFileURL(path.join(root, "tests/context-fixture.mjs")).href);
  let cleanup;
  try {
    const f = await fixture({ after(fn) { cleanup = fn; } }, { correction: true, preparation: false, sourceRoot: root, actionBody: captured.actionBody });
    need(f.prepare === undefined, "COMPARISON_SYNTHETIC_PREPARATION_PRESENT");
    const selected = await snapshot(f.root, ["candidate.mjs", "action.mjs", "oracle.json", "verify.mjs", "sources.json"]);
    for (const [name, value] of Object.entries(captured.captured)) selected.contents.set(name,
      Buffer.from(typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n"));
    selected.contents.set("continuation.mjs", Buffer.from(captured.continuation));
    const target = path.join(output, "scenario");
    await copySnapshot(target, selected);
    const actual = await snapshot(target);
    const scenario = { schema: "qualification.comparison-scenario.v1", kind: "SYNTHETIC_PROTOCOL_ONLY",
      sourceFreeze: expectedDigest, sourceCarriers: freeze.inputs, files: actual.files,
      oracle: captured.oracle, preparationExecuted: false, approvalsWritten: false, modelsLaunched: 0 };
    await writeFile(path.join(output, "scenario.json"), canonicalJson(scenario) + "\n", { flag: "wx", mode: 0o400 });
    for (const arm of ["baseline", "candidate"]) {
      const workspace = path.join(output, "workspaces", arm);
      need((await readdir(workspace)).length === 0, "COMPARISON_WORKSPACE_NOT_EMPTY");
      for (const [name, bytes] of actual.contents) await writeFile(path.join(workspace, name), bytes, { flag: "wx", mode: 0o600 });
    }
    await verifyComparisonPreflight(output, expectedDigest);
    return { scenarioDigest: hash(scenario), files: scenario.files, approvalsWritten: false, preparationExecuted: false };
  } finally { if (cleanup) await cleanup(); }
}

export async function verifyComparisonScenario({ output, scenarioDigest }) {
  const receipt = path.join(output, "scenario.json");
  need(!(await lstat(receipt)).isSymbolicLink(), "COMPARISON_SYMLINK_REFUSED");
  const scenario = JSON.parse(await readFile(receipt, "utf8"));
  need(hash(scenario) === scenarioDigest && scenario.schema === "qualification.comparison-scenario.v1", "COMPARISON_SCENARIO_IDENTITY");
  await verifyComparisonPreflight(output, scenario.sourceFreeze);
  need((await snapshot(path.join(output, "scenario"))).digest === hash(scenario.files), "COMPARISON_SCENARIO_DRIFT");
  return scenario;
}

// An executable protocol test, never a native arm or semantic owner decision.
export async function runSyntheticComparisonTransport({ output, expectedDigest, scenarioDigest, arm, prepareOnly = false }) {
  need(["baseline", "candidate"].includes(arm), "COMPARISON_ARM_INVALID");
  need(typeof prepareOnly === "boolean", "COMPARISON_PREPARATION_MODE_INVALID");
  await verifyComparisonPreflight(output, expectedDigest);
  const root = await directory(path.join(output, "workspaces", arm));
  const scenario = await verifyComparisonScenario({ output, scenarioDigest });
  const steps = [];
  const put = async (name, value) => {
    const bytes = typeof value === "string" ? value : canonicalJson(value) + "\n";
    await writeFile(path.join(root, name), bytes, { flag: "wx", mode: 0o600 });
    return { path: name, sha256: sha256(bytes) };
  };
  const ref = async name => ({ path: name, sha256: sha256(await readFile(path.join(root, name))) });
  const call = async (name, operation, options = {}) => {
    const result = await invokeComparisonAdapter({ output, expectedDigest, scenarioDigest, arm, operation, ...options });
    steps.push({ name, ...result });
    await put(`transport-${name}.json`, result);
    return result.result;
  };
  const needStatus = (result, status) => need(result.status === status, `COMPARISON_TRANSPORT_${status}:${JSON.stringify(result)}`);
  await put("recipe.json", scenario.oracle.recipe);
  await put("shared.md", "SYNTHETIC_PROTOCOL_ONLY: pending task; no model acceptance or retained meaning claimed.\n");
  const events = JSON.parse(await readFile(path.join(output, "candidate", "tests/fixtures/retained-progress/events.json"), "utf8")).events.slice(0, 4);
  const docNames = ["scope", "goal", "contract", "decisions", "success", "ideas", "map"];
  const publicEvents = [];
  for (const id of docNames) publicEvents.push({ id, authorKind: "human", body: await readFile(path.join(root, `${id}.md`), "utf8") });
  await put("public-events.json", { schema: "context.events.v1", complete: true, events: publicEvents });
  const classify = (sourceId, eventId, assertions) => ({ sourceId, eventId, eventDisposition: "assertions",
    reason: "SYNTHETIC_PROTOCOL_ONLY, not semantic classification evidence", assertions: assertions.map(a => ({ id: a.id, quote: a.text,
      disposition: "current_constraint", scope: ["bundle"], targetRef: "module:consumer", reason: "Synthetic byte-transport input only",
      supersededBy: null, ownerGate: null, trigger: null })) });
  const commandSpec = script => ({ executable: process.execPath, args: [script], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
  const pkg = { schema: "context.package.v3", owner: "owner",
    task: { id: "consumer", worker: "worker", scope: ["bundle"], action: commandSpec("action.mjs"), candidateFiles: ["action.mjs"] },
    module: { publicBoundary: "consumer", implementationFiles: ["action.mjs"], retainedExampleIds: ["B1", "B2"], newExampleIds: ["N1"],
      oracle: "oracle.json", verificationScript: "verify.mjs", verificationCommand: commandSpec("verify.mjs"), contractFiles: ["contract.md"] },
    sources: [{ id: "SOURCE-BUNDLE", path: "sources.json", scope: ["bundle"] }, { id: "PUBLIC-SCENARIO", path: "public-events.json", scope: ["bundle"] }],
    classifications: [...events.map(e => classify("SOURCE-BUNDLE", e.id, e.assertions)),
      ...publicEvents.map(e => classify("PUBLIC-SCENARIO", e.id, [{ id: `public:${e.id}`, text: e.body }]))],
    dependencies: [{ id: "fixed-release", path: "candidate.mjs", scope: ["bundle"] }, { id: "connection", path: "success.md", scope: ["bundle"] }],
    sharedArtifacts: ["shared.md"],
    moduleAccess: { schema: "context.module-access.v1", modules: [
      { id: "consumer", intent: "change", contractFiles: ["contract.md"], privatePaths: ["action.mjs", "continuation.mjs"], release: null },
      { id: "buildBundle", intent: "consume", contractFiles: ["contract.md"], privatePaths: ["producer"], release: { artifact: await ref("candidate.mjs"), connection: await ref("success.md") } }
    ] },
    navigation: { taskId: "consumer", worker: "worker", preparedBy: "owner", outcome: "Synthetic fixed consumer transport check",
      assignment: { owner: "owner", requestId: "transport", question: "Synthetic public-only connection", phase: "initial", previous: null },
      references: ["goal", "contract"].map(id => ({ id, path: `${id}.md`, quote: publicEvents.find(e => e.id === id).body, purpose: id, appliesTo: "task" })),
      constraints: [], gaps: [] },
    alignment: { goalRef: "goal", invariantRefs: ["contract"], acceptanceRef: "contract", review: null, decisions: [
      { moduleId: "consumer", boundaryChange: false, gapRef: "goal", existingRef: "contract", rationale: "Synthetic transport: connect the fixed consumer without a boundary change." },
      { moduleId: "buildBundle", boundaryChange: false, gapRef: null, existingRef: "contract", rationale: "Consume the existing public release unchanged." }
    ] }
  };
  const prepare = async (name, packageValue) => {
    await put(`${name}-package.json`, packageValue);
    const invoke = (mode, extra) => call(`${name}-${mode}`, "prepare", { args: [mode, "--output", name, ...extra] });
    needStatus(await invoke("plan", ["--input", `${name}-package.json`]), "PLAN_READY");
    needStatus(await invoke("confirm", ["--owner", "owner", "--decision", "approved"]), "PREPARED");
    needStatus(await invoke("read", ["--worker", "worker"]), "DELIVERED");
    await put(`${name}-worker.txt`, "SYNTHETIC_PROTOCOL_ONLY: explicit test-authored worker bytes, not model readback/comprehension.\n");
    needStatus(await invoke("ack", ["--worker", "worker", "--evidence", `${name}-worker.txt`]), "ACKNOWLEDGED");
  };
  await prepare("prepared", pkg);
  if (prepareOnly) return { status: "SYNTHETIC_PREPARATION_ONLY", semanticEvidence: false,
    modelsLaunched: 0, wholeChainComparatorReady: false, steps };
  needStatus(await call("resume", "context", { file: "prepared/resume.json" }), "ACTION_COMPLETED");
  const accepted = await call("accept", "context", { file: "prepared/accept.json" });
  needStatus(accepted, "VERIFIED");
  const actual = await readFile(path.join(root, "consumer-output.json"));
  need(hash(JSON.parse(actual)) === hash(scenario.oracle.retainedOutput), "COMPARISON_OUTPUT_WRONG");
  await put("return.md", accepted.returnSync);
  const received = await call("return-read", "outbox", { file: "return.md" });
  need(received.parsed.returnCount === 1 && received.parsed.returns[0].valid && received.parsed.routedCount === 0, "COMPARISON_RETURN_NOT_RECEIVED");
  await put("retained.md", `SYNTHETIC_PROTOCOL_ONLY; actual Return bytes are in return.md. Product acceptance NOT_ESTABLISHED.\n${publicEvents.map(e => e.body).join("\n")}\n`);
  const next = structuredClone(pkg);
  next.task.id = "next-consumer"; next.navigation.taskId = next.task.id;
  next.task.action = commandSpec("continuation.mjs"); next.task.candidateFiles = ["continuation.mjs"];
  next.module.implementationFiles = ["continuation.mjs"];
  next.sharedArtifacts = ["retained.md", "return.md"];
  next.dependencies.push({ id: "accepted-output", path: "consumer-output.json", scope: ["bundle"] });
  await prepare("next", next);
  const input = JSON.parse(await readFile(path.join(root, "next/preflight.json"), "utf8"));
  await put("integration-request.json", { ...input, operation: "integrate", capsule: null, readback: null, integrationPlan: await ref("next/integration-plan.json") });
  needStatus(await call("integrate", "context", { file: "integration-request.json" }), "VERIFIED");
  await put("route-input.json", { returnReceiptId: received.parsed.returns[0].id, consumer: "owner",
    routedNextAction: "SYNTHETIC_PROTOCOL_ONLY: consume accepted output with fixed continuation", evidence: "return.md; retained.md; transport-integrate.json" });
  const routed = await call("route", "route", { file: "route-input.json" });
  await put("outbox.md", accepted.returnSync + "\n" + routed.route);
  const consumed = await call("return-consumed", "outbox", { file: "outbox.md" });
  need(consumed.parsed.routedCount === 1 && consumed.parsed.pendingReturnIds.length === 0, "COMPARISON_RETURN_NOT_ROUTED");
  needStatus(await call("next-consumer", "context", { file: "next/resume.json" }), "ACTION_COMPLETED");
  need(hash(JSON.parse(await readFile(path.join(root, "continued.json"), "utf8"))) === hash({ used: ["AA", "b"] }) &&
    sha256(await readFile(path.join(root, "consumer-output.json"))) === sha256(actual), "COMPARISON_CONTINUATION_LOST_OUTPUT");
  const report = { status: "SYNTHETIC_TRANSPORT_PASS", semanticEvidence: false, modelCalls: 0, wholeChainComparatorReady: false,
    candidateControl: arm === "candidate" ? "NOT_WIRED_REFERENCE_ROUTE_ONLY" : "NOT_INJECTED", scenarioDigest,
    producerPreserved: true, acceptedOutputSha256: sha256(actual), steps };
  await put("transport-report.json", report);
  return report;
}

export async function runComparisonPreflight(options) {
  const staged = await stageComparisonPreflight(options), arms = {};
  for (const arm of ["baseline", "candidate"]) arms[arm] = await invokeComparisonAdapter({ ...staged, expectedDigest: staged.digest, arm });
  const scenario = await materializeComparisonScenario({ ...staged, expectedDigest: staged.digest }), transport = {};
  for (const arm of ["baseline", "candidate"]) transport[arm] = await runSyntheticComparisonTransport({ ...staged, ...scenario, expectedDigest: staged.digest, arm });
  const report = { ...staged, status: "PARTIAL_ZERO_INFERENCE_PREFLIGHT_PASS", semanticComparison: "NOT_RUN",
    actionExecution: "FROZEN_SYNTHETIC_COMMANDS_ONLY", policyApplication: "NOT_OBSERVED", arms, scenario, transport, pending };
  await writeFile(path.join(staged.output, "preflight.json"), canonicalJson(report) + "\n", { flag: "wx", mode: 0o600 });
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === here) {
  try {
    need(process.argv.length === 4 && process.argv[2] === "--output", "Usage: node scripts/qualify-framework-comparison.mjs --output /absolute/new-directory");
    const result = await runComparisonPreflight({ sourceRoot: fileURLToPath(new URL("..", import.meta.url)), output: process.argv[3] });
    console.log(JSON.stringify({ output: result.output, digest: result.digest, status: result.status,
      modelsLaunched: 0, wholeChainComparatorReady: false, semanticComparison: "NOT_RUN" }, null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
