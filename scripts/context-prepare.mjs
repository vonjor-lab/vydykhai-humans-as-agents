// Task-local transport builder. Semantic decisions remain explicit owner inputs.
import path from "node:path";
import { readFile, writeFile, lstat, realpath, mkdir, rmdir, rename, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256, checkPreparedContext } from "./memory-brief.mjs";
import { parseContextJson, runContextTransition, artifactHash } from "./context-run.mjs";

const hash = v => sha256(canonicalJson(v));
const encoded = v => canonicalJson(v) + "\n";
const id = v => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, a) => object(v) && Object.keys(v).sort().join() === [...a].sort().join();
const need = (v, code = "PACKAGE_SCHEMA_INVALID") => { if (!v) throw new Error(code); };
const intersects = (a, b) => a.includes("*") || b.includes("*") || a.some(x => b.includes(x));
const sort = a => [...a].sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);
const scope = a => Array.isArray(a) && a.length > 0 && a.every(x => x === "*" || id(x));
const list = a => Array.isArray(a) && a.length <= 256;
const quote = s => `'${s.replaceAll("'", "'\\''")}'`;
const command = value => {
  need(object(value) && (keys(value, ["executable", "args", "cwd"]) || keys(value, ["executable", "args", "cwd", "timeoutMs", "maxOutputBytes"])));
  return { timeoutMs: 3000, maxOutputBytes: 65536, ...value, executable: value.executable === "node" ? process.execPath : value.executable };
};

async function file(root, relative) {
  need(typeof relative === "string" && relative.length && !path.isAbsolute(relative) &&
    !relative.split(/[\\/]/).includes(".."), "PACKAGE_PATH_INVALID");
  const absolute = path.resolve(root, relative);
  need(absolute.startsWith(root + path.sep) && await realpath(absolute) === absolute, "PACKAGE_PATH_INVALID");
  const stat = await lstat(absolute);
  need(stat.isFile() && stat.size <= 2 * 1024 * 1024, "PACKAGE_FILE_INVALID");
  const bytes = await readFile(absolute); need(bytes.length <= 2 * 1024 * 1024, "PACKAGE_FILE_INVALID"); return bytes;
}
const read = async (root, name) => parseContextJson(await file(root, name));
const reference = (name, value) => ({ path: name, sha256: sha256(encoded(value)) });

