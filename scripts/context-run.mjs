import { constants } from "node:fs";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { canonicalJson, sha256, compileExecutableBrief, checkPreparedContext } from "./memory-brief.mjs";

const CAPABILITY = "retained-progress-v1";
const MAX_BYTES = 2 * 1024 * 1024;
const hash = value => sha256(canonicalJson(value));
const text = v => typeof v === "string" && v.trim().length > 0;
const id = v => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, names) => object(v) && Object.keys(v).sort().join("\0") === [...names].sort().join("\0");
const list = (v, predicate, nonempty = true) => Array.isArray(v) && v.length <= 1024 &&
  (!nonempty || v.length > 0) && v.every(predicate);
const unique = values => new Set(values).size === values.length;
const scopes = v => list(v, x => x === "*" || id(x)) && unique(v);
const intersects = (a, b) => a.includes("*") || b.includes("*") || a.some(x => b.includes(x));
const ref = v => keys(v, ["path", "sha256"]) && text(v.path) && digest(v.sha256);
export const artifactRef = v => ref(v) || (keys(v, ["path", "sha256", "startMarker", "endMarker"]) && text(v.path) &&
  digest(v.sha256) && text(v.startMarker) && text(v.endMarker) && v.startMarker !== v.endMarker);
class ContextError extends Error {
  constructor(code, limited = false, reference = null) { super(code); this.code = code; this.limited = limited; this.reference = reference; }
}
const requireThat = (condition, code = "CONTEXT_SCHEMA_INVALID", reference = null) => { if (!condition) throw new ContextError(code, false, reference); };

export function artifactHash(reference, data) {
  requireThat(artifactRef(reference), "ARTIFACT_REF_INVALID");
  if (ref(reference)) return sha256(data);
  const body = data.toString("utf8"), start = body.indexOf(reference.startMarker), end = body.indexOf(reference.endMarker);
  requireThat(start >= 0 && end > start && start === body.lastIndexOf(reference.startMarker) &&
    end === body.lastIndexOf(reference.endMarker), "ARTIFACT_SELECTOR_INVALID");
  return sha256(body.slice(start, end + reference.endMarker.length));
}

// No error includes source bytes, command output, environment values or supplied paths.
async function boundedRead(file) {
  const s = await lstat(file);
  requireThat(s.isFile() && s.size <= MAX_BYTES, "ARTIFACT_SIZE_OR_TYPE_INVALID");
  const bytes = await readFile(file);
  requireThat(bytes.length <= MAX_BYTES, "ARTIFACT_SIZE_OR_TYPE_INVALID");
  return bytes;
}
function parse(bytes) {
  const input = bytes.toString("utf8");
  let value;
  try { value = JSON.parse(input); } catch { throw new ContextError("JSON_INVALID"); }
  // JSON.parse silently keeps the last duplicate member. Reject ambiguous bindings,
  // including escaped spellings of the same key, before any command is considered.
  const stack = [];
  for (const match of input.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    const token = match[0], top = stack.at(-1);
    if (token === "{") stack.push({ object: true, key: true, seen: new Set() });
    else if (token === "[") stack.push({ object: false });
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && top?.object) top.key = true;
    else if (token === ":" && top?.object) top.key = false;
    else if (token.startsWith('"') && top?.object && top.key) {
      const key = JSON.parse(token);
      requireThat(!top.seen.has(key), "JSON_DUPLICATE_KEY");
      top.seen.add(key); top.key = false;
    }
  }
  return value;
}
function schema(value, name, fields) {
  requireThat(keys(value, ["schema", ...fields]) && value.schema === name);
}
function sourceBindings(value) {
  requireThat(list(value, b => keys(b, ["sourceId", "eventId", "sha256", "classificationSha256", "reviewSha256"]) &&
    id(b.sourceId) && id(b.eventId) && digest(b.sha256) && digest(b.classificationSha256) && digest(b.reviewSha256), false));
  requireThat(unique(value.map(b => `${b.sourceId}/${b.eventId}`)), "DUPLICATE_SOURCE");
}

