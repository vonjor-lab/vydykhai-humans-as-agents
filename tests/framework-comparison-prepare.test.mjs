import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, writeFile, rm, realpath } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { canonicalJson, sha256 } from "../scripts/memory-brief.mjs";
import { stageComparisonPreflight, materializeComparisonScenario, runSyntheticComparisonTransport, invokeComparisonAdapter } from "../scripts/qualify-framework-comparison.mjs";
import { stageNativeComparison, readTurnSources, dispatchRole, publishTurnSources } from "../scripts/qualify-framework-comparison-native.mjs";
import { stageNativePreparationWorkspace, applyNativePreparation, applyNativeWorkerAcknowledgment,
  subsequentPreparationPaths, stageNativeSubsequentPreparation, applyNativeSubsequentPreparation,
  applyNativeSubsequentWorkerAcknowledgment, appendPreparationChoices,
  verificationSourceContract, requireVerificationSources } from "../scripts/qualify-framework-comparison-prepare.mjs";
import { openReviewSources } from "../scripts/control-review-sources.mjs";
import { nativeProvider, codeItem, answerItem } from "./native-provider-fixture.mjs";
import * as preparationApi from "../scripts/qualify-framework-comparison-prepare.mjs";

const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
const binary = process.env.VYDYKHAI_CODEX_BINARY;
const options = { skip: process.platform !== "darwin" || !binary, timeout: 60000 };
const encode = value => canonicalJson(value) + "\n";
const hash = value => sha256(canonicalJson(value));

test("compact transport projects only an exact redundant action from the recorded structural shape", () => {
  const action = { executable: "/node", args: ["continuation.mjs"], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 };
  // Sanitized structural reproduction, not a model-authored semantic fixture.
  const input = { schema: "comparison.compact-preparation.v1", task: { id: "next-consumer", scope: ["module"],
    candidateFiles: ["continuation.mjs"], action }, module: {}, sources: [], dependencies: [], sharedArtifacts: [],
    modules: [], navigation: {}, alignment: {}, recipe: {}, decision: "approved" };
  const original = structuredClone(input), descriptor = { action };
  const compiler = { format: { schema: "comparison.compact-format.v1", shape: {
    schema: input.schema, task: { id: "<string>", scope: ["<string>"], candidateFiles: ["<path>"] } } },
  compile(value, frozen) {
    assert.deepEqual(Object.keys(value).sort(), Object.keys(original).sort());
    assert.deepEqual(Object.keys(value.task).sort(), ["candidateFiles", "id", "scope"]);
    return { decision: value.decision, package: { task: { ...value.task, action: frozen.interface.action } } };
  } };
  const run = (value = input, module = compiler) => preparationApi.compilePreparationTransport(value, module, descriptor, {});
  const result = run();
  assert.deepEqual(input, original);
  assert.deepEqual(result.proposed.package.task.action, action);
  assert.deepEqual(result.projection.removedPaths, ["preparation.task.action"]);
  assert.equal(result.projection.originalPreparationSha256, hash(original));
  const projected = structuredClone(original); delete projected.task.action;
  assert.equal(result.projection.projectedPreparationSha256, hash(projected));
  assert.equal(result.projection.descriptorSha256, hash(descriptor));
  assert.equal(result.projection.formatSha256, hash(compiler.format));
  assert.equal(result.projection.actionSha256, hash(action));
  assert.equal(result.projection.compiledSha256, sha256(encode(result.proposed)));
  assert.equal(run(projected).projection, null);
  assert.equal(run({ ...input, decision: "rejected" }).proposed.decision, "rejected");
  for (const changed of [{ ...action, args: ["other.mjs"] }, { ...action, extra: true }, null])
    assert.throws(() => run({ ...input, task: { ...input.task, action: changed } }), /NATIVE_COMPACT_ACTION_MISMATCH/);
  assert.throws(() => run({ ...input, task: { ...input.task, extra: true } }));
  const missing = structuredClone(input); delete missing.task.scope;
  assert.throws(() => run(missing));
  for (const format of [{ schema: "other" }, { ...compiler.format, shape: { ...compiler.format.shape,
    task: { ...compiler.format.shape.task, action: {} } } }])
    assert.throws(() => run(input, { ...compiler, format }), /NATIVE_COMPACT_ACTION_FORMAT_INVALID/);
  assert.throws(() => run({ ...input, schema: "other" }), /NATIVE_COMPACT_ACTION_FORMAT_INVALID/);
  assert.throws(() => run(input, { ...compiler, compile: () => ({ package: { task: { action: { ...action, args: [] } } } }) }),
    /NATIVE_COMPACT_COMPILED_ACTION_MISMATCH/);
});

test("verification source interface exposes exact linkage but no example answers", () => {
  const oracle = { schema: "context.oracle.v1", examples: [
    { id: "kept", sourceAssertionRefs: ["history:1"], input: "hidden input", expected: "hidden answer" },
    { id: "new", sourceAssertionRefs: ["history:2"], input: [], expected: {} }
  ] };
  const contract = verificationSourceContract(oracle);
  assert.deepEqual(contract, [{ exampleId: "kept", sourceAssertionRefs: ["history:1"] },
    { exampleId: "new", sourceAssertionRefs: ["history:2"] }]);
  const pkg = { module: { retainedExampleIds: ["kept"], newExampleIds: ["new"] },
    classifications: [{ assertions: [{ id: "history:1" }, { id: "history:2" }] }] };
  requireVerificationSources(pkg, contract);
  const renamed = structuredClone(pkg);
  renamed.classifications[0].assertions[1].id = "free-name";
  assert.throws(() => requireVerificationSources(renamed, contract), /NATIVE_VERIFICATION_SOURCE_MISSING:history:2/);
  assert.throws(() => requireVerificationSources({ ...pkg, module: { ...pkg.module, newExampleIds: ["unknown"] } }, contract),
    /NATIVE_VERIFICATION_EXAMPLE_MISSING/);
  contract[0].sourceAssertionRefs[0] = "changed";
  assert.equal(oracle.examples[0].sourceAssertionRefs[0], "history:1");
});

test("pure subsequent namespace paths are isolated and invalid names fail before staging", async () => {
  assert.deepEqual(subsequentPreparationPaths("reuse-2"), { directory: "native-next-reuse-2",
    package: "native-next-reuse-2/package.json", recipe: "native-next-reuse-2/recipe.json",
    prepared: "native-next-reuse-2/prepared", evidence: "native-next-reuse-2/worker-readback.txt" });
  for (const namespace of [undefined, null, "", "../escape", "/tmp/escape", "nested/task", "x\\y", "NEXT", "a".repeat(41)]) {
    assert.throws(() => subsequentPreparationPaths(namespace), { message: "NATIVE_NEXT_NAMESPACE_INVALID" });
    await assert.rejects(stageNativeSubsequentPreparation({ namespace }), { message: "NATIVE_NEXT_NAMESPACE_INVALID" });
  }
});