async function build(root, input, output) {
  const inputs = new Map();
  const source = async name => {
    need(name !== output && !name.startsWith(output + "/"), "PACKAGE_INPUT_INSIDE_OUTPUT");
    const data = await file(root, name); inputs.set(name, { path: name, sha256: sha256(data) }); return data;
  };
  const pkg = parseContextJson(await source(input));
  need(keys(pkg, ["schema", "owner", "task", "module", "sources", "classifications", "dependencies", "sharedArtifacts"]) && pkg.schema === "context.package.v1" && id(pkg.owner));
  need(keys(pkg.task, ["id", "worker", "scope", "action", "candidateFiles"]) && id(pkg.task.id) && id(pkg.task.worker) && scope(pkg.task.scope) && list(pkg.task.candidateFiles));
  need(keys(pkg.module, ["publicBoundary", "implementationFiles", "retainedExampleIds", "newExampleIds", "oracle", "verificationScript", "verificationCommand"]));
  need(list(pkg.sources) && pkg.sources.length && list(pkg.classifications) && list(pkg.dependencies) && list(pkg.sharedArtifacts) && pkg.sharedArtifacts.length);
  const artifacts = new Map(), at = name => `${output}/${name}`;
  const add = (name, value) => { const p = at(name); artifacts.set(p, value); return reference(p, value); };
  const sourceSet = { schema: "context.sources.v1", sources: [] }, inventory = [], bodies = new Map(), ranges = [];
  for (const s of pkg.sources) {
    need(keys(s, ["id", "path", "scope"]) && id(s.id) && scope(s.scope));
    sourceSet.sources.push({ ...s, kind: "events" });
    if (!intersects(s.scope, pkg.task.scope)) continue;
    const bytes = await source(s.path), exported = parseContextJson(bytes);
    need(keys(exported, ["schema", "complete", "events"]) && exported.schema === "context.events.v1" && exported.complete === true && list(exported.events), "PACKAGE_SOURCE_INCOMPLETE");
    ranges.push({ sourceId: s.id, sha256: sha256(bytes) });
    for (const e of exported.events) {
      need(keys(e, ["id", "authorKind", "body"]) && id(e.id) && typeof e.body === "string" && e.body.length);
      inventory.push({ sourceId: s.id, eventId: e.id, sha256: hash(e), scope: s.scope }); bodies.set(`${s.id}/${e.id}`, e.body);
    }
  }
  add("source-set.json", sourceSet);
  const records = [], meaning = [], items = [];
  for (const c of pkg.classifications) {
    need(keys(c, ["sourceId", "eventId", "eventDisposition", "assertions", "reason"]) && list(c.assertions));
    const s = inventory.find(s => s.sourceId === c.sourceId && s.eventId === c.eventId);
    need(s, "PACKAGE_UNKNOWN_SOURCE"); const body = bodies.get(`${c.sourceId}/${c.eventId}`);
    need(["assertions", "no_change", "evidence_only"].includes(c.eventDisposition) &&
      (c.eventDisposition === "assertions" ? c.assertions.length > 0 : c.assertions.length === 0), "PACKAGE_SOURCE_MEANING_MISSING");
    const assertions = c.assertions.map(a => {
      need(keys(a, ["id", "quote", "disposition", "scope", "targetRef", "reason", "supersededBy", "ownerGate", "trigger"]) && typeof a.quote === "string" && a.quote.length);
      const index = body.indexOf(a.quote); need(index >= 0 && index === body.lastIndexOf(a.quote), "PACKAGE_QUOTE_AMBIGUOUS_OR_MISSING");
      const { quote: excerpt, ...rest } = a;
      if (["current_constraint", "accepted_capability", "deferred"].includes(a.disposition)) items.push({ id: `ITEM-${items.length}`, sourceAssertionRefs: [a.id],
        text: `${excerpt}\nDisposition: ${a.disposition}. ${a.reason}${a.trigger ? ` Trigger: ${a.trigger}. Owner gate: ${a.ownerGate}.` : ""}` });
      return { ...rest, sourceRange: { start: Buffer.byteLength(body.slice(0, index)), end: Buffer.byteLength(body.slice(0, index) + excerpt), sha256: sha256(excerpt) } };
    });
    const value = { sourceId: c.sourceId, eventId: c.eventId, sourceSha256: s.sha256, eventDisposition: c.eventDisposition,
      assertions, reason: c.reason, localOwner: null, localTask: null };
    meaning.push(value);
    const review = add(`source-review-${records.length}.json`, { schema: "context.source-review.v1", classificationSha256: hash(value), reviewer: pkg.owner, decision: "approved" });
    records.push({ ...value, review, integration: null });
  }
  // Preview validates known source coverage without certifying shared integration.
  const checked = checkPreparedContext({ inventory, dispositions: records.map(c => ({ sourceId: c.sourceId, eventId: c.eventId,
    sourceSha256: c.sourceSha256, reviewRef: c.review.sha256, integrated: true, localOwner: null, localTask: null,
    assertions: c.assertions.map(({ sourceRange, ...a }) => a), reason: c.reason })),
    prepared: { scope: pkg.task.scope, taskId: pkg.task.id, owner: pkg.task.worker, allowLocalOverlay: false, items, envelope: null, atomicRender: "" }, phase: "bind" });
  need(checked.status === "READY", checked.code);
  const shared = [];
  for (const a of pkg.sharedArtifacts) {
    const r = typeof a === "string" ? { path: a } : a;
    need(keys(r, ["path"]) || keys(r, ["path", "startMarker", "endMarker"]));
    need(r.path !== output && !r.path.startsWith(output + "/"), "PACKAGE_INPUT_INSIDE_OUTPUT");
    const binding = { ...r, sha256: artifactHash({ ...r, sha256: "0".repeat(64) }, await file(root, r.path)) };
    inputs.set(canonicalJson(r), binding);
    shared.push(binding);
  }
  const bindings = records.map(c => ({ sourceId: c.sourceId, eventId: c.eventId, sha256: c.sourceSha256,
    classificationSha256: hash(meaning.find(m => m.sourceId === c.sourceId && m.eventId === c.eventId)), reviewSha256: c.review.sha256 }));
  const integrationBody = { schema: "context.integration-plan.v1", owner: "orchestrator", sourceBindings: bindings, artifacts: shared };
  const integrationReview = add("integration-review.json", { schema: "context.integration-review.v1", planSha256: hash(integrationBody), reviewer: pkg.owner, decision: "approved" });
  const integrationPlan = add("integration-plan.json", { ...integrationBody, reviewRef: integrationReview });
  const expectedIntegration = { schema: "context.integration.v1", plan: integrationPlan, sourceBindings: bindings, artifacts: shared };
  // Predicted reference only. Receipt is written exclusively after real integrate readback.
  for (const c of records) c.integration = reference(at("integration.json"), expectedIntegration);
  add("classifications.json", { schema: "context.classifications.v1", records });
  for (const d of pkg.dependencies) { need(keys(d, ["id", "path", "scope"]) && scope(d.scope)); if (intersects(d.scope, pkg.task.scope)) await source(d.path); }
  add("dependencies.json", { schema: "context.dependencies.v1", dependencies: pkg.dependencies });
  const module = { schema: "context.module.v1", publicBoundary: pkg.module.publicBoundary, implementationFiles: pkg.module.implementationFiles,
    retainedExampleIds: pkg.module.retainedExampleIds, oracle: { path: pkg.module.oracle, sha256: sha256(await source(pkg.module.oracle)) },
    verificationScript: { path: pkg.module.verificationScript, sha256: sha256(await source(pkg.module.verificationScript)) }, verificationCommand: command(pkg.module.verificationCommand) };
  const moduleRef = add("module.json", module), render = items.map(i => `<!-- context:item ${i.id} -->\n${i.text}\n<!-- context:item:end -->`).join("\n\n");
  const memoryReview = add("memory-review.json", { schema: "context.memory-review.v1", reviewer: pkg.owner, decision: "approved",
    sourceDigest: hash({ events: sort(inventory), ranges: sort(ranges) }), meaningDigest: hash(sort(meaning)), contentDigest: sha256(render), publicBoundary: pkg.module.publicBoundary });
  const identity = add("identity.json", { workspace: root, task: pkg.task.id });
  const task = add("task.json", { schema: "context.task.v1", id: pkg.task.id, owner: pkg.task.worker, workspace: root, identity,
    requiredCapabilities: ["retained-progress-v1"], enforcement: "reference", scope: pkg.task.scope,
    sourceSet: at("source-set.json"), classifications: at("classifications.json"), dependencies: at("dependencies.json"), module: moduleRef,
    memory: { publicBoundary: pkg.module.publicBoundary, items, atomicInput: null }, memoryReview, action: command(pkg.task.action),
    newExampleIds: pkg.module.newExampleIds, candidateFiles: pkg.task.candidateFiles, allowLocalOverlay: false,
    packageApproval: { plan: at("plan.json"), approval: at("approval.json") } });
  const request = { schema: "context.request.v1", workspace: root, task, operation: "prepare", capsule: null, readback: null, integrationPlan: null };
  const plan = { schema: "context.preparation-plan.v1", owner: pkg.owner, workspace: root, semanticPackage: pkg,
    inputFiles: [...inputs.values()], artifacts: [...artifacts].map(([name, value]) => reference(name, value)) };
  return { plan, artifacts, request, integrationPlan, expectedIntegration, render, task: artifacts.get(task.path) };
}

