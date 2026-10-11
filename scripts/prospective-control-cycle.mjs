// Maintainer staging only. No native worker, host admission, or protected action.
import {readFile, writeFile, mkdir, realpath, readdir, lstat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {canonicalJson, sha256} from "./memory-brief.mjs";
import {stageCycle, cycleAcquired, cycleAnswer} from "./qualify-control-cycle.mjs";
import {repairCycleFixture} from "./control-cycle-fixture.mjs";
import {inspectControlRuntime} from "./control-runtime.mjs";
import {openReviewSources} from "./control-review-sources.mjs";

const runtimeDigest = "aed7297eccdba2fdb4474a993d5e4d1d69e1427d9ec447cb49dbceba12614840";
const need = (v, code) => { if (!v) throw Error(code); };
const hash = v => sha256(canonicalJson(v));
const equal = (a, b) => canonicalJson(a) === canonicalJson(b);
const inside = (root, p) => p === root || p.startsWith(root + path.sep);
const json = async p => JSON.parse(await readFile(p));
const save = (p, v, fresh = true) => writeFile(p, typeof v === "string" ? v : canonicalJson(v) + "\n",
  {mode: 0o600, flag: fresh ? "wx" : "w"});
const input = [{id: "Z", label: " z "}, {id: "a", label: " a "}];
const expectedOutput = {schema: "bundle/v1", entries: [{id: "Z", label: "z"}, {id: "a", label: "a"}], count: 2};
const allocation = {model: "gpt-6.1-sol", effort: "low", secondsPerCall: 120, retries: 0, maxCalls: 16,
  calls: {prepare: 1, workerReadback: 1, independentReadiness: 1, execute: 1, ownerAcceptance: 1,
    currentRecipient: 1, post: 8, ownerDisposition: 1, heldOutRecall: 1}};
const order = ["parentDependency", "prepare", "workerReadback", "executorEnvironment", "independentReadiness",
  "execute", "ownerAcceptance", "currentRecipient", "post", "ownerDisposition", "heldOutRecall"];
const lifetime = {initial: "EXISTING_SOURCES_ONLY", preparation: "SEPARATE_ACTUAL_MODEL_ARTIFACT_NOT_SEED_REPLACEMENT",
  beforeReadiness: "PUBLISH_ACTUAL_ACK_ENVIRONMENT_AND_UPDATED_PACKET_THEN_FREEZE",
  beforePost: "PUBLISH_ACTUAL_ACCEPTANCE_RETENTION_AND_CURRENT_RECIPIENT_THEN_FREEZE",
  duringPost: "NO_SOURCE_DRIFT_ALL_87_EIGHT_PARTS", afterClosure: "SEPARATE_HELD_OUT_REGISTRY"};
const gates = {parentDependency: "PENDING_INDEPENDENT_DECISION", workerReadback: "PENDING_ACTUAL_WORKER",
  executorEnvironment: "PENDING_CONTEMPORANEOUS_EXECUTOR", independentReadiness: "PENDING_EXACT_COMPOSITION",
  currentRecipient: "PENDING_ACTUAL_RETRIEVAL_APPLICATION", heldOutRecall: "AFTER_CLEAN_FIRST_TASK_AT_TWO_TASK_BOUNDARY"};

export function validateProspectivePlan(p) {
  need(p?.schema === "qualification.prospective-cycle.v1" && p.status === "STAGED_NOT_AUTHORIZED" &&
    p.runtime?.digest === runtimeDigest && p.dependencyDecisionRequired === true, "PROSPECTIVE_AUTHORITY_INVALID");
  need(equal(p.allocation, allocation) && equal(p.order, order), "PROSPECTIVE_ALLOCATION_OR_ORDER_INVALID");
  need(Array.isArray(p.priorRuns) && p.priorRuns.length === 28 && p.priorRuns.at(-1).name === "source-selection-probe" &&
    hash(p.priorRuns) === p.priorRunsSha256 && p.spentBefore === 28 && p.totalMaximum === 44 &&
    p.refundedAttempts === 0, "PROSPECTIVE_HISTORY_REFUND_OR_DRIFT");
  need(equal(p.gates, gates) && equal(p.sourceLifetime, lifetime) && p.modelsLaunched === 0 &&
    p.protectedActions === 0 && p.hostAdmissions === 0, "PROSPECTIVE_GATES_OR_LIFETIME_INVALID");
  need(p.request?.operation === "resume" && p.request.readback === null &&
    p.config?.executor === p.compiledWorker && p.compiledWorker === p.roles?.executor &&
    p.config.workspace === p.workspace && p.config.evidenceRegistry === p.registryFile &&
    p.request.workspace === p.workspace && p.binding?.cwd === p.workspace && p.config.policy === hash(p.policy) &&
    p.binding?.taskSha256 === p.request.task?.sha256 && p.binding?.capsuleSha256 === p.request.capsule?.sha256,
  "PROSPECTIVE_CURRENT_IDENTITY_INVALID");
  need(equal(p.input, input) && equal(p.expectedOutput, expectedOutput) &&
    equal(p.productDependencies, ["PINNED_PUBLIC_BUNDLE_R2_ONLY"]) && p.oldAcceptedResultDependency === false &&
    p.historicalClosure === false, "PROSPECTIVE_OLD_RESULT_DEPENDENCY");
  need(p.requiredSourceIdsAreWhitelist === false && p.frozenSources?.rows?.length > 0 &&
    p.frozenSources.rows.every(r => r.status === "AVAILABLE" && r.id !== "current-readback") &&
    p.requiredSourceIds.every(id => p.frozenSources.rows.some(r => r.id === id)), "PROSPECTIVE_SOURCE_LIFETIME_INVALID");
  return p;
}

async function pinned(file) {
  const s = await lstat(file);
  need(s.isFile() && !s.isSymbolicLink() && s.nlink === 1 && s.size <= 4 * 1024 * 1024 &&
    await realpath(file) === file, "PROSPECTIVE_EVIDENCE_UNSAFE");
  return {path: file, sha256: sha256(await readFile(file))};
}

// Resolve only the public control root actually acquired by the diagnostic.
async function previousEvidence(previous) {
  const refs = await Promise.all(["allocation.json", "result.json", "trace.json"].map(n => pinned(path.join(previous, n))));
  const [a, r, t] = await Promise.all(refs.map(ref => json(ref.path)));
  need(r.status === "SOURCE_SELECTION_OBSERVED_NO_ADMISSION" && r.failure === null && r.runtime === runtimeDigest &&
    r.stateUnchanged === true && r.controlAdmission === "NOT_ATTEMPTED_PARTIAL_VERDICT" && r.findingsClosed === 0 &&
    r.productReplayed === false && r.runs?.length === 28 && a.priorAttempts === 27 && a.maxCalls === 1 && a.retries === 0 &&
    a.runtime === runtimeDigest && equal(cycleAnswer(t), r.answer), "PROSPECTIVE_PRIOR_DIAGNOSTIC_INVALID");
  const reads = cycleAcquired(t);
  need(reads.every(s => s.status === "AVAILABLE" && sha256(s.text) === s.sha256), "PROSPECTIVE_PRIOR_READ_CHANGED");
  const inventory = reads.filter(s => s.id === "repair-inventory-2");
  need(inventory.length === 1, "PROSPECTIVE_PRIOR_CONTROL_ROOT_MISSING");
  const root = JSON.parse(inventory[0].text).root;
  need(path.isAbsolute(root) && await realpath(root) === root, "PROSPECTIVE_PRIOR_CONTROL_ROOT_UNSAFE");
  const registryFile = path.join(root, "sources.json"), registry = await openReviewSources(registryFile);
  const snapshot = await registry.snapshot();
  need(snapshot.digest === a.sourceDigest, "PROSPECTIVE_PRIOR_SOURCES_CHANGED");
  const journalRoot = path.join(root, "host"), names = (await readdir(journalRoot)).filter(n => /^\d{10}\.json$/.test(n)).sort();
  need(names.length > 0, "PROSPECTIVE_PRIOR_JOURNAL_MISSING");
  const journal = path.join(journalRoot, names.at(-1)), record = await json(journal);
  need(hash(record.state) === a.stateHash, "PROSPECTIVE_PRIOR_STATE_CHANGED");
  const packet = JSON.parse((await registry.read({id: "execution-packet"})).text);
  const producer = packet.consumedProducer?.artifact, accepted = record.state.acceptances?.consumer?.acceptance?.artifact;
  need(producer?.path === "candidate.mjs" && /^[a-f0-9]{64}$/.test(producer.sha256) &&
    accepted?.path === "consumer-output.json", "PROSPECTIVE_PRIOR_PUBLIC_BINDING_MISSING");
  const acceptedRef = await pinned(path.join(registry.workspace, accepted.path));
  need(acceptedRef.sha256 === accepted.sha256, "PROSPECTIVE_PRIOR_ACCEPTED_BYTES_CHANGED");
  return {refs: [...refs, await pinned(registryFile), await pinned(journal), acceptedRef],
    root, workspace: registry.workspace, registryFile, journalRoot, journalNames: names,
    journalDigest: record.digest, stateHash: a.stateHash, sourceDigest: snapshot.digest,
    producer, priorRuns: r.runs};
}

async function unchanged(old) {
  for (const ref of old.refs) need((await pinned(ref.path)).sha256 === ref.sha256, "PROSPECTIVE_PRIOR_BYTES_CHANGED");
  need(equal((await readdir(old.journalRoot)).filter(n => /^\d{10}\.json$/.test(n)).sort(), old.journalNames) &&
    (await (await openReviewSources(old.registryFile)).snapshot()).digest === old.sourceDigest, "PROSPECTIVE_PRIOR_DRIFT");
}

export async function stageProspectiveCycle({previous, output, binary, authHome}) {
  need([previous, output, binary, authHome].every(p => typeof p === "string" && path.isAbsolute(p)), "PROSPECTIVE_PATHS_REQUIRED");
  need(await realpath(previous) === previous && await realpath(path.dirname(output)) === path.dirname(output), "PROSPECTIVE_PATH_ALIAS");
  const old = await previousEvidence(previous);
  for (const protectedRoot of [previous, old.root, old.workspace, authHome])
    need(!inside(protectedRoot, output) && !inside(output, protectedRoot), "PROSPECTIVE_OUTPUT_OVERLAP");
  const sourceRoot = fileURLToPath(new URL("..", import.meta.url));
  need((await inspectControlRuntime(sourceRoot)).digest === runtimeDigest, "PROSPECTIVE_RUNTIME_CHANGED");
  const staged = await stageCycle({output, binary, authHome, terminal: true});
  const base = await json(path.join(staged.output, "freeze.json")), workspace = base.workspace;
  const originalRegistry = await readFile(base.registryFile);
  await save(path.join(output, "initial-sources.json"), originalRegistry.toString());
  const scaffold = [];
  await mkdir(path.join(output, "initial-scaffold"), {mode: 0o700});
  for (const name of ["scope.md", "contract.md", "consumer-input.json", "execution-packet.md"]) {
    const target = path.join(output, "initial-scaffold", name);
    await save(target, (await readFile(path.join(workspace, name))).toString());
    scaffold.push(await pinned(target));
  }
  const roles = {outcomeOwner: "owner", executor: (await json(path.join(workspace, "task.json"))).owner,
    independentReviewer: "reviewer", integrationOwner: "orchestrator", custodyOwner: "maintainer",
    declaration: "PROSPECTIVE_ASSIGNMENT_NOT_HISTORICAL_AUTHENTICATION"};
  const planText = `Prospective independent consumer of the closed public buildBundle@bundle-r2, not replay of the old consumer or use of its output. Parent hold applicability remains PENDING independent byte-bound decision before ANY native call. No self-exemption or historical closure.
Only the two supplied records Z / ' z ' and a / ' a ' are in scope; expected exact ids in codepoint order Z,a and trimmed labels z,a. consumeBundle delegates unchanged records. Producer is stateless for this boundary: no persistent state, I/O or input mutation; duplicate detection state is local to each call. Supported input is an array of records with string id and label; this task authorizes exactly two. Other input types, size limits, Unicode normalization and cross-runtime ordering are not qualified. Duplicate comparison uses lowercase comparison; DUPLICATE_ID throws, with no successful output. The wrapper reads recipe.json and consumer-input.json and creates consumer-output.json once with wx; existing output refuses overwrite, failures are not automatically retried, partial/unknown outcomes require reconciliation. No producer edits, consumer preprocessing, keep-last, CSV, network or deployment.
Planning convention: evidence-before-effect, current recipient retrieval before POST, later held-out recall after clean first-task closure at the enclosing two-task boundary. No external GitHub board exists for this disposable local fixture; the local retained tracker is the planning/status surface, not a claimed GitHub integration. Map covers this consumer, public producer connection and retained obligations only, not a whole platform. Owner owns product acceptance and terminal disposition; orchestrator owns integration plan and shared meaning; worker owns actual readback and environment; independent reviewer owns readiness and full87; maintainer owns custody, unresolved historical qualification and Q6. All local artifacts, initial scaffold, journals and failed attempts are retained until an explicit cleanup decision, checkpoint within seven days; no cleanup is authorized here.
Model selection is a bounded Sol 6.1 Low qualification choice based on prior bounded public-source runs, not a universal policy or economy claim. Budget: prepare1, workerReadback1, independentReadiness1, execute1, ownerAcceptance1, currentRecipient1, post8, ownerDisposition1, heldOutRecall1; 16 calls maximum, 120 seconds each, no retries or escalation. All 28 prior attempts remain spent; unknown timeout usage and preparation/execution/review/recovery/coordination costs remain unknown, never zero. Q6 matched comparison remains separately maintainer-owned and incomplete; no productivity or release claim.
Original source reviews/ACKs and corrected package confirm/integration are synthetic compilation scaffolding, NOT actual approval or executor understanding. Seed recipe is synthetic immutable compilation input. Actual model preparation must be saved separately; mismatch stops, never rewrites frozen recipe/task/capsule. Actual current worker readback and contemporaneous executor environment receipt precede independent readiness and effects. Actual recipient retrieval/application follows accepted retention and precedes full POST. Remaining map/tracker/memory/custody publication, owner response and held-out recall are pending, not established by staging.\n`;
  await save(path.join(workspace, "scope.md"), planText, false);
  await save(path.join(workspace, "prospective-plan.md"), planText);
  await save(path.join(workspace, "prospective-roles.json"), roles);
  await save(path.join(workspace, "contract.md"), (await readFile(path.join(workspace, "contract.md"), "utf8")) + "\n" + planText, false);
  await save(path.join(workspace, "consumer-input.json"), input, false);
  const seed = {entrypoint: "buildBundle", revision: "bundle-r2", preprocess: "none", format: "json", producerEdits: [],
    rejected: ["keep-last"], idea: {id: "CSV", disposition: "ASK_OWNER_NOT_IMPLEMENT"},
    provenance: "MAINTAINER_SYNTHETIC_COMPILATION_SEED_NOT_MODEL_PREPARATION"};
  await save(path.join(workspace, "recipe.json"), seed);
  need(sha256(await readFile(path.join(workspace, "candidate.mjs"))) === old.producer.sha256, "PROSPECTIVE_PUBLIC_PRODUCER_CHANGED");
  const repaired = await repairCycleFixture({workspace, runtimeRoot: base.runtime.root, deferAck: true});
  const task = await json(path.join(workspace, repaired.request.task.path));
  // Missing future artifacts are not sources. Later phases publish separately, before freezing their verdict input.
  const initial = JSON.parse(originalRegistry).sources.filter(s => ["scope", "goal", "contract", "decisions", "success", "ideas", "map", "execution-packet"].includes(s.id));
  const sources = [...initial, ...repaired.sources, {id: "prospective-plan", path: "prospective-plan.md", purpose: "Prospective plan, limits and pending obligations"},
    {id: "prospective-roles", path: "prospective-roles.json", purpose: "Actual prospective role assignment, not historical authentication"}];
  const registryFile = path.join(base.root, "prospective-sources.json");
  await save(registryFile, {schema: "control.review-sources.v1", workspace, sources});
  const frozenSources = await (await openReviewSources(registryFile)).snapshot();
  const scripts = {};
  for (const name of ["prospective-control-cycle", "qualify-control-cycle", "control-cycle-fixture"])
    scripts[`scripts/${name}.mjs`] = sha256(await readFile(path.join(sourceRoot, `scripts/${name}.mjs`)));
  scripts["tests/context-fixture.mjs"] = sha256(await readFile(path.join(sourceRoot, "tests/context-fixture.mjs")));
  const policy = {schema: "qualification.prospective-policy.v1", allocation, input, expectedOutput, order, gates,
    productDependencies: ["PINNED_PUBLIC_BUNDLE_R2_ONLY"], sourceLifetime: lifetime};
  const manifest = {schema: "qualification.prospective-cycle.v1", status: "STAGED_NOT_AUTHORIZED",
    out: base.out, root: base.root, workspace, binary, authHome, runtime: base.runtime, registryFile,
    config: {...base.config, policy: hash(policy), executor: task.owner, evidenceRegistry: registryFile}, policy,
    request: repaired.request, binding: repaired.binding,
    packetOutput: "cycle-fixture-repair", preflight: repaired.preflight, resume: repaired.resume, accept: repaired.accept,
    priorRuns: old.priorRuns, priorRunsSha256: hash(old.priorRuns), spentBefore: 28, refundedAttempts: 0, totalMaximum: 44,
    allocation, input, expectedOutput, scriptSha256: scripts["scripts/prospective-control-cycle.mjs"], scripts, frozenSources,
    dependencyDecisionRequired: true, parentEvidence: old, initialScaffold: scaffold, compiledWorker: task.owner, roles, order, gates, sourceLifetime: lifetime,
    productDependencies: ["PINNED_PUBLIC_BUNDLE_R2_ONLY"], oldAcceptedResultDependency: false, historicalClosure: false,
    producer: old.producer, modelsLaunched: 0, protectedActions: 0, hostAdmissions: 0, requiredSourceIdsAreWhitelist: false,
    requiredSourceIds: ["goal", "contract", "decisions", "success", "ideas", "prospective-plan", "prospective-roles", "execution-packet"],
    actualPreparationPath: "actual-preparation.json", actualWorkerEvidencePath: "actual-worker-readback.json",
    actualEnvironmentPath: "actual-executor-environment.json", qualification: "INCOMPLETE_NO_RELEASE"};
  validateProspectivePlan(manifest);
  need((await readdir(path.join(base.root, "host"))).length === 0, "PROSPECTIVE_HOST_NOT_EMPTY");
  await unchanged(old);
  await save(path.join(output, "prospective-freeze.json"), manifest);
  return manifest;
}
