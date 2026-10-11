// Maintainer-only synthetic fixture repair. This is not semantic approval.
import { readFile, writeFile, mkdir, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const need = (value, code) => { if (!value) throw new Error(code); };

export async function repairCycleFixture({ workspace, runtimeRoot, deferAck = false }) {
  need(typeof deferAck === "boolean", "CYCLE_FIXTURE_DEFER_ACK_INVALID");
  need([workspace, runtimeRoot].every(p => typeof p === "string" && path.isAbsolute(p)), "CYCLE_FIXTURE_PATHS_REQUIRED");
  const root = await realpath(workspace), runtime = await realpath(runtimeRoot);
  const { canonicalJson, sha256 } = await import(pathToFileURL(path.join(runtime, "scripts/memory-brief.mjs")));
  const hash = value => sha256(canonicalJson(value));
  const bytes = async name => {
    need(typeof name === "string" && !path.isAbsolute(name) && !name.split(/[\\/]/).some(p => p === ".." || !p), "CYCLE_FIXTURE_PATH_INVALID");
    const absolute = path.join(root, name), stat = await lstat(absolute);
    need(await realpath(absolute) === absolute && stat.isFile() && stat.nlink === 1 && stat.size <= 2 * 1024 * 1024, "CYCLE_FIXTURE_FILE_INVALID");
    return readFile(absolute);
  };
  const json = async name => JSON.parse(await bytes(name));
  const pin = async name => ({ path: name, sha256: sha256(await bytes(name)) });
  const originalFile = async name => ({ ...await pin(name), record: await json(name) });
  const sourceSet = await originalFile("source-set.json"), classifications = await originalFile("classifications.json"),
    dependencies = await originalFile("dependencies.json"), oldTask = await json("task.json"), oldModule = await json("module.json");
  need(oldTask.id === "TASK-1" && oldModule.publicBoundary === "buildBundle" &&
    oldModule.implementationFiles.length === 1 && oldModule.implementationFiles[0] === "candidate.mjs" &&
    classifications.record.records.map(r => r.eventId).sort().join() === "S1,S2,S3,S4", "CYCLE_FIXTURE_UNSUPPORTED");
  const recipe = await json("recipe.json"), input = await json("consumer-input.json");
  need(recipe.entrypoint === "buildBundle" && recipe.revision === "bundle-r2" && recipe.preprocess === "none" && recipe.format === "json" &&
    Array.isArray(recipe.producerEdits) && recipe.producerEdits.length === 0 && recipe.rejected?.includes("keep-last") &&
    recipe.idea?.id === "CSV" && recipe.idea.disposition === "ASK_OWNER_NOT_IMPLEMENT" && Array.isArray(input), "CYCLE_FIXTURE_RECIPE_INVALID");
  const contract = (await bytes("contract.md")).toString(), decisions = (await bytes("decisions.md")).toString();
  need(/bundle-r2/.test(contract) && /accepted public boundary/.test(contract) && /D2/.test(decisions) && /bundle-r2/.test(decisions),
    "CYCLE_FIXTURE_CURRENT_PUBLIC_SOURCE_MISSING");
  const eventSources = [];
  for (const s of sourceSet.record.sources) eventSources.push({ ...s, ...await originalFile(s.path) });
  const publicDocs = ["scope", "goal", "map", "contract", "decisions", "success", "ideas"];
  const publicDocRefs = [];
  for (const id of publicDocs) publicDocRefs.push({ id, ...await pin(`${id}.md`) });
  const dependencyFiles = [];
  for (const d of dependencies.record.dependencies) dependencyFiles.push({ ...d, ...await pin(d.path) });
  const historicalProofs = [];
  for (const c of classifications.record.records) {
    for (const r of [c.review, c.integration]) if (r && !historicalProofs.some(p => p.path === r.path)) {
      const proof = await originalFile(r.path); need(proof.sha256 === r.sha256, "CYCLE_FIXTURE_HISTORICAL_PROOF_CHANGED"); historicalProofs.push(proof);
    }
  }
  const producer = await pin("candidate.mjs"), oracle = await pin(oldModule.oracle.path);
  need(oracle.sha256 === oldModule.oracle.sha256, "CYCLE_FIXTURE_ORACLE_CHANGED");
  const rejectedPacket = await bytes("execution-packet.md");
  const base = "cycle-fixture-input", output = "cycle-fixture-repair";
  await mkdir(path.join(root, base), { mode: 0o700 });
  const put = async (name, value) => {
    const content = typeof value === "string" ? value : canonicalJson(value) + "\n";
    await writeFile(path.join(root, name), content, { flag: "wx", mode: 0o600 }); return pin(name);
  };
  const originalPacket = await put(`${base}/rejected-execution-packet.md`, rejectedPacket.toString());
  const notice = "MAINTAINER SYNTHETIC fixture compilation only: the generated owner reviews and worker acknowledgment are scaffolding, not independent semantic approval, historical native proof, or current consumer acceptance.";
  const currentText = `${notice}\nSynthetic S8 current source: buildBundle at bundle-r2 is the accepted public boundary for this fixture. Pass id/label records unchanged, preserve exact id spelling, trim labels, order identifiers by codepoint, reject case-insensitive duplicate identifiers with DUPLICATE_ID even when labels differ, and return schema bundle/v1, entries and count. Consume the pinned producer artifact without producer edits or preprocessing; normalizeEntries is internal and unavailable. Current D2 replaces historical D1 lowercasing; keep-last stays rejected. This current accepted r2 source supersedes S1:1 and the future producer-correction instruction S4:1 only, not S1:2, S2:1 or the deferred CSV owner checkpoint S3:1. Prior capability acceptance is not this new consumer's acceptance or whole-workspace completion. SL0 assisted evidence cannot certify autonomy. Fresh actual independent native readiness must judge this exact composition before controlled execution.`;
  const s8 = { schema: "context.events.v1", complete: true, events: [{ id: "S8", authorKind: "human", body: currentText }] };
  const s8Ref = await put(`${base}/source-S8.json`, s8);
  const consumerContract = "consumeBundle(input) is the primary JSON consumer boundary. It delegates the supplied records unchanged to the pinned public buildBundle@bundle-r2 release. The consumer owns its wrapper and output only, not producer implementation. Exact action reads recipe.json and consumer-input.json and creates consumer-output.json once with wx. No producer edits, preprocessing, keep-last, CSV implementation, network or deployment are requested.\n";
  const consumerContractRef = await put(`${base}/consumer-contract.md`, consumerContract);
  const connection = await put(`${base}/producer-connection.json`, { schema: "qualification.synthetic-connection.v1", notice,
    publicBoundary: "buildBundle", revision: "bundle-r2", artifact: producer, contract: await pin("contract.md"),
    decisions: await pin("decisions.md"), currentSource: s8Ref, semanticApproval: "NOT_ESTABLISHED" });
  const consumer = await put(`${base}/consumer.mjs`, "import { buildBundle } from '../candidate.mjs';\nexport function consumeBundle(input) { return buildBundle(input); }\n");
  const action = await put(`${base}/action.mjs`, `import { readFileSync, writeFileSync } from 'node:fs';
import { consumeBundle } from './consumer.mjs';
const recipe = JSON.parse(readFileSync('recipe.json', 'utf8'));
if (recipe.entrypoint !== 'buildBundle' || recipe.revision !== 'bundle-r2' || recipe.preprocess !== 'none' || recipe.format !== 'json' || !Array.isArray(recipe.producerEdits) || recipe.producerEdits.length) throw Error('RECIPE_NOT_AUTHORIZED');
const input = JSON.parse(readFileSync('consumer-input.json', 'utf8'));
writeFileSync('consumer-output.json', JSON.stringify(consumeBundle(input)) + '\\n', { flag: 'wx' });
`);
  const verifier = await put(`${base}/verify.mjs`, `import { readFileSync } from 'node:fs';
import { consumeBundle } from './consumer.mjs';
const oracle = JSON.parse(readFileSync(${JSON.stringify(oracle.path)}, 'utf8'));
const observations = JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES).map(id => {
  const example = oracle.examples.find(e => e.id === id);
  let observed; try { observed = consumeBundle(example.input); } catch (error) { observed = { error: error.message }; }
  return { id, observed };
});
console.log(JSON.stringify({ schema: 'context.observations.v1', candidateSha256: process.env.VYDYKHAI_CANDIDATE_SHA256,
  oracleSha256: process.env.VYDYKHAI_ORACLE_SHA256, observations }));
`);
  const shared = await put(`${base}/shared.md`, `${notice}\nCurrent synthetic r2 consumer obligations are compiled from immutable original S1-S4 plus explicit S8. S1:2, S2:1 and S3:1 remain active.\n`);
  const evidence = deferAck ? null : await put(`${base}/worker-readback.txt`, `${notice}\nSynthetic worker has read consumeBundle/buildBundle public boundaries, S8, retained duplicate safety, unfinished workspace and deferred CSV owner checkpoint. No producer context is supplied.\n`);
  const commands = name => ({ executable: process.execPath, args: [name], cwd: ".", timeoutMs: 3000, maxOutputBytes: 65536 });
  const currentClassifications = classifications.record.records.map(c => {
    const event = eventSources.find(s => s.id === c.sourceId)?.record.events.find(e => e.id === c.eventId);
    need(event && hash(event) === c.sourceSha256, "CYCLE_FIXTURE_HISTORICAL_SOURCE_CHANGED");
    return { sourceId: c.sourceId, eventId: c.eventId, eventDisposition: c.eventDisposition, reason: c.reason,
      assertions: c.assertions.map(a => {
        const { sourceRange, ...rest } = a, quote = Buffer.from(event.body).subarray(sourceRange.start, sourceRange.end).toString();
        need(sha256(quote) === sourceRange.sha256, "CYCLE_FIXTURE_HISTORICAL_QUOTE_CHANGED");
        return ["S1:1", "S4:1"].includes(a.id)
          ? { ...rest, quote, disposition: "superseded", supersededBy: "S8:1", reason: "Explicit maintainer synthetic S8 current r2 source supersedes this historical instruction only." }
          : { ...rest, quote };
      }) };
  });
  currentClassifications.push({ sourceId: "SOURCE-MAINTAINER-S8", eventId: "S8", eventDisposition: "assertions", reason: notice,
    assertions: [{ id: "S8:1", quote: currentText, disposition: "accepted_capability", scope: ["bundle"], targetRef: "module:buildBundle",
      reason: "Current synthetic accepted r2 producer is consumed unchanged; independent semantic readiness remains unproven.",
      supersededBy: null, ownerGate: null, trigger: null }] });
  const candidateFiles = [consumer.path, action.path, verifier.path];
  const moduleAccess = { schema: "context.module-access.v1", modules: [
    { id: "consumeBundle", intent: "create", contractFiles: [consumerContractRef.path], privatePaths: [base, "consumer-output.json"], release: null },
    { id: "buildBundle", intent: "consume", contractFiles: ["contract.md"], privatePaths: ["candidate.mjs"], release: { artifact: producer, connection } }
  ] };
  const pinnedDependencies = [producer.path, connection.path, "recipe.json", "consumer-input.json", ...publicDocRefs.map(r => r.path),
    "source-set.json", "classifications.json", "dependencies.json", action.path, consumer.path];
  const pkg = { schema: "context.package.v2", owner: "maintainer-synthetic-fixture", task: {
    id: oldTask.id, worker: oldTask.owner, scope: ["bundle"], action: commands(action.path), candidateFiles },
    module: { publicBoundary: "consumeBundle", implementationFiles: candidateFiles, retainedExampleIds: oldModule.retainedExampleIds,
      newExampleIds: oldTask.newExampleIds, oracle: oracle.path, verificationScript: verifier.path, verificationCommand: commands(verifier.path),
      contractFiles: [consumerContractRef.path, "contract.md"] },
    sources: [...sourceSet.record.sources.map(({ id, path, scope }) => ({ id, path, scope })), { id: "SOURCE-MAINTAINER-S8", path: s8Ref.path, scope: ["bundle"] }],
    classifications: currentClassifications,
    dependencies: [...dependencies.record.dependencies, ...pinnedDependencies.map((name, i) => ({ id: `cycle-pin-${i}`, path: name, scope: ["bundle"] }))],
    sharedArtifacts: [shared.path], moduleAccess,
    navigation: { taskId: oldTask.id, worker: oldTask.owner, preparedBy: "maintainer-synthetic-fixture", outcome: "Execute only the JSON consumer of accepted fixture r2; no producer work.",
      assignment: { owner: "maintainer-synthetic-fixture", requestId: "cycle-fixture-repair", question: notice, phase: "initial", previous: null },
      references: [{ id: "consumer-contract", path: consumerContractRef.path, quote: consumerContract.trim(), purpose: "Primary consumer boundary", appliesTo: "task" },
        { id: "producer-contract", path: "contract.md", quote: contract.trim(), purpose: "Consumed public contract only", appliesTo: "task" },
        { id: "current-decisions", path: "decisions.md", quote: decisions.trim(), purpose: "Current D2, not historical D1", appliesTo: "task" }],
      constraints: [{ text: "Consume pinned buildBundle@bundle-r2 unchanged; no producer context or mutation.", appliesTo: "task", referenceIds: ["consumer-contract", "producer-contract", "current-decisions"] }], gaps: [] } };
  const packageRef = await put(`${base}/package.json`, pkg), preparation = [];
  const cli = async (...args) => {
    const result = await execute(process.execPath, [path.join(runtime, "scripts/vydykhai.mjs"), ...args], { cwd: root, timeout: 15000, maxBuffer: 2 * 1024 * 1024 });
    need(!result.stderr.trim(), "CYCLE_FIXTURE_CLI_STDERR"); return JSON.parse(result.stdout);
  };
  for (const [args, expected] of [
    [["plan", "--input", packageRef.path, "--output", output], "PLAN_READY"],
    [["confirm", "--output", output, "--owner", pkg.owner, "--decision", "approved"], "PREPARED"],
    [["read", "--output", output, "--worker", pkg.task.worker], "DELIVERED"],
    ...(!deferAck ? [[["ack", "--output", output, "--worker", pkg.task.worker, "--evidence", evidence.path], "ACKNOWLEDGED"]] : [])
  ]) {
    const result = await cli("context-prepare", ...args); need(result.status === expected, `CYCLE_FIXTURE_${args[0].toUpperCase()}_${result.code ?? result.status}`);
    preparation.push({ operation: args[0], status: result.status });
  }
  const preflight = `${output}/preflight.json`, resume = `${output}/resume.json`, accept = `${output}/accept.json`;
  // Keep awaiting-worker.json intact: ordinary ack validates its preflight operation.
  const request = deferAck ? { ...await json(`${output}/awaiting-worker.json`), operation: "resume" } : await json(resume);
  const ctx = deferAck ? await import(pathToFileURL(path.join(runtime, "scripts/context-run.mjs"))) : null;
  const ready = deferAck ? await ctx.runContextTransition({ ...request, operation: "prepare", capsule: null, readback: null, integrationPlan: null })
    : await cli("context-run", "--input", preflight);
  need(ready.status === (deferAck ? "PREPARED" : "READY"), `CYCLE_FIXTURE_PREFLIGHT_${ready.code ?? ready.status}`);
  const task = await json(request.task.path), capsule = await json(request.capsule.path);
  const binding = { operation: "resume", taskId: task.id, taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
    sourceDigest: ready.coverageBasis.sourceDigest, dependencyDigest: ready.coverageBasis.dependencyDigest,
    commandSha256: hash(task.action), cwd: root, executable: await realpath(process.execPath), kind: "dependent" };
  const ledger = await put(`${base}/source-ledger.json`, { schema: "qualification.synthetic-source-ledger.v1", notice,
    original: { sourceSet, eventSources, classifications, dependencies, dependencyFiles, historicalProofs, rejectedPacket: originalPacket },
    currentSource: { ...s8Ref, record: s8 }, publicDocRefs, supersession: [{ from: "S1:1", to: "S8:1" }, { from: "S4:1", to: "S8:1" }] });
  const sources = [
    { id: "source-ledger", path: ledger.path, purpose: "Original immutable revisions and explicit synthetic S8 supersession" },
    { id: "public-action", path: action.path, purpose: "Exact permitted public action source" },
    { id: "consumer-input", path: "consumer-input.json", purpose: "Exact action input records" },
    { id: "consumer-wrapper", path: consumer.path, purpose: "Public consumer wrapper; producer implementation not supplied" },
    { id: "consumer-recipe", path: "recipe.json", purpose: "Exact recipe bytes read by public action" },
    { id: "consumer-contract", path: consumerContractRef.path, purpose: "Primary consumer contract" },
    { id: "producer-connection", path: connection.path, purpose: "Public synthetic release connection; opaque artifact hash only" },
    { id: "original-source-set", path: "source-set.json", purpose: "Original registered event source inventory" },
    { id: "original-classifications", path: "classifications.json", purpose: "Original historical classifications unchanged" },
    { id: "original-dependencies", path: "dependencies.json", purpose: "Original dependency registry unchanged" },
    ...pkg.sources.map(s => ({ id: s.id, path: s.path, purpose: "Exact registered event bytes (historical or explicit synthetic current)" })),
    ...dependencyFiles.map((r, i) => ({ id: `original-dependency-${i}`, path: r.path, purpose: "Original dependency bytes" })),
    ...historicalProofs.map((r, i) => ({ id: `original-proof-${i}`, path: r.path, purpose: "Original synthetic classification/integration proof" }))
  ];
  for (const name of ["source-set", "classifications", "dependencies", "module", "task", "capsule", ...(!deferAck ? ["readback"] : []), "memory-review", "source-receipt", "integration", "integration-plan", "integration-review", "plan", "approval", "navigation"])
    sources.push({ id: `current-${name}`, path: `${output}/${name}.json`, purpose: "Current runtime-derived synthetic fixture binding, not semantic approval" });
  for (let i = 0; i < currentClassifications.length; i++) sources.push({ id: `current-source-review-${i}`, path: `${output}/source-review-${i}.json`, purpose: "Current synthetic classification review" });
  const routing = await put(`${base}/source-routing.json`, { schema: "qualification.synthetic-source-routing.v1", notice,
    sourceDigest: binding.sourceDigest, dependencyDigest: binding.dependencyDigest, classificationBindings: ready.classificationBindings ?? null,
    sourceReceipt: ready.sourceReceipt, currentDependencies: await originalFile(task.dependencies),
    publicSources: sources, protectedProducer: { artifact: producer, connection, readAuthority: "OPAQUE_BINDING_OR_EXECUTION_ONLY" } });
  sources.push({ id: "source-routing", path: routing.path, purpose: "Current bindings resolved to original/current public source revisions" });
  const publicBindings = [];
  for (const s of sources) publicBindings.push({ ...s, ...await pin(s.path) });
  const expose = async ref => ({ ...ref, text: (await bytes(ref.path)).toString() });
  const packet = { schema: "qualification.cycle-fixture-packet.v1", notice, semanticApproval: "NOT_ESTABLISHED", preparation,
    ...(deferAck ? { acknowledgment: "PENDING_ACTUAL_WORKER", readiness: "NOT_ESTABLISHED" } : {}),
    request, task, capsule, binding, original: { sourceSet, eventSources, classifications, dependencies, dependencyFiles, historicalProofs, rejectedPacket: originalPacket },
    current: { sourceDigest: binding.sourceDigest, dependencyDigest: binding.dependencyDigest, classificationBindings: ready.classificationBindings ?? null,
      sourceReceipt: ready.sourceReceipt, classifications: await originalFile(task.classifications), dependencies: await originalFile(task.dependencies),
      integration: await originalFile(`${output}/integration.json`), memoryReview: await originalFile(task.memoryReview.path) },
    publicAction: { command: task.action, script: await expose(action), consumer: await expose(consumer),
      recipe: await expose(await pin("recipe.json")), input: await expose(await pin("consumer-input.json")), output: "consumer-output.json", createMode: "wx" },
    consumedProducer: { artifact: producer, connection, publicContract: await pin("contract.md"), producerContext: "NOT_EXPOSED" }, publicBindings,
    limits: ["Synthetic compilation is not semantic approval; fresh actual independent native readiness is required.",
      "No actual action or behavior verification was run by repairCycleFixture.", "Declared module access is not an OS sandbox or a general write-trace claim.",
      "Frozen oracle and original event files are unchanged. Whole-workspace/product acceptance is not established."] };
  need(sha256(await bytes("execution-packet.md")) === sha256(rejectedPacket), "CYCLE_FIXTURE_REJECTED_PACKET_CHANGED");
  await writeFile(path.join(root, "execution-packet.md"), canonicalJson(packet) + "\n", { mode: 0o600 });
  return { request, binding, sources, preparation, semanticApproval: "NOT_ESTABLISHED", originalPacket,
    package: packageRef.path, preflight, resume, accept, executionPacket: await pin("execution-packet.md") };
}