async function setup(t, arm, modify = value => value, { readInterface = true, maxCalls = 1, noDispatch = false,
  compilerMode = false, readCompact = true, reuseMode = false, readPrior = true, adoptionDecision = "approved" } = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "comparison-prepare-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const comparison = await stageComparisonPreflight({ sourceRoot, output: path.join(root, "comparison") });
  const scenario = await materializeComparisonScenario({ output: comparison.output, expectedDigest: comparison.digest });
  // Obtain a protocol-valid example in the OTHER disposable arm. This is
  // deliberately scripted input, never a semantic model discovery or matched run.
  const other = arm === "baseline" ? "candidate" : "baseline";
  await runSyntheticComparisonTransport({ output: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, arm: other, prepareOnly: true });
  const pkg = JSON.parse(await readFile(path.join(comparison.output, "workspaces", other, "prepared-package.json")));
  pkg.sharedArtifacts = ["map.md"];
  const native = await stageNativeComparison({ comparisonOutput: comparison.output, expectedDigest: comparison.digest,
    scenarioDigest: scenario.scenarioDigest, output: path.join(root, "native"), maxCalls, timeoutMs: 15000 });
  const args = { directory: native.directory, expectedDigest: native.expectedDigest, arm };
  const initialSources = await readTurnSources(args);
  let compiler;
  if (compilerMode) {
    const file = path.join(root, "identity-compiler.mjs");
    const source = compilerMode === "compact"
      ? 'export const format={schema:"comparison.compact-format.v1",shape:{schema:"comparison.compact-preparation.v1",task:{id:"<string>",scope:[],candidateFiles:[]}}}; export function compile(input,c){if(Object.keys(input.task).sort().join()!=="candidateFiles,id,scope")throw Error("COMPACT_FIELDS_REQUIRED");return {...input.exact,decision:input.decision,package:{...input.exact.package,task:{...input.exact.package.task,...input.task,action:c.interface.action}}};}'
      : 'export const format={schema:"test.identity-only"}; export function compile(input){if(!input.exact)throw Error("MISSING_EXACT");return input.exact;}';
    await writeFile(file, source);
    compiler = { path: file, sha256: sha256(source) };
  }
  for (const row of pkg.classifications.filter(row => row.sourceId === "PUBLIC-SCENARIO"))
    row.assertions[0].quote = await readFile(path.join(native.directory, arm, "public/evidence", `${row.eventId}.md`), "utf8");
  for (const ref of pkg.navigation.references) ref.quote = await readFile(path.join(native.directory, arm, "public/evidence", ref.path), "utf8");
  const recipe = JSON.parse(await readFile(path.join(comparison.output, "scenario.json"))).oracle.recipe;
  const preparation = modify({ package: pkg, recipe, decision: "approved" });
  let priorPreparation;
  if (reuseMode) {
    const names = ["scope", "goal", "contract", "decisions", "success", "ideas", "map"], events = [], files = { ...scenario.files };
    for (const id of names) {
      const body = await readFile(path.join(native.directory, arm, "public/evidence", `${id}.md`), "utf8");
      files[`${id}.md`] = sha256(body); events.push({ id, authorKind: "human", body });
    }
    files["public-events.json"] = sha256(encode({ schema: "context.events.v1", complete: true, events }));
    const file = path.join(root, "unapplied-proposal.json"), text = encode({ exact: preparation, decision: "approved" });
    await writeFile(file, text);
    priorPreparation = { path: file, sha256: sha256(text), filesSha256: hash(files), files };
  }
  const stage = await stageNativePreparationWorkspace({ ...args, ...(compiler ? { compiler } : {}),
    ...(priorPreparation ? { priorPreparation } : {}) });
  const sources = await readTurnSources(args), goal = sources.sourceSnapshot.rows.find(row => row.path === "evidence/goal.md");
  assert.deepEqual(sources.sourceRevision, stage.sourceRevision);
  const formatRow = sources.sourceSnapshot.rows.find(row => row.id === "preparation-format");
  const shape = await readFile(path.join(native.directory, arm, "public", formatRow.path), "utf8");
  assert.doesNotMatch(shape, /CSV|DUPLICATE_ID|bundle-r1/);
  if (noDispatch) return { args, stage, preparation, comparison, format: JSON.parse(shape) };
  const provider = await nativeProvider(t, async n => n === 1 ? codeItem(
    "const tool=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));" +
    `for(const id of ${JSON.stringify([goal.id, ...(readInterface ? ["preparation-interface"] : []),
      ...(compilerMode && readCompact ? ["preparation-compact-format"] : []),
      ...(reuseMode && readPrior ? ["preparation-prior-proposal"] : [])])})text(await tools[tool.name]({id}));`) :
    answerItem({ preparation: reuseMode ? { reuse: { id: "preparation-prior-proposal", sha256: priorPreparation.sha256 }, decision: adoptionDecision } :
      compilerMode === "compact" ? { schema: "comparison.compact-preparation.v1", decision: preparation.decision,
        task: { id: preparation.package.task.id, scope: preparation.package.task.scope,
          candidateFiles: preparation.package.task.candidateFiles, action: preparation.package.task.action }, exact: preparation } :
      compilerMode ? { exact: preparation } : preparation }));
  await mkdir(path.join(root, "auth"), { mode: 0o700 });
  const record = await dispatchRole({ ...args, role: "owner", binary, authHome: path.join(root, "auth"), provider: provider.provider,
    sourceRevision: sources.sourceRevision, intent: { task: { id: goal.id, sha256: goal.sha256 }, commands: [], context: null },
    prompt: "Scripted preparation transport: read the task and author exact protocol inputs. No semantic proof is claimed." });
  return { args, stage, preparation, record, compiler, priorPreparation, initialSources, root, ownerTask: { id: goal.id, sha256: goal.sha256 },
    apply: { ...args, number: 1, stageSha256: stage.stageSha256 } };
}

test("missing fixed verification linkage blocks native preparation before packet or action writes", options, async t => {
  const x = await setup(t, "candidate", value => {
    for (const row of value.package.classifications) for (const assertion of row.assertions ?? [])
      if (assertion.id === "S4:1") assertion.id = "independently-authored-name";
    return value;
  });
  const sources = await readTurnSources(x.args);
  const row = sources.sourceSnapshot.rows.find(row => row.id === "preparation-interface");
  const descriptor = JSON.parse(await readFile(path.join(x.args.directory, "candidate/public", row.path)));
  assert.ok(descriptor.verificationSources.some(row => row.sourceAssertionRefs.includes("S4:1")));
  assert.ok(descriptor.verificationSources.every(row => Object.keys(row).sort().join() === "exampleId,sourceAssertionRefs"));
  await assert.rejects(applyNativePreparation(x.apply), /NATIVE_VERIFICATION_SOURCE_MISSING:S4:1/);
  const names = await readdir(x.stage.workspace);
  for (const name of ["native-package.json", "recipe.json", "native-prepared", "consumer-output.json"])
    assert.equal(names.includes(name), false, name);
});

test("explicit compiler keeps original native output and separately binds derived input", options, async t => {
  const x = await setup(t, "candidate", v => v, { compilerMode: true });
  const result = await applyNativePreparation(x.apply);
  assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED");
  const attempt = path.join(x.args.directory, "candidate/preparation-application/attempt");
  const compiled = JSON.parse(await readFile(path.join(attempt, "compiled-input.json")));
  const provenance = JSON.parse(await readFile(path.join(attempt, "compilation.json")));
  assert.deepEqual(compiled, x.preparation);
  assert.deepEqual(x.record.modelOutput, { preparation: { exact: x.preparation } });
  assert.equal(provenance.originalModelOutputSha256, x.record.modelOutputSha256);
  assert.equal(provenance.compiledSha256, sha256(encode(compiled)));
  assert.deepEqual(provenance.compiler, x.compiler);
});

test("compiler tamper or unacquired syntax refuses before packet write", options, async t => {
  for (const readCompact of [true, false]) {
    const x = await setup(t, "candidate", v => v, { compilerMode: true, readCompact });
    if (readCompact) await writeFile(x.compiler.path, "export const format={};");
    await assert.rejects(applyNativePreparation(x.apply), readCompact ?
      /NATIVE_PREPARATION_COMPILER_CHANGED/ : /NATIVE_PREPARATION_COMPACT_FORMAT_NOT_ACQUIRED/);
    await assert.rejects(readFile(path.join(x.stage.workspace, "native-package.json")), { code: "ENOENT" });
  }
});