export async function prepareContext(args, services = {}) {
  let unlock;
  try {
    const [mode, ...rest] = args, options = {};
    need(["plan", "confirm", "read", "ack", "bind"].includes(mode) && rest.length % 2 === 0, "PREPARATION_ARGUMENTS_INVALID");
    for (let i = 0; i < rest.length; i += 2) { need(/^--(input|output|owner|decision|worker|evidence|event)$/.test(rest[i]) && !Object.hasOwn(options, rest[i]), "PREPARATION_ARGUMENTS_INVALID"); options[rest[i]] = rest[i + 1]; }
    const allowed = { plan: ["--input", "--output"], confirm: ["--output", "--owner", "--decision"], read: ["--output", "--worker"], ack: ["--output", "--worker", "--evidence"], bind: ["--output", "--owner", "--event"] };
    need(keys(options, allowed[mode]), "PREPARATION_ARGUMENTS_INVALID");
    const root = await realpath(process.cwd()), output = options["--output"];
    need(typeof output === "string" && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(output) && !output.split("/").some(x => x === "." || x === ".."), "PACKAGE_OUTPUT_INVALID");
    const dir = path.resolve(root, output);
    need(await realpath(path.dirname(dir)) === path.dirname(dir), "PACKAGE_PATH_INVALID");
    if (mode === "plan") { try { await mkdir(dir); } catch (e) { if (e.code !== "EEXIST") throw e; } }
    need(await realpath(dir) === dir && (await lstat(dir)).isDirectory(), "PACKAGE_PATH_INVALID");
    const lock = path.join(dir, ".prepare-lock"); await mkdir(lock); unlock = () => rmdir(lock);
    const put = async (name, value, replace = false) => {
      const relative = `${output}/${name}`, target = path.join(dir, name), content = encoded(value);
      try { const prior = await file(root, relative); if (prior.toString() === content) return reference(relative, value); need(replace, "PACKAGE_OUTPUT_COLLISION"); }
      catch (e) { if (e.code !== "ENOENT") throw e; }
      const tmp = `${target}.${randomUUID()}.tmp`; await writeFile(tmp, content, { flag: "wx", mode: 0o600 }); await rename(tmp, target);
      return reference(relative, value);
    };
    if (mode === "plan") {
      const built = await build(root, options["--input"], output);
      const names = (await readdir(dir)).filter(n => n !== ".prepare-lock");
      if (names.length) need(names.includes("plan.json") && hash(await read(root, `${output}/plan.json`)) === hash(built.plan), "PACKAGE_OUTPUT_COLLISION");
      await put("plan.json", built.plan);
      return { status: "PLAN_READY", plan: `${output}/plan.json`, owner: built.plan.owner, approval: "REQUIRED",
        note: "Review semanticPackage and pinned source/shared inputs. Derived approved reviews are inactive until this exact plan is explicitly confirmed." };
    }
    const plan = await read(root, `${output}/plan.json`);
    need(plan.schema === "context.preparation-plan.v1" && list(plan.inputFiles) && plan.inputFiles.length, "PACKAGE_PLAN_INVALID");
    const built = await build(root, plan.inputFiles[0].path, output);
    need(hash(plan) === hash(built.plan), "PACKAGE_PLAN_STALE");
    const owner = options["--owner"];
    if (mode === "confirm") {
      need(owner === plan.owner && options["--decision"] === "approved", "PACKAGE_APPROVAL_REQUIRED");
      // Refuse collisions before making the explicit decision persistent.
      for (const [name, value] of built.artifacts) {
        try { need((await file(root, name)).toString() === encoded(value), "PACKAGE_OUTPUT_COLLISION"); } catch (e) { if (e.code !== "ENOENT") throw e; }
      }
      await put("approval.json", { schema: "context.package-approval.v1", owner, decision: "approved", planSha256: sha256(await file(root, `${output}/plan.json`)) });
      for (const [name, value] of built.artifacts) await put(name.slice(output.length + 1), value);
      const integrated = await runContextTransition({ ...built.request, operation: "integrate", integrationPlan: built.integrationPlan }, services);
      need(integrated.status === "VERIFIED", integrated.code);
      need(hash(integrated.receipt) === hash(built.expectedIntegration), "PACKAGE_INTEGRATION_MISMATCH"); await put("integration.json", integrated.receipt);
      const prepared = await runContextTransition(built.request, services); need(prepared.status === "PREPARED", prepared.code);
      await put("capsule.json", prepared.capsule); await put("source-receipt.json", prepared.sourceReceipt);
      const request = { ...built.request, operation: "preflight", capsule: reference(`${output}/capsule.json`, prepared.capsule) };
      await put("awaiting-worker.json", request);
      return { status: "PREPARED", output, worker: built.task.owner, readback: "REQUIRED", sourceReceipt: prepared.sourceReceipt, stats: prepared.stats };
    }
    const pending = await read(root, `${output}/awaiting-worker.json`);
    need(hash({ ...pending, capsule: null }) === hash({ ...built.request, operation: "preflight" }), "PACKAGE_REQUEST_MISMATCH");
    // Fresh prepare validates root decision, exact inputs and actual shared readback.
    const checked = await runContextTransition(built.request, services);
    need(checked.status === "PREPARED", checked.code);
    need(hash(pending.capsule) === hash(reference(`${output}/capsule.json`, checked.capsule)), "PACKAGE_CAPSULE_CHANGED");
    const capsule = await read(root, pending.capsule.path); need(hash(capsule) === hash(checked.capsule), "PACKAGE_CAPSULE_CHANGED");
    if (mode === "read" || mode === "ack") {
      const worker = options["--worker"]; need(worker === built.task.owner, "PACKAGE_WORKER_MISMATCH");
      const delivery = { schema: "context.worker-delivery.v1", worker, capsuleSha256: pending.capsule.sha256, renderSha256: sha256(capsule.render) };
      if (mode === "read") { await put("worker-delivery.json", delivery); return { status: "DELIVERED", worker, context: capsule.render, acknowledgment: "REQUIRED" }; }
      need(hash(await read(root, `${output}/worker-delivery.json`)) === hash(delivery), "PACKAGE_WORKER_DELIVERY_MISSING");
      const evidence = options["--evidence"], data = await file(root, evidence); need(data.toString().trim().length, "PACKAGE_WORKER_EVIDENCE_EMPTY");
      const readback = await put("readback.json", { schema: "context.readback.v1", worker, taskSha256: pending.task.sha256,
        capsuleSha256: pending.capsule.sha256, capability: "retained-progress-v1", evidenceRef: { path: evidence, sha256: sha256(data) } });
      let preflight;
      for (const operation of ["preflight", "resume", "accept"]) {
        const reference = await put(`${operation}.json`, { ...pending, operation, readback }); if (operation === "preflight") preflight = reference;
      }
      try {
        const current = await read(root, `${output}/hook-state.json`);
        need(keys(current, ["schema", "request", "eventBindings"]) && current.schema === "context.hook-state.v1" &&
          hash(current.request) === hash(preflight) && list(current.eventBindings), "PACKAGE_OUTPUT_COLLISION");
      } catch (e) { if (e.code !== "ENOENT") throw e; await put("hook-state.json", { schema: "context.hook-state.v1", request: preflight, eventBindings: [] }); }
      try { await mkdir(path.join(dir, "hook-metadata")); } catch (e) { if (e.code !== "EEXIST") throw e; }
      const action = { ...built.task.action, cwd: await realpath(path.resolve(root, built.task.action.cwd)) };
      const { nativeActionCommand } = await import("./context-hook.mjs");
      const command = [process.execPath, path.resolve(path.dirname(fileURLToPath(import.meta.url)), "context-hook.mjs"), "--workspace", root,
        "--command", nativeActionCommand(action), "--state", `${output}/hook-state.json`, "--metadata", `${output}/hook-metadata`].map(quote).join(" ");
      const hooks = Object.fromEntries(["UserPromptSubmit", "PreToolUse", "PostToolUse"].map(event => [event, [{ ...(event === "UserPromptSubmit" ? {} : { matcher: "^Bash$" }), hooks: [{ type: "command", command, timeout: 10 }] }]]));
      await put("hooks.template.json", { hooks });
      return { status: "ACKNOWLEDGED", worker, preflight: `${output}/preflight.json`, resume: `${output}/resume.json`, accept: `${output}/accept.json`, hooks: "INERT_TEMPLATE_ONLY" };
    }
    need(owner === plan.owner, "PACKAGE_OWNER_MISMATCH");
    const { hookEventKey } = await import("./context-hook.mjs");
    const event = await read(root, options["--event"]), state = await read(root, `${output}/hook-state.json`);
    need(keys(state, ["schema", "request", "eventBindings"]) && state.schema === "context.hook-state.v1" &&
      hash(state.request) === hash({ path: `${output}/preflight.json`, sha256: sha256(await file(root, `${output}/preflight.json`)) }) &&
      list(state.eventBindings), "PACKAGE_OUTPUT_COLLISION");
    need(event.schema === "context.hook-event.v1" && event.key === hookEventKey({ session_id: event.session, turn_id: event.turn }), "PACKAGE_EVENT_INVALID");
    const request = await read(root, state.request.path), ready = await runContextTransition(request, services); need(ready.status === "READY", ready.code);
    const matches = ready.sourceBodies.filter(s => s.bodySha256 === event.promptSha256);
    need(matches.length === 1, "HOOK_SOURCE_BODY_MISMATCH"); const s = matches[0];
    const classification = ready.classificationBindings.find(c => c.sourceId === s.sourceId && c.eventId === s.eventId && c.sha256 === s.sha256);
    need(classification, "HOOK_SOURCE_PENDING");
    const binding = { eventKey: event.key, eventSha256: hash(event), classification };
    const prior = state.eventBindings.find(b => b.eventKey === event.key); need(!prior || hash(prior) === hash(binding), "PACKAGE_MAPPING_CONFLICT");
    if (!prior) { state.eventBindings.push(binding); await put("hook-state.json", state, true); }
    return { status: "BOUND", eventKey: event.key, sourceId: s.sourceId, eventId: s.eventId, note: "Existing pending events, conflict markers and action outcomes retained." };
  } catch (e) { return { status: "BLOCKED", code: /^[A-Z][A-Z0-9_]+$/.test(e.message) ? e.message : "PREPARATION_IO_INVALID", commands: 0 }; }
  finally { if (unlock) await unlock(); }
}
