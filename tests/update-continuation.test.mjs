import assert from "node:assert/strict";
import test from "node:test";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const repository = fileURLToPath(new URL("../", import.meta.url));
const baseline = "72086069e853e785392d8ec722b03a4b1bacba75";
const digest = value => createHash("sha256").update(value).digest("hex");

test("published-kit update retains unfinished work through preparation, verification and one routed Return", async t => {
  const available = spawnSync("git", ["cat-file", "-e", `${baseline}^{commit}`], { cwd: repository });
  if (available.status !== 0) return t.skip("Published 1.32.8 object unavailable; no network fetch is performed");
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-update-cycle-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const old = path.join(root, "published"), target = path.join(root, "project");
  await mkdir(old); await mkdir(target);
  const command = (executable, args, cwd = target, options = {}) => {
    const result = spawnSync(executable, args, { cwd, encoding: "utf8", timeout: 15000,
      maxBuffer: 16 * 1024 * 1024, ...options });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, String(result.stderr || result.stdout));
    return result.stdout;
  };
  await writeFile(path.join(root, "published.tar"), command("git", ["archive", baseline], repository, { encoding: null }));
  command("tar", ["-xf", path.join(root, "published.tar"), "-C", old]);
  command(process.execPath, [path.join(old, "scripts/vydykhai.mjs"), "install", target]);
  await cp(path.join(old, "examples/context-preparation"), target, { recursive: true });
  const installed = path.join(target, "scripts/vydykhai.mjs");
  const cli = (...args) => command(process.execPath, [installed, ...args]);
  const json = async name => JSON.parse(await readFile(path.join(target, name), "utf8"));
  const put = (name, value) => writeFile(path.join(target, name), typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n");
  const pin = async name => ({ path: name, sha256: digest(await readFile(path.join(target, name))) });
  const result = (...args) => {
    const run = spawnSync(process.execPath, [installed, ...args], { cwd: target, encoding: "utf8", timeout: 15000 });
    assert.equal(run.error, undefined, run.error?.message);
    assert.equal(run.signal, null, run.stderr);
    const body = JSON.parse(run.stdout);
    assert.equal(run.status, body.status === "BLOCKED" ? 1 : 0, run.stderr || run.stdout);
    return body;
  };
  const prepare = (output, mode, ...args) => result("context-prepare", mode, "--output", output, ...args);
  const run = (output, operation) => result("context-run", "--input", `${output}/${operation}.json`);
  const acknowledge = async output => {
    const delivered = prepare(output, "read", "--worker", "bundle-worker");
    assert.equal(delivered.status, "DELIVERED");
    assert.match(delivered.context, /CSV/);
    assert.match(delivered.context, /case-insensitively/);
    await put("readback.txt", "Synthetic worker readback: preserve buildBundle output, retained examples and case-insensitive duplicate rejection. CSV remains deferred to module-owner. Product integration still requires a human decision.");
    assert.equal(prepare(output, "ack", "--worker", "bundle-worker", "--evidence", "readback.txt").status, "ACKNOWLEDGED");
    return delivered;
  };

  // Begin with a real published installation and an already approved task.
  assert.equal(prepare("prior", "plan", "--input", "package.json").status, "PLAN_READY");
  assert.equal(prepare("prior", "confirm", "--owner", "module-owner", "--decision", "approved").status, "PREPARED");
  await acknowledge("prior");
  const state = "Retain bundle-change and bundle-worker at verification checkpoint.\nHuman question: approve product integration? Still unanswered.\nOther work: explicitly paused by human.\n";
  await put("project-state.md", state);
  command("git", ["init", "-b", "retained-work"]);
  command("git", ["add", "."]);
  command("git", ["-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false",
    "-c", "core.hooksPath=/dev/null", "commit", "-m", "Synthetic accepted task"]);
  const head = command("git", ["rev-parse", "HEAD"]).trim();
  const candidate = (await readFile(path.join(target, "candidate.mjs"), "utf8"))
    .replace("const key = entry.id;", "const key = entry.id.toLowerCase();");
  await put("candidate.mjs", candidate);
  const priorTask = await readFile(path.join(target, "prior/task.json"), "utf8");
  const oldPlan = JSON.parse(cli("adoption-plan", "--json"));

  // This process starts from the old installed updater, not the candidate CLI.
  const update = cli("update", target, "--from", repository);
  assert.match(update, /UNPROVEN_BY_INSTALLER/);
  const plan = JSON.parse(cli("adoption-plan", "--json"));
  assert.notEqual(plan.id, oldPlan.id, "same version label must not hide a changed bundle");
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER");
  assert.ok(plan.requirements.some(item => item.id === "module-boundaries"));
  assert.match(cli("doctor", target, "--offline"), /ORCHESTRATOR=low \(recovery=high\); DISCOVERY=high/);
  assert.equal(await readFile(path.join(target, "prior/task.json"), "utf8"), priorTask);
  assert.equal(run("prior", "preflight").coverageBasis.moduleAccess, "LEGACY_UNCHECKED");
  t.diagnostic("Old installed updater preserved task/branch/code; installation did not certify active use.");

  const ids = ["code-map", "module-map", "module-contracts", "graph-routes", "verification"];
  const readiness = { trigger: "update", scope: "synthetic-bundle", sourceRevision: head,
    bindings: Object.fromEntries(ids.map(id => [id, `missing:${id}`])), checks: [] };
  const assess = async () => {
    await put("readiness.json", readiness);
    return JSON.parse(cli("adoption-plan", target, "--input", "readiness.json", "--json")).capabilityReadiness;
  };
  const missing = await assess();
  assert.equal(missing.action, "ASSIGN_MAINTENANCE");
  assert.deepEqual(missing.preparation.required, ["COMPLETE_PROJECT_MAP", "ASSESS_AND_PLAN_MODULES"]);
  assert.equal(missing.independentWork, "CONTINUE_WITHIN_EXISTING_AUTHORITY");
  const owner = { id: "maintenance-1", scope: readiness.scope, status: "WAITING", checkpoint: "bundle verification boundary" };
  readiness.owner = owner;
  assert.equal((await assess()).action, "WAIT_OWNER");
  owner.status = "WORKING";
  assert.equal((await assess()).action, "REUSE_OWNER");
  readiness.repairAttemptedFor = missing.defectKey;
  cli("update", target, "--from", repository);
  assert.equal(JSON.parse(cli("adoption-plan", "--json")).id, plan.id);
  const repeated = await assess();
  assert.equal(repeated.action, "REUSE_OWNER");
  assert.equal(repeated.defectKey, missing.defectKey);
  delete readiness.owner;
  assert.equal((await assess()).action, "WAIT_CHECKPOINT", "reinstall cannot reset the same failed-repair history");
  readiness.owner = owner;

  // Fixture-owned maintenance supplies actual files; the classifier checks
  // their declared bindings, not their meaning or a real agent's initiative.
  await mkdir(path.join(target, "project-docs"));
  const artifacts = {
    "code-map": "buildBundle: candidate.mjs; local action: action.mjs; verification: verify.mjs and oracle.json.\n",
    "module-map": "One project module: buildBundle. Public contract: module-contract.md. Framework files are external tooling, not project modules.\n",
    "module-contracts": await readFile(path.join(repository, "examples/context-preparation/module-contract.md"), "utf8"),
    "graph-routes": "bundle -> buildBundle -> bundle-history S1-S4. S3: CSV remains deferred to module-owner when the module returns to scope. S4: preserve id spelling and reject case-insensitive duplicates.\n",
    "verification": "Public boundary buildBundle; B1/B2 retained, N1 new. Use verify.mjs and oracle.json. Verification is not human acceptance.\n",
  };
  for (const [id, body] of Object.entries(artifacts)) {
    const name = `project-docs/${id}.md`; await put(name, body);
    const binding = (await pin(name)).sha256;
    readiness.bindings[id] = binding;
    readiness.checks.push({ id, status: "VERIFIED", binding, checkedBinding: binding, source: name });
  }
  readiness.architecture = { project: "synthetic-bundle", scope: "synthetic-bundle",
    inventory: { source: "project-docs/code-map.md", areas: ["bundle"] }, source: "project-docs/module-map.md",
    reviewedBy: "synthetic-maintainer", review: "synthetic fixture coverage, not model or product acceptance",
    coverage: [{ area: "bundle", access: "AVAILABLE", modularity: "ENCAPSULATED", documentation: "CURRENT", evidence: "project-docs/module-contracts.md" }] };
  owner.status = "RETURNED";
  assert.equal((await assess()).action, "REVIEW_MAINTENANCE_RETURN");
  delete readiness.owner;
  assert.equal((await assess()).action, "WAIT_CHECKPOINT", "missing sync retains the same failed-repair checkpoint");
  await put("participant-registry.txt", "synthetic-maintainer is the only participant in this isolated fixture.\n");
  const sharedRefs = ids.map(id => ({ id, revision: readiness.bindings[id] }));
  for (const [id, body] of Object.entries(artifacts)) {
    assert.equal(await readFile(path.join(target, `project-docs/${id}.md`), "utf8"), body);
  }
  assert.match(artifacts["graph-routes"], /CSV remains deferred/);
  await put("sync-readback.txt", "Fixture retrieval: buildBundle is in candidate.mjs, has one public contract, and CSV remains deferred. Application: keep the current candidate, preserve id spelling and reject case-insensitive duplicates; do not implement CSV. This is a synthetic no-mutation rehearsal, not an agent result.\n");
  readiness.teamSync = { scope: readiness.scope, registrySource: "participant-registry.txt",
    artifacts: ids.map(id => ({ id, revision: readiness.bindings[id], source: `project-docs/${id}.md` })),
    participants: [{ id: "synthetic-maintainer", sourceRange: "fixture:through-documentation", artifacts: ids }],
    receipts: [{ participant: "synthetic-maintainer",
      contribution: { disposition: "DELTA", sourceRange: "fixture:through-documentation", artifacts: sharedRefs,
        evidence: "project-docs/graph-routes.md", integration: "sync-readback.txt" },
      readback: { artifacts: sharedRefs, evidence: "sync-readback.txt", retrieval: "sync-readback.txt",
        application: "sync-readback.txt" } }] };
  assert.equal((await assess()).action, "REVIEW_ROUTE_PROOF", "five documents alone cannot finish adoption");

  // Upgrade the same task at its safe checkpoint; do not recreate its code.
  const next = JSON.parse(await readFile(path.join(repository, "examples/context-preparation/package-modular.json"), "utf8"));
  await put("module-contract.md", artifacts["module-contracts"]);
  next.navigation.assignment = { owner: next.owner, requestId: "adopt-module-boundary",
    question: "Retain the same implemented correction and add its declared module boundary", phase: "supplement",
    previous: { plan: await pin("prior/plan.json"), approval: await pin("prior/approval.json") } };
  await put("modular.json", next);
  assert.equal(prepare("current", "plan", "--input", "modular.json").status, "PLAN_READY");
  assert.equal(prepare("current", "confirm", "--owner", next.owner, "--decision", "approved").status, "PREPARED");
  assert.equal(run("prior", "resume").code, "PACKAGE_SUPERSEDED");
  assert.equal(run("current", "awaiting-worker").status, "BLOCKED");
  assert.equal((await acknowledge("current")).moduleAccess.schema, "context.module-access.v1");
  assert.equal(run("current", "resume").status, "ACTION_COMPLETED");
  assert.equal(run("current", "preflight").status, "READY", "lost final message needs reconciliation, not another action");
  const accepted = run("current", "accept");
  assert.equal(accepted.status, "VERIFIED");
  assert.equal(accepted.coverageBasis.moduleAccess, "DECLARED_BOUNDARIES");
  assert.equal(accepted.receipt.productAcceptance, "NOT_ESTABLISHED");
  assert.deepEqual(accepted.receipt.observations.map(item => item.id), ["B1", "B2", "N1"]);
  await put("verification-receipt.json", accepted.receipt);
  t.diagnostic("The same worker used a v2 supplement, retained its implementation and passed old/new examples.");

  const { validateDurableOutbox, createReturnRoute } = await import(pathToFileURL(installed));
  await put("outbox.md", accepted.returnSync);
  const pending = validateDurableOutbox(await readFile(path.join(target, "outbox.md"), "utf8"));
  assert.equal(pending.returnCount, 1);
  assert.equal(pending.pendingReturnIds.length, 1);
  const route = createReturnRoute({ returnReceiptId: pending.pendingReturnIds[0], consumer: "synthetic-manager",
    routedNextAction: "Retain the verified result and ask the pending human product-integration question", evidence: "verification-receipt.json" });
  await put("outbox.md", accepted.returnSync + "\n" + route);
  const routed = validateDurableOutbox(await readFile(path.join(target, "outbox.md"), "utf8"));
  assert.deepEqual(routed.pendingReturnIds, []);
  assert.equal(routed.returnCount, 1); assert.equal(routed.routeCount, 1);
  assert.equal(routed.returns[0].fields.Status, "CHECKPOINT_READY");
  assert.match(prepare("current", "read", "--worker", "bundle-worker").context, /CSV/);
  readiness.accepted = { status: "ACCEPTED", acceptedBy: "synthetic-maintainer", relevantKey: (await assess()).relevantKey,
    routeProof: { moduleFound: "project-docs/module-map.md", contextDelivered: "current/worker-delivery.json",
      retainedAndNewAcceptance: "verification-receipt.json", documentationUpdated: "project-docs/verification.md",
      semanticIntegration: "project-docs/graph-routes.md", nextRetrieval: "current/capsule.json" } };
  for (const source of Object.values(readiness.accepted.routeProof)) {
    assert.ok((await readFile(path.join(target, source))).length, `Missing fixture evidence: ${source}`);
  }
  assert.equal((await assess()).action, "REUSE_ACCEPTED");
  assert.equal((await assess()).dependentDispatch, "READY");
  assert.equal(await readFile(path.join(target, "candidate.mjs"), "utf8"), candidate);
  assert.equal(await readFile(path.join(target, "actions.log"), "utf8"), "called\n");
  assert.equal(await readFile(path.join(target, "project-state.md"), "utf8"), state);
  assert.equal(command("git", ["rev-parse", "HEAD"]).trim(), head);
  assert.equal(command("git", ["branch", "--show-current"]).trim(), "retained-work");
  t.diagnostic("One action and one routed producer Return; unchanged candidate, HEAD, human pause and pending question.");
});
