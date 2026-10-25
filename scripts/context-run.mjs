import { constants } from "node:fs";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { canonicalJson, sha256, compileExecutableBrief, checkPreparedContext } from "./memory-brief.mjs";
import { moduleAccessPolicy, moduleExampleIds } from "./module-access.mjs";
import { prepareAlignment } from "./context-alignment.mjs";

const CAPABILITY = "retained-progress-v1";
const MAX_BYTES = 2 * 1024 * 1024;
const COMMAND_STOP_GRACE_MS = 250;
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
const commandFailures = new WeakMap();
const commandSuccesses = new WeakMap();
const commandEnvironments = new WeakMap();
export const readCommandFailure = error => commandFailures.has(error) ? structuredClone(commandFailures.get(error)) : null;
export const readCommandSuccess = result => commandSuccesses.has(result) ? structuredClone(commandSuccesses.get(result)) : null;
export function bindCommandEnvironment(observation, result) {
  const closed = readCommandSuccess(result);
  requireThat(closed?.environment && observation.outcome === "COMPLETED" &&
    observation.resultSha256 === hash({exitCode: closed.exitCode, commandSha256: closed.commandSha256,
      stdoutSha256: closed.stdoutSha256, executable: closed.executable, cwd: closed.cwd}) &&
    !commandEnvironments.has(observation), "COMMAND_ENVIRONMENT_UNBOUND");
  commandEnvironments.set(observation, {environment: closed.environment, process: closed.process});
}
export const readCommandEnvironment = observation => commandEnvironments.has(observation)
  ? structuredClone(commandEnvironments.get(observation)) : null;
const requireThat = (condition, code = "CONTEXT_SCHEMA_INVALID", reference = null) => { if (!condition) throw new ContextError(code, false, reference); };

export function artifactBytes(reference, data) {
  requireThat(artifactRef(reference), "ARTIFACT_REF_INVALID");
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data);
  if (ref(reference)) return bytes;
  const first = Buffer.from(reference.startMarker), last = Buffer.from(reference.endMarker);
  const start = bytes.indexOf(first), end = bytes.indexOf(last);
  requireThat(start >= 0 && end > start && start === bytes.lastIndexOf(first) &&
    end === bytes.lastIndexOf(last), "ARTIFACT_SELECTOR_INVALID");
  return bytes.subarray(start, end + last.length);
}
export const artifactHash = (reference, data) => sha256(artifactBytes(reference, data));

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
export function checkExampleOracle(oracle, requiredExamples, knownAssertions) {
  schema(oracle, "context.oracle.v1", ["examples"]);
  requireThat(list(oracle.examples, e => keys(e, ["id", "sourceAssertionRefs", "input", "expected"]) && id(e.id) &&
    list(e.sourceAssertionRefs, id)) && unique(oracle.examples.map(e => e.id)), "ORACLE_SCHEMA_INVALID");
  requireThat(requiredExamples.every(e => oracle.examples.some(o => o.id === e)), "REQUIRED_EXAMPLE_MISSING");
  requireThat(oracle.examples.filter(e => requiredExamples.includes(e.id)).every(e =>
    e.sourceAssertionRefs.every(r => knownAssertions.has(r))), "VERIFICATION_SOURCE_MISSING");
}
function sourceBindings(value) {
  requireThat(list(value, b => keys(b, ["sourceId", "eventId", "sha256", "classificationSha256", "reviewSha256"]) &&
    id(b.sourceId) && id(b.eventId) && digest(b.sha256) && digest(b.classificationSha256) && digest(b.reviewSha256), false));
  requireThat(unique(value.map(b => `${b.sourceId}/${b.eventId}`)), "DUPLICATE_SOURCE");
}

