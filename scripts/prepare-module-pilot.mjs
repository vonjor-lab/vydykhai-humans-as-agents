// Maintainer-only staging. No model calls, installation or product operations.
import { readFile, realpath, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { checkFreeze } from "./prepare-framework-eval.mjs";
import { validateDurableOutbox } from "./vydykhai.mjs";
import { rawCases, producer, route } from "../tests/fixtures/module-transition/cases.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE = "tests/fixtures/module-transition";
const hash = data => createHash("sha256").update(data).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";

const client = `import http from "node:http";
import { readFile } from "node:fs/promises";

export async function callOutbox(operation, payload) {
  const endpoint = JSON.parse(await readFile(new URL("endpoint.json", import.meta.url)));
  return new Promise((resolve, reject) => {
    const request = http.request({ socketPath: endpoint.socketPath, path: "/v1", method: "POST",
      headers: { "content-type": "application/json" }, timeout: 3000 }, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", part => { body += part; });
      response.on("end", () => {
        try {
          const result = JSON.parse(body);
          if (result.release !== endpoint.release) throw new Error("RELEASE_IDENTITY_MISMATCH");
          if (!result.ok) { const error = new Error(result.error.message); error.name = result.error.name; throw error; }
          resolve(result.value);
        } catch (error) { reject(error); }
      });
    });
    request.on("timeout", () => request.destroy(new Error("endpoint timed out")));
    request.on("error", cause => reject(Object.assign(new Error("Outbox endpoint unavailable", { cause }), { code: "ENDPOINT_UNAVAILABLE" })));
    request.end(JSON.stringify({ operation, payload }));
  });
}
`;

const producerTask = `# Task: package the retained outbox codec

You own one bounded extraction in this isolated evaluation workspace. This is
implementation, not a plan-only response. Accepted profile: GPT-6 Sol Low. Read
../public/contract.md, then use the source/export list below to locate the codec.
There is no existing module-map file; creating it is part of your output. This is
a nongit isolated copy. Inspect relevant legacy code, implement and test. Do not
create agents, contact people, change models, publish or use a network.

Input source: ../legacy/scripts/vydykhai.mjs. The codec exports are
parseReturnStatus, createReturnSync, createReturnRoute, validateDurableOutbox and
parseDurableOutboxComment. They depend on RETURN_STATUSES and nearby pure parsing
helpers. CLI installation, Guard scheduling and memory logic are outside scope.

Create work/package/outbox.mjs exporting those five functions, standalone with no
imports of the legacy tree or other packages and no IO. Retain existing semantics
and error behavior exactly; do not fix unrelated bugs. Do not copy the whole CLI.
Write work/package/CONTRACT.md, INTERNALS.md and module-map.json with public API,
errors, algorithm rationale, retained invariants and private/public boundaries.
No file over 600 lines. Keep original baseline, public contract and checks intact.

Public transport contract: ../public/contract.md. The evaluator supplies the
transport; you implement the codec, not an HTTP server. At least the complete raw
input path, duplicates, legacy aliases, incomplete lifecycles and CRLF must work.
The independent verifier compares unseen raw inputs with the retained baseline.

Run node checks/producer-check.mjs; its missing-package failure is expected before
implementation. Add your own tests under work if useful. Do not stop merely at a
local failure: repair within scope until checks pass or the granted budget ends.
Write work/RETURN.json with status, changed paths, test evidence, limitations and
next action. Do not claim a released reusable module before independent consumers.
Final answer at most 250 words, with actual result, checks and unresolved items.
`;

const consumerCommon = `
This is an isolated implementation task, not an architecture redesign. Profile:
GPT-6 Sol Low. The producer is closed: read only your task/current work, the public
contract/client and applicable framework instructions. Do not try producer or
legacy sources, sibling consumers, private review evidence or a replacement parser.
No agents, new models, package downloads, project operations or external network.
Only work/ is writable. Preserve any existing progress and use apply_patch for
manual edits. The public SDK ../public/client.mjs exposes callOutbox; import it
from work with ../../public/client.mjs. The public contract is ../public/contract.md.
The host supplies a local Unix socket; do not create another server or change it.
No raw Markdown parsing in the consumer. Keep module internals out of context.
Document your small consumer boundary in work/README.md and work/module-map.json.
At each return write work/RETURN.json with actual status, checks, dependency and
next action. Never label a mock or unavailable endpoint as a passing real integration.
Final answer at most 250 words. Correct ordinary local test failures within scope.
`;

const consumerA = `# Consumer A: status summary, dependency not yet available
${consumerCommon}
Create work/summary.mjs exporting async summarizeOutbox(text). It calls inspect
once with the complete raw string, then returns exactly { valid, pending, routed,
warnings, issues }, where valid means issues.length === 0, pending/routed are the
returned receipt-id arrays and warnings/issues are retained. Propagate transport
and type errors unchanged. Importing your module must have no side effects.

The accepted producer artifact exists, but its endpoint is deliberately not started
yet. Prepare this consumer now, verify syntax and demonstrate the real unavailable
endpoint error without replacing it with a fake result. Do not poll or start a host.
Save work/CHECKPOINT.json with taskId consumer-a, status WAITING, retained files,
test evidence, dependency endpoint-ready and next action real API verification.
Stop at that concrete dependency; continuing this same task is already authorized
when endpoint-ready arrives. Public sample raw texts are in ../public/samples.json.
`;

const consumerResume = `# Consumer A: endpoint-ready
${consumerCommon}
Resume the existing logical task consumer-a from work/CHECKPOINT.json and its
retained files. This is a fresh context, not a new owner. The fixed accepted API
endpoint is now available; the named dependency is resolved. Do not seek the same
permission again, restart the implementation or read producer code.

Complete and test summarizeOutbox against the real API on public samples and your
own cases. Retain its exact contract: { valid, pending, routed, warnings, issues }.
Preserve errors; no local parsing or substituted results. Save actual test evidence
and update the existing checkpoint/Return to reflect verified completion, or the
exact remaining blocker. Successful producer tests alone do not prove your wiring.
`;

const consumerB = `# Consumer B: audit a collection of raw comments
${consumerCommon}
Create work/audit.mjs exporting async auditComments(comments), where comments is
an array of raw strings. Validate that shape; reject invalid input with TypeError.
Join complete comments with a newline before one inspect call so that a producer
receipt in one comment can match its route in another. Do not parse comments
separately. Return exactly { status, pendingCount, routedCount, pendingIds, warnings,
issues }; status is needs-review when issues are nonempty, otherwise clear.
pendingCount is pendingReturnIds.length, pendingIds is pendingReturnIds; retain
warnings/issues and the module's routedCount. Propagate transport failures, perform
no IO on import, and do not confuse structurally clear data with product acceptance.

The fixed accepted API is available now. Implement and run real integration tests,
including a pair split between comments, an older pending receipt and malformed
input. Samples in ../public/samples.json include independent raw comments. Do not
read or copy consumer A. Complete within scope and save proof in work/RETURN.json.
`;

const producerCheck = `import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as legacy from "../../legacy/scripts/vydykhai.mjs";
import * as candidate from "../work/package/outbox.mjs";
const samples = JSON.parse(await readFile(new URL("../../public/samples.json", import.meta.url)));
for (const text of samples.texts) {
  assert.deepEqual(candidate.validateDurableOutbox(text), legacy.validateDurableOutbox(text));
  assert.deepEqual(candidate.parseDurableOutboxComment(text), legacy.parseDurableOutboxComment(text));
}
for (const value of ["ACCEPT", "NEEDS_FIXES / RETAINED", "invalid", "", null])
  assert.deepEqual(candidate.parseReturnStatus(value), legacy.parseReturnStatus(value));
const input = { status: "CHECKPOINT_READY", returnReceiptId: "PUBLIC-WRITER",
  taskContextArtifact: "task / artifact", memoryCandidates: "NO_MEMORY_DELTA",
  artifactDisposition: "retained", recommendedNextAction: "review" };
assert.equal(candidate.createReturnSync(input), legacy.createReturnSync(input));
const routed = { returnReceiptId: "PUBLIC-WRITER", consumer: "owner", routedNextAction: "review", evidence: "receipt" };
assert.equal(candidate.createReturnRoute(routed), legacy.createReturnRoute(routed));
assert.throws(() => candidate.createReturnSync({ status: "invented" }), TypeError);
for (const name of ["CONTRACT.md", "INTERNALS.md", "module-map.json"])
  assert.ok((await readFile(new URL("../work/package/" + name, import.meta.url), "utf8")).trim());
console.log(JSON.stringify({ status: "PASS", publicSamples: samples.texts.length, operations: 5 }));
`;

export async function stageModulePilot(root, output) {
  root = await realpath(root);
  if (!path.isAbsolute(output)) throw new Error("PILOT_ABSOLUTE_OUTPUT_REQUIRED");
  output = path.join(await realpath(path.dirname(output)), path.basename(output));
  if (output === root || output.startsWith(root + path.sep)) throw new Error("PILOT_EXTERNAL_OUTPUT_REQUIRED");
  const freeze = JSON.parse(await readFile(path.join(root, "tests/fixtures/framework-behavior/freeze.json")));
  const { candidate } = await checkFreeze(root, freeze);
  const records = [];
  await mkdir(output);
  const write = async (name, bytes) => {
    const value = Buffer.from(bytes);
    const file = path.join(output, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, value, { flag: "wx" });
    records.push({ path: name, sha256: hash(value), bytes: value.length });
  };
  const legacyFiles = ["vydykhai", "memory-brief", "context-run", "context-prepare", "context-navigation",
    "context-cost", "module-access", "adoption-plan", "checkpoint-review"].map(name => `${name}.mjs`);
  for (const name of legacyFiles)
    await write(`legacy/scripts/${name}`, await readFile(path.join(root, "scripts", name)));
  for (const worker of ["producer", "consumer-a", "consumer-b"]) {
    for (const [name, bytes] of candidate) await write(`${worker}/${name}`, bytes);
    await write(`${worker}/AGENTS.md`, candidate.get("docs/AGENTS_CORE.md"));
    await mkdir(path.join(output, worker, "work"));
  }
  await write("producer/TASK.md", producerTask);
  await write("producer/checks/producer-check.mjs", producerCheck);
  await write("consumer-a/TASK.md", consumerA);
  await write("consumer-a/RESUME.md", consumerResume);
  await write("consumer-b/TASK.md", consumerB);
  await write("public/contract.md", await readFile(path.join(root, FIXTURE, "contract.md")));
  await write("public/client.mjs", client);
  await write("public/samples.json", json({ texts: ["# ordinary prose", producer("PUBLIC-PENDING"),
    `${producer("PUBLIC-PAIR")}\n${route("PUBLIC-PAIR")}`], comments: [producer("PUBLIC-SPLIT"), route("PUBLIC-SPLIT")] }));
  const cases = rawCases("INDEPENDENT-20260929").map(c => ({ ...c, expected: validateDurableOutbox(c.text) }));
  for (const c of cases) {
    if (json(c.expected.pendingReturnIds) !== json(c.pending) || json(c.expected.routedReturnIds) !== json(c.routed))
      throw new Error(`PILOT_INVARIANT_MISMATCH:${c.id}`);
  }
  await write("review/cases.json", json(cases));
  await write("review/acceptance.md", await readFile(path.join(root, FIXTURE, "README.md")));
  await write("review/budget-template.json", json({ status: "NOT_APPROVED", date: null, model: "gpt-6-sol", effort: "low",
    attempts: ["01-producer", "02-consumer-a", "03-consumer-a-resume", "04-consumer-b"], wallMs: 180000,
    thresholdTokens: 120000, tokenMetric: "GROSS_INPUT_PLUS_OUTPUT", enforcement: "UNVERIFIED",
    finalResponseOvershoot: true, retries: 0, extraJudges: 0,
    authority: "Staging grants no model budget; record separate user confirmation before execution." }));
  const frozen = { schema: "framework.module-pilot-freeze.v1", frameworkFreezeSha256: freeze.sha256,
    sourceScriptSha256: hash(await readFile(path.join(root, "scripts/prepare-module-pilot.mjs"))), records };
  await write("review/freeze.json", json({ ...frozen, sha256: hash(json(frozen)) }));
  return { status: "STAGED_NOT_RUN", output, workers: 3, attempts: 4, independentRawCases: cases.length, modelCalls: 0 };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("Usage: node scripts/prepare-module-pilot.mjs /absolute/external/output");
  console.log(json(await stageModulePilot(ROOT, process.argv[2])));
}
