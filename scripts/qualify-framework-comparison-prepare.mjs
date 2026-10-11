// Native-authored preparation on the actual archived/candidate protocol. No inference,
// semantic field repair or command execution lives here. Worker ack copies only
// exact native-authored bytes through the selected arm's actual protocol.
import { mkdir, readFile, writeFile, realpath, lstat, readdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { canonicalJson, sha256 } from "./memory-brief.mjs";
import { verifyNativeComparison, readCompletedRoleOutput, readTurnSources, publishTurnSources } from "./qualify-framework-comparison-native.mjs";
import { verifyComparisonScenario, invokeComparisonAdapter } from "./qualify-framework-comparison.mjs";
import { openReviewSources } from "./control-review-sources.mjs";

const here = fileURLToPath(import.meta.url);
const hash = value => sha256(canonicalJson(value));
const encode = value => canonicalJson(value) + "\n";
const need = (value, code) => { if (!value) throw Error(code); };
const docs = ["scope", "goal", "contract", "decisions", "success", "ideas", "map"];
export function nativeCustodyContract() {
  return "# Local consumer custody contract\n" +
    "Recipient and sole notification owner: owner. No external notification is authorized or required in this local scenario.\n" +
    "The registered action.mjs writes consumer-output.json once through the admitted supervisor action.\n" +
    "After verify.mjs succeeds, the trusted experiment applicator writes the exact unmodified actual adapter Return Sync to producer-return.md and its verification receipt to technical-proof.json, then publishes both to owner through read_source. Planned writes do not establish delivery.\n" +
    "The fresh owner must acquire actual Return, proof and output, then author acceptance and retention text. The trusted applicator writes exactly that text once to retained-memory.md, retained-map.md, retained-tracker.md and retained-custody.md, reads it back, then exposes actual records to fresh independent control and the next consumer.\n" +
    "Models do not write files or send notifications directly. Keep original inputs, pending records and observed effects on interruption. A missing or failed writer/readback blocks the dependent step; reconcile unknown effects before replay.\n" +
    "The subsequent bounded continuation.mjs reads the retained consumer-output.json and writes continued.json once. Its observed receipt is retained by the supervisor as continuation.json in the private cycle record for owner inspection. This proves dependent use only; delivery and acceptance of a separate new product increment are not claimed.\n" +
    "This is the authorized local transport contract, not evidence of execution, worker acknowledgment, delivery, retention or product acceptance.\n";
}
const initialPaths = { package: "native-package.json", recipe: "recipe.json", prepared: "native-prepared",
  evidence: "native-worker-readback.txt" };
const ackFiles = ["readback.json", "preflight.json", "resume.json", "accept.json", "hook-state.json", "hooks.template.json"];
const preparedFiles = ["plan.json", "approval.json", "navigation.json", "alignment.json", "source-set.json",
  "integration-review.json", "integration-plan.json", "classifications.json", "dependencies.json", "module.json",
  "memory-review.json", "identity.json", "task.json", "integration.json", "capsule.json", "source-receipt.json",
  "awaiting-worker.json", "worker-delivery.json"];
const nextCommand = () => ({ executable: process.execPath, args: ["continuation.mjs"], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
export function subsequentPreparationPaths(namespace) {
  need(typeof namespace === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(namespace), "NATIVE_NEXT_NAMESPACE_INVALID");
  const directory = `native-next-${namespace}`;
  return { directory, package: `${directory}/package.json`, recipe: `${directory}/recipe.json`,
    prepared: `${directory}/prepared`, evidence: `${directory}/worker-readback.txt` };
}
async function workspaceSnapshot(workspace) {
  const files = {}, directories = [];
  let count = 0, size = 0;
  async function visit(relative) {
    for (const name of (await readdir(path.join(workspace, relative))).sort()) {
      need(!name.includes("\\"), "NATIVE_NEXT_WORKSPACE_UNSAFE");
      const entry = relative ? `${relative}/${name}` : name, absolute = path.join(workspace, entry);
      const stat = await lstat(absolute);
      need(++count <= 1024 && !stat.isSymbolicLink() && await realpath(absolute) === absolute, "NATIVE_NEXT_WORKSPACE_UNSAFE");
      if (stat.isDirectory()) { directories.push(entry); await visit(entry); }
      else {
        const data = await bytes(absolute); size += data.length;
        need(size <= 16 * 1024 * 1024, "NATIVE_NEXT_WORKSPACE_TOO_LARGE");
        files[entry] = sha256(data);
      }
    }
  }
  await visit("");
  return { files, directories };
}
async function nextUnchanged(workspace, stage, exact = false) {
  const snapshot = await workspaceSnapshot(workspace), paths = subsequentPreparationPaths(stage.namespace), prefix = paths.directory;
  const own = name => name === prefix || name.startsWith(prefix + "/");
  need(hash({ files: Object.fromEntries(Object.entries(snapshot.files).filter(([name]) => !own(name))),
    directories: snapshot.directories.filter(name => !own(name)) }) === hash(stage.workspaceBefore), "NATIVE_NEXT_WORKSPACE_CHANGED");
  if (exact) need(!Object.keys(snapshot.files).some(own) &&
    snapshot.directories.filter(own).every(name => name === prefix), "NATIVE_NEXT_NAMESPACE_NOT_EMPTY");
  // A namespace is not a write grant. Only this selected v3 protocol's finite
  // outputs are allowed, including one derived review per authored classification.
  const allowed = new Set([paths.package, paths.recipe, paths.evidence,
    ...[...preparedFiles, ...ackFiles].map(name => `${paths.prepared}/${name}`)]);
  if (Object.hasOwn(snapshot.files, paths.package)) {
    const pkg = JSON.parse(await bytes(path.join(workspace, paths.package)));
    need(Array.isArray(pkg.classifications) && pkg.classifications.length <= 1024, "NATIVE_NEXT_WORKSPACE_CHANGED");
    for (let index = 0; index < pkg.classifications.length; index++) allowed.add(`${paths.prepared}/source-review-${index}.json`);
  }
  need(Object.keys(snapshot.files).filter(own).every(name => allowed.has(name)) &&
    snapshot.directories.filter(own).every(name => [prefix, paths.prepared, `${paths.prepared}/hook-metadata`].includes(name)),
    "NATIVE_NEXT_WORKSPACE_CHANGED");
}

async function nextAckNamespace(workspace, paths, expected, acknowledged = false) {
  const snapshot = await workspaceSnapshot(workspace), own = name => name.startsWith(paths.directory + "/");
  const files = value => Object.fromEntries(Object.entries(value).filter(([name]) => own(name)));
  const directories = [paths.directory, paths.prepared, ...(acknowledged ? [`${paths.prepared}/hook-metadata`] : [])].sort();
  need(hash(files(snapshot.files)) === hash(files(expected)) &&
    hash(snapshot.directories.filter(name => name === paths.directory || own(name)).sort()) === hash(directories),
    "NATIVE_NEXT_WORKSPACE_CHANGED");
}
async function bytes(file) {
  const stat = await lstat(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 2 * 1024 * 1024 &&
    await realpath(file) === file, "NATIVE_PREPARATION_FILE_UNSAFE");
  const value = await readFile(file);
  need(value.length <= 2 * 1024 * 1024, "NATIVE_PREPARATION_FILE_UNSAFE");
  return value;
}
const save = (file, value) => writeFile(file, typeof value === "string" ? value : encode(value), { flag: "wx", mode: 0o600 });

async function compilerModule(ref) {
  need(ref && Object.keys(ref).sort().join() === "path,sha256" && path.isAbsolute(ref.path) &&
    /^[a-f0-9]{64}$/.test(ref.sha256 ?? "") && sha256(await bytes(ref.path)) === ref.sha256,
    "NATIVE_PREPARATION_COMPILER_CHANGED");
  const module = await import(pathToFileURL(ref.path).href + `?sha256=${ref.sha256}`);
  need(typeof module.compile === "function" && module.format && typeof module.format === "object",
    "NATIVE_PREPARATION_COMPILER_INVALID");
  return module;
}

async function compilerCarrier(ref) {
  const module = await compilerModule(ref), text = encode(module.format);
  return { id: "preparation-compact-format", text, purpose: "Optional frozen mechanical input syntax, no task answers",
    origin: { kind: "parent-protocol-result", operation: "preparation-interface", sha256: sha256(text) } };
}

// This is a serialization projection, never a decision or authority repair.
export function compilePreparationTransport(input, module, descriptor, files) {
  const compact = structuredClone(input);
  let projection = null;
  if (compact?.task && Object.hasOwn(compact.task, "action")) {
    need(compact.schema === "comparison.compact-preparation.v1" &&
      module.format?.schema === "comparison.compact-format.v1" &&
      module.format.shape?.schema === compact.schema && module.format.shape.task &&
      typeof module.format.shape.task === "object" && !Array.isArray(module.format.shape.task) &&
      !Object.hasOwn(module.format.shape.task, "action"), "NATIVE_COMPACT_ACTION_FORMAT_INVALID");
    need(descriptor.action && hash(compact.task.action) === hash(descriptor.action), "NATIVE_COMPACT_ACTION_MISMATCH");
    const originalPreparationSha256 = hash(compact);
    delete compact.task.action;
    projection = { schema: "comparison.compact-transport-projection.v1",
      removedPaths: ["preparation.task.action"], originalPreparationSha256,
      projectedPreparationSha256: hash(compact), descriptorSha256: hash(descriptor),
      formatSha256: hash(module.format), actionSha256: hash(descriptor.action), semanticEvidence: false };
  }
  const proposed = module.compile(compact, { interface: structuredClone(descriptor), files: structuredClone(files) });
  if (projection) {
    need(proposed?.package?.task?.action && hash(proposed.package.task.action) === projection.actionSha256,
      "NATIVE_COMPACT_COMPILED_ACTION_MISMATCH");
    projection.compiledSha256 = sha256(encode(proposed));
  }
  return { proposed, projection };
}

async function priorCarrier(ref, files, arm) {
  need(ref && ["filesSha256,path,sha256", "files,filesSha256,path,sha256"].includes(Object.keys(ref).sort().join()) &&
    path.isAbsolute(ref.path), "NATIVE_PRIOR_INPUTS_CHANGED");
  const previous = ref.files ?? files;
  need(previous && typeof previous === "object" && !Array.isArray(previous) &&
    ref.filesSha256 === hash(previous) && Object.keys(previous).length > 0 &&
    Object.entries(previous).every(([name, sha]) => Object.hasOwn(files, name) && files[name] === sha) &&
    Object.keys(files).filter(name => !Object.hasOwn(previous, name)).every(name => name === "custody-contract.md"),
    "NATIVE_PRIOR_INPUTS_CHANGED");
  const data = await bytes(ref.path);
  need(sha256(data) === ref.sha256, "NATIVE_PRIOR_PROPOSAL_CHANGED");
  JSON.parse(data);
  return { id: "preparation-prior-proposal", text: data.toString("utf8"),
    purpose: "Unapplied prior proposal, not approval. Fresh owner must inspect and explicitly adopt or replace it.",
    origin: { kind: "parent-protocol-result", arm, operation: "prior-proposal", sha256: ref.sha256 } };
}

export function appendPreparationChoices(prior, authored) {
  const fields = ["contractFiles", "moduleContracts", "dependencies", "references", "constraints"];
  need(authored && Object.keys(authored).sort().join() === fields.sort().join() &&
    fields.every(key => Array.isArray(authored[key]) && authored[key].length <= 256), "NATIVE_PRIOR_DELTA_INVALID");
  const input = structuredClone(prior), delta = structuredClone(authored);
  need(input.module && Array.isArray(input.module.contractFiles) && Array.isArray(input.modules) &&
    Array.isArray(input.dependencies) && Array.isArray(input.navigation?.references) && Array.isArray(input.navigation?.constraints),
    "NATIVE_PRIOR_DELTA_INVALID");
  input.module.contractFiles.push(...delta.contractFiles);
  for (const selection of delta.moduleContracts) {
    need(selection && Object.keys(selection).sort().join() === "contractFiles,moduleId" &&
      Array.isArray(selection.contractFiles), "NATIVE_PRIOR_DELTA_INVALID");
    const matches = input.modules.filter(module => module.id === selection.moduleId);
    need(matches.length === 1 && Array.isArray(matches[0].contractFiles), "NATIVE_PRIOR_DELTA_INVALID");
    matches[0].contractFiles.push(...selection.contractFiles);
  }
  input.dependencies.push(...delta.dependencies);
  input.navigation.references.push(...delta.references);
  input.navigation.constraints.push(...delta.constraints);
  return input;
}
async function roots(options) {
  need(["baseline", "candidate"].includes(options.arm), "NATIVE_PREPARATION_ARM_INVALID");
  const freeze = await verifyNativeComparison(options.directory, options.expectedDigest);
  const workspace = path.join(freeze.comparisonOutput, "workspaces", options.arm);
  need(await realpath(workspace) === workspace && (await lstat(workspace)).isDirectory(), "NATIVE_PREPARATION_WORKSPACE_UNSAFE");
  return { freeze, workspace, root: path.join(options.directory, options.arm, "preparation-application") };
}
async function unchanged(workspace, files, exact = false) {
  if (exact) need((await readdir(workspace)).sort().join() === Object.keys(files).sort().join(), "NATIVE_PREPARATION_WORKSPACE_NOT_PRISTINE");
  for (const [name, expected] of Object.entries(files))
    need(sha256(await bytes(path.join(workspace, name))) === expected, "NATIVE_PREPARATION_INPUT_CHANGED");
}
async function publicInputs(options, freeze) {
  const scenario = await verifyComparisonScenario({ output: freeze.comparisonOutput, scenarioDigest: freeze.scenarioDigest });
  const replacements = {}, files = { ...scenario.files };
  for (const id of docs) {
    replacements[`${id}.md`] = await bytes(path.join(options.directory, options.arm, "public/evidence", `${id}.md`));
    files[`${id}.md`] = sha256(replacements[`${id}.md`]);
  }
  replacements["custody-contract.md"] = Buffer.from(nativeCustodyContract());
  files["custody-contract.md"] = sha256(replacements["custody-contract.md"]);
  // Required protocol authorKind; frozen scenario facts, never a new human grant.
  const events = { schema: "context.events.v1", complete: true,
    events: docs.map(id => ({ id, authorKind: "human", body: replacements[`${id}.md`].toString("utf8") })) };
  files["public-events.json"] = sha256(encode(events));
  return { scenario, replacements, events, files };
}
function shapeOnly(value, key = "") {
  if (["supersededBy", "ownerGate", "trigger"].includes(key)) return "<string|null>";
  if (value === null) return "<string|null>";
  if (Array.isArray(value)) {
    const shapes = value.map(item => shapeOnly(item));
    return [...new Map(shapes.map(item => [encode(item), item])).values()];
  }
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shapeOnly(v, k)]));
  if (typeof value === "string") return key === "schema" ? value : "<string>";
  return typeof value === "boolean" ? "<boolean>" : "<number>";
}