test("compact projection retains original native JSON and receipt; refusal cannot create a packet", options, async t => {
  for (const decision of ["approved", "rejected"]) {
    const x = await setup(t, "candidate", value => ({ ...value, decision }), { compilerMode: "compact" });
    const originalFile = path.join(x.args.directory, "candidate/turns/model-output-1.json");
    const original = await readFile(originalFile);
    if (decision === "rejected") {
      await assert.rejects(applyNativePreparation(x.apply), /NATIVE_PREPARATION_NOT_AUTHORED/);
      await assert.rejects(readFile(path.join(x.stage.workspace, "native-package.json")), { code: "ENOENT" });
    } else {
      const result = await applyNativePreparation(x.apply);
      assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED");
      const attempt = path.join(x.args.directory, "candidate/preparation-application/attempt");
      const receipt = JSON.parse(await readFile(path.join(attempt, "compilation.json")));
      assert.deepEqual(await readFile(path.join(attempt, "original-model-output.json")), original);
      assert.deepEqual(receipt.projection.removedPaths, ["preparation.task.action"]);
      assert.equal(receipt.originalModelOutputSha256, sha256(original));
      assert.equal(receipt.projection.originalPreparationSha256, hash(x.record.modelOutput.preparation));
      assert.equal(receipt.projection.compiledSha256, receipt.compiledSha256);
      assert.deepEqual(receipt.compiler, x.compiler);
    }
    assert.deepEqual(await readFile(originalFile), original);
  }
});

test("prior proposal needs fresh acquired exact adoption; refusal never becomes approval", options, async t => {
  for (const [readPrior, adoptionDecision] of [[true, "approved"], [false, "approved"], [true, "rejected"]]) {
    const x = await setup(t, "candidate", v => v, { compilerMode: true, reuseMode: true, readPrior, adoptionDecision });
    if (!readPrior || adoptionDecision !== "approved") {
      await assert.rejects(applyNativePreparation(x.apply), !readPrior ? /NATIVE_PRIOR_PROPOSAL_NOT_ACQUIRED/ : /NATIVE_PRIOR_DECISION_REQUIRED/);
      await assert.rejects(readFile(path.join(x.stage.workspace, "native-package.json")), { code: "ENOENT" });
      continue;
    }
    const result = await applyNativePreparation(x.apply);
    assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED");
    const compiled = JSON.parse(await readFile(path.join(x.args.directory, "candidate/preparation-application/attempt/compiled-input.json")));
    assert.deepEqual(compiled, x.preparation);
    assert.equal(x.record.modelOutput.preparation.reuse.sha256, x.priorPreparation.sha256);
  }
});

test("prior revision appends only explicit authored fields, without mutating or replacing earlier meaning", () => {
  const prior = { decision: "approved", recipe: { preserve: "old choice" }, module: { contractFiles: ["old.md"] },
    modules: [{ id: "consumer", contractFiles: ["old.md"] }], dependencies: [],
    navigation: { references: [{ id: "old" }], constraints: [{ text: "preserve old obligation" }] } };
  const additions = { contractFiles: ["custody.md"], moduleContracts: [{ moduleId: "consumer", contractFiles: ["custody.md"] }],
    dependencies: [{ id: "custody", path: "custody.md", scope: ["task"] }],
    references: [{ id: "custody", path: "custody.md", quote: "authored exact quote", purpose: "return", appliesTo: "task" }],
    constraints: [{ text: "authored custody obligation", appliesTo: "task", referenceIds: ["custody"] }] };
  const before = structuredClone(prior), copy = structuredClone(additions), revised = appendPreparationChoices(prior, additions);
  assert.deepEqual(prior, before); assert.deepEqual(additions, copy);
  assert.deepEqual(revised.recipe, prior.recipe); assert.equal(revised.decision, prior.decision);
  assert.deepEqual(revised.module.contractFiles, ["old.md", "custody.md"]);
  assert.deepEqual(revised.navigation.constraints, [...prior.navigation.constraints, ...additions.constraints]);
  for (const key of Object.keys(additions)) {
    const omitted = structuredClone(additions); delete omitted[key];
    assert.throws(() => appendPreparationChoices(prior, omitted), /NATIVE_PRIOR_DELTA_INVALID/);
  }
  assert.throws(() => appendPreparationChoices(prior, { ...additions, decision: "approved" }), /NATIVE_PRIOR_DELTA_INVALID/);
  assert.throws(() => appendPreparationChoices(prior, { ...additions, moduleContracts: [{ moduleId: "unknown", contractFiles: [] }] }), /NATIVE_PRIOR_DELTA_INVALID/);
});

let matchedFormat;
for (const arm of ["baseline", "candidate"]) test(`zero-inference v3 preparation-format ${arm} is complete neutral syntax accepted by own primitives`, { timeout: 60000 }, async t => {
  const x = await setup(t, arm, value => value, { noDispatch: true }), format = x.format;
  assert.equal(format.inputSchema, "context.package.v3", "published format must describe v3, not a redacted v2 example");
  assert.equal(format.package.schema, "context.package.v3");
  assert.deepEqual(Object.keys(format.package.alignment).sort(),
    ["acceptanceRef", "decisions", "goalRef", "invariantRefs", "review"]);
  const walk = value => {
    if (!value || typeof value !== "object") return;
    for (const key of ["default", "examples"]) assert.ok(!Object.hasOwn(value, key), `no ready ${key}`);
    for (const child of Object.values(value)) walk(child);
  };
  walk(format);
  const noAnswers = value => {
    if (value && typeof value === "object") return Object.values(value).forEach(noAnswers);
    assert.equal(typeof value, "string", "no boolean/null/number choices in public shape");
    assert.ok(/^<[^>]+>$/.test(value) || ["context.package.v3", "context.module-access.v1"].includes(value),
      `no scenario answer in public shape: ${value}`);
  };
  noAnswers(format.package);
  if (matchedFormat) assert.deepEqual(format, matchedFormat, "same syntax without candidate control leakage");
  else matchedFormat = format;
  const example = await readFile(path.join(x.comparison.output, arm, "examples/context-preparation/package-modular.json"));
  assert.equal(JSON.parse(example).schema, "context.package.v2", "historical own-arm example was not rewritten");
  assert.deepEqual(format.enums["classifications[].assertions[].disposition"],
    ["current_constraint", "accepted_capability", "deferred", "superseded", "unresolved", "evidence_only"]);
  assert.equal(format.package.alignment.decisions[0].boundaryChange, "<boolean>");
  // Fixed envelope checks only; no duplicate schema engine. The actual primitive
  // validates types, enums, source quotations and cross-reference semantics.
  for (const key of ["task", "module", "navigation", "alignment"])
    assert.deepEqual(Object.keys(format.package[key]).sort(), Object.keys(x.preparation.package[key]).sort(), key);
  assert.deepEqual(Object.keys(format.package).sort(), Object.keys(x.preparation.package).sort());
  assert.deepEqual(Object.keys(format.package.dependencies[0]).sort(), ["id", "path", "scope"]);
  assert.deepEqual(format.package.navigation.gaps, [{ text: "<string>", critical: "<boolean>" }]);
  assert.equal(format.package.moduleAccess.modules[0].release, "<null|moduleRelease>");
  assert.equal(format.package.navigation.assignment.previous, "<null|previousAssignment>");
  assert.deepEqual(Object.keys(format.types.moduleRelease).sort(), ["artifact", "connection"]);
  assert.deepEqual(Object.keys(format.types.artifactRef).sort(), ["path", "sha256"]);
  assert.deepEqual(Object.keys(format.types.previousAssignment).sort(), ["approval", "plan"]);
  assert.deepEqual(Object.keys(format.types.alignmentReview).sort(), ["basisSha256", "decision", "reason", "reviewer", "schema"]);
  assert.deepEqual(Object.keys(format.optionalPairs["task.action / module.verificationCommand"]).sort(), ["maxOutputBytes", "timeoutMs"]);
  assert.deepEqual(Object.keys(format.optionalPairs["navigation.references[]"]).sort(), ["endLine", "startLine"]);
  assert.deepEqual(format.enums["classifications[].eventDisposition"], ["assertions", "no_change", "evidence_only"]);
  assert.deepEqual(format.enums["moduleAccess.modules[].intent"], ["consume", "change", "create"]);
  assert.deepEqual(format.enums["navigation.assignment.phase"], ["initial", "supplement"]);
  assert.deepEqual(format.enums["navigation.references[].appliesTo / navigation.constraints[].appliesTo"], ["task", "preparation"]);
  const originalPackage = encode(x.preparation.package), workspace = x.stage.workspace;
  const invoke = args => invokeComparisonAdapter({ output: x.comparison.output, expectedDigest: x.comparison.digest,
    arm, operation: "prepare", args });
  // Authored fixture only. No model, worker acknowledgment, action or acceptance.
  await writeFile(path.join(workspace, "format-package.json"), originalPackage);
  for (const [mode, extra, status] of [
    ["plan", ["--input", "format-package.json"], "PLAN_READY"],
    ["confirm", ["--owner", "owner", "--decision", "approved"], "PREPARED"],
    ["read", ["--worker", "worker"], "DELIVERED"]
  ]) {
    const observed = await invoke([mode, "--output", "format-prepared", ...extra]);
    assert.equal(observed.result.status, status, JSON.stringify(observed.result));
    assert.deepEqual(observed.commands, []);
  }
  assert.equal(await readFile(path.join(workspace, "format-package.json"), "utf8"), originalPackage);
  const request = JSON.parse(await readFile(path.join(workspace, "format-prepared/awaiting-worker.json")));
  assert.equal(request.readback, null);
  assert.deepEqual(await readFile(path.join(x.comparison.output, arm, "examples/context-preparation/package-modular.json")), example);
  const missing = structuredClone(x.preparation.package); delete missing.alignment;
  await writeFile(path.join(workspace, "missing-alignment.json"), encode(missing));
  const denied = await invoke(["plan", "--output", "format-denied", "--input", "missing-alignment.json"]);
  assert.equal(denied.result.code, "PACKAGE_SCHEMA_INVALID");
  const wrong = structuredClone(x.preparation.package); wrong.alignment.goalRef = "nonexistent-reference";
  await writeFile(path.join(workspace, "wrong-alignment.json"), encode(wrong));
  const unresolved = await invoke(["plan", "--output", "format-unresolved", "--input", "wrong-alignment.json"]);
  assert.equal(unresolved.result.code, "ALIGNMENT_SOURCE_MISSING");
});