function commandShape(spec) {
  requireThat(keys(spec, ["executable", "args", "cwd", "timeoutMs", "maxOutputBytes"]) &&
    path.isAbsolute(spec.executable || "") && list(spec.args, v => typeof v === "string", false) &&
    text(spec.cwd) && Number.isInteger(spec.timeoutMs) && spec.timeoutMs > 0 && spec.timeoutMs <= 60000 &&
    Number.isInteger(spec.maxOutputBytes) && spec.maxOutputBytes > 0 && spec.maxOutputBytes <= MAX_BYTES,
  "COMMAND_SCHEMA_INVALID");
  requireThat(!/^(?:sh|bash|zsh|fish|csh|dash|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh(?:\.exe)?)$/i.test(path.basename(spec.executable)), "SHELL_COMMAND_UNSUPPORTED");
}
async function command(spec, root, readPath, stats, extraEnv = {}, kind = "dependent") {
  commandShape(spec);
  const cwd = await readPath(spec.cwd, true);
  const executable = await realpath(spec.executable);
  requireThat((await lstat(executable)).isFile(), "COMMAND_EXECUTABLE_INVALID");
  await access(executable, constants.X_OK);
  // A minimal environment avoids forwarding host credentials to reference commands.
  const env = { ...extraEnv };
  for (const k of ["PATH", "SystemRoot", "TMPDIR", "TEMP"]) if (process.env[k]) env[k] = process.env[k];
  stats.commands++;
  stats[`${kind}Commands`]++;
  return new Promise((resolve, reject) => {
    let stdout = Buffer.alloc(0), stderrBytes = 0, failure = null;
    const child = spawn(executable, spec.args, { cwd, env, shell: false, windowsHide: true,
      detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
    const stop = code => {
      if (failure) return;
      failure = code;
      try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch { /* exited */ }
    };
    const timer = setTimeout(() => stop("COMMAND_TIMEOUT"), spec.timeoutMs);
    child.stdout.on("data", chunk => {
      if (stdout.length + stderrBytes + chunk.length > spec.maxOutputBytes) stop("COMMAND_OUTPUT_LIMIT");
      else stdout = Buffer.concat([stdout, chunk]);
    });
    child.stderr.on("data", chunk => {
      stderrBytes += chunk.length;
      if (stdout.length + stderrBytes > spec.maxOutputBytes) stop("COMMAND_OUTPUT_LIMIT");
    });
    child.on("error", () => { clearTimeout(timer); reject(new ContextError("COMMAND_START_FAILED")); });
    child.on("close", code => {
      clearTimeout(timer);
      if (failure || code !== 0) reject(new ContextError(failure || "COMMAND_FAILED"));
      else resolve({ stdout, stdoutSha256: sha256(stdout), exitCode: code, commandSha256: hash(spec), cwd, executable });
    });
  });
}

// This is the sole reference transition entry. It performs no shared-state writes.
// services are existing canonical Return APIs injected by the CLI, avoiding an import cycle.
export async function runContextTransition(request, services = {}) {
  const stats = { reads: 0, sourceEvents: 0, compiles: 0, commands: 0, dependentCommands: 0, verificationCommands: 0 };
  let sourceReceipt = null;
  try {
    schema(request, "context.request.v1", ["operation", "workspace", "task", "capsule", "readback", "integrationPlan"]);
    requireThat(["prepare", "resume", "preflight", "accept", "integrate"].includes(request.operation) &&
      path.isAbsolute(request.workspace || "") && ref(request.task) &&
      [request.capsule, request.readback, request.integrationPlan].every(v => v === null || ref(v)));
    const root = await realpath(request.workspace);
    requireThat(root === path.resolve(request.workspace), "WORKSPACE_IDENTITY_MISMATCH");
    const resolvePath = async (relative, directory = false) => {
      requireThat(text(relative) && !path.isAbsolute(relative) && !relative.includes("\0") &&
        !relative.split(/[\\/]/).includes(".."), "ARTIFACT_PATH_INVALID");
      const target = path.resolve(root, relative);
      requireThat(target === root || target.startsWith(root + path.sep), "ARTIFACT_PATH_INVALID");
      const actual = await realpath(target);
      requireThat(actual === target, "ARTIFACT_SYMLINK_UNSUPPORTED");
      requireThat(directory ? (await lstat(actual)).isDirectory() : (await lstat(actual)).isFile(), "ARTIFACT_SIZE_OR_TYPE_INVALID");
      return actual;
    };
    const bytes = async relative => { stats.reads++; return boundedRead(await resolvePath(relative)); };
    const json = async relative => parse(await bytes(relative));
    const pinned = async reference => {
      requireThat(ref(reference), "ARTIFACT_REF_INVALID");
      const data = await bytes(reference.path);
      requireThat(sha256(data) === reference.sha256, "ARTIFACT_HASH_MISMATCH");
      return parse(data);
    };
    const readArtifactHash = async reference => artifactHash(reference, await bytes(reference.path));
    const task = await pinned(request.task);
    schema(task, "context.task.v1", ["id", "owner", "workspace", "identity", "requiredCapabilities", "enforcement", "scope", "sourceSet",
      "classifications", "dependencies", "module", "memory", "memoryReview", "action", "newExampleIds", "candidateFiles", "allowLocalOverlay",
      ...(Object.hasOwn(task, "packageApproval") ? ["packageApproval"] : [])]);
    requireThat(id(task.id) && id(task.owner) && task.workspace === root && ref(task.identity) && scopes(task.scope) &&
      list(task.requiredCapabilities, id) && unique(task.requiredCapabilities) &&
      [task.sourceSet, task.classifications, task.dependencies].every(text) && ref(task.module) && ref(task.memoryReview) &&
      list(task.newExampleIds, id, false) && unique(task.newExampleIds) && list(task.candidateFiles, text) && unique(task.candidateFiles) &&
      typeof task.allowLocalOverlay === "boolean");
    if (Object.hasOwn(task, "packageApproval")) {
      requireThat(keys(task.packageApproval, ["plan", "approval"]) && text(task.packageApproval.plan) && text(task.packageApproval.approval), "PACKAGE_APPROVAL_INVALID");
      const planBytes = await bytes(task.packageApproval.plan), plan = parse(planBytes);
      schema(plan, "context.preparation-plan.v1", ["owner", "workspace", "semanticPackage", "inputFiles", "artifacts"]);
      const approval = await json(task.packageApproval.approval);
      schema(approval, "context.package-approval.v1", ["owner", "decision", "planSha256"]);
      requireThat(id(plan.owner) && plan.workspace === root && approval.owner === plan.owner && approval.decision === "approved" &&
        approval.planSha256 === sha256(planBytes), "PACKAGE_APPROVAL_MISMATCH");
      requireThat(list(plan.inputFiles, artifactRef) && list(plan.artifacts, ref) &&
        plan.artifacts.some(r => r.path === request.task.path && r.sha256 === request.task.sha256), "PACKAGE_TASK_MISMATCH");
      // This one explicit decision is provenance for all exact derived reviews.
      // No derived review is an additional independently made approval.
      for (const r of [...plan.inputFiles, ...plan.artifacts]) requireThat(await readArtifactHash(r) === r.sha256, "PACKAGE_INPUT_OR_ARTIFACT_CHANGED");
    }
    if (task.enforcement !== "reference" || !task.requiredCapabilities.includes(CAPABILITY) ||
        task.requiredCapabilities.some(c => c !== CAPABILITY)) throw new ContextError("CAPABILITY_NOT_ENFORCED", true);
    const identity = await bytes(task.identity.path);
    requireThat(sha256(identity) === task.identity.sha256, "WORKSPACE_IDENTITY_MISMATCH");
    const module = await pinned(task.module);
    schema(module, "context.module.v1", ["publicBoundary", "implementationFiles", "retainedExampleIds", "oracle", "verificationScript", "verificationCommand"]);
    requireThat(id(module.publicBoundary) && list(module.implementationFiles, text) && unique(module.implementationFiles) &&
      list(module.retainedExampleIds, id) && unique(module.retainedExampleIds) && ref(module.oracle) && ref(module.verificationScript));
    requireThat(module.implementationFiles.every(f => task.candidateFiles.includes(f)), "CANDIDATE_BOUNDARY_MISSING");
    commandShape(task.action);
    commandShape(module.verificationCommand);
    requireThat(keys(task.memory, ["publicBoundary", "items", "atomicInput"]) && task.memory.publicBoundary === module.publicBoundary,
      "PUBLIC_BOUNDARY_MISMATCH");

    const readPlan = async reference => {
      const plan = await pinned(reference);
      schema(plan, "context.integration-plan.v1", ["owner", "reviewRef", "sourceBindings", "artifacts"]);
      requireThat(plan.owner === "orchestrator" && ref(plan.reviewRef) && list(plan.artifacts, artifactRef));
      sourceBindings(plan.sourceBindings);
      const approval = await pinned(plan.reviewRef);
      schema(approval, "context.integration-review.v1", ["planSha256", "reviewer", "decision"]);
      // Exclude only the approval reference, avoiding a circular content hash.
      const { reviewRef, ...body } = plan;
      requireThat(approval.decision === "approved" && id(approval.reviewer) && approval.planSha256 === hash(body), "INTEGRATION_REVIEW_MISMATCH");
      return plan;
    };
    const readIntegration = async reference => {
      const receipt = await pinned(reference);
      schema(receipt, "context.integration.v1", ["plan", "sourceBindings", "artifacts"]);
      sourceBindings(receipt.sourceBindings);
      requireThat(list(receipt.artifacts, artifactRef) && ref(receipt.plan));
      const plan = await readPlan(receipt.plan);
      requireThat(hash(plan.sourceBindings) === hash(receipt.sourceBindings) && hash(plan.artifacts) === hash(receipt.artifacts), "INTEGRATION_PLAN_MISMATCH");
      for (const artifact of receipt.artifacts) {
        requireThat(await readArtifactHash(artifact) === artifact.sha256, "INTEGRATION_READBACK_MISMATCH");
      }
      return receipt;
    };
    const intake = async () => {
      const sourceSet = await json(task.sourceSet);
      schema(sourceSet, "context.sources.v1", ["sources"]);
      requireThat(list(sourceSet.sources, s => keys(s, ["id", "path", "scope", "kind"]) && id(s.id) && text(s.path) &&
        scopes(s.scope) && ["events", "return"].includes(s.kind)) && unique(sourceSet.sources.map(s => s.id)));
      const selected = sourceSet.sources.filter(s => intersects(s.scope, task.scope));
      if (!selected.length) throw new ContextError("SOURCE_COVERAGE_UNKNOWN", true);
      const inventory = [], ranges = [], bodies = new Map();
      for (const s of selected) {
        const data = await bytes(s.path);
        ranges.push({ sourceId: s.id, sha256: sha256(data) });
        let events;
        if (s.kind === "events") {
          const exported = parse(data);
          schema(exported, "context.events.v1", ["complete", "events"]);
          if (exported.complete !== true) throw new ContextError("SOURCE_COVERAGE_LIMITED", true);
          requireThat(list(exported.events, e => keys(e, ["id", "authorKind", "body"]) && id(e.id) &&
            ["human", "worker", "orchestrator", "artifact"].includes(e.authorKind) && text(e.body), false) &&
            unique(exported.events.map(e => e.id)), "SOURCE_EXPORT_INVALID");
          events = exported.events;
        } else {
          requireThat(typeof services.parseDurableOutboxComment === "function", "RETURN_ADAPTER_MISSING");
          const parsed = services.parseDurableOutboxComment(data.toString("utf8"));
          requireThat(parsed.returnCount === 1 && parsed.returns[0].valid && id(parsed.returns[0].id), "RETURN_SOURCE_INVALID");
          events = [{ id: parsed.returns[0].id, authorKind: "worker", body: data.toString("utf8") }];
        }
        for (const e of events) {
          inventory.push({ sourceId: s.id, eventId: e.id, sha256: hash(e), scope: s.scope });
          bodies.set(`${s.id}/${e.id}`, e.body);
        }
      }
      requireThat(inventory.length <= 1024, "SOURCE_RANGE_TOO_LARGE");
      const classifications = await json(task.classifications);
      schema(classifications, "context.classifications.v1", ["records"]);
      requireThat(list(classifications.records, object, false));
      const dispositions = [], meaning = [], classificationBindings = [], integrationReads = new Map();
      const relevantIds = new Set(selected.map(s => s.id));
      for (const c of classifications.records) {
        requireThat(keys(c, ["sourceId", "eventId", "sourceSha256", "eventDisposition", "assertions", "reason", "localOwner", "localTask", "review", "integration"]) &&
          id(c.sourceId) && id(c.eventId), "CLASSIFICATION_SCHEMA_INVALID");
        if (!relevantIds.has(c.sourceId)) continue;
        requireThat(digest(c.sourceSha256) && list(c.assertions, object, false) && text(c.reason) &&
          (c.localOwner === null || id(c.localOwner)) && (c.localTask === null || id(c.localTask)) &&
          (c.localOwner === null) === (c.localTask === null) && ref(c.review) && (c.integration === null || ref(c.integration)) &&
          ["assertions", "no_change", "evidence_only"].includes(c.eventDisposition) &&
          (c.eventDisposition === "assertions" ? c.assertions.length > 0 : c.assertions.length === 0), "CLASSIFICATION_SCHEMA_INVALID");
        const original = bodies.get(`${c.sourceId}/${c.eventId}`);
        requireThat(original !== undefined, "UNKNOWN_SOURCE_DISPOSITION");
        const assertions = c.assertions.map(a => {
          requireThat(keys(a, ["id", "disposition", "scope", "targetRef", "reason", "supersededBy", "ownerGate", "trigger", "sourceRange"]), "CLASSIFICATION_SCHEMA_INVALID");
          const { sourceRange, ...assertion } = a;
          requireThat(keys(sourceRange, ["start", "end", "sha256"]) && Number.isInteger(sourceRange.start) &&
            Number.isInteger(sourceRange.end) && sourceRange.start >= 0 && sourceRange.end > sourceRange.start &&
            sourceRange.end <= Buffer.byteLength(original) && digest(sourceRange.sha256), "SOURCE_ASSERTION_RANGE_INVALID");
          requireThat(sha256(Buffer.from(original).subarray(sourceRange.start, sourceRange.end)) === sourceRange.sha256, "SOURCE_ASSERTION_RANGE_MISMATCH");
          return assertion;
        });
        const classificationBody = { sourceId: c.sourceId, eventId: c.eventId, sourceSha256: c.sourceSha256,
          eventDisposition: c.eventDisposition, assertions: c.assertions, reason: c.reason, localOwner: c.localOwner, localTask: c.localTask };
        const review = await pinned(c.review);
        schema(review, "context.source-review.v1", ["classificationSha256", "reviewer", "decision"]);
        requireThat(review.classificationSha256 === hash(classificationBody) && id(review.reviewer) && review.decision === "approved", "SOURCE_REVIEW_MISMATCH");
        const binding = { sourceId: c.sourceId, eventId: c.eventId, sha256: c.sourceSha256,
          classificationSha256: hash(classificationBody), reviewSha256: c.review.sha256 };
        classificationBindings.push(binding);
        let integrated = c.eventDisposition !== "assertions";
        if (c.integration && request.operation !== "integrate") {
          const key = hash(c.integration);
          if (!integrationReads.has(key)) integrationReads.set(key, await readIntegration(c.integration));
          const receipt = integrationReads.get(key);
          integrated = receipt.sourceBindings.some(b => hash(b) === hash(binding));
          requireThat(integrated, "INTEGRATION_SOURCE_MISMATCH");
        }
        dispositions.push({ sourceId: c.sourceId, eventId: c.eventId, sourceSha256: c.sourceSha256, reviewRef: c.review.sha256,
          integrated, localOwner: c.localOwner, localTask: c.localTask, assertions, reason: c.reason });
        meaning.push(classificationBody);
      }
      const registry = await json(task.dependencies);
      schema(registry, "context.dependencies.v1", ["dependencies"]);
      requireThat(list(registry.dependencies, d => keys(d, ["id", "path", "scope"]) && id(d.id) && text(d.path) && scopes(d.scope), false) &&
        unique(registry.dependencies.map(d => d.id)));
      const dependencies = [];
      for (const d of registry.dependencies.filter(d => intersects(d.scope, task.scope))) dependencies.push({ ...d, sha256: sha256(await bytes(d.path)) });
      stats.sourceEvents = inventory.length;
      const sort = array => [...array].sort((a, b) => canonicalJson(a) < canonicalJson(b) ? -1 : canonicalJson(a) > canonicalJson(b) ? 1 : 0);
      return { inventory, ranges, dispositions, classificationBindings,
        sourceBodies: inventory.map(s => ({ sourceId: s.sourceId, eventId: s.eventId, sha256: s.sha256,
          bodySha256: sha256(bodies.get(`${s.sourceId}/${s.eventId}`)) })),
        sourceDigest: hash({ events: sort(inventory), ranges: sort(ranges) }), meaningDigest: hash(sort(meaning)),
        dependencyDigest: hash({ sources: sort(selected), dependencies: sort(dependencies) }) };
    };
    const snapshot = await intake();
    const classifiedPrefixes = [];
    for (const sourceId of new Set(snapshot.inventory.map(s => s.sourceId))) {
      const prefix = [];
      for (const s of snapshot.inventory.filter(s => s.sourceId === sourceId)) {
        if (!snapshot.dispositions.some(d => d.sourceId === s.sourceId && d.eventId === s.eventId && d.sourceSha256 === s.sha256 && d.integrated)) break;
        prefix.push(s.eventId);
      }
      classifiedPrefixes.push({ sourceId, eventIds: prefix });
    }
    sourceReceipt = { schema: "context.intake.v1", observed: snapshot.inventory, ranges: snapshot.ranges, classifiedPrefixes,
      sourceDigest: snapshot.sourceDigest, coverage: "declared-file-snapshots", liveHistory: "UNKNOWN" };
    const prepared = { scope: task.scope, taskId: task.id, owner: task.owner, allowLocalOverlay: task.allowLocalOverlay,
      items: task.memory.items, envelope: null, atomicRender: "" };
    const gate = (phase, content = prepared, snap = snapshot) => {
      const result = checkPreparedContext({ inventory: snap.inventory, dispositions: snap.dispositions, prepared: content, phase });
      requireThat(result.status === "READY", result.code, result.ref);
      return result;
    };
    if (request.operation === "integrate") {
      requireThat(request.integrationPlan !== null && request.capsule === null && request.readback === null, "INTEGRATION_PLAN_MISSING");
      // Integration has no worker action and may read back pending reviewed classifications.
      gate("prepare", { ...prepared, allowLocalOverlay: true }, { ...snapshot,
        dispositions: snapshot.dispositions.map(d => ({ ...d, integrated: true })) });
      const plan = await readPlan(request.integrationPlan);
      requireThat(plan.sourceBindings.length > 0 && plan.sourceBindings.every(b => snapshot.classificationBindings.some(s =>
        hash(s) === hash(b))), "INTEGRATION_SOURCE_MISMATCH");
      for (const artifact of plan.artifacts) requireThat(await readArtifactHash(artifact) === artifact.sha256, "INTEGRATION_READBACK_MISMATCH");
      return { status: "VERIFIED", operation: "integrate", enforcement: "reference", receipt: {
        schema: "context.integration.v1", plan: request.integrationPlan, sourceBindings: plan.sourceBindings, artifacts: plan.artifacts }, sourceReceipt, stats };
    }
    gate("prepare");
    let envelope = null, atomicRender = "", capsule;
    const advisoryRender = () => task.memory.items.map(i => `<!-- context:item ${i.id} -->\n${i.text}\n<!-- context:item:end -->`).join("\n\n");
    if (request.operation === "prepare") {
      requireThat(request.capsule === null && request.readback === null && request.integrationPlan === null);
      if (task.memory.atomicInput !== null) {
        ({ envelope, atomicRender } = compileExecutableBrief(task.memory.atomicInput));
        stats.compiles++;
      }
      const render = [atomicRender, advisoryRender()].filter(Boolean).join("\n\n");
      capsule = { schema: "context.capsule.v1", taskSha256: request.task.sha256, owner: task.owner, scope: task.scope,
        sourceDigest: snapshot.sourceDigest, meaningDigest: snapshot.meaningDigest, dependencyDigest: snapshot.dependencyDigest,
        envelope, atomicRender, render, contentDigest: sha256(render) };
    } else {
      requireThat(request.capsule !== null && request.integrationPlan === null, "CAPSULE_MISSING");
      capsule = await pinned(request.capsule);
      schema(capsule, "context.capsule.v1", ["taskSha256", "owner", "scope", "sourceDigest", "meaningDigest", "dependencyDigest", "envelope", "atomicRender", "render", "contentDigest"]);
      requireThat(capsule.taskSha256 === request.task.sha256 && capsule.owner === task.owner && hash(capsule.scope) === hash(task.scope), "CAPSULE_TASK_MISMATCH");
      requireThat(capsule.sourceDigest === snapshot.sourceDigest && capsule.meaningDigest === snapshot.meaningDigest &&
        capsule.dependencyDigest === snapshot.dependencyDigest, "RELEVANT_CONTEXT_CHANGED");
      ({ envelope, atomicRender } = capsule);
      requireThat(capsule.render === [atomicRender, advisoryRender()].filter(Boolean).join("\n\n") &&
        capsule.contentDigest === sha256(capsule.render), "RENDER_BINDING_MISMATCH");
    }
    const bound = gate("bind", { ...prepared, envelope, atomicRender });
    const review = await pinned(task.memoryReview);
    schema(review, "context.memory-review.v1", ["reviewer", "decision", "sourceDigest", "meaningDigest", "contentDigest", "publicBoundary"]);
    requireThat(id(review.reviewer) && review.decision === "approved" && review.sourceDigest === snapshot.sourceDigest &&
      review.meaningDigest === snapshot.meaningDigest && review.contentDigest === capsule.contentDigest &&
      review.publicBoundary === module.publicBoundary, "MEMORY_REVIEW_MISMATCH");
    const recheck = async () => {
      requireThat(sha256(await bytes(request.task.path)) === request.task.sha256 &&
        sha256(await bytes(task.identity.path)) === task.identity.sha256, "TASK_CHANGED_BEFORE_ACTION");
      const latest = await intake();
      requireThat(latest.sourceDigest === snapshot.sourceDigest && latest.meaningDigest === snapshot.meaningDigest &&
        latest.dependencyDigest === snapshot.dependencyDigest, "CONTEXT_CHANGED_BEFORE_ACTION");
      gate("bind", { ...prepared, envelope, atomicRender }, latest);
    };
    await recheck();
    const basis = { sourceDigest: snapshot.sourceDigest, dependencyDigest: snapshot.dependencyDigest,
      unknownHistory: "outside declared exports", requiredAssertionIds: bound.requiredAssertionIds };
    if (request.operation === "prepare") return { status: "PREPARED", operation: "prepare", enforcement: "reference", coverageBasis: basis, capsule, sourceReceipt, stats };
    requireThat(request.readback !== null, "WORKER_READBACK_REQUIRED");
    const readback = await pinned(request.readback);
    schema(readback, "context.readback.v1", ["worker", "taskSha256", "capsuleSha256", "capability", "evidenceRef"]);
    requireThat(readback.worker === task.owner && readback.taskSha256 === request.task.sha256 &&
      readback.capsuleSha256 === request.capsule.sha256 && readback.capability === CAPABILITY && ref(readback.evidenceRef), "WORKER_READBACK_MISMATCH");
    requireThat(sha256(await bytes(readback.evidenceRef.path)) === readback.evidenceRef.sha256, "ARTIFACT_HASH_MISMATCH");
    if (request.operation === "preflight") return { status: "READY", operation: "preflight", enforcement: "reference",
      coverageBasis: basis, sourceReceipt, classificationBindings: snapshot.classificationBindings, sourceBodies: snapshot.sourceBodies,
      action: { ...task.action, cwd: await resolvePath(task.action.cwd, true) }, stats };
    if (request.operation === "resume") {
      const result = await command(task.action, root, resolvePath, stats);
      return { status: "ACTION_COMPLETED", operation: "resume", enforcement: "reference", coverageBasis: basis,
        action: { commandSha256: result.commandSha256, stdoutSha256: result.stdoutSha256, exitCode: result.exitCode,
          executable: result.executable, cwd: result.cwd }, sourceReceipt, stats };
    }
    const candidateIdentity = async () => {
      const files = [];
      for (const f of [...task.candidateFiles].sort()) files.push({ path: f, sha256: sha256(await bytes(f)) });
      return { kind: "declared-files", workspace: root, files, sha256: hash({ workspace: root, files }) };
    };
    const oracle = await pinned(module.oracle);
    schema(oracle, "context.oracle.v1", ["examples"]);
    requireThat(list(oracle.examples, e => keys(e, ["id", "sourceAssertionRefs", "input", "expected"]) && id(e.id) &&
      list(e.sourceAssertionRefs, id)) && unique(oracle.examples.map(e => e.id)), "ORACLE_SCHEMA_INVALID");
    const requiredExamples = [...new Set([...module.retainedExampleIds, ...task.newExampleIds])];
    requireThat(requiredExamples.every(e => oracle.examples.some(o => o.id === e)), "REQUIRED_EXAMPLE_MISSING");
    const knownAssertions = new Set(snapshot.dispositions.flatMap(d => d.assertions.map(a => a.id)));
    requireThat(oracle.examples.filter(e => requiredExamples.includes(e.id)).every(e => e.sourceAssertionRefs.every(r => knownAssertions.has(r))), "VERIFICATION_SOURCE_MISSING");
    const before = await candidateIdentity();
    requireThat(sha256(await bytes(module.verificationScript.path)) === module.verificationScript.sha256, "VERIFICATION_SCRIPT_MISMATCH");
    const spec = module.verificationCommand;
    requireThat(object(spec) && Array.isArray(spec.args) && text(spec.args[0]) && text(spec.cwd) &&
      path.resolve(root, spec.cwd, spec.args[0]) === await resolvePath(module.verificationScript.path), "VERIFICATION_COMMAND_MISMATCH");
    const result = await command(spec, root, resolvePath, stats, { VYDYKHAI_CANDIDATE_SHA256: before.sha256,
      VYDYKHAI_ORACLE_SHA256: module.oracle.sha256, VYDYKHAI_REQUIRED_EXAMPLES: JSON.stringify(requiredExamples) }, "verification");
    requireThat((await candidateIdentity()).sha256 === before.sha256, "CANDIDATE_CHANGED_DURING_VERIFICATION");
    requireThat(sha256(await bytes(module.oracle.path)) === module.oracle.sha256 &&
      sha256(await bytes(module.verificationScript.path)) === module.verificationScript.sha256, "VERIFICATION_INPUT_CHANGED");
    const observations = parse(result.stdout);
    schema(observations, "context.observations.v1", ["candidateSha256", "oracleSha256", "observations"]);
    requireThat(observations.candidateSha256 === before.sha256 && observations.oracleSha256 === module.oracle.sha256,
      "CANDIDATE_EVIDENCE_BINDING_MISMATCH");
    requireThat(list(observations.observations, o => keys(o, ["id", "observed"]) && id(o.id), false) &&
      unique(observations.observations.map(o => o.id)), "OBSERVATIONS_SCHEMA_INVALID");
    requireThat(observations.observations.length === requiredExamples.length &&
      requiredExamples.every(e => observations.observations.some(o => o.id === e)), "BEHAVIOR_EVIDENCE_MISSING");
    for (const observed of observations.observations) requireThat(hash(observed.observed) ===
      hash(oracle.examples.find(e => e.id === observed.id).expected), "BEHAVIOR_MISMATCH", observed.id);
    requireThat(typeof services.createReturnSync === "function", "RETURN_ADAPTER_MISSING");
    const pendingIntegrationSources = snapshot.dispositions.filter(d => !d.integrated).map(d => ({ sourceId: d.sourceId, eventId: d.eventId, sha256: d.sourceSha256 }));
    const receipt = { schema: "context.verification.v1", taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
      candidate: before, oracle: module.oracle, script: module.verificationScript, commandSha256: result.commandSha256,
      execution: { executable: result.executable, cwd: result.cwd, exitCode: result.exitCode, stdoutSha256: result.stdoutSha256 },
      observations: observations.observations, pendingIntegrationSources, productAcceptance: "NOT_ESTABLISHED" };
    const returnSync = services.createReturnSync({ status: "CHECKPOINT_READY", returnReceiptId: `context-${hash(receipt).slice(0, 24)}`,
      taskContextArtifact: `${task.id} / candidate ${before.sha256}`, memoryCandidates: pendingIntegrationSources.length
        ? `Pending source deltas: ${pendingIntegrationSources.map(s => `${s.sourceId}/${s.eventId}`).join(", ")}; inspect pinned task/capsule and verification receipt`
        : "NO_MEMORY_DELTA; no pending source integration in the declared snapshot",
      artifactDisposition: "Candidate retained for independent review", recommendedNextAction: `Review verification receipt ${hash(receipt)} and shared meaning` });
    return { status: "VERIFIED", operation: "accept", enforcement: "reference", coverageBasis: basis, receipt, returnSync, sourceReceipt, stats };
  } catch (error) {
    return { status: error instanceof ContextError && error.limited ? "LIMITED" : "BLOCKED",
      code: error instanceof ContextError ? error.code : "CONTEXT_IO_OR_INPUT_INVALID",
      reference: error instanceof ContextError && /^[A-Za-z0-9_.:/-]{1,256}$/.test(error.reference || "") ? error.reference : null,
      actionOutcome: stats.dependentCommands ? "OUTCOME_UNKNOWN" : "NOT_INVOKED",
      replayRequiresReconciliation: stats.dependentCommands > 0, enforcement: "reference", sourceReceipt, stats };
  }
}

export async function runContextFile(inputPath, services) {
  try { return await runContextTransition(parse(await boundedRead(inputPath)), services); }
  catch (error) { return { status: "BLOCKED", code: error instanceof ContextError ? error.code : "REQUEST_READ_FAILED", enforcement: "reference", stats: { commands: 0 } }; }
}

export { parse as parseContextJson };