export function verificationSourceContract(oracle) {
  need(oracle?.schema === "context.oracle.v1" && Array.isArray(oracle.examples) &&
    oracle.examples.every(example => typeof example.id === "string" && Array.isArray(example.sourceAssertionRefs) &&
      example.sourceAssertionRefs.every(ref => typeof ref === "string" && ref.length > 0)),
    "NATIVE_VERIFICATION_SOURCE_CONTRACT_INVALID");
  return oracle.examples.map(example => ({ exampleId: example.id, sourceAssertionRefs: [...example.sourceAssertionRefs] }));
}

export function requireVerificationSources(pkg, contract) {
  const required = new Set([...(pkg.module?.retainedExampleIds ?? []), ...(pkg.module?.newExampleIds ?? [])]);
  const known = new Set((pkg.classifications ?? []).flatMap(row => (row.assertions ?? []).map(assertion => assertion.id)));
  need([...required].every(id => contract.some(row => row.exampleId === id)), "NATIVE_VERIFICATION_EXAMPLE_MISSING");
  const missing = [...new Set(contract.filter(row => required.has(row.exampleId))
    .flatMap(row => row.sourceAssertionRefs).filter(id => !known.has(id)))];
  need(missing.length === 0, `NATIVE_VERIFICATION_SOURCE_MISSING:${missing.join(",")}`);
}