async function dispatchWorker(t, x, prepared, { wrongTaskFirst = false,
  paths = { evidence: "native-worker-readback.txt", prepared: "native-prepared" } } = {}) {
  const workspace = x.stage.workspace, request = { ...prepared.request, operation: "resume" }, artifacts = [];
  for (const [id, ref] of [["actual-task", request.task], ["actual-capsule", request.capsule]]) {
    const text = await readFile(path.join(workspace, ref.path), "utf8");
    artifacts.push({ id, text, purpose: `Actual selected-arm ${id}; scripted transport only`,
      origin: { kind: "parent-protocol-result", arm: x.args.arm, operation: "worker-delivery", sha256: sha256(text) } });
  }
  const current = await readTurnSources(x.args);
  const published = await publishTurnSources({ ...x.args, expectedSourceRevision: current.sourceRevision, artifacts });
  let context = null, sourceFile = null;
  if (x.args.arm === "candidate") {
    sourceFile = path.join(x.root, "ack-sources.json");
    await writeFile(sourceFile, encode({ schema: "control.review-sources.v1", workspace, sources: [
      { id: "task", path: request.task.path, purpose: "Actual task" },
      { id: "capsule", path: request.capsule.path, purpose: "Actual capsule" },
      { id: "future-evidence", path: paths.evidence, purpose: "Future native authored evidence" },
      { id: "future-ack", path: `${paths.prepared}/readback.json`, purpose: "Actual future machine ACK" },
      { id: "unrelated", path: "future-other.txt", purpose: "Unrelated registered future source" }
    ] }), { mode: 0o600 });
    context = { sourceRoot: workspace, sourceRegistrySha256: sha256(await readFile(sourceFile)),
      sourceSnapshotDigest: (await (await openReviewSources(sourceFile)).snapshot()).digest,
      runtimeDigest: hash("scripted-context-not-host-admission"), transportSha256: hash("scripted-context-not-command-authority") };
  }
  const readback = "Exact scripted native worker readback. No comprehension, execution or semantic success claim.\n";
  const provider = await nativeProvider(t, async n => n % 2 ? codeItem(
    "const tool=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));for(const id of ['actual-task','actual-capsule'])text(await tools[tool.name]({id}));", `worker-read-${n}`)
    : answerItem({ commands: [{ requestId: "resume", decision: "AUTHORIZE_SUPERVISOR_ACTION", readback }] }));
  const intent = { task: { id: "actual-task", sha256: request.task.sha256 }, context,
    commands: [{ requestId: "resume", requestSha256: hash(request), bindingSha256: hash("fixture-no-command-execution"), dependenciesSha256: hash([]) }] };
  const dispatch = { ...x.args, role: "worker", binary, authHome: path.join(x.root, "auth"), provider: provider.provider,
    sourceRevision: published.sourceRevision, intent, prompt: "Read actual-task and actual-capsule; author exact readback. Scripted transport only." };
  if (wrongTaskFirst) await dispatchRole({ ...dispatch, intent: { ...intent, task: x.ownerTask } });
  const record = await dispatchRole(dispatch);
  return { args: { ...x.apply, number: record.number, requestId: "resume", capsuleSourceId: "actual-capsule", sourceFile },
    readback, sourceFile, dispatch, published };
}

