import test, {before, after} from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, cp, readFile, writeFile, realpath, readdir, rm, chmod, symlink, link, lstat} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {inspectControlRuntime, stageControlRuntime, loadControlRuntime} from "../scripts/control-runtime.mjs";
import {activateControl, verifyControlActivation} from "../scripts/control-activation.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlObserver} from "../scripts/control-observer-run.mjs";

const repository = fileURLToPath(new URL("..", import.meta.url));
const baselineRevision = "72086069e853e785392d8ec722b03a4b1bacba75";
const bounded = {timeout: 30000};
const darwin = {...bounded, skip: process.platform !== "darwin"};
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
let suiteRoot, candidate, published, frozenRuntime, frozenKit, manifest;

function command(executable, args, cwd, expected = 0, extra = {}) {
  const result = spawnSync(executable, args, {cwd, encoding: "utf8", timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
    env: {PATH: process.env.PATH, HOME: suiteRoot, TMPDIR: suiteRoot,
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null"}, ...extra});
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  assert.equal(result.status, expected, result.stderr || result.stdout);
  return result;
}
async function tree(root, prefix = "") {
  const files = {};
  for (const entry of await readdir(path.join(root, prefix), {withFileTypes: true})) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(files, await tree(root, name));
    else {
      assert.equal(entry.isFile(), true, `Unexpected fixture entry: ${name}`);
      files[name] = digest(await readFile(path.join(root, name)));
    }
  }
  return files;
}
before(async () => {
  suiteRoot = await realpath(await mkdtemp(path.join(tmpdir(), "control-install-qualification-")));
  candidate = path.join(suiteRoot, "frozen-candidate");
  published = path.join(suiteRoot, "published-1.32.8");
  await mkdir(candidate, {mode: 0o700}); await mkdir(published, {mode: 0o700});
  manifest = JSON.parse(await readFile(path.join(repository, "vydykhai.json")));
  const observed = await inspectControlRuntime(repository);
  const names = new Set([...manifest.managedPaths, ...Object.keys(observed.description.files)]);
  for (const name of names) {
    await mkdir(path.dirname(path.join(candidate, name)), {recursive: true});
    await cp(path.join(repository, name), path.join(candidate, name), {recursive: true});
  }
  frozenRuntime = await inspectControlRuntime(candidate);
  assert.equal(frozenRuntime.digest, observed.digest, "Candidate changed during snapshot");
  assert.equal((await inspectControlRuntime(repository)).digest, observed.digest);
  frozenKit = digest(JSON.stringify(Object.entries(await tree(candidate)).sort()));
  const archive = command("git", ["archive", baselineRevision], repository, 0, {encoding: null});
  command("tar", ["-x", "-C", published], suiteRoot, 0, {input: archive.stdout});
});
after(async () => {if (suiteRoot) await rm(suiteRoot, {recursive: true, force: true});});

async function inherited(t, {fresh = false} = {}) {
  const root = await mkdtemp(path.join(suiteRoot, "case-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const workspace = path.join(root, "project"); await mkdir(workspace, {mode: 0o700});
  const local = {
    "LICENSE.md": "Product-local license retained.\n",
    "NOTICE.md": "Product-local notice retained.\n",
    "src/product.mjs": "export const accepted = 'retained';\n// Unfinished local change.\n",
    "data/records.bin": Buffer.from([0, 255, 1, 128, 13, 10]),
    "project-state.md": "Accepted product retained. Human pause: DO NOT RESUME.\nMaintenance owner: owner; checkpoint: next approved connection.\nRepair attempts: 1 FAILED; pending human question unchanged.\n",
    "memory/history.json": JSON.stringify({accepted: ["prior"], pending: ["unintegrated-delta"]}),
    "tasks/unfinished.json": JSON.stringify({owner: "owner", status: "PAUSED", candidate: "retained"}),
    "docs/workflows/product-only.md": "Product-local workflow, not kit-managed.\n",
    ".agents/skills/product-only/SKILL.md": "Product-local skill retained.\n",
  };
  for (const [name, bytes] of Object.entries(local)) {
    await mkdir(path.dirname(path.join(workspace, name)), {recursive: true});
    await writeFile(path.join(workspace, name), bytes);
  }
  const prefix = "# Product Instructions\nPreserve local data and human pauses.\n\n";
  const suffix = "\n# Local Tail\nUnfinished work belongs to owner.\n";
  await writeFile(path.join(workspace, "AGENTS.md"), prefix);
  command("git", ["init", "-b", "retained-work"], workspace);
  command(process.execPath, [path.join(fresh ? candidate : published, "scripts/vydykhai.mjs"), "install", workspace], workspace);
  await writeFile(path.join(workspace, "AGENTS.md"), (await readFile(path.join(workspace, "AGENTS.md"))) + suffix);
  const gitBefore = await tree(path.join(workspace, ".git"));
  const preserve = async () => {
    for (const [name, bytes] of Object.entries(local))
      assert.deepEqual(await readFile(path.join(workspace, name)), Buffer.from(bytes), name);
    const agents = await readFile(path.join(workspace, "AGENTS.md"), "utf8");
    assert.ok(agents.startsWith(prefix)); assert.ok(agents.endsWith(suffix));
    assert.deepEqual(await tree(path.join(workspace, ".git")), gitBefore);
  };
  const installedCli = path.join(workspace, "scripts/vydykhai.mjs");
  const cli = (args, expected = 0, source = installedCli) =>
    command(process.execPath, [source, ...args], workspace, expected).stdout;
  t.diagnostic(`Frozen kit ${frozenKit}; runtime ${frozenRuntime.digest}; baseline ${baselineRevision}`);
  const baselineLock = JSON.parse(await readFile(path.join(workspace, ".vydykhai-lock.json")));
  return {root, workspace, installedCli, cli, preserve, baselineLock};
}

test("historical installed updater preserves inherited product bytes; doctor is not adoption", bounded, async t => {
  const x = await inherited(t);
  assert.match(x.cli(["update", x.workspace, "--from", candidate]), /UNPROVEN_BY_INSTALLER/);
  const doctor = JSON.parse(x.cli(["doctor", x.workspace, "--offline", "--json"]));
  assert.equal(doctor.ok, true); assert.equal(doctor.mode, "installed-copy");
  assert.equal(doctor.installedVersion, manifest.version);
  const lock = JSON.parse(await readFile(path.join(x.workspace, ".vydykhai-lock.json")));
  for (const [name, hash] of Object.entries(lock.managedFiles)) {
    assert.equal(digest(await readFile(path.join(x.workspace, name))), hash);
    assert.equal(hash, digest(await readFile(path.join(candidate, name))));
  }
  const plan = JSON.parse(x.cli(["adoption-plan", x.workspace, "--json"]));
  assert.equal(plan.activeUse, "UNPROVEN_BY_INSTALLER"); assert.equal(plan.progressOwner, "Project State");
  const workflow = "docs/workflows/independent-control.md";
  assert.equal(lock.managedFiles[workflow], digest(await readFile(path.join(candidate, workflow))));
  for (const entry of ["AGENTS.md", "docs/workflows/framework-orchestrator.md", "docs/workflows/accept-work.md",
    "docs/workflows/start-work.md", "docs/workflows/framework-activation.md"])
    assert.match(await readFile(path.join(x.workspace, entry), "utf8"), /independent-control\.md/);
  assert.match(await readFile(path.join(x.workspace, workflow), "utf8"), /Acceptance durably enrolls fresh post-accept REVIEW/);
  await writeFile(path.join(x.workspace, "readiness.json"), JSON.stringify({trigger: "update",
    scope: "disposable-inherited-project", sourceRevision: "fixture-only",
    bindings: Object.fromEntries(["code-map", "module-map", "module-contracts", "graph-routes", "verification"]
      .map(id => [id, `missing:${id}`])), checks: []}));
  const diagnosed = JSON.parse(x.cli(["adoption-plan", x.workspace, "--input", "readiness.json", "--json"]));
  assert.equal(diagnosed.capabilityReadiness.action, "ASSIGN_MAINTENANCE");
  assert.equal(diagnosed.activeUse, "UNPROVEN_BY_INSTALLER");
  x.cli(["update", x.workspace, "--from", candidate]);
  assert.equal(JSON.parse(x.cli(["adoption-plan", x.workspace, "--json"])).id, plan.id);
  await x.preserve();
  const omitted = Object.keys(frozenRuntime.description.files).filter(name => name.startsWith("scripts/") &&
    !Object.hasOwn(lock.managedFiles, name));
  t.diagnostic(`Ordinary installed kit omits ${omitted.length} protected runtime scripts; explicit staging is separate.`);
  const beforeRollback = await tree(x.workspace);
  x.cli(["update", x.workspace, "--from", published], 1);
  assert.deepEqual(await tree(x.workspace), beforeRollback);
  x.cli(["update", x.workspace, "--from", published, "--approve-transition",
    `${manifest.version}:${x.baselineLock.installedVersion}`]);
  const restored = JSON.parse(await readFile(path.join(x.workspace, ".vydykhai-lock.json")));
  assert.deepEqual(restored.managedFiles, x.baselineLock.managedFiles);
  assert.equal(restored.agentsBlockHash, x.baselineLock.agentsBlockHash);
  assert.equal(JSON.parse(x.cli(["doctor", x.workspace, "--offline", "--json"])).ok, true);
  for (const name of Object.keys(lock.managedFiles).filter(name => !Object.hasOwn(restored.managedFiles, name)))
    await assert.rejects(readFile(path.join(x.workspace, name)), {code: "ENOENT"});
  await x.preserve();
});

test("locally modified managed file refuses candidate before any writes", bounded, async t => {
  const x = await inherited(t), file = path.join(x.workspace, "docs/FRAMEWORK.md");
  await writeFile(file, (await readFile(file)) + "\nProduct owner's unmerged managed edit.\n");
  const before = await tree(x.workspace);
  const refused = command(process.execPath, [x.installedCli, "update", x.workspace, "--from", candidate], x.workspace, 1);
  assert.match(refused.stderr, /Refusing to overwrite locally modified framework files/);
  assert.deepEqual(await tree(x.workspace), before); await x.preserve();
});

for (const fault of ["failed-copy", "interrupted-process"])
  test(`actual updater ${fault}: mixed kit is diagnosed; explicit kit rollback preserves product`, bounded, async t => {
    const x = await inherited(t), lockFile = path.join(x.workspace, ".vydykhai-lock.json");
    const lockBefore = await readFile(lockFile);
    const baselineLock = JSON.parse(lockBefore);
    const changed = "docs/AGENTS_CORE.md";
    assert.notEqual(digest(await readFile(path.join(candidate, changed))), baselineLock.managedFiles[changed]);
    // Fault only this disposable child, after a real changed file reaches disk.
    const program = `
      import fs from 'node:fs'; import {syncBuiltinESMExports} from 'node:module';
      const copy = fs.promises.copyFile;
      fs.promises.copyFile = async (...args) => {
        await copy(...args);
        if (args[1] === ${JSON.stringify(path.join(x.workspace, changed))}) {
          ${fault === "interrupted-process" ? "process.exit(23);" : "throw Object.assign(Error('qualification injected EIO after copy'), {code:'EIO'});"}
        }
      };
      syncBuiltinESMExports();
      process.argv = [process.execPath, ${JSON.stringify(x.installedCli)}, 'update',
        ${JSON.stringify(x.workspace)}, '--from', ${JSON.stringify(candidate)}];
      await import(${JSON.stringify(pathToFileURL(x.installedCli).href)});
    `;
    const result = command(process.execPath, ["--input-type=module", "--eval", program], x.workspace,
      fault === "interrupted-process" ? 23 : 1);
    if (fault === "failed-copy") assert.match(result.stderr, /injected EIO/);
    assert.deepEqual(await readFile(lockFile), lockBefore, "Failed update never reached lock publication");
    assert.equal(digest(await readFile(path.join(x.workspace, changed))),
      digest(await readFile(path.join(candidate, changed))));
    const doctor = JSON.parse(x.cli(["doctor", x.workspace, "--offline", "--json"], 1,
      path.join(candidate, "scripts/vydykhai.mjs")));
    assert.equal(doctor.ok, false); assert.ok(doctor.modified.includes(changed));
    await x.preserve();
    // No transaction/rollback API exists: reuse update --from with explicit fixture authority.
    x.cli(["update", x.workspace, "--from", published, "--force"], 0, path.join(candidate, "scripts/vydykhai.mjs"));
    const restored = JSON.parse(await readFile(lockFile));
    assert.deepEqual(restored.managedFiles, baselineLock.managedFiles);
    assert.equal(restored.agentsBlockHash, baselineLock.agentsBlockHash);
    assert.equal(JSON.parse(x.cli(["doctor", x.workspace, "--offline", "--json"])).ok, true);
    await x.preserve();
  });

async function staged(x, sourceRoot = candidate) {
  const directory = path.join(x.root, "packages"); await mkdir(directory, {mode: 0o700, recursive: true});
  const {digest: expectedDigest} = await inspectControlRuntime(sourceRoot);
  return stageControlRuntime({sourceRoot, directory, workspace: x.workspace, expectedDigest});
}
async function privateProfile(x) {
  const root = path.join(x.root, "control"); await mkdir(root, {mode: 0o700});
  const sourceFile = path.join(root, "sources.json");
  await writeFile(sourceFile, JSON.stringify({schema: "control.review-sources.v1", workspace: x.workspace,
    sources: [{id: "product", path: "src/product.mjs", purpose: "Disposable inherited behavior"}]}), {mode: 0o600});
  const profile = {schema: "control.service.v1", directory: path.join(root, "host"),
    config: {workspace: x.workspace, policy: "a".repeat(64), owner: "owner", executor: "executor", reviewer: "reviewer",
      evidenceRegistry: sourceFile, health: {scope: "Disposable only", intervalMs: 60000, maxBranches: 1,
        maxWorktrees: 1, triggerSourceIds: ["product"], repairTasks: ["maintenance"]}},
    review: {directory: path.join(root, "review"), controlRoot: root, reviewer: "reviewer", sourceFile,
      native: {workspace: path.join(root, "review-room"), home: path.join(root, "empty-home"),
        binary: "/never-launch-model", model: "no-inference", effort: "low", timeoutMs: 1000},
      maxCalls: 2, expiresAt: new Date(Date.now() + 3600000).toISOString(), scope: {kind: "fixture"}},
    timeoutMs: 3000, maxReviewsPerTick: 0};
  return {root, profile};
}
async function privateService(x, installed) {
  const {root, profile} = await privateProfile(x);
  const options = {sourceRoot: installed.root, expectedDigest: installed.digest, root, profile};
  const descriptor = await activateControl(options);
  const runtime = await loadControlRuntime({packageRoot: installed.root, expectedDigest: installed.digest, workspace: x.workspace});
  const service = await runtime.service.openControlService(profile);
  await service.host.pause(true);
  const hostStore = await openControlStore(profile.directory), reviewStore = await openControlStore(profile.review.directory);
  await hostStore.transact(s => {
    s.reservations.unresolved = {status: "IN_FLIGHT", evidence: "must not replay"};
    s.acceptances.retained = {acceptance: {id: "retained", status: "ACCEPTED"}, enrollment: "REPAIR_DUE",
      reviewLease: null, findings: [{id: "open", status: "OPEN", attempts: 1}],
      history: [{evidence: "failed repair retained"}]};
    return s;
  });
  await reviewStore.transact(s => {s.calls = 2; s.runs.unresolved = {state: "UNKNOWN"}; return s;});
  return {options, descriptor, profile, hostStore, reviewStore,
    before: [await hostStore.read(), await reviewStore.read()]};
}

test("failed staged candidate import rolls back to readable package without journal or product reset", darwin, async t => {
  const x = await inherited(t), first = await staged(x), state = await privateService(x, first);
  const broken = path.join(x.root, "broken-candidate"); await cp(candidate, broken, {recursive: true});
  const hostFile = path.join(broken, "scripts/control-host.mjs");
  await writeFile(hostFile, "throw Error('qualification candidate import failed');\n" + await readFile(hostFile, "utf8"));
  const second = await staged(x, broken); assert.notEqual(second.digest, first.digest);
  assert.equal(second.status, "STAGED_NOT_ACTIVATED");
  await assert.rejects(loadControlRuntime({packageRoot: second.root, expectedDigest: second.digest,
    workspace: x.workspace}), /qualification candidate import failed/);
  const prior = await loadControlRuntime({packageRoot: first.root, expectedDigest: first.digest, workspace: x.workspace});
  const reopened = await prior.service.openControlService(state.profile);
  assert.deepEqual(await reopened.host.snapshot(), state.before[0].state);
  assert.deepEqual(await reopened.review.capacity(), {used: 2, remaining: 0});
  assert.deepEqual([await state.hostStore.read(), await state.reviewStore.read()], state.before);
  assert.equal((await verifyControlActivation(state.descriptor.descriptorFile)).descriptor.runtime.digest, first.digest);
  await x.preserve();
});

test("activation alone refuses a candidate switch; prior paused observer remains readable", darwin, async t => {
  const x = await inherited(t), first = await staged(x), state = await privateService(x, first);
  const alternate = path.join(x.root, "alternate-candidate"); await cp(candidate, alternate, {recursive: true});
  const file = path.join(alternate, "scripts/control-catalog.mjs");
  await writeFile(file, (await readFile(file, "utf8")) + "\n// Disposable package identity change only.\n");
  const second = await staged(x, alternate), descriptorBefore = await readFile(state.descriptor.descriptorFile);
  await assert.rejects(activateControl({...state.options, sourceRoot: second.root, expectedDigest: second.digest}),
    /CONTROL_ACTIVATION_CONFLICT/);
  assert.deepEqual(await readFile(state.descriptor.descriptorFile), descriptorBefore);
  assert.deepEqual([await state.hostStore.read(), await state.reviewStore.read()], state.before);
  const receipt = await runControlObserver(state.descriptor.descriptorFile);
  assert.equal(receipt.paused, true); assert.equal(receipt.calls, 0);
  assert.equal(receipt.projectReadiness, "NOT_CERTIFIED");
  assert.deepEqual([await state.hostStore.read(), await state.reviewStore.read()], state.before);
  await x.preserve();
  t.diagnostic("Activation conflict requires the separate explicit cutover API; it is not cutover success.");
});

async function installedActivation(t, {fresh = false} = {}) {
  const x = await inherited(t, {fresh});
  if (!fresh) x.cli(["update", x.workspace, "--from", candidate]);
  const {root, profile} = await privateProfile(x);
  const runtimeDirectory = path.join(x.root, "private-packages"); await mkdir(runtimeDirectory, {mode: 0o700});
  const sourceRoot = path.join(x.root, "trusted-source"); await cp(candidate, sourceRoot, {recursive: true});
  const requestFile = path.join(x.root, "private-request.json");
  const request = {expectedDigest: frozenRuntime.digest, runtimeDirectory, root, profile};
  const save = async value => writeFile(requestFile, JSON.stringify(value), {mode: 0o600});
  await save(request);
  const args = ["control-activate", "--runtime-source", sourceRoot, "--input", requestFile];
  const activate = (expected = 0, rest = args.slice(1)) =>
    command(process.execPath, [x.installedCli, "control-activate", ...rest], x.workspace, expected);
  const before = {workspace: await tree(x.workspace), control: await tree(root), packages: await tree(runtimeDirectory)};
  const unchanged = async () => {
    assert.deepEqual(await tree(x.workspace), before.workspace);
    assert.deepEqual(await tree(root), before.control);
    assert.deepEqual(await tree(runtimeDirectory), before.packages); await x.preserve();
  };
  return {...x, control: root, profile, runtimeDirectory, sourceRoot, requestFile, request, save, args, activate,
    before, unchanged};
}

for (const fresh of [true, false])
  test(`actual ${fresh ? "freshly installed" : "historically updated"} CLI stages standalone source and preserves product/state on repetition`, darwin, async t => {
    const x = await installedActivation(t, {fresh});
    const lock = JSON.parse(await readFile(path.join(x.workspace, ".vydykhai-lock.json")));
    assert.ok(lock.managedFiles["scripts/control-runtime.mjs"]);
    assert.equal(Object.hasOwn(lock.managedFiles, "scripts/control-activation.mjs"), false);
    for (const name of ["LICENSE.md", "NOTICE.md"]) assert.equal(Object.hasOwn(lock.managedFiles, name), false);
    const result = JSON.parse(x.activate().stdout);
    assert.equal(result.status, "PRIVATE_ACTIVATED_NOT_PROJECT_READY");
    assert.equal(result.kitInstallation, "SEPARATE_PREVIOUS_STEP"); assert.equal(result.runtimeKind, "candidate-not-release");
    assert.equal(result.projectReadiness, "NOT_CERTIFIED"); assert.equal(result.observer, "NOT_RUN");
    assert.equal(result.scheduler, "NOT_CHANGED"); assert.equal(result.runtime.digest, frozenRuntime.digest);
    assert.equal(result.runtime.root, path.join(x.runtimeDirectory, frozenRuntime.digest));
    assert.equal(result.descriptorFile, path.join(x.control, "activation.json"));
    for (const name of ["LICENSE.md", "NOTICE.md"])
      assert.deepEqual(await readFile(path.join(result.runtime.root, name)), await readFile(path.join(candidate, name)));
    assert.equal((await lstat(result.descriptorFile)).mode & 0o777, 0o400);
    await assert.rejects(lstat(path.join(x.control, "observer-latest.json")), {code: "ENOENT"});
    const runtime = await loadControlRuntime({packageRoot: result.runtime.root, expectedDigest: result.runtime.digest,
      workspace: x.workspace});
    const service = await runtime.service.openControlService(x.profile); await service.host.pause(true);
    const host = await openControlStore(x.profile.directory), review = await openControlStore(x.profile.review.directory);
    await host.transact(s => {s.reservations.retained = {status: "IN_FLIGHT", evidence: "do not replay"}; return s;});
    await review.transact(s => {s.calls = 2; s.runs.retained = {state: "STOPPED", evidence: "spent remains spent"}; return s;});
    const state = [await host.read(), await review.read()], controlBefore = await tree(x.control);
    assert.deepEqual(JSON.parse(x.activate().stdout), result);
    assert.deepEqual(await tree(x.control), controlBefore);
    assert.deepEqual([await host.read(), await review.read()], state);
    // The actual descriptor-selected observer remains runnable after deleting
    // this fixture's source. Activation itself never ran it or a model.
    await rm(x.sourceRoot, {recursive: true});
    const receipt = JSON.parse(command(process.execPath,
      [path.join(result.runtime.root, "scripts/control-observer-run.mjs"), result.descriptorFile], x.workspace).stdout);
    assert.equal(receipt.paused, true); assert.equal(receipt.calls, 0); assert.equal(receipt.capacity.used, 2);
    assert.equal(receipt.capacity.remaining, 0); assert.equal(receipt.projectReadiness, "NOT_CERTIFIED");
    assert.deepEqual([await host.read(), await review.read()], state);
    assert.deepEqual(await tree(x.workspace), x.before.workspace);
    assert.equal(JSON.parse(x.cli(["doctor", x.workspace, "--offline", "--json"])).ok, true);
    assert.equal(JSON.parse(x.cli(["adoption-plan", x.workspace, "--json"])).activeUse, "UNPROVEN_BY_INSTALLER");
    await x.preserve();
  });

test("installed activation rejects strict options and request fields without private or kit writes", darwin, async t => {
  const x = await installedActivation(t);
  for (const rest of [[], ["--input", x.requestFile], ["--runtime-source", x.sourceRoot, "--input"],
    ["--input", x.requestFile, "--input", x.requestFile],
    ["--runtime-source", x.sourceRoot, "--input", x.requestFile, "--force"],
    ["--from", x.sourceRoot, "--input", x.requestFile],
    ["--runtime-source", "--input", "--input", x.requestFile]])
    assert.match(x.activate(1, rest).stderr, /CONTROL_ACTIVATE_ARGUMENTS_INVALID/);
  for (const value of [{...x.request, extra: true}, {...x.request, expectedDigest: "self-derived-not-a-pin"},
    {...x.request, profile: null}]) {
    await x.save(value); assert.match(x.activate(1).stderr, /CONTROL_ACTIVATE_REQUEST_INVALID/);
  }
  await writeFile(x.requestFile, '{"private-payload-that-must-not-appear-in-errors": invalid}');
  const invalid = x.activate(1);
  assert.match(invalid.stderr, /CONTROL_ACTIVATE_PRIVATE_JSON_INVALID/);
  assert.doesNotMatch(invalid.stderr, /private-payload-that-must-not-appear-in-errors/);
  await x.unchanged();
});

test("installed bootstrap helper integrity is checked before its import", darwin, async t => {
  const x = await installedActivation(t), file = path.join(x.workspace, "scripts/control-runtime.mjs");
  const bytes = await readFile(file), sentinel = path.join(x.root, "unverified-helper-executed");
  await writeFile(file, `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'unsafe');\n` + bytes);
  const changed = await tree(x.workspace);
  assert.match(x.activate(1).stderr, /MANAGED_FILES_CHANGED/);
  await assert.rejects(lstat(sentinel), {code: "ENOENT"});
  assert.deepEqual(await tree(x.workspace), changed);
  await writeFile(file, bytes); await x.unchanged();
});

test("installed activation checks pinned source bytes before source code imports", darwin, async t => {
  const x = await installedActivation(t), file = path.join(x.sourceRoot, "scripts/control-activation.mjs");
  const sentinel = path.join(x.root, "source-code-executed");
  await writeFile(file, `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(sentinel)}, 'unsafe');\n` +
    await readFile(file, "utf8"));
  assert.match(x.activate(1).stderr, /CONTROL_ACTIVATE_SOURCE_DIGEST_MISMATCH/);
  await assert.rejects(lstat(sentinel), {code: "ENOENT"}); await x.unchanged();
});

for (const name of ["LICENSE.md", "NOTICE.md", "scripts/control-service.mjs"])
  test(`installed activation refuses missing standalone source ${name}, never substituting product files`, darwin, async t => {
    const x = await installedActivation(t); await rm(path.join(x.sourceRoot, name));
    assert.match(x.activate(1).stderr, /ENOENT/); await x.unchanged();
  });

test("installed activation rejects missing source and noncanonical source identity/version", darwin, async t => {
  const x = await installedActivation(t);
  assert.match(x.activate(1, ["--runtime-source", path.join(x.root, "missing"), "--input", x.requestFile]).stderr, /ENOENT/);
  const file = path.join(x.sourceRoot, "vydykhai.json"), value = JSON.parse(await readFile(file));
  await writeFile(file, JSON.stringify({...value, canonicalSource: "https://invalid.example/not-canonical"}));
  assert.match(x.activate(1).stderr, /Invalid canonical source/);
  await writeFile(file, JSON.stringify({...value, version: "0.0.1"}));
  assert.match(x.activate(1).stderr, /SOURCE_VERSION_MISMATCH_UPDATE_KIT_FIRST/); await x.unchanged();
});

test("installed activation refuses public, linked or oversized private requests", darwin, async t => {
  const x = await installedActivation(t), alias = path.join(x.root, "request-alias.json");
  await chmod(x.requestFile, 0o644); assert.match(x.activate(1).stderr, /PRIVATE_FILE_UNSAFE/);
  await chmod(x.requestFile, 0o600); await symlink(x.requestFile, alias);
  assert.match(x.activate(1, ["--runtime-source", x.sourceRoot, "--input", alias]).stderr, /PRIVATE_FILE_UNSAFE/);
  await rm(alias); await link(x.requestFile, alias);
  assert.match(x.activate(1).stderr, /PRIVATE_FILE_UNSAFE/); await rm(alias);
  await writeFile(x.requestFile, " ".repeat(1024 * 1024 + 1));
  assert.match(x.activate(1).stderr, /PRIVATE_FILE_UNSAFE/); await x.save(x.request);
  await chmod(x.root, 0o755); assert.match(x.activate(1).stderr, /DIRECTORY_UNSAFE/); await chmod(x.root, 0o700);
  await x.unchanged();
});

test("installed activation refuses private/source/workspace path overlap or symlinks before staging", darwin, async t => {
  const x = await installedActivation(t), alias = path.join(x.root, "packages-alias");
  await symlink(x.runtimeDirectory, alias);
  for (const value of [{...x.request, root: x.workspace}, {...x.request, runtimeDirectory: x.workspace},
    {...x.request, runtimeDirectory: x.control}, {...x.request, runtimeDirectory: alias},
    {...x.request, root: "relative-control"},
    {...x.request, profile: {...x.profile, config: {...x.profile.config, workspace: x.sourceRoot}}}]) {
    await x.save(value);
    assert.match(x.activate(1).stderr, /CONTROL_ACTIVATE_(PATH_BOUNDARY|DIRECTORY_UNSAFE|PATH_INVALID|WORKSPACE_KIT_MISMATCH)/);
  }
  await x.save(x.request);
  assert.match(x.activate(1, ["--runtime-source", x.workspace, "--input", x.requestFile]).stderr, /PATH_BOUNDARY/);
  const inProduct = path.join(x.workspace, "private-request.json");
  await writeFile(inProduct, JSON.stringify(x.request), {mode: 0o600});
  assert.match(x.activate(1, ["--runtime-source", x.sourceRoot, "--input", inProduct]).stderr, /PATH_BOUNDARY/);
  await rm(inProduct); await chmod(x.control, 0o755);
  assert.match(x.activate(1).stderr, /DIRECTORY_UNSAFE/); await chmod(x.control, 0o700);
  await x.unchanged();
});

test("installed activation retains unknown journals and refuses profile change or different pinned runtime", darwin, async t => {
  const x = await installedActivation(t), result = JSON.parse(x.activate().stdout);
  const runtime = await loadControlRuntime({packageRoot: result.runtime.root, expectedDigest: result.runtime.digest,
    workspace: x.workspace});
  await (await runtime.service.openControlService(x.profile)).host.pause(true);
  const review = await openControlStore(x.profile.review.directory);
  await review.transact(s => {s.calls = 2; s.runs.lost = {state: "UNKNOWN", evidence: "must not reset"}; return s;});
  const controlBefore = await tree(x.control), packagesBefore = await tree(x.runtimeDirectory);
  assert.deepEqual(JSON.parse(x.activate().stdout), result);
  await x.save({...x.request, profile: {...x.profile, review: {...x.profile.review, maxCalls: 99}}});
  assert.match(x.activate(1).stderr, /CONTROL_ACTIVATION_CONFLICT/);
  const file = path.join(x.sourceRoot, "scripts/control-catalog.mjs");
  await writeFile(file, (await readFile(file, "utf8")) + "\n// Disposable new runtime, not an active switch.\n");
  const next = await inspectControlRuntime(x.sourceRoot);
  await x.save({...x.request, expectedDigest: next.digest});
  assert.match(x.activate(1).stderr, /CONTROL_ACTIVATE_CUTOVER_REQUIRED/);
  assert.deepEqual(await tree(x.control), controlBefore);
  assert.deepEqual(await tree(x.runtimeDirectory), packagesBefore);
  assert.deepEqual(await tree(x.workspace), x.before.workspace); await x.preserve();
});

test("actual installed CLI fails unsupported host before reading request/source or writing state", bounded, async t => {
  const x = await installedActivation(t);
  const program = `Object.defineProperty(process, 'platform', {value:'linux'});
    process.argv=[process.execPath,${JSON.stringify(x.installedCli)},'control-activate',
      '--runtime-source','/missing-unread-source','--input','/missing-unread-request'];
    await import(${JSON.stringify(pathToFileURL(x.installedCli).href)});`;
  const result = command(process.execPath, ["--input-type=module", "--eval", program], x.workspace, 1);
  assert.match(result.stderr, /CONTROL_ACTIVATE_HOST_UNSUPPORTED/); await x.unchanged();
});

test("installed reactivation never replenishes a missing budget journal", darwin, async t => {
  const x = await installedActivation(t), result = JSON.parse(x.activate().stdout);
  const runtime = await loadControlRuntime({packageRoot: result.runtime.root, expectedDigest: result.runtime.digest,
    workspace: x.workspace});
  await (await runtime.service.openControlService(x.profile)).host.pause(true);
  for (const name of await readdir(x.profile.review.directory))
    if (/^\d{10}\.json$/.test(name)) await rm(path.join(x.profile.review.directory, name));
  const controlBefore = await tree(x.control), packagesBefore = await tree(x.runtimeDirectory);
  assert.match(x.activate(1).stderr, /CONTROL_ACTIVATION_JOURNAL_MISSING/);
  assert.deepEqual(await tree(x.control), controlBefore);
  assert.deepEqual(await tree(x.runtimeDirectory), packagesBefore);
  assert.deepEqual(await tree(x.workspace), x.before.workspace); await x.preserve();
});

test("staging rejects stale identity and in-project packaging without changing inherited files", bounded, async t => {
  const x = await inherited(t), before = await tree(x.workspace);
  const packages = path.join(x.root, "packages"); await mkdir(packages, {mode: 0o700});
  await assert.rejects(stageControlRuntime({sourceRoot: candidate, directory: packages, workspace: x.workspace,
    expectedDigest: "b".repeat(64)}), /CONTROL_RUNTIME_SOURCE_CHANGED/);
  await assert.rejects(stageControlRuntime({sourceRoot: candidate, directory: x.workspace, workspace: x.workspace,
    expectedDigest: frozenRuntime.digest}), /CONTROL_RUNTIME_WORKSPACE_BOUNDARY/);
  assert.deepEqual(await tree(x.workspace), before); assert.deepEqual(await readdir(packages), []);
  await x.preserve();
});

test("unsupported host never claims controlled installation", {...bounded, skip: process.platform === "darwin"}, async () => {
  await assert.rejects(activateControl({}), /CONTROL_ACTIVATION_HOST_UNSUPPORTED/);
});