async function preparationCarriers(options, freeze, { files, events }) {
  const oracleBytes = await bytes(path.join(freeze.comparisonOutput, "workspaces", options.arm, "oracle.json"));
  need(sha256(oracleBytes) === files["oracle.json"], "NATIVE_PREPARATION_INPUT_CHANGED");
  const verificationSources = verificationSourceContract(JSON.parse(oracleBytes));
  const schemaPath = path.join(freeze.comparisonOutput, options.arm, "examples/context-preparation/package-modular.json");
  const shape = shapeOnly(JSON.parse(await bytes(schemaPath)));
  // Preserve the selected arm's historical example, but publish the requested
  // v3 syntax, including branches its example does not exercise. Not a validator.
  shape.schema = "context.package.v3";
  shape.dependencies = [{ id: "<string>", path: "<string>", scope: ["<string>"] }];
  shape.sharedArtifacts = ["<sharedArtifact>"];
  for (const module of shape.moduleAccess.modules) module.release = "<null|moduleRelease>";
  shape.navigation.assignment.previous = "<null|previousAssignment>";
  shape.navigation.gaps = [{ text: "<string>", critical: "<boolean>" }];
  shape.alignment = { goalRef: "<string>", invariantRefs: ["<string>"], acceptanceRef: "<string>",
    decisions: [{ moduleId: "<string>", boundaryChange: "<boolean>", gapRef: "<string|null>",
      existingRef: "<string>", rationale: "<string>" }], review: "<null|artifactRef>" };
  const artifactRef = { path: "<string>", sha256: "<64 lowercase hex characters>" };
  const format = { schema: "comparison.preparation-format.v1", inputSchema: "context.package.v3", package: shape,
    notation: "Syntax only, not valid task input or decisions. Angle brackets denote types. Array entries describe item shapes, not required counts. All shown object keys are required; optional/alternative forms are listed below. Selected-arm primitives remain authoritative.",
    types: { artifactRef, moduleRelease: { artifact: artifactRef, connection: artifactRef },
      previousAssignment: { plan: artifactRef, approval: artifactRef },
      sharedArtifact: ["<string>", { path: "<string>" }, { path: "<string>", startMarker: "<string>", endMarker: "<string>" }],
      alignmentReview: { schema: "context.alignment-review.v1", basisSha256: "<64 lowercase hex characters>",
        reviewer: "<string>", decision: "<string>", reason: "<string>" } },
    optionalPairs: { "task.action / module.verificationCommand": { timeoutMs: "<integer 1..60000>", maxOutputBytes: "<integer 1..2097152>" },
      "navigation.references[]": { startLine: "<integer >=1>", endLine: "<integer >=startLine>" } },
    enums: { "classifications[].eventDisposition": ["assertions", "no_change", "evidence_only"],
      "classifications[].assertions[].disposition": ["current_constraint", "accepted_capability", "deferred", "superseded", "unresolved", "evidence_only"],
      "moduleAccess.modules[].intent": ["consume", "change", "create"],
      "navigation.references[].appliesTo / navigation.constraints[].appliesTo": ["task", "preparation"],
      "navigation.assignment.phase": ["initial", "supplement"], "types.alignmentReview.decision": ["fit"] },
    constraints: [
      "IDs for owner, task id/worker, sources id, events and assertions match ^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$. Scopes are nonempty arrays of IDs or '*'. Text values are nonempty. Workspace paths are relative, without traversal or symlink escape; cwd may be '.'.",
      "Package lists are bounded to 256. Sources, sharedArtifacts, task.candidateFiles, module.contractFiles, moduleAccess.modules and navigation.references are nonempty. Module contract/private path lists have unique entries; privatePaths may be empty only for consume. Command args are strings. Optional pairs are either both present or both absent.",
      "retainedExampleIds is a nonempty array of unique IDs; newExampleIds may be empty but IDs remain unique. Verification binds both sets. Hash references bind actual file bytes, not path names. Shape entries do not select a release, disposition, scope, recipe, reference ID or approval.",
      "Classify every in-scope source event exactly once using its actual sourceId/eventId. eventDisposition assertions requires nonempty assertions; no_change/evidence_only requires []. Assertion quote must occur exactly once in that event body; IDs are unique and assertion scope stays within source scope. superseded requires supersededBy; deferred requires ownerGate and trigger. Those three fields otherwise permit string or null. Unresolved applicable meaning blocks preparation.",
      "Consume release is moduleRelease; change/create release is null. publicBoundary names an owned change/create module. Candidate/implementation paths stay owned; consumed implementation is not navigable. Every consumed artifact/connection hash binds actual bytes and has an in-scope dependency. module.contractFiles covers all declared contracts.",
      "navigation.taskId/worker equal task.id/worker; preparedBy differs from worker. assignment.owner equals owner. initial previous is null; supplement previous pins a real same-task owner-approved plan/approval with unchanged access/alignment. A different task is initial, not supplement.",
      "References have unique IDs and actual exact quotes, unique in normalized source text unless explicit line range is supplied. Every required contract has a task reference. Constraints reference existing IDs, nonempty referenceIds, and task constraints use task references. Gaps critical is an authored boolean; true blocks preparation.",
      "alignment goalRef, nonempty unique invariantRefs, acceptanceRef, existingRef and applicable gapRef name task navigation references to immutable sources. decisions has exactly one entry per moduleId. Consume requires boundaryChange false and gapRef null; change/create requires gapRef; create requires boundaryChange true. These are conditional constraints, not selected decisions.",
      "Any boundaryChange true requires alignment.review artifactRef to a real independent review of the computed alignment basis; otherwise review may be null. Review hash/basis must match actual bytes; reviewer differs from owner, worker and preparedBy; decision fit is the accepted vocabulary, not supplied approval. No review, acknowledgment or approval is fabricated by this format."
    ] };
  const command = script => ({ executable: process.execPath, args: [script], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
  const descriptor = { schema: "comparison.preparation-interface.v1", owner: "owner", worker: "worker",
    inputSchema: "context.package.v3", formatNote: "preparation-format describes v3 syntax, types, alternatives and enum vocabularies, including alignment. Author all task meaning from acquired sources; it supplies no decisions or valid task input.",
    sources: [{ path: "sources.json", scope: ["bundle"] }, { path: "public-events.json", scope: ["bundle"] }],
    publicRelease: { path: "candidate.mjs", sha256: files["candidate.mjs"] },
    connectionEvidence: { path: "success.md", sha256: files["success.md"] },
    custodyContract: { path: "custody-contract.md", sha256: files["custody-contract.md"], sourceId: "preparation-custody-contract" },
    consumerSurface: { path: "action.mjs", exists: true,
      responsibility: "Existing fixed JSON consumer launcher; the task supplies its public recipe configuration, not new launcher code or a new module API.",
      producerAccess: "The separate candidate.mjs is a closed release, not consumer-owned implementation." },
    custody: { recipient: "owner", notificationOwner: "owner", externalNotification: "NOT_AUTHORIZED_OR_REQUIRED_IN_THIS_LOCAL_SCENARIO",
      actionWriter: "The registered action.mjs writes consumer-output.json once through the admitted supervisor action.",
      output: "consumer-output.json", producerReturn: "producer-return.md", technicalProof: "technical-proof.json",
      returnWriter: "After the registered verify.mjs succeeds, the trusted experiment applicator writes the exact unmodified actual adapter Return Sync to producer-return.md and the verification receipt to technical-proof.json, then publishes both to the owner through read_source. It never manufactures the Return or treats a planned write as delivery.",
      retention: { memory: "retained-memory.md", map: "retained-map.md", tracker: "retained-tracker.md", custody: "retained-custody.md" },
      integration: "The fresh owner must acquire actual Return, proof and output and author acceptance plus retention text. The trusted applicator writes exactly that text once, reads it back, then exposes actual records to fresh independent control and a new consumer. No model writes files or sends notifications directly.",
      interruption: "Keep original inputs, pending records and observed effects; a missing or failed writer/readback blocks the dependent step. Do not claim delivery, retry an unknown effect, or replace original evidence.",
      currentState: "AUTHORIZED_LOCAL_TRANSPORT_CONTRACT_ONLY_NO_EXECUTION_OR_RETENTION_YET" },
    action: command("action.mjs"), verification: command("verify.mjs"),
    permittedCandidateFiles: ["action.mjs"], oracle: "oracle.json", requiredExampleIds: ["B1", "B2", "N1"],
    verificationSources,
    verificationSourceRule: "The fixed verification examples reference these exact assertion IDs. Preserve those IDs on the appropriate source-backed authored assertions; names are not semantic proof. Missing links block preparation before consumer execution. No verification inputs or expected outputs are supplied here.",
    existingSharedArtifacts: ["map.md"],
    response: { preparation: { package: "Complete authored v3 package", recipe: "Authored public consumer options",
      decision: "Explicit owner decision; no default approval" } } };
  return [["preparation-events", encode(events)], ["preparation-interface", encode(descriptor)],
    ["preparation-custody-contract", nativeCustodyContract()],
    ["preparation-format", encode(format)]].map(([id, text]) => ({ id, text, purpose: `Neutral protocol input: ${id}`,
      origin: { kind: "parent-protocol-result", arm: options.arm, operation: "preparation-interface", sha256: sha256(text) } }));
}

async function readStage(options, stageSha256) {
  const { freeze, workspace, root } = await roots(options), raw = await bytes(path.join(root, "stage.json"));
  need(sha256(raw) === stageSha256, "NATIVE_PREPARATION_STAGE_MISMATCH");
  const stage = JSON.parse(raw), original = await publicInputs(options, freeze);
  need(stage.schema === "comparison.native-preparation.v1" && stage.nativeDigest === options.expectedDigest &&
    stage.arm === options.arm && stage.workspace === workspace && stage.scenarioDigest === freeze.scenarioDigest &&
    hash(stage.files) === hash(original.files) && stage.helperSha256 === sha256(await bytes(here)), "NATIVE_PREPARATION_STAGE_MISMATCH");
  const carriers = await preparationCarriers(options, freeze, original), descriptor = carriers.find(row => row.id === "preparation-interface");
  if (stage.compiler) {
    const carrier = await compilerCarrier(stage.compiler);
    carriers.push({ ...carrier, origin: { ...carrier.origin, arm: options.arm } });
  }
  if (stage.priorPreparation) carriers.push(await priorCarrier(stage.priorPreparation, stage.files, options.arm));
  const expectedInterface = { id: descriptor.id, sha256: sha256(descriptor.text) };
  need(hash(stage.interface) === hash(expectedInterface), "NATIVE_PREPARATION_INTERFACE_INVALID");
  const published = await readTurnSources({ ...options, sourceRevision: stage.sourceRevision });
  need(carriers.every(carrier => published.sourceSnapshot.rows.some(row => row.id === carrier.id &&
    row.status === "AVAILABLE" && row.sha256 === sha256(carrier.text))), "NATIVE_PREPARATION_CARRIERS_INVALID");
  return { freeze, workspace, root, stage, expectedInterface, published, descriptor: JSON.parse(descriptor.text) };
}

// Replace only fixture framing with the exact neutral bytes already exposed to
// both roles. An interrupted stage is retained and cannot be replayed.
export async function stageNativePreparationWorkspace(options) {
  const { freeze, workspace, root } = await roots(options);
  const original = await publicInputs(options, freeze), { scenario, replacements, events, files } = original;
  await unchanged(workspace, scenario.files, true);
  await mkdir(root, { mode: 0o700 });
  const helperSha256 = sha256(await bytes(here));
  await save(path.join(root, "pending.json"), { nativeDigest: options.expectedDigest, arm: options.arm, helperSha256 });
  for (const [name, value] of Object.entries(replacements)) await writeFile(path.join(workspace, name), value);
  await save(path.join(workspace, "public-events.json"), events);
  await unchanged(workspace, files, true);
  await verifyNativeComparison(options.directory, options.expectedDigest);
  const current = await readTurnSources(options), artifacts = await preparationCarriers(options, freeze, original);
  if (options.compiler) {
    const carrier = await compilerCarrier(options.compiler);
    artifacts.push({ ...carrier, origin: { ...carrier.origin, arm: options.arm } });
  }
  if (options.priorPreparation) {
    need(options.compiler, "NATIVE_PRIOR_COMPILER_REQUIRED");
    artifacts.push(await priorCarrier(options.priorPreparation, files, options.arm));
  }
  const published = await publishTurnSources({ ...options, expectedSourceRevision: current.sourceRevision, artifacts });
  const stage = { schema: "comparison.native-preparation.v1", nativeDigest: options.expectedDigest,
    arm: options.arm, workspace, helperSha256, files, scenarioDigest: freeze.scenarioDigest,
    interface: { id: "preparation-interface", sha256: sha256(artifacts.find(row => row.id === "preparation-interface").text) },
    sourceRevision: published.sourceRevision,
    ...(options.compiler ? { compiler: structuredClone(options.compiler) } : {}),
    ...(options.priorPreparation ? { priorPreparation: structuredClone(options.priorPreparation) } : {}),
    semanticEvidence: false, wholeChainComparatorReady: false };
  await save(path.join(root, "stage.json"), stage);
  return { stageSha256: sha256(encode(stage)), workspace, sourceRevision: published.sourceRevision, semanticEvidence: false };
}

async function nextInputs(workspace, stage) {
  need(typeof stage.taskId === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(stage.taskId) &&
    stage.predecessor && Object.keys(stage.predecessor).sort().join() === "output,recipe,task", "NATIVE_NEXT_SCOPE_INVALID");
  const goal = await pinned(workspace, stage.goalRef);
  const task = JSON.parse(await pinned(workspace, stage.predecessor.task));
  await pinned(workspace, stage.predecessor.recipe); await pinned(workspace, stage.predecessor.output);
  need(task.schema === "context.task.v1" && task.workspace === workspace && task.id !== stage.taskId,
    "NATIVE_NEXT_TASK_NOT_NEW");
  need(stage.predecessor.recipe.path === "recipe.json" && stage.predecessor.output.path === "consumer-output.json",
    "NATIVE_NEXT_PREDECESSOR_PATH_INVALID");
  const refs = [stage.goalRef, ...Object.values(stage.predecessor)];
  need(new Set(refs.map(ref => ref.path)).size === refs.length && refs.every(ref =>
    stage.workspaceBefore.files[ref.path] === ref.sha256), "NATIVE_NEXT_SCOPE_INVALID");
  return goal.toString("utf8");
}
async function nextCarriers(options, freeze, stage, goal) {
  const prefix = `next-${stage.namespace}`;
  const descriptor = { schema: "comparison.subsequent-preparation-interface.v1", arm: options.arm,
    nativeDigest: options.expectedDigest, namespace: stage.namespace, taskId: stage.taskId,
    goalRef: stage.goalRef, predecessor: stage.predecessor, workspaceBefore: stage.workspaceBefore,
    paths: subsequentPreparationPaths(stage.namespace), inputSchema: "context.package.v3", owner: "owner", worker: "worker",
    assignment: { phase: "initial", previous: null },
    action: nextCommand(), actionRef: { path: "continuation.mjs", sha256: stage.workspaceBefore.files["continuation.mjs"] },
    consumerSurface: { path: "continuation.mjs", exists: true,
      responsibility: "Existing fixed continuation consumer; reads the retained predecessor result without editing the closed producer." },
    operation: "resume", recipeUse: "RETAINED_PROPOSAL_ONLY_CONTINUATION_READS_PREDECESSOR_OUTPUT",
    evidence: "PINNED_PARENT_INPUTS_NOT_ACCEPTANCE_OR_SEMANTIC_PROOF" };
  if (stage.compiler) {
    const originals = await preparationCarriers(options, freeze, await publicInputs(options, freeze));
    const initial = JSON.parse(originals.find(row => row.id === "preparation-interface").text);
    descriptor.compilerContext = { interface: { ...initial, action: descriptor.action,
      permittedCandidateFiles: [descriptor.actionRef.path], consumerSurface: descriptor.consumerSurface },
      files: stage.workspaceBefore.files };
    descriptor.compactInstructions = "For the compact response, preparation-compact-format defines exact authored keys. " +
      "Its preparation-interface means compilerContext.interface here; compilerContext is the exact mechanical compiler input, not a prior-task approval. " +
      "Return the compact shape, not a full v3 package. task.action is derived from this fixed interface, not an authored choice. " +
      "An explicitly repeated task.action is accepted only when exactly equal to interface.action; every other field and decision must still be authored and validated. " +
      "Use this next taskId, goal, predecessor, initial assignment and continuation surface; initial transport metadata does not assert new execution or retention.";
  }
  if (stage.priorPreparation) descriptor.priorPreparation = {
    id: "preparation-prior-proposal", sha256: stage.priorPreparation.sha256,
    response: { preparation: { reuse: { id: "preparation-prior-proposal", sha256: stage.priorPreparation.sha256 },
      decision: "Explicit fresh owner decision; only approved adopts the unchanged proposal" } },
    evidence: "Historical authorship only. Read the proposal and this current interface; no previous grant is revived. No additions or semantic substitutions." };
  const carriers = [[`${prefix}-interface`, encode(descriptor)], [`${prefix}-goal`, goal]].map(([id, text]) => ({
    id, text, purpose: `Subsequent task protocol input: ${id}`,
    origin: { kind: "parent-protocol-result", arm: options.arm, operation: "subsequent-preparation", sha256: sha256(text) } }));
  if (stage.priorPreparation) {
    need(stage.compiler, "NATIVE_PRIOR_COMPILER_REQUIRED");
    need(stage.priorPreparation.filesSha256 === hash(stage.workspaceBefore.files), "NATIVE_PRIOR_INPUTS_CHANGED");
    carriers.push(await priorCarrier(stage.priorPreparation, stage.workspaceBefore.files, options.arm));
  }
  return carriers;
}

// The parent supplies current public references, not an approval inferred here.
// No original source, recipe, output or prior prepared packet is rewritten.
export async function stageNativeSubsequentPreparation({ directory, expectedDigest, arm, namespace, taskId, goalRef, predecessor,
  compiler = null, priorPreparation = null }) {
  const options = { directory, expectedDigest, arm }, paths = subsequentPreparationPaths(namespace);
  const { freeze, workspace, root: originalRoot } = await roots(options);
  if (compiler) {
    await compilerModule(compiler);
    await mkdir(originalRoot, { recursive: true, mode: 0o700 });
  }
  need(await realpath(originalRoot) === originalRoot && (await lstat(originalRoot)).isDirectory(), "NATIVE_NEXT_ROOT_UNSAFE");
  const root = path.join(originalRoot, `next-${namespace}`);
  const initialStage = compiler ? { compiler } : JSON.parse(await bytes(path.join(originalRoot, "stage.json")));
  if (initialStage.compiler) await compilerModule(initialStage.compiler);
  await absent(root); await absent(path.join(workspace, paths.directory));
  await unchanged(workspace, (await publicInputs(options, freeze)).files);
  const stage = { schema: "comparison.native-subsequent-preparation.v1", nativeDigest: expectedDigest,
    arm, workspace, namespace, taskId, goalRef: structuredClone(goalRef), predecessor: structuredClone(predecessor),
    helperSha256: sha256(await bytes(here)), workspaceBefore: await workspaceSnapshot(workspace),
    ...(initialStage.compiler ? { compiler: structuredClone(initialStage.compiler) } : {}),
    ...(priorPreparation ? { priorPreparation: structuredClone(priorPreparation) } : {}),
    semanticEvidence: false, wholeChainComparatorReady: false };
  const goal = await nextInputs(workspace, stage), carriers = await nextCarriers(options, freeze, stage, goal);
  const current = await readTurnSources(options);
  if (stage.compiler) {
    const carrier = await compilerCarrier(stage.compiler);
    const existing = current.sourceSnapshot.rows.find(row => row.id === carrier.id);
    if (existing) need(existing.status === "AVAILABLE" && existing.sha256 === sha256(carrier.text),
      "NATIVE_PREPARATION_COMPACT_FORMAT_NOT_ACQUIRED");
    else carriers.push({ ...carrier, origin: { ...carrier.origin, arm } });
  }
  need(carriers.every(row => Buffer.byteLength(row.text) <= 128 * 1024), "NATIVE_NEXT_SCOPE_TOO_LARGE");
  await nextUnchanged(workspace, stage, true);
  await mkdir(root, { mode: 0o700 });
  await save(path.join(root, "pending.json"), stage);
  await mkdir(path.join(workspace, paths.directory), { mode: 0o700 });
  const published = await publishTurnSources({ ...options, expectedSourceRevision: current.sourceRevision, artifacts: carriers });
  stage.sourceRevision = published.sourceRevision;
  await nextUnchanged(workspace, stage, true);
  await save(path.join(root, "stage.json"), stage);
  return { stageSha256: sha256(encode(stage)), workspace, paths, sourceRevision: stage.sourceRevision,
    task: { id: carriers[1].id, sha256: sha256(carriers[1].text) }, interfaceId: carriers[0].id,
    semanticEvidence: false, wholeChainComparatorReady: false };
}
async function readNextStage(options, stageSha256, namespace) {
  const paths = subsequentPreparationPaths(namespace), { freeze, workspace, root: originalRoot } = await roots(options);
  const root = path.join(originalRoot, `next-${namespace}`), raw = await bytes(path.join(root, "stage.json"));
  need(sha256(raw) === stageSha256, "NATIVE_PREPARATION_STAGE_MISMATCH");
  const stage = JSON.parse(raw);
  need(stage.schema === "comparison.native-subsequent-preparation.v1" && stage.nativeDigest === options.expectedDigest &&
    stage.arm === options.arm && stage.workspace === workspace && stage.namespace === namespace &&
    stage.helperSha256 === sha256(await bytes(here)), "NATIVE_PREPARATION_STAGE_MISMATCH");
  await unchanged(workspace, (await publicInputs(options, freeze)).files);
  const carriers = await nextCarriers(options, freeze, stage, await nextInputs(workspace, stage));
  const nextDescriptor = JSON.parse(carriers[0].text);
  let descriptor;
  if (stage.compiler) {
    await compilerModule(stage.compiler);
    descriptor = nextDescriptor.compilerContext.interface;
  }
  const published = await readTurnSources({ ...options, sourceRevision: stage.sourceRevision });
  need(carriers.every(carrier => published.sourceSnapshot.rows.some(row => row.id === carrier.id &&
    row.status === "AVAILABLE" && row.sha256 === sha256(carrier.text))), "NATIVE_PREPARATION_CARRIERS_INVALID");
  await nextUnchanged(workspace, stage);
  return { freeze, workspace, root, stage, paths, published, descriptor,
    expectedInterface: { id: carriers[0].id, sha256: sha256(carriers[0].text) } };
}
export async function applyNativePreparation(options) { return applyPreparation(options, false); }
export async function applyNativeSubsequentPreparation(options) { return applyPreparation(options, true); }

async function applyPreparation({ directory, expectedDigest, arm, number, stageSha256, namespace }, subsequent) {
  const options = { directory, expectedDigest, arm };
  const { freeze, workspace, root, stage, expectedInterface, published, descriptor } = await (subsequent
    ? readNextStage(options, stageSha256, namespace) : readStage(options, stageSha256));
  const paths = subsequent ? subsequentPreparationPaths(namespace) : initialPaths;
  const protect = exact => subsequent ? nextUnchanged(workspace, stage, exact) : unchanged(workspace, stage.files, exact);
  const record = await readCompletedRoleOutput({ ...options, number });
  need(record.role === "owner", "NATIVE_PREPARATION_OWNER_REQUIRED");
  need(record.allocatedAtMs + record.timeoutMs + 300000 > Date.now(), "NATIVE_PREPARATION_EXPIRED");
  need(record.intent.context === null && record.intent.commands.length === 0,
    "NATIVE_PREPARATION_INTENT_INVALID");
  need(hash(record.sourceRevision) === hash(published.sourceRevision) &&
    hash(record.sourceSnapshot) === hash(published.sourceSnapshot) && record.acquiredSources.some(row =>
      row.id === expectedInterface.id && row.sha256 === expectedInterface.sha256), "NATIVE_PREPARATION_INTERFACE_NOT_ACQUIRED");
  const goal = record.sourceSnapshot.rows.find(row => subsequent ? row.id === `next-${namespace}-goal` : row.path === "evidence/goal.md");
  need(goal && goal.sha256 === (subsequent ? stage.goalRef.sha256 : stage.files["goal.md"]) && record.intent.task.id === goal.id &&
    record.intent.task.sha256 === goal.sha256 && record.acquiredSources.some(row =>
      row.id === goal.id && row.sha256 === goal.sha256), "NATIVE_PREPARATION_TASK_NOT_ACQUIRED");
  let proposed = record.modelOutput.preparation;
  let reusedProposal = null;
  if (stage.priorPreparation && proposed?.reuse) {
    if (subsequent) need(Object.keys(proposed).sort().join() === "decision,reuse", "NATIVE_PRIOR_DELTA_INVALID");
    need(["decision,reuse", "additions,decision,reuse"].includes(Object.keys(proposed).sort().join()) &&
      Object.keys(proposed.reuse).sort().join() === "id,sha256" &&
      proposed.reuse.id === "preparation-prior-proposal" && proposed.reuse.sha256 === stage.priorPreparation.sha256 &&
      record.acquiredSources.some(row => row.id === proposed.reuse.id && row.sha256 === proposed.reuse.sha256),
      "NATIVE_PRIOR_PROPOSAL_NOT_ACQUIRED");
    const prior = await priorCarrier(stage.priorPreparation, subsequent ? stage.workspaceBefore.files : stage.files, arm);
    const input = JSON.parse(prior.text);
    need(proposed.decision === "approved" && input.decision === proposed.decision, "NATIVE_PRIOR_DECISION_REQUIRED");
    reusedProposal = { id: prior.id, sha256: stage.priorPreparation.sha256, freshOwnerDecision: proposed.decision };
    proposed = Object.hasOwn(proposed, "additions") ? appendPreparationChoices(input, proposed.additions) : input;
  }
  let compilation = null;
  if (stage.compiler) {
    const module = await compilerModule(stage.compiler);
    need(record.acquiredSources.some(row => row.id === "preparation-compact-format" &&
      row.sha256 === sha256(encode(module.format))), "NATIVE_PREPARATION_COMPACT_FORMAT_NOT_ACQUIRED");
    const compiled = compilePreparationTransport(proposed, module, descriptor,
      subsequent ? stage.workspaceBefore.files : stage.files);
    proposed = compiled.proposed;
    compilation = { compiler: stage.compiler, originalModelOutputSha256: record.modelOutputSha256,
      compiledSha256: sha256(encode(proposed)), projection: compiled.projection, reusedProposal, semanticEvidence: false };
    await compilerModule(stage.compiler);
  }
  need(proposed && Object.keys(proposed).sort().join() === "decision,package,recipe" &&
    proposed.decision === "approved" && proposed.package?.schema === "context.package.v3" &&
    proposed.package.owner === "owner" && proposed.package.task?.worker === "worker" &&
    proposed.recipe && typeof proposed.recipe === "object" && !Array.isArray(proposed.recipe), "NATIVE_PREPARATION_NOT_AUTHORED");
  need(Buffer.byteLength(encode(proposed)) <= 512 * 1024, "NATIVE_PREPARATION_TOO_LARGE");
  if (subsequent) need(proposed.package.task.id === stage.taskId &&
    proposed.package.navigation?.assignment?.phase === "initial" && proposed.package.navigation.assignment.previous === null,
    "NATIVE_NEXT_ASSIGNMENT_INVALID");
  if (subsequent) need(hash(proposed.package.task.action) === hash(nextCommand()), "NATIVE_NEXT_COMMAND_MISMATCH");
  await protect(true);
  const oracleBytes = await bytes(path.join(workspace, "oracle.json"));
  need(sha256(oracleBytes) === (subsequent ? stage.workspaceBefore.files : stage.files)["oracle.json"],
    "NATIVE_PREPARATION_INPUT_CHANGED");
  requireVerificationSources(proposed.package, verificationSourceContract(JSON.parse(oracleBytes)));
  const attempt = path.join(root, "attempt");
  await mkdir(attempt, { mode: 0o700 });
  await save(path.join(attempt, "pending.json"), { number, allocationSha256: record.allocationSha256,
    modelOutputSha256: record.modelOutputSha256, stageSha256 });
  if (compilation) {
    await save(path.join(attempt, "original-model-output.json"), record.modelOutputText);
    await save(path.join(attempt, "compilation.json"), compilation);
    await save(path.join(attempt, "compiled-input.json"), proposed);
  }
  await save(path.join(workspace, paths.package), proposed.package);
  await save(path.join(workspace, paths.recipe), proposed.recipe);
  const steps = [];
  for (const [mode, args, expected] of [
    ["plan", ["--input", paths.package], "PLAN_READY"],
    ["confirm", ["--owner", "owner", "--decision", proposed.decision], "PREPARED"],
    ["read", ["--worker", "worker"], "DELIVERED"]
  ]) {
    const observed = await invokeComparisonAdapter({ output: freeze.comparisonOutput, expectedDigest: freeze.comparisonDigest,
      arm, operation: "prepare", args: [mode, "--output", paths.prepared, ...args] });
    await save(path.join(attempt, `${mode}.json`), observed);
    steps.push(observed);
    await protect(false);
    if (observed.result.status !== expected) {
      const result = { status: "PREPARATION_NOT_READY", phase: mode, result: observed.result,
        semanticEvidence: false, wholeChainComparatorReady: false };
      await save(path.join(attempt, "result.json"), result);
      return result;
    }
  }
  await verifyNativeComparison(directory, expectedDigest);
  need(sha256(await bytes(path.join(workspace, paths.package))) === sha256(encode(proposed.package)) &&
    sha256(await bytes(path.join(workspace, paths.recipe))) === sha256(encode(proposed.recipe)), "NATIVE_PREPARATION_PROPOSAL_CHANGED");
  const deliveryBytes = await bytes(path.join(workspace, paths.prepared, "awaiting-worker.json"));
  const request = JSON.parse(deliveryBytes);
  need(request.readback === null, "NATIVE_PREPARATION_INVENTED_READBACK");
  const result = { status: "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED", request,
    allocationSha256: record.allocationSha256, modelOutputSha256: record.modelOutputSha256,
    provenanceKind: record.provenanceKind, steps, semanticEvidence: false, wholeChainComparatorReady: false };
  await save(path.join(attempt, "result.json"), result);
  return result;
}

async function pinned(workspace, ref) {
  need(ref && typeof ref.path === "string" && !path.isAbsolute(ref.path) && !ref.path.includes("\\") &&
    !ref.path.split("/").some(part => !part || part === "." || part === "..") &&
    /^[a-f0-9]{64}$/.test(ref.sha256 ?? ""), "NATIVE_ACK_REFERENCE_INVALID");
  const value = await bytes(path.join(workspace, ref.path));
  need(sha256(value) === ref.sha256, "NATIVE_ACK_REFERENCE_CHANGED");
  return value;
}
async function absent(file) {
  try { await lstat(file); throw Error("NATIVE_ACK_ALREADY_ATTEMPTED"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
}
async function syncDirectory(directory) {
  const handle = await open(directory, "r");
  try { await handle.sync(); } finally { await handle.close(); }
}
async function durable(file, value) {
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(typeof value === "string" ? value : encode(value)); await handle.sync(); }
  finally { await handle.close(); }
  await syncDirectory(path.dirname(file));
}

// No dispatch, approval, action or verification execution. Callers publish actual
// task/capsule copies before dispatch; the native command pins its pre-ack request.
// Capsule acquisition does not claim full v3 navigation/alignment comprehension.
export async function applyNativeWorkerAcknowledgment(options) { return applyAcknowledgment(options, false); }
export async function applyNativeSubsequentWorkerAcknowledgment(options) { return applyAcknowledgment(options, true); }

async function applyAcknowledgment({ directory, expectedDigest, arm, number, stageSha256, namespace,
  requestId, capsuleSourceId, operation = "resume", sourceFile = null }, subsequent) {
  const options = { directory, expectedDigest, arm };
  need(["resume", "accept"].includes(operation) && typeof requestId === "string" && typeof capsuleSourceId === "string",
    "NATIVE_ACK_ARGUMENT_INVALID");
  const readCurrentStage = () => subsequent ? readNextStage(options, stageSha256, namespace) : readStage(options, stageSha256);
  const { freeze, workspace, root, stage } = await readCurrentStage();
  const paths = subsequent ? subsequentPreparationPaths(namespace) : initialPaths;
  const protect = () => subsequent ? nextUnchanged(workspace, stage) : unchanged(workspace, stage.files);
  const attempt = path.join(root, "worker-ack");
  await absent(attempt);
  const prepared = JSON.parse(await bytes(path.join(root, "attempt/result.json")));
  need(prepared.status === "NATIVE_INPUTS_DELIVERED_NOT_ACKNOWLEDGED", "NATIVE_ACK_PREPARATION_REQUIRED");
  const before = JSON.parse(await bytes(path.join(workspace, paths.prepared, "awaiting-worker.json")));
  need(before.readback === null && before.workspace === workspace && hash(before) === hash(prepared.request), "NATIVE_ACK_REQUEST_CHANGED");
  const request = { ...before, operation }, task = JSON.parse(await pinned(workspace, before.task));
  const capsule = JSON.parse(await pinned(workspace, before.capsule));
  const delivery = JSON.parse(await bytes(path.join(workspace, paths.prepared, "worker-delivery.json")));
  need(delivery.schema === "context.worker-delivery.v1" && delivery.worker === task.owner &&
    delivery.capsuleSha256 === before.capsule.sha256 && delivery.renderSha256 === sha256(capsule.render), "NATIVE_ACK_DELIVERY_MISMATCH");
  const record = await readCompletedRoleOutput({ ...options, number });
  need(record.role === "worker", "NATIVE_ACK_WORKER_REQUIRED");
  const live = () => need(record.allocatedAtMs + record.timeoutMs + 300000 > Date.now(), "NATIVE_ACK_EXPIRED");
  live();
  need(record.intent.task.sha256 === before.task.sha256 && record.acquiredSources.some(row =>
    row.id === record.intent.task.id && row.sha256 === before.task.sha256), "NATIVE_ACK_TASK_NOT_ACQUIRED");
  need(capsuleSourceId !== record.intent.task.id && record.acquiredSources.some(row =>
    row.id === capsuleSourceId && row.sha256 === before.capsule.sha256), "NATIVE_ACK_CAPSULE_NOT_ACQUIRED");
  const command = record.intent.commands.find(row => row.requestId === requestId);
  need(command?.requestSha256 === hash(request), "NATIVE_ACK_INTENT_MISMATCH");
  const commands = record.modelOutput.commands;
  need(Array.isArray(commands) && commands.length > 0 && commands.length <= 3 &&
    new Set(commands.map(row => row?.requestId)).size === commands.length, "NATIVE_ACK_NOT_AUTHORED");
  const authored = commands.find(row => row?.requestId === requestId)?.readback;
  need(typeof authored === "string" && authored.trim() && Buffer.byteLength(authored) <= 128 * 1024, "NATIVE_ACK_NOT_AUTHORED");
  let sourceBefore = null;
  const currentPublication = async () => {
    const sources = await readTurnSources(options);
    need(hash(sources.sourceRevision) === hash(record.sourceRevision) &&
      hash(sources.sourceSnapshot) === hash(record.sourceSnapshot), "NATIVE_ACK_SOURCES_CHANGED");
  };
  const current = async () => {
    await readCurrentStage(); live();
    await protect();
    await unchanged(workspace, prepared.steps.at(-1).after);
    if (subsequent) await nextAckNamespace(workspace, paths, prepared.steps.at(-1).after);
    await currentPublication();
    if (record.intent.context === null) need(sourceFile === null, "NATIVE_ACK_CONTEXT_CHANGED");
    else {
      need(typeof sourceFile === "string", "NATIVE_ACK_CONTEXT_REQUIRED");
      const registry = await openReviewSources(sourceFile), context = record.intent.context;
      const snapshot = await registry.snapshot();
      need(registry.workspace === workspace && context.sourceRoot === workspace &&
        sha256(await bytes(sourceFile)) === context.sourceRegistrySha256 &&
        snapshot.digest === context.sourceSnapshotDigest, "NATIVE_ACK_CONTEXT_CHANGED");
      sourceBefore = snapshot;
    }
  };
  await current();
  const evidencePath = paths.evidence;
  for (const name of [evidencePath, ...ackFiles
    .map(name => `${paths.prepared}/${name}`)]) await absent(path.join(workspace, name));
  await mkdir(attempt, { mode: 0o700 }); await syncDirectory(root);
  await durable(path.join(attempt, "pending.json"), { nativeDigest: expectedDigest, arm, number, stageSha256,
    helperSha256: stage.helperSha256, allocationSha256: record.allocationSha256, modelOutputSha256: record.modelOutputSha256,
    requestSha256: hash(request), requestId, evidenceSha256: sha256(authored), sourceBefore,
    sourceRegistrySha256: record.intent.context?.sourceRegistrySha256 ?? null });
  await current();
  await durable(path.join(workspace, evidencePath), authored);
  // Any exception/unknown leaves the immutable attempt and authored evidence.
  // Never repeat the arm effect, even if a machine receipt was partly written.
  const observed = await invokeComparisonAdapter({ output: freeze.comparisonOutput, expectedDigest: freeze.comparisonDigest,
    arm, operation: "prepare", args: ["ack", "--output", paths.prepared, "--worker", task.owner, "--evidence", evidencePath] });
  await durable(path.join(attempt, "observed.json"), observed);
  need(observed.result.status === "ACKNOWLEDGED" && observed.commands.length === 0, "NATIVE_ACK_NOT_CONFIRMED");
  await readCurrentStage(); live();
  await protect();
  await unchanged(workspace, prepared.steps.at(-1).after);
  if (subsequent) await nextAckNamespace(workspace, paths, { ...prepared.steps.at(-1).after,
    [evidencePath]: sha256(authored), ...Object.fromEntries(ackFiles.map(name => {
      const file = `${paths.prepared}/${name}`;
      need(typeof observed.after[file] === "string", "NATIVE_NEXT_WORKSPACE_CHANGED");
      return [file, observed.after[file]];
    })) }, true);
  const evidenceRef = { path: evidencePath, sha256: sha256(authored) };
  await pinned(workspace, evidenceRef);
  const receiptBytes = await bytes(path.join(workspace, paths.prepared, "readback.json")), receipt = JSON.parse(receiptBytes);
  need(hash(receipt) === hash({ schema: "context.readback.v1", worker: task.owner, taskSha256: before.task.sha256,
    capsuleSha256: before.capsule.sha256, capability: "retained-progress-v1", evidenceRef }), "NATIVE_ACK_RECEIPT_MISMATCH");
  const readback = { path: `${paths.prepared}/readback.json`, sha256: sha256(receiptBytes) }, requests = {};
  for (const mode of ["preflight", "resume", "accept"]) {
    requests[mode] = JSON.parse(await bytes(path.join(workspace, paths.prepared, `${mode}.json`)));
    need(hash(requests[mode]) === hash({ ...before, operation: mode, readback }), "NATIVE_ACK_REQUEST_CHANGED");
  }
  let sourceAfter = null;
  if (sourceBefore) {
    const registry = await openReviewSources(sourceFile);
    need(registry.workspace === workspace && sha256(await bytes(sourceFile)) === record.intent.context.sourceRegistrySha256,
      "NATIVE_ACK_CONTEXT_CHANGED");
    // Only the two actual ACK outputs may fill registered MISSING carriers.
    // Other generated files are not an exemption for unrelated registered drift.
    const refs = [readback, evidenceRef];
    const expectedRows = sourceBefore.rows.map(row => {
      const ref = refs.find(ref => ref.path === row.path);
      if (!ref) return row;
      need(row.status === "MISSING" && !Object.hasOwn(row, "sha256"), "NATIVE_ACK_CONTEXT_CHANGED");
      return { ...row, status: "AVAILABLE", sha256: ref.sha256 };
    });
    sourceAfter = await registry.snapshot();
    need(sourceAfter.digest === hash(expectedRows) &&
      sha256(await bytes(sourceFile)) === record.intent.context.sourceRegistrySha256, "NATIVE_ACK_CONTEXT_CHANGED");
  }
  await currentPublication(); live();
  const result = { status: "NATIVE_WORKER_ACKNOWLEDGED", request: requests[operation], requests, receipt, evidenceRef,
    allocationSha256: record.allocationSha256, modelOutputSha256: record.modelOutputSha256,
    provenanceKind: record.provenanceKind, observed, sourceBefore: sourceBefore?.digest ?? null, sourceAfter: sourceAfter?.digest ?? null,
    semanticEvidence: false, wholeChainComparatorReady: false,
    deliveryEvidence: "TASK_AND_CAPSULE_ACQUIRED_NOT_FULL_DELIVERY_COMPREHENSION", commandAuthorization: "NOT_ESTABLISHED" };
  await durable(path.join(attempt, "result.json"), result);
  return result;
}