async function workerAck(t, x, prepared) {
  const w = await dispatchWorker(t, x, prepared, { wrongTaskFirst: true }), workspace = x.stage.workspace;
  const attempt = path.join(x.args.directory, x.args.arm, "preparation-application/worker-ack");
  const noAck = async () => {
    await assert.rejects(readFile(path.join(workspace, "native-worker-readback.txt")), { code: "ENOENT" });
    await assert.rejects(readFile(path.join(workspace, "native-prepared/readback.json")), { code: "ENOENT" });
    await assert.rejects(readdir(attempt), { code: "ENOENT" });
  };
  for (const [patch, message] of [
    [{ number: 1 }, "NATIVE_ACK_WORKER_REQUIRED"], [{ number: 2 }, "NATIVE_ACK_TASK_NOT_ACQUIRED"],
    [{ capsuleSourceId: "actual-task" }, "NATIVE_ACK_CAPSULE_NOT_ACQUIRED"],
    [{ requestId: "invented" }, "NATIVE_ACK_INTENT_MISMATCH"],
    [{ operation: "accept" }, "NATIVE_ACK_INTENT_MISMATCH"]
  ]) { await assert.rejects(applyNativeWorkerAcknowledgment({ ...w.args, ...patch }), { message }); await noAck(); }
  const deliveryFile = path.join(workspace, "native-prepared/worker-delivery.json"), delivery = await readFile(deliveryFile);
  await writeFile(deliveryFile, encode({ ...JSON.parse(delivery), worker: "another-worker" }));
  await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_ACK_DELIVERY_MISMATCH" });
  await writeFile(deliveryFile, delivery);
  const outputFile = path.join(x.args.directory, x.args.arm, `turns/model-output-${w.args.number}.json`), output = await readFile(outputFile);
  await writeFile(outputFile, encode({ commands: [{ requestId: "resume", readback: "parent replacement" }] }));
  await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_OUTPUT_BINDING_MISMATCH" });
  await writeFile(outputFile, output);
  const goalFile = path.join(workspace, "goal.md"), goal = await readFile(goalFile);
  await writeFile(goalFile, "Stale after worker dispatch");
  await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_PREPARATION_INPUT_CHANGED" });
  await writeFile(goalFile, goal);
  const stageFile = path.join(x.args.directory, x.args.arm, "preparation-application/stage.json"), stageBytes = await readFile(stageFile);
  const changed = encode({ ...JSON.parse(stageBytes), helperSha256: "0".repeat(64) }); await writeFile(stageFile, changed);
  await assert.rejects(applyNativeWorkerAcknowledgment({ ...w.args, stageSha256: sha256(changed) }), { message: "NATIVE_PREPARATION_STAGE_MISMATCH" });
  await writeFile(stageFile, stageBytes);
  if (w.sourceFile) {
    const registry = await readFile(w.sourceFile); await writeFile(w.sourceFile, registry.toString() + "\n");
    await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_ACK_CONTEXT_CHANGED" });
    await writeFile(w.sourceFile, registry);
  }
  await noAck();
  const result = await applyNativeWorkerAcknowledgment(w.args);
  assert.equal(result.status, "NATIVE_WORKER_ACKNOWLEDGED");
  assert.equal(result.request.readback.sha256, sha256(await readFile(path.join(workspace, result.request.readback.path))));
  assert.equal(result.receipt.worker, "worker");
  assert.equal(result.receipt.taskSha256, prepared.request.task.sha256);
  assert.equal(result.receipt.capsuleSha256, prepared.request.capsule.sha256);
  assert.equal(await readFile(path.join(workspace, result.evidenceRef.path), "utf8"), w.readback);
  assert.deepEqual(result.observed.commands, []); assert.equal(result.commandAuthorization, "NOT_ESTABLISHED");
  assert.equal(result.semanticEvidence, false); assert.equal(result.wholeChainComparatorReady, false);
  if (w.sourceFile) {
    const pending = JSON.parse(await readFile(path.join(attempt, "pending.json")));
    const after = await (await openReviewSources(w.sourceFile)).snapshot();
    assert.equal(result.sourceBefore, pending.sourceBefore.digest);
    assert.equal(result.sourceAfter, after.digest); assert.notEqual(result.sourceAfter, result.sourceBefore);
    const expected = pending.sourceBefore.rows.map(row => {
      const ref = [result.request.readback, result.evidenceRef].find(ref => ref.path === row.path);
      return ref ? { ...row, status: "AVAILABLE", sha256: ref.sha256 } : row;
    });
    assert.deepEqual(after.rows, expected);
  }
  if (x.args.arm === "baseline") assert.ok(!result.observed.loaded.includes("scripts/control-host.mjs"));
  const receipt = await readFile(path.join(workspace, "native-prepared/readback.json"));
  await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_ACK_ALREADY_ATTEMPTED" });
  assert.deepEqual(await readFile(path.join(workspace, "native-prepared/readback.json")), receipt);
  await assert.rejects(readFile(path.join(workspace, "consumer-output.json")), { code: "ENOENT" });
}

for (const arm of ["baseline", "candidate"]) test(`${arm} applies exact native owner inputs through its own v3 route, without a fabricated worker ack`, options, async t => {
  const x = await setup(t, arm, value => value, { maxCalls: 3 }), initialNames = await readdir(x.stage.workspace);
  await assert.rejects(applyNativePreparation({ ...x.apply, stageSha256: "0".repeat(64) }), /NATIVE_PREPARATION_STAGE_MISMATCH/);
  assert.deepEqual(await readdir(x.stage.workspace), initialNames);
  const goalPath = path.join(x.stage.workspace, "goal.md"), goal = await readFile(goalPath);
  await writeFile(goalPath, "Changed after owner dispatch");
  await assert.rejects(applyNativePreparation(x.apply), /NATIVE_PREPARATION_INPUT_CHANGED/);
  await assert.rejects(readFile(path.join(x.stage.workspace, "native-package.json")), { code: "ENOENT" });
  await writeFile(goalPath, goal);
  const result = await applyNativePreparation(x.apply);
  assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED", JSON.stringify(result));
  assert.equal(result.request.readback, null);
  assert.equal(result.semanticEvidence, false);
  assert.deepEqual(result.steps.map(step => step.result.status), ["PLAN_READY", "PREPARED", "DELIVERED"]);
  assert.ok(result.steps.every(step => step.commands.length === 0));
  if (arm === "baseline") assert.ok(result.steps.every(step => !step.loaded.includes("scripts/control-host.mjs")));
  assert.equal(await readFile(path.join(x.stage.workspace, "native-package.json"), "utf8"), encode(x.preparation.package));
  assert.equal(await readFile(path.join(x.stage.workspace, "recipe.json"), "utf8"), encode(x.preparation.recipe));
  for (const name of ["native-prepared/readback.json", "consumer-output.json"])
    await assert.rejects(readFile(path.join(x.stage.workspace, name)), { code: "ENOENT" });
  await assert.rejects(applyNativePreparation(x.apply), /NATIVE_PREPARATION_WORKSPACE_NOT_PRISTINE/);
  await assert.rejects(stageNativePreparationWorkspace(x.args), /NATIVE_PREPARATION_WORKSPACE_NOT_PRISTINE/);
  await workerAck(t, x, result);
});

test("P2 caller-rehashed stage cannot replace interface acquisition with an already-read goal", options, async t => {
  const x = await setup(t, "candidate", value => value, { readInterface: false });
  const file = path.join(x.args.directory, x.args.arm, "preparation-application/stage.json");
  const stage = JSON.parse(await readFile(file));
  const originalInterface = stage.interface;
  const sources = await readTurnSources(x.args), goal = sources.sourceSnapshot.rows.find(row => row.path === "evidence/goal.md");
  stage.interface = { id: goal.id, sha256: goal.sha256 };
  const tampered = encode(stage); await writeFile(file, tampered);
  const names = await readdir(x.stage.workspace);
  await assert.rejects(applyNativePreparation({ ...x.apply, stageSha256: sha256(tampered) }),
    { message: "NATIVE_PREPARATION_INTERFACE_INVALID" });
  assert.deepEqual(await readdir(x.stage.workspace), names);
  await assert.rejects(readFile(path.join(x.stage.workspace, "native-package.json")), { code: "ENOENT" });
  stage.interface = originalInterface;
  stage.sourceRevision = x.initialSources.sourceRevision;
  const oldPublication = encode(stage); await writeFile(file, oldPublication);
  await assert.rejects(applyNativePreparation({ ...x.apply, stageSha256: sha256(oldPublication) }),
    { message: "NATIVE_PREPARATION_CARRIERS_INVALID" });
  assert.deepEqual(await readdir(x.stage.workspace), names);
});

test("invalid native classifications are retained and rejected rather than corrected by an oracle", options, async t => {
  const x = await setup(t, "candidate", value => {
    value.package.classifications[0].assertions[0].quote = "Not present in the authoritative source";
    return value;
  });
  const result = await applyNativePreparation(x.apply);
  assert.equal(result.status, "PREPARATION_NOT_READY");
  assert.equal(result.phase, "plan");
  assert.equal(result.result.code, "PACKAGE_QUOTE_AMBIGUOUS_OR_MISSING");
  assert.equal(await readFile(path.join(x.stage.workspace, "native-package.json"), "utf8"), encode(x.preparation.package));
  await assert.rejects(readFile(path.join(x.stage.workspace, "native-prepared/awaiting-worker.json")), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(x.stage.workspace, "consumer-output.json")), { code: "ENOENT" });
});