const COMMAND_TIMEOUT_MAX_MS = 60000;
const CONTROLLED_ACTION_TIMEOUT_MAX_MS = 600000;
function commandShape(spec, timeoutMaxMs = COMMAND_TIMEOUT_MAX_MS) {
  requireThat(keys(spec, ["executable", "args", "cwd", "timeoutMs", "maxOutputBytes"]) &&
    path.isAbsolute(spec.executable || "") && list(spec.args, v => typeof v === "string", false) &&
    text(spec.cwd) && Number.isInteger(spec.timeoutMs) && spec.timeoutMs > 0 && spec.timeoutMs <= timeoutMaxMs &&
    Number.isInteger(spec.maxOutputBytes) && spec.maxOutputBytes > 0 && spec.maxOutputBytes <= MAX_BYTES,
  "COMMAND_SCHEMA_INVALID");
  requireThat(!/^(?:sh|bash|zsh|fish|csh|dash|cmd(?:\.exe)?|powershell(?:\.exe)?|pwsh(?:\.exe)?)$/i.test(path.basename(spec.executable)), "SHELL_COMMAND_UNSUPPORTED");
}
async function command(spec, root, readPath, stats, extraEnv = {}, kind = "dependent", admission = null) {
  const controlledAction = typeof admission?.dispatch === "function" &&
    admission.binding.operation === "resume" && kind === "dependent";
  commandShape(spec, controlledAction ? CONTROLLED_ACTION_TIMEOUT_MAX_MS : COMMAND_TIMEOUT_MAX_MS);
  const cwd = await readPath(spec.cwd, true);
  const executable = await realpath(spec.executable);
  requireThat((await lstat(executable)).isFile(), "COMMAND_EXECUTABLE_INVALID");
  await access(executable, constants.X_OK);
  // A minimal environment avoids forwarding host credentials to reference commands.
  const env = { ...extraEnv };
  for (const k of ["PATH", "SystemRoot", "TMPDIR", "TEMP"]) if (process.env[k]) env[k] = process.env[k];
  const invoke = async () => {
    if (admission) await admission.recheck();
    // Check again after admission: a grant is not a lock on the local environment.
    requireThat(await readPath(spec.cwd, true) === cwd && await realpath(spec.executable) === executable,
      "COMMAND_ENVIRONMENT_CHANGED");
    requireThat((await lstat(executable)).isFile(), "COMMAND_EXECUTABLE_INVALID");
    await access(executable, constants.X_OK);
    const environment = {schema: "context.command-environment.v1", checkedAt: new Date().toISOString(),
      scope: "LOCAL_PROCESS_LAUNCH_ONLY", workspace: root, cwd, executable, commandSha256: hash(spec),
      checks: ["WORKSPACE_CWD_RESOLVED", "EXECUTABLE_FILE_RESOLVED", "EXECUTABLE_PERMISSION"],
      contextBindings: admission ? "RECHECKED_BEFORE_EXECUTION" : "UNCONTROLLED",
      hostIdentity: "NOT_ESTABLISHED", remotePermissions: "NOT_OBSERVED"};
    const readSandboxLaunch=admission?.binding.confined ?
      (await import("./local-control-sandbox.mjs")).readSandboxLaunch : null;
    return new Promise((resolve, reject) => {
      let stdout = Buffer.alloc(0), stdoutBytes = 0, stderrBytes = 0, failure = null, settled = false;
      let timer, teardownTimer;
      const stdoutHash = createHash("sha256"), stderrHash = createHash("sha256");
      const launchId = randomUUID(), startedAt = new Date().toISOString();
      const launch = admission?.launch ? admission.launch({executable, args: [...spec.args], cwd}) : {executable, args: spec.args};
      const confined = readSandboxLaunch ? readSandboxLaunch(launch) : null;
      if(admission?.binding.confined)requireThat(confined?.workspace === root &&
        hash(confined.writeFiles) === hash(admission.binding.confined.writeFiles) &&
        hash(confined.command) === hash({executable,args:[...spec.args],cwd}),"COMMAND_CONFINEMENT_REQUIRED");
      stats.commands++;
      stats[`${kind}Commands`]++;
      const child = spawn(launch.executable, launch.args, { cwd, env, shell: false, windowsHide: true,
        detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      const stop = code => {
        if (failure || settled) return;
        failure = code;
        teardownTimer = setTimeout(() => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          // Local pipe teardown is not a close/process-tree observation. No closed failure receipt is minted.
          child.stdout.destroy(); child.stderr.destroy(); child.unref();
          reject(new ContextError(failure));
        }, COMMAND_STOP_GRACE_MS);
        if (child.pid) {
          try { process.platform === "win32" ? child.kill("SIGKILL") : process.kill(-child.pid, "SIGKILL"); } catch { /* termination unproven */ }
        }
      };
      timer = setTimeout(() => stop("COMMAND_TIMEOUT"), spec.timeoutMs);
      child.stdout.on("data", chunk => {
        if (settled) return;
        stdoutBytes += chunk.length; stdoutHash.update(chunk);
        if (stdoutBytes + stderrBytes > spec.maxOutputBytes) stop("COMMAND_OUTPUT_LIMIT");
        else stdout = Buffer.concat([stdout, chunk]);
      });
      child.stderr.on("data", chunk => {
        if (settled) return;
        stderrBytes += chunk.length; stderrHash.update(chunk);
        if (stdoutBytes + stderrBytes > spec.maxOutputBytes) stop("COMMAND_OUTPUT_LIMIT");
      });
      child.on("error", () => stop("COMMAND_START_FAILED"));
      child.on("close", (code, signal) => {
        if (settled) return;
        settled = true; clearTimeout(timer); clearTimeout(teardownTimer);
        if (failure || code !== 0) {
          const reason = failure || (signal ? "COMMAND_SIGNALLED" : "COMMAND_FAILED");
          const error = new ContextError(reason);
          // Protected metadata only: public error/result paths never include output or launch arguments.
          commandFailures.set(error, {exitCode: code, signal, reason, commandSha256: hash(spec), cwd, executable,
            process: {launchId, pid: child.pid ?? null, groupId: process.platform === "win32" ? null : child.pid ?? null,
              startedAt, closedAt: new Date().toISOString(), launchExecutable: launch.executable,
              launchArgsSha256: hash(launch.args)},
            stdoutSha256: stdoutHash.digest("hex"), stderrSha256: stderrHash.digest("hex"), stdoutBytes, stderrBytes});
          reject(error);
        }
        else {
          const result={stdout,stdoutSha256:sha256(stdout),exitCode:code,commandSha256:hash(spec),cwd,executable,environment};
          commandSuccesses.set(result,{exitCode:code,signal,commandSha256:hash(spec),cwd,executable,
            environment,
            process:{launchId,pid:child.pid??null,groupId:process.platform==="win32"?null:child.pid??null,
              startedAt,closedAt:new Date().toISOString(),launchExecutable:launch.executable,launchArgsSha256:hash(launch.args)},
            stdoutSha256:stdoutHash.digest("hex"),stderrSha256:stderrHash.digest("hex"),stdoutBytes,stderrBytes,
            ...(confined?{confinement:{workspace:confined.workspace,writeFiles:confined.writeFiles,policySha256:sha256(confined.policy)}}:{})});
          resolve(result);
        }
      });
    });
  };
  return admission ? admission.dispatch({...admission.binding, commandSha256: hash(spec),
    cwd, executable, kind}, invoke) : invoke();
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
    let alignmentCoverage = "LEGACY_UNCHECKED";
    let packetBinding = null;
    const checkPackageApproval = async () => {
      if (!Object.hasOwn(task, "packageApproval")) return;
      requireThat(keys(task.packageApproval, ["plan", "approval"]) && text(task.packageApproval.plan) && text(task.packageApproval.approval), "PACKAGE_APPROVAL_INVALID");
      const planBytes = await bytes(task.packageApproval.plan), plan = parse(planBytes);
      schema(plan, "context.preparation-plan.v1", ["owner", "workspace", "semanticPackage", "inputFiles", "artifacts"]);
      try {
        await bytes(`${task.packageApproval.plan}.superseded.json`);
        throw new ContextError("PACKAGE_SUPERSEDED");
      } catch (e) { if (e.code !== "ENOENT") throw e; }
      const previous = plan.semanticPackage?.navigation?.assignment?.previous;
      if (previous && ["preflight", "resume", "accept"].includes(request.operation)) {
        requireThat(ref(previous.plan), "PREPARATION_PARENT_INVALID");
        const marker = await json(`${previous.plan.path}.superseded.json`);
        requireThat(marker.schema === "context.supersession.v1" && ref(marker.successorPlan) &&
          marker.successorPlan.path === task.packageApproval.plan && marker.successorPlan.sha256 === sha256(planBytes), "PREPARATION_PARENT_SUPERSEDED");
      }
      const approval = await json(task.packageApproval.approval);
      schema(approval, "context.package-approval.v1", ["owner", "decision", "planSha256"]);
      requireThat(id(plan.owner) && plan.workspace === root && approval.owner === plan.owner && approval.decision === "approved" &&
        approval.planSha256 === sha256(planBytes), "PACKAGE_APPROVAL_MISMATCH");
      packetBinding={plan:{path:task.packageApproval.plan,sha256:sha256(planBytes)},
        approval:{path:task.packageApproval.approval,sha256:sha256(await bytes(task.packageApproval.approval))},
        moduleAccess:plan.semanticPackage?.moduleAccess};
      requireThat(list(plan.inputFiles, artifactRef) && list(plan.artifacts, ref) &&
        plan.artifacts.some(r => r.path === request.task.path && r.sha256 === request.task.sha256), "PACKAGE_TASK_MISMATCH");
      // This one explicit decision is provenance for all exact derived reviews.
      // No derived review is an additional independently made approval.
      for (const r of [...plan.inputFiles, ...plan.artifacts]) requireThat(await readArtifactHash(r) === r.sha256, "PACKAGE_INPUT_OR_ARTIFACT_CHANGED");
      if (plan.semanticPackage?.schema === "context.package.v3") {
        const artifact = name => {
          const r = plan.artifacts.find(r => r.path === `${path.posix.dirname(request.task.path)}/${name}.json`);
          requireThat(r, "ALIGNMENT_REQUIRED"); return pinned(r);
        };
        const navigation = await artifact("navigation"), alignment = await artifact("alignment");
        let checked;
        try { checked = await prepareAlignment(plan.semanticPackage, navigation, bytes, parse); }
        catch (e) { throw new ContextError(/^ALIGNMENT_[A-Z_]+$/.test(e.message) ? e.message : "ALIGNMENT_INVALID"); }
        requireThat(hash(alignment) === hash(checked), "ALIGNMENT_CHANGED");
        alignmentCoverage = checked.coverage;
      }
    };
    await checkPackageApproval();
    if (task.enforcement !== "reference" || !task.requiredCapabilities.includes(CAPABILITY) ||
        task.requiredCapabilities.some(c => c !== CAPABILITY)) throw new ContextError("CAPABILITY_NOT_ENFORCED", true);
    const identity = await bytes(task.identity.path);
    requireThat(sha256(identity) === task.identity.sha256, "WORKSPACE_IDENTITY_MISMATCH");
    const module = await pinned(task.module);
    schema(module, "context.module.v1", ["publicBoundary", "implementationFiles", "retainedExampleIds", "oracle", "verificationScript", "verificationCommand",
      ...(Object.hasOwn(module, "access") ? ["access"] : [])]);
    requireThat(id(module.publicBoundary) && list(module.implementationFiles, text) && unique(module.implementationFiles) &&
      ref(module.oracle) && ref(module.verificationScript));
    requireThat(module.implementationFiles.every(f => task.candidateFiles.includes(f)), "CANDIDATE_BOUNDARY_MISSING");
    const checkModuleAccess = async () => {
      if (!Object.hasOwn(module, "access")) return;
      let policy;
      try {
        policy = moduleAccessPolicy(module.access, module.publicBoundary, task.candidateFiles);
        module.implementationFiles.forEach(policy.assertMutation);
      } catch (e) { throw new ContextError(/^(?:MODULE|CONSUMED_MODULE)_[A-Z_]+$/.test(e.message) ? e.message : "MODULE_ACCESS_INVALID"); }
      for (const r of policy.immutable) requireThat(sha256(await bytes(r.path)) === r.sha256, "MODULE_RELEASE_CHANGED");
      return policy;
    };
    const accessPolicy = await checkModuleAccess();
    let requiredExamples;
    try { requiredExamples = moduleExampleIds(module.retainedExampleIds, task.newExampleIds, accessPolicy?.targetIntent); }
    catch (e) { throw new ContextError(e.message === "MODULE_EXAMPLES_INVALID" ? e.message : "CONTEXT_SCHEMA_INVALID"); }
    // A longer declaration is not admission; actual dispatch enforces its route's bound.
    commandShape(task.action, CONTROLLED_ACTION_TIMEOUT_MAX_MS);
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
    const knownAssertions = new Set(snapshot.dispositions.flatMap(d => d.assertions.map(a => a.id)));
    if (module.retainedExampleIds.length === 0) checkExampleOracle(await pinned(module.oracle), requiredExamples, knownAssertions);
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
    const recheck = async (phase = "BEFORE_ACTION", references = []) => {
      await checkModuleAccess();
      requireThat(sha256(await bytes(request.task.path)) === request.task.sha256 &&
        sha256(await bytes(task.identity.path)) === task.identity.sha256, `TASK_CHANGED_${phase}`);
      const latest = await intake();
      requireThat(latest.sourceDigest === snapshot.sourceDigest && latest.meaningDigest === snapshot.meaningDigest &&
        latest.dependencyDigest === snapshot.dependencyDigest, `CONTEXT_CHANGED_${phase}`);
      gate("bind", { ...prepared, envelope, atomicRender }, latest);
      for (const reference of references) requireThat(sha256(await bytes(reference.path)) === reference.sha256, "ARTIFACT_HASH_MISMATCH");
      if (phase !== "BEFORE_ACTION") await checkPackageApproval();
    };
    await recheck();
    const basis = { sourceDigest: snapshot.sourceDigest, dependencyDigest: snapshot.dependencyDigest,
      unknownHistory: "outside declared exports", requiredAssertionIds: bound.requiredAssertionIds,
      moduleAccess: Object.hasOwn(module, "access") ? "DECLARED_BOUNDARIES" : "LEGACY_UNCHECKED",
      alignment: alignmentCoverage,
      processIsolation: "NOT_ENFORCED", replayProtection: "CALLER_OWNED" };
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
      const confined=services.confinedCommand;
      if(confined!==undefined) {
        requireThat(services.dispatch && keys(confined,["schema","writeFiles","module","plan","approval"]) &&
          confined.schema==="control.confined-command.v1" && Array.isArray(confined.writeFiles) && confined.writeFiles.length===1 &&
          task.candidateFiles.includes(confined.writeFiles[0]) && packetBinding?.moduleAccess && module.access &&
          hash(packetBinding.moduleAccess)===hash(module.access) && hash(confined.module)===hash(task.module) &&
          hash(confined.plan)===hash(packetBinding.plan) && hash(confined.approval)===hash(packetBinding.approval),"COMMAND_RIGHTS_REQUIRED");
        moduleAccessPolicy(module.access,module.publicBoundary,task.candidateFiles).assertMutation(confined.writeFiles[0]);
      }
      const admission = services.dispatch ? {dispatch: services.dispatch, launch: services.sandboxLaunch,
        binding: {operation: request.operation, taskId: task.id, taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
          sourceDigest: snapshot.sourceDigest, dependencyDigest: snapshot.dependencyDigest,...(confined?{confined:structuredClone(confined)}:{})},
        recheck: () => recheck("BEFORE_ACTION", [task.module, task.memoryReview, request.capsule, request.readback, readback.evidenceRef])} : null;
      const result = await command(task.action, root, resolvePath, stats, {}, "dependent", admission);
      await recheck("DURING_ACTION", [task.module, task.memoryReview, request.capsule, request.readback, readback.evidenceRef]);
      return { status: "ACTION_COMPLETED", operation: "resume", enforcement: "reference", coverageBasis: basis,
        environment: result.environment,
        action: { commandSha256: result.commandSha256, stdoutSha256: result.stdoutSha256, exitCode: result.exitCode,
          executable: result.executable, cwd: result.cwd }, sourceReceipt, stats };
    }
    const candidateIdentity = async () => {
      const files = [];
      for (const f of [...task.candidateFiles].sort()) files.push({ path: f, sha256: sha256(await bytes(f)) });
      return { kind: "declared-files", workspace: root, files, sha256: hash({ workspace: root, files }) };
    };
    const oracle = await pinned(module.oracle);
    checkExampleOracle(oracle, requiredExamples, knownAssertions);
    const before = await candidateIdentity();
    requireThat(sha256(await bytes(module.verificationScript.path)) === module.verificationScript.sha256, "VERIFICATION_SCRIPT_MISMATCH");
    const spec = module.verificationCommand;
    requireThat(object(spec) && Array.isArray(spec.args) && text(spec.args[0]) && text(spec.cwd) &&
      path.resolve(root, spec.cwd, spec.args[0]) === await resolvePath(module.verificationScript.path), "VERIFICATION_COMMAND_MISMATCH");
    const admission = services.dispatch ? {dispatch: services.dispatch, launch: services.sandboxLaunch,
      binding: {operation: request.operation, taskId: task.id, taskSha256: request.task.sha256, capsuleSha256: request.capsule.sha256,
        sourceDigest: snapshot.sourceDigest, dependencyDigest: snapshot.dependencyDigest, candidateSha256: before.sha256},
      recheck: () => recheck("BEFORE_ACTION", [task.module, task.memoryReview, request.capsule, request.readback,
        readback.evidenceRef, module.oracle, module.verificationScript])} : null;
    const result = await command(spec, root, resolvePath, stats, { VYDYKHAI_CANDIDATE_SHA256: before.sha256,
      VYDYKHAI_ORACLE_SHA256: module.oracle.sha256, VYDYKHAI_REQUIRED_EXAMPLES: JSON.stringify(requiredExamples) }, "verification", admission);
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
    await recheck("DURING_VERIFICATION", [task.module, task.memoryReview, request.capsule, request.readback, readback.evidenceRef]);
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
    return { status: "VERIFIED", operation: "accept", enforcement: "reference", coverageBasis: basis,
      environment: result.environment, receipt, returnSync, sourceReceipt, stats };
  } catch (error) {
    return { status: error instanceof ContextError && error.limited ? "LIMITED" : "BLOCKED",
      code: error instanceof ContextError ? error.code : "CONTEXT_IO_OR_INPUT_INVALID",
      reference: error instanceof ContextError && /^[A-Za-z0-9_.:/-]{1,256}$/.test(error.reference || "") ? error.reference : null,
      actionOutcome: stats.commands ? "OUTCOME_UNKNOWN" : "NOT_INVOKED",
      replayRequiresReconciliation: stats.commands > 0, enforcement: "reference", sourceReceipt, stats };
  }
}

export async function runContextFile(inputPath, services) {
  try { return await runContextTransition(parse(await boundedRead(inputPath)), services); }
  catch (error) { return { status: "BLOCKED", code: error instanceof ContextError ? error.code : "REQUEST_READ_FAILED", enforcement: "reference", stats: { commands: 0 } }; }
}

export { parse as parseContextJson };