test("unknown after real ACK retains receipt/evidence/attempt and never dispatches ACK twice", options, async t => {
  const x = await setup(t, "candidate", value => value, { maxCalls: 2 });
  const prepared = await applyNativePreparation(x.apply), w = await dispatchWorker(t, x, prepared);
  const workspace = x.stage.workspace, attempt = path.join(x.args.directory, x.args.arm, "preparation-application/worker-ack");
  const spawn = childProcess.spawnSync;
  let calls = 0, actual;
  const mock = t.mock.method(childProcess, "spawnSync", (...args) => {
    const result = spawn(...args), input = args[2]?.input;
    if (typeof input === "string") {
      const request = JSON.parse(input);
      if (request.operation === "prepare" && request.args?.[0] === "ack") {
        calls++; actual = JSON.parse(result.stdout);
        // Real child completed its actual writes. Only transport readback is lost.
        return { ...result, stdout: "lost ACK response" };
      }
    }
    return result;
  });
  syncBuiltinESMExports();
  try { await assert.rejects(applyNativeWorkerAcknowledgment(w.args), SyntaxError); }
  finally { mock.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(calls, 1); assert.equal(actual.result.status, "ACKNOWLEDGED"); assert.deepEqual(actual.commands, []);
  const pending = await readFile(path.join(attempt, "pending.json"));
  const receipt = await readFile(path.join(workspace, "native-prepared/readback.json"));
  const evidence = await readFile(path.join(workspace, "native-worker-readback.txt"));
  assert.equal(evidence.toString(), w.readback);
  assert.equal(JSON.parse(receipt).evidenceRef.sha256, sha256(evidence));
  const requests = {};
  for (const mode of ["preflight", "resume", "accept"]) requests[mode] = await readFile(path.join(workspace, `native-prepared/${mode}.json`));
  const retry = t.mock.method(childProcess, "spawnSync", (...args) => {
    if (typeof args[2]?.input === "string" && JSON.parse(args[2].input).args?.[0] === "ack") calls++;
    return spawn(...args);
  });
  syncBuiltinESMExports();
  try { await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_ACK_ALREADY_ATTEMPTED" }); }
  finally { retry.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(path.join(attempt, "pending.json")), pending);
  assert.deepEqual(await readFile(path.join(workspace, "native-prepared/readback.json")), receipt);
  assert.deepEqual(await readFile(path.join(workspace, "native-worker-readback.txt")), evidence);
  for (const mode of Object.keys(requests)) assert.deepEqual(await readFile(path.join(workspace, `native-prepared/${mode}.json`)), requests[mode]);
  await assert.rejects(readFile(path.join(attempt, "result.json")), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(workspace, "consumer-output.json")), { code: "ENOENT" });
});

for (const drift of ["source", "registry", "publication"]) test(`P2 post-ACK ${drift} drift cannot publish current success or replay`, options, async t => {
  const x = await setup(t, "candidate", value => value, { maxCalls: 2 });
  const prepared = await applyNativePreparation(x.apply), w = await dispatchWorker(t, x, prepared);
  const workspace = x.stage.workspace, attempt = path.join(x.args.directory, x.args.arm, "preparation-application/worker-ack");
  const spawn = childProcess.spawnSync; let calls = 0;
  const mock = t.mock.method(childProcess, "spawnSync", (...args) => {
    const result = spawn(...args);
    if (typeof args[2]?.input === "string") {
      const request = JSON.parse(args[2].input);
      if (request.operation === "prepare" && request.args?.[0] === "ack") {
        calls++;
        assert.equal(JSON.parse(result.stdout).result.status, "ACKNOWLEDGED");
        if (drift === "source") writeFileSync(path.join(workspace, "future-other.txt"), "Unrelated after-effect source\n");
        if (drift === "registry") writeFileSync(w.sourceFile, readFileSync(w.sourceFile).toString() + "\n");
        if (drift === "publication") {
          const text = "Later native publication, not the worker's acquired snapshot\n";
          const publication = { ...x.args, expectedSourceRevision: w.published.sourceRevision, artifacts: [{
            id: "later-source", text, purpose: "Post-effect drift counterexample", origin: {
              kind: "parent-protocol-result", arm: x.args.arm, operation: "drift-test", sha256: sha256(text) } }] };
          const child = spawn(process.execPath, ["--input-type=module", "-e",
            `import {publishTurnSources} from ${JSON.stringify(new URL("../scripts/qualify-framework-comparison-native.mjs", import.meta.url).href)}; await publishTurnSources(${JSON.stringify(publication)});`],
            { encoding: "utf8", timeout: 10000 });
          assert.equal(child.status, 0, child.stderr);
        }
      }
    }
    return result;
  });
  syncBuiltinESMExports();
  try { await assert.rejects(applyNativeWorkerAcknowledgment(w.args), {
    message: drift === "publication" ? "NATIVE_ACK_SOURCES_CHANGED" : "NATIVE_ACK_CONTEXT_CHANGED"
  }); } finally { mock.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(calls, 1);
  const pending = await readFile(path.join(attempt, "pending.json"));
  const receipt = await readFile(path.join(workspace, "native-prepared/readback.json"));
  assert.equal(await readFile(path.join(workspace, "native-worker-readback.txt"), "utf8"), w.readback);
  await assert.rejects(readFile(path.join(attempt, "result.json")), { code: "ENOENT" });
  const retry = t.mock.method(childProcess, "spawnSync", (...args) => {
    if (typeof args[2]?.input === "string" && JSON.parse(args[2].input).args?.[0] === "ack") calls++;
    return spawn(...args);
  });
  syncBuiltinESMExports();
  try { await assert.rejects(applyNativeWorkerAcknowledgment(w.args), { message: "NATIVE_ACK_ALREADY_ATTEMPTED" }); }
  finally { retry.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(calls, 1);
  assert.deepEqual(await readFile(path.join(attempt, "pending.json")), pending);
  assert.deepEqual(await readFile(path.join(workspace, "native-prepared/readback.json")), receipt);
  if (drift === "source") assert.equal(await readFile(path.join(workspace, "future-other.txt"), "utf8"), "Unrelated after-effect source\n");
});

test("subsequent preparation accepts only a frozen explicit compiler across ledgers, without inherited authority", options, async t => {
  const x = await setup(t, "candidate", value => value, { compilerMode: true });
  const initial = await applyNativePreparation(x.apply), workspace = x.stage.workspace;
  await writeFile(path.join(workspace, "consumer-output.json"), '{"scriptedPredecessor":true}\n', { flag: "wx" });
  await writeFile(path.join(workspace, "next-goal.md"), "Use the preserved result.\n", { flag: "wx" });
  const ref = async name => ({ path: name, sha256: sha256(await readFile(path.join(workspace, name))) });
  const oldFreeze = JSON.parse(await readFile(path.join(x.args.directory, "native-freeze.json")));
  const second = await stageNativeComparison({ comparisonOutput: oldFreeze.comparisonOutput, expectedDigest: oldFreeze.comparisonDigest,
    scenarioDigest: oldFreeze.scenarioDigest, output: path.join(x.root, "second-native"), maxCalls: 4, timeoutMs: 15000 });
  const scope = { ...second, arm: "candidate", namespace: "recovery-next", taskId: "next-consumer",
    goalRef: await ref("next-goal.md"), predecessor: { task: initial.request.task,
      recipe: await ref("recipe.json"), output: await ref("consumer-output.json") },
    compiler: x.compiler };
  await assert.rejects(stageNativeSubsequentPreparation({ ...scope,
    compiler: { ...scope.compiler, sha256: "0".repeat(64) } }),
  /NATIVE_PREPARATION_COMPILER_CHANGED/);
  const next = await stageNativeSubsequentPreparation(scope);
  const published = await readTurnSources({ ...second, arm: "candidate" });
  const format = published.sourceSnapshot.rows.find(row => row.id === "preparation-compact-format");
  assert.ok(format && format.status === "AVAILABLE");
  assert.equal(format.sha256, sha256(encode({ schema: "test.identity-only" })));
  const interfaceRow = published.sourceSnapshot.rows.find(row => row.id === next.interfaceId);
  const descriptor = JSON.parse(await readFile(path.join(second.directory, "candidate/public", interfaceRow.path)));
  assert.equal(descriptor.compilerContext.interface.schema, "comparison.preparation-interface.v1");
  assert.deepEqual(descriptor.compilerContext.interface.action, descriptor.action);
  assert.deepEqual(descriptor.compilerContext.interface.verification.args, ["verify.mjs"]);
  assert.equal(descriptor.compilerContext.interface.oracle, "oracle.json");
  assert.deepEqual(descriptor.compilerContext.interface.permittedCandidateFiles, ["continuation.mjs"]);
  assert.deepEqual(descriptor.compilerContext.files, descriptor.workspaceBefore.files);
  assert.match(descriptor.compactInstructions, /compilerContext/);
  const stored = JSON.parse(await readFile(path.join(second.directory, "candidate/preparation-application/next-recovery-next/stage.json")));
  assert.deepEqual(stored.compiler, x.compiler);
  assert.equal(next.workspace, workspace);
  assert.equal(next.semanticEvidence, false);
  assert.deepEqual(await ref(initial.request.task.path), initial.request.task);
  assert.equal(await readFile(path.join(workspace, "consumer-output.json"), "utf8"), '{"scriptedPredecessor":true}\n');

  // Scripted historical proposal plus a fresh native transport adoption, not a
  // semantic model discovery or inherited execution permission.
  const proposal = structuredClone(x.preparation), pkg = proposal.package;
  pkg.task.id = scope.taskId; pkg.task.action = descriptor.action;
  pkg.task.candidateFiles = ["continuation.mjs"]; pkg.module.implementationFiles = ["continuation.mjs"];
  pkg.dependencies.push({ id: "previous-output", path: "consumer-output.json", scope: ["bundle"] });
  pkg.navigation.taskId = scope.taskId;
  pkg.navigation.assignment = { ...pkg.navigation.assignment, requestId: "adopted", phase: "initial", previous: null };
  const goal = pkg.navigation.references.find(row => row.id === "goal");
  goal.path = scope.goalRef.path; goal.quote = await readFile(path.join(workspace, goal.path), "utf8");
  const priorText = encode({ exact: proposal, decision: "approved" }), priorPath = path.join(x.root, "next-prior.json");
  await writeFile(priorPath, priorText, { flag: "wx" });
  const priorPreparation = { path: priorPath, sha256: sha256(priorText),
    filesSha256: hash(stored.workspaceBefore.files), files: stored.workspaceBefore.files };
  const reuseScope = { ...scope, namespace: "adopted", priorPreparation };
  await writeFile(path.join(workspace, "unrelated.txt"), "Unexpected prior input", { flag: "wx" });
  await assert.rejects(stageNativeSubsequentPreparation(reuseScope), /NATIVE_PRIOR_INPUTS_CHANGED/);
  await rm(path.join(workspace, "unrelated.txt"));
  await assert.rejects(stageNativeSubsequentPreparation({ ...reuseScope,
    priorPreparation: { ...priorPreparation, sha256: "0".repeat(64) } }), /NATIVE_PRIOR_PROPOSAL_CHANGED/);
  const adopted = await stageNativeSubsequentPreparation(reuseScope);
  let mode;
  const provider = await nativeProvider(t, async n => n % 2 ? codeItem(
    "const tool=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));" +
    `for(const id of ${JSON.stringify([adopted.task.id, adopted.interfaceId, "preparation-compact-format"])}` +
    `${mode === "unread" ? "" : '.concat(["preparation-prior-proposal"])'})text(await tools[tool.name]({id}));`, `adoption-read-${n}`)
    : answerItem({ preparation: { reuse: { id: "preparation-prior-proposal", sha256: priorPreparation.sha256 },
      decision: mode === "refused" ? "rejected" : "approved", ...(mode === "additions" ? { additions: {} } : {}) } }));
  for (mode of ["unread", "refused", "additions", "approved"]) {
    const record = await dispatchRole({ ...second, arm: "candidate", role: "owner", binary,
      authHome: path.join(x.root, "auth"), provider: provider.provider, sourceRevision: adopted.sourceRevision,
      intent: { task: adopted.task, commands: [], context: null }, prompt: "Scripted explicit prior proposal adoption; no semantic proof." });
    const apply = { ...second, arm: "candidate", namespace: "adopted", stageSha256: adopted.stageSha256, number: record.number };
    if (mode !== "approved") {
      await assert.rejects(applyNativeSubsequentPreparation(apply), mode === "unread" ? /NATIVE_PRIOR_PROPOSAL_NOT_ACQUIRED/ :
        mode === "refused" ? /NATIVE_PRIOR_DECISION_REQUIRED/ : /NATIVE_PRIOR_DELTA_INVALID/);
      assert.deepEqual(await readdir(path.join(workspace, adopted.paths.directory)), []);
    } else {
      await writeFile(priorPath, priorText + " ");
      await assert.rejects(applyNativeSubsequentPreparation(apply), /NATIVE_PRIOR_PROPOSAL_CHANGED/);
      await writeFile(priorPath, priorText);
      const result = await applyNativeSubsequentPreparation(apply);
      assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED", JSON.stringify(result));
      assert.equal(result.request.readback, null);
      assert.deepEqual(result.steps.map(step => step.result.status), ["PLAN_READY", "PREPARED", "DELIVERED"]);
      const attempt = path.join(second.directory, "candidate/preparation-application/next-adopted/attempt");
      const receipt = JSON.parse(await readFile(path.join(attempt, "compilation.json")));
      assert.equal(receipt.reusedProposal.sha256, priorPreparation.sha256);
      assert.equal(receipt.reusedProposal.freshOwnerDecision, "approved");
      assert.equal(receipt.originalModelOutputSha256, record.modelOutputSha256);
      assert.deepEqual(JSON.parse(await readFile(path.join(attempt, "compiled-input.json"))), proposal);
      await assert.rejects(applyNativeSubsequentPreparation(apply), /NATIVE_NEXT_NAMESPACE_NOT_EMPTY/);
    }
  }
  assert.equal(await readFile(priorPath, "utf8"), priorText);
  assert.deepEqual(await ref(initial.request.task.path), initial.request.task);
});

for (const { arm, namespaceDrift = null } of [
  { arm: "baseline" }, { arm: "candidate" },
  { arm: "candidate", namespaceDrift: "before-ACK" },
  { arm: "candidate", namespaceDrift: "after-ACK" }
]) test(namespaceDrift ? `P2 subsequent namespace ${namespaceDrift} unrelated file must be rejected` :
  `${arm} subsequent native preparation preserves predecessor and uses its own initial packet and ACK`, options, async t => {
  const x = await setup(t, arm, value => value, { maxCalls: 4 });
  const initial = await applyNativePreparation(x.apply), workspace = x.stage.workspace;
  // A seeded predecessor output isolates preparation transport. It is not actual
  // acceptance/execution evidence and is never advertised to the real comparator.
  await writeFile(path.join(workspace, "consumer-output.json"), '{"scriptedPredecessor":true}\n', { flag: "wx" });
  await writeFile(path.join(workspace, "next-goal.md"), "Read the prior consumer result in a separate next task. Retain earlier obligations.\n", { flag: "wx" });
  const ref = async name => ({ path: name, sha256: sha256(await readFile(path.join(workspace, name))) });
  const predecessor = { task: initial.request.task, recipe: await ref("recipe.json"), output: await ref("consumer-output.json") };
  const originalNames = await readdir(workspace), originals = new Map();
  for (const name of [...originalNames.filter(name => !name.startsWith("native-prepared")),
    "native-prepared/task.json", "native-prepared/plan.json", "native-prepared/approval.json", "native-prepared/awaiting-worker.json"])
    originals.set(name, await readFile(path.join(workspace, name)));
  const scope = { ...x.args, namespace: "reuse", taskId: "next-consumer", goalRef: await ref("next-goal.md"), predecessor };
  await assert.rejects(stageNativeSubsequentPreparation({ ...scope, taskId: "consumer" }), { message: "NATIVE_NEXT_TASK_NOT_NEW" });
  await assert.rejects(stageNativeSubsequentPreparation({ ...scope, predecessor: { ...predecessor,
    output: { ...predecessor.output, sha256: "0".repeat(64) } } }), { message: "NATIVE_ACK_REFERENCE_CHANGED" });
  assert.deepEqual(await readdir(workspace), originalNames);
  const stage = await stageNativeSubsequentPreparation(scope), paths = stage.paths;
  const next = { ...x, stage, apply: { ...x.args, namespace: scope.namespace, stageSha256: stage.stageSha256 } };
  const pkg = structuredClone(x.preparation.package);
  pkg.task.id = scope.taskId;
  pkg.task.action = { executable: process.execPath, args: ["continuation.mjs"], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 };
  pkg.task.candidateFiles = ["continuation.mjs"];
  pkg.module.implementationFiles = ["continuation.mjs"];
  pkg.dependencies.push({ id: "previous-output", path: predecessor.output.path, scope: ["bundle"] });
  pkg.navigation.taskId = scope.taskId;
  pkg.navigation.assignment = { ...pkg.navigation.assignment, requestId: "reuse", phase: "initial", previous: null };
  const goal = pkg.navigation.references.find(row => row.id === "goal");
  goal.path = scope.goalRef.path; goal.quote = await readFile(path.join(workspace, goal.path), "utf8");
  const proposal = { package: pkg, recipe: { authored: "Subsequent proposal; fixed continuation does not consume this JSON." }, decision: "approved" };
  const invalid = structuredClone(proposal); invalid.package.navigation.assignment.phase = "supplement";
  const provider = await nativeProvider(t, async n => n % 2 ? codeItem(
    "const tool=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));" +
    `for(const id of ${JSON.stringify([stage.task.id, stage.interfaceId])})text(await tools[tool.name]({id}));`, `next-owner-read-${n}`)
    : answerItem({ preparation: n === 2 ? invalid : proposal }));
  const dispatch = { ...x.args, role: "owner", binary, authHome: path.join(x.root, "auth"), provider: provider.provider,
    sourceRevision: stage.sourceRevision, intent: { task: stage.task, commands: [], context: null },
    prompt: "Scripted next-task transport only: read the pinned goal/interface and author a new initial package and recipe." };
  const wrong = await dispatchRole(dispatch);
  await assert.rejects(applyNativeSubsequentPreparation({ ...next.apply, number: wrong.number }), { message: "NATIVE_NEXT_ASSIGNMENT_INVALID" });
  assert.deepEqual(await readdir(path.join(workspace, paths.directory)), []);
  const owner = await dispatchRole(dispatch), apply = { ...next.apply, number: owner.number };
  await writeFile(path.join(workspace, "recipe.json"), "Changed predecessor");
  await assert.rejects(applyNativeSubsequentPreparation(apply), { message: "NATIVE_ACK_REFERENCE_CHANGED" });
  await writeFile(path.join(workspace, "recipe.json"), originals.get("recipe.json"));
  await writeFile(path.join(workspace, "unplanned.txt"), "No blanket skipPristine");
  await assert.rejects(applyNativeSubsequentPreparation(apply), { message: "NATIVE_NEXT_WORKSPACE_CHANGED" });
  await rm(path.join(workspace, "unplanned.txt"));
  const result = await applyNativeSubsequentPreparation(apply);
  assert.equal(result.status, "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED", JSON.stringify(result));
  assert.deepEqual(result.steps.map(step => step.result.status), ["PLAN_READY", "PREPARED", "DELIVERED"]);
  assert.equal(result.request.task.path, `${paths.prepared}/task.json`);
  assert.equal(result.request.readback, null);
  assert.equal(await readFile(path.join(workspace, paths.package), "utf8"), encode(pkg));
  assert.equal(await readFile(path.join(workspace, paths.recipe), "utf8"), encode(proposal.recipe));
  await assert.rejects(applyNativeSubsequentPreparation(apply), { message: "NATIVE_NEXT_NAMESPACE_NOT_EMPTY" });
  const worker = await dispatchWorker(t, next, result, { paths });
  if (namespaceDrift) {
    // An unregistered file must not become authorized merely by sharing the
    // next packet's namespace. Inputs and decisions remain scripted transport.
    const unrelated = path.join(workspace, paths.directory, "unrelated.txt");
    const text = "Unrelated namespace write, not worker-authored evidence.\n";
    const attempt = path.join(x.args.directory, arm, "preparation-application", `next-${scope.namespace}`, "worker-ack");
    const spawn = childProcess.spawnSync; let calls = 0;
    if (namespaceDrift === "before-ACK") await writeFile(unrelated, text, { flag: "wx" });
    const mock = t.mock.method(childProcess, "spawnSync", (...args) => {
      const observed = spawn(...args);
      if (typeof args[2]?.input === "string") {
        const request = JSON.parse(args[2].input);
        if (request.operation === "prepare" && request.args?.[0] === "ack") {
          calls++;
          assert.equal(JSON.parse(observed.stdout).result.status, "ACKNOWLEDGED");
          if (namespaceDrift === "after-ACK") writeFileSync(unrelated, text, { flag: "wx" });
        }
      }
      return observed;
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(applyNativeSubsequentWorkerAcknowledgment(worker.args), { message: "NATIVE_NEXT_WORKSPACE_CHANGED" });
      assert.equal(calls, namespaceDrift === "after-ACK" ? 1 : 0);
      await assert.rejects(readFile(path.join(attempt, "result.json")), { code: "ENOENT" });
      assert.equal(await readFile(unrelated, "utf8"), text);
      if (namespaceDrift === "after-ACK") {
        const receipt = await readFile(path.join(workspace, paths.prepared, "readback.json"));
        const pending = await readFile(path.join(attempt, "pending.json"));
        assert.equal(await readFile(path.join(workspace, paths.evidence), "utf8"), worker.readback);
        // Removing only the injected drift must not release the unknown-effect hold.
        await rm(unrelated);
        await assert.rejects(applyNativeSubsequentWorkerAcknowledgment(worker.args), { message: "NATIVE_ACK_ALREADY_ATTEMPTED" });
        assert.equal(calls, 1);
        assert.deepEqual(await readFile(path.join(workspace, paths.prepared, "readback.json")), receipt);
        assert.deepEqual(await readFile(path.join(attempt, "pending.json")), pending);
      } else {
        await assert.rejects(readdir(attempt), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(workspace, paths.evidence)), { code: "ENOENT" });
        await assert.rejects(readFile(path.join(workspace, paths.prepared, "readback.json")), { code: "ENOENT" });
      }
      for (const [name, value] of originals) assert.deepEqual(await readFile(path.join(workspace, name)), value, name);
    } finally { mock.mock.restore(); syncBuiltinESMExports(); }
    return;
  }
  const ack = await applyNativeSubsequentWorkerAcknowledgment(worker.args);
  assert.equal(ack.status, "NATIVE_WORKER_ACKNOWLEDGED");
  assert.equal(ack.evidenceRef.path, paths.evidence);
  assert.equal(ack.request.readback.path, `${paths.prepared}/readback.json`);
  assert.equal(await readFile(path.join(workspace, paths.evidence), "utf8"), worker.readback);
  assert.equal(ack.semanticEvidence, false); assert.equal(ack.wholeChainComparatorReady, false);
  await assert.rejects(applyNativeSubsequentWorkerAcknowledgment(worker.args), { message: "NATIVE_ACK_ALREADY_ATTEMPTED" });
  for (const [name, value] of originals) assert.deepEqual(await readFile(path.join(workspace, name)), value, name);
  await assert.rejects(readFile(path.join(workspace, "continued.json")), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(workspace, "native-prepared/readback.json")), { code: "ENOENT" });
  t.diagnostic("Scripted native preparation/ACK only. Predecessor output is seeded; no acceptance, action or semantic proof.");
});
