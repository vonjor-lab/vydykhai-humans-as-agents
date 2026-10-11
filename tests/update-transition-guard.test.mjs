import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test, { before, after } from "node:test";

const repository = fileURLToPath(new URL("..", import.meta.url));
const upstream = "https://github.com/vonjor-lab/vydykhai-humans-as-agents.git";
const canonical = "https://github.com/vonjor-lab/vydykhai-humans-as-agents";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
let root, base, preload, environment;
const sources = new Map();

function command(executable, args, { cwd = root, env = {}, ...options } = {}) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8", timeout: 15000,
    maxBuffer: 16 * 1024 * 1024, env: { ...environment, ...env }, ...options });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.signal, null, result.stderr);
  return result;
}

function success(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

function cli(source, args, env = {}) {
  return command(process.execPath, ["--import", preload, path.join(source, "scripts/vydykhai.mjs"), ...args], { env });
}

async function json(file) { return JSON.parse(await readFile(file, "utf8")); }
async function putJson(file, value) { await writeFile(file, JSON.stringify(value, null, 2) + "\n"); }

async function setVersion(directory, version) {
  const file = path.join(directory, "vydykhai.json"), manifest = await json(file);
  manifest.version = version;
  await putJson(file, manifest);
}

async function source(version) {
  if (!sources.has(version)) {
    const directory = await mkdtemp(path.join(root, "source-"));
    await cp(base, directory, { recursive: true });
    await setVersion(directory, version);
    sources.set(version, directory);
  }
  return sources.get(version);
}

async function installed(version) {
  const target = await mkdtemp(path.join(root, "installed-"));
  await writeFile(path.join(target, "product.txt"), "retained product bytes\n");
  success(cli(await source(version), ["install", target]));
  return target;
}

async function tree(directory, prefix = "") {
  const files = {};
  for (const entry of await readdir(path.join(directory, prefix), { withFileTypes: true })) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) Object.assign(files, await tree(directory, name));
    else files[name] = digest(await readFile(path.join(directory, name)));
  }
  return files;
}

async function refusedUnchanged(target, result, before, pattern) {
  assert.notEqual(result.status, 0, result.stdout);
  assert.match(result.stderr, pattern);
  assert.deepEqual(await tree(target), before);
}

before(async () => {
  root = await mkdtemp(path.join(tmpdir(), "vydykhai-transition-"));
  base = path.join(root, "base"); await mkdir(base);
  const manifest = await json(path.join(repository, "vydykhai.json"));
  for (const name of manifest.managedPaths) {
    await mkdir(path.dirname(path.join(base, name)), { recursive: true });
    await cp(path.join(repository, name), path.join(base, name), { recursive: true });
  }
  environment = { PATH: process.env.PATH, HOME: root, TMPDIR: root,
    GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_ALLOW_PROTOCOL: "file",
    GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid" };
  preload = path.join(root, "offline-fetch.mjs");
  await writeFile(preload, `import {readFile, appendFile} from 'node:fs/promises';
globalThis.fetch = async url => {
  if (process.env.FETCH_LOG) await appendFile(process.env.FETCH_LOG, String(url) + '\\n');
  if (!process.env.FETCH_REPLY) throw new Error('NETWORK_DISABLED_BY_TEST');
  const reply = JSON.parse(await readFile(process.env.FETCH_REPLY, 'utf8'));
  return {ok: true, json: async () => reply};
};
`);
});
after(async () => { if (root) await rm(root, { recursive: true, force: true }); });

test("same-major forward updates and reinstalls preserve ordinary API and product bytes", async () => {
  const target = await installed("1.34.1"), next = await source("1.34.2");
  success(cli(target, ["update", target, "--from", next]));
  success(cli(next, ["install", target]));
  assert.equal((await json(path.join(target, ".vydykhai-lock.json"))).installedVersion, "1.34.2");
  assert.equal(await readFile(path.join(target, "product.txt"), "utf8"), "retained product bytes\n");
  assert.equal(JSON.parse(success(cli(target, ["doctor", target, "--offline", "--json"]))).ok, true);
});

for (const [from, to] of [["1.34.1", "2.0.0"], ["2.0.0", "1.34.1"], ["2.0.1", "2.0.0"]]) {
  for (const entry of ["install", "update"]) {
    test(`${entry} ${from} -> ${to} needs exact approval, including with --force`, async () => {
      const target = await installed(from), next = await source(to), before = await tree(target);
      const args = entry === "install" ? ["install", target] : ["update", target, "--from", next];
      const executor = entry === "install" ? next : target;
      for (const flags of [[], ["--force"], ["--approve-transition", `${from}:9.0.0`]]) {
        await refusedUnchanged(target, cli(executor, [...args, ...flags]), before, /approval/);
      }
      success(cli(executor, [...args, "--approve-transition", `${from}:${to}`]));
      assert.equal((await json(path.join(target, ".vydykhai-lock.json"))).installedVersion, to);
      assert.equal(await readFile(path.join(target, "product.txt"), "utf8"), "retained product bytes\n");
    });
  }
}

test("approval requires explicit update source and is rejected when malformed, stale or misplaced", async () => {
  const target = await installed("2.0.0"), before = await tree(target), next = await source("2.0.1");
  await refusedUnchanged(target, cli(target, ["update", target, "--approve-transition", "2.0.0:1.34.1"]), before, /explicit --from/);
  for (const pair of ["", "2:1", "02.0.0:2.0.1", "2.0.0:2.0.1:extra", "2.0.0:2.0.1-rc.1", "9007199254740992.0.0:2.0.1"]) {
    await refusedUnchanged(target, cli(target, ["update", target, "--from", next, "--approve-transition", pair]), before, /version|requires/);
  }
  await refusedUnchanged(target, cli(target, ["doctor", target, "--approve-transition", "2.0.0:2.0.1"]), before, /only supported/);
  await refusedUnchanged(target, cli(target, ["update", target, "--from", next,
    "--approve-transition", "2.0.0:2.0.1", "--approve-transition", "2.0.0:2.0.1"]), before, /Duplicate/);
  const fresh = await mkdtemp(path.join(root, "fresh-"));
  await refusedUnchanged(fresh, cli(next, ["install", fresh, "--approve-transition", "2.0.0:2.0.1"]), {}, /approval/);
});

test("transition approval and managed-file overwrite approval remain independent", async () => {
  const target = await installed("1.34.1"), next = await source("2.0.0");
  await writeFile(path.join(target, "docs/FRAMEWORK.md"), "local framework change\n");
  const before = await tree(target);
  const args = ["update", target, "--from", next, "--approve-transition", "1.34.1:2.0.0"];
  await refusedUnchanged(target, cli(target, args), before, /Refusing to overwrite/);
  success(cli(target, [...args, "--force"]));
  assert.equal((await json(path.join(target, ".vydykhai-lock.json"))).installedVersion, "2.0.0");
});

test("malformed or conflicting installed identity cannot be overridden by approval or force", async () => {
  const changes = [
    async target => putJson(path.join(target, ".vydykhai-lock.json"), null),
    async target => { const file = path.join(target, ".vydykhai-lock.json"), lock = await json(file); lock.installedVersion = "1.0.0"; await putJson(file, lock); },
    async target => { const file = path.join(target, ".vydykhai-lock.json"), lock = await json(file); lock.canonicalSource = "https://example.invalid"; await putJson(file, lock); },
    async target => { const file = path.join(target, ".vydykhai-lock.json"), lock = await json(file); lock.installedVersion = "2.0"; await putJson(file, lock); },
    async target => rm(path.join(target, ".vydykhai-lock.json")),
    async target => rm(path.join(target, "vydykhai.json")),
    async target => setVersion(target, "1.34.1"),
    async target => writeFile(path.join(target, ".vydykhai-lock.json"), "{broken"),
  ];
  const next = await source("1.34.1");
  for (const change of changes) {
    const target = await installed("2.0.0"); await change(target);
    const before = await tree(target);
    await refusedUnchanged(target, cli(next, ["install", target, "--force", "--approve-transition", "2.0.0:1.34.1"]), before,
      /identity|version|JSON|property|Unexpected/);
    await refusedUnchanged(target, cli(target, ["update", target]), before, /identity|version|JSON|property|Unexpected/);
  }
});

test("malformed source version and unsupported channel fail before target writes", async () => {
  const target = await installed("2.0.0"), before = await tree(target);
  for (const version of ["bad", "2.0", "02.0.0", "3.0.0"]) {
    await refusedUnchanged(target, cli(target, ["update", target, "--from", await source(version), "--force"]), before, /version|Unsupported/);
  }
});

test("manifest hash drift and null locks fail closed, including installed doctor", async () => {
  const target = await installed("2.0.0"), file = path.join(target, "vydykhai.json");
  const original = await readFile(file);
  await writeFile(file, Buffer.concat([original, Buffer.from("\n")]));
  const before = await tree(target);
  await refusedUnchanged(target, cli(target, ["update", target, "--from", await source("2.0.1"), "--force"]), before, /differs from lock/);
  await writeFile(file, original);
  await putJson(path.join(target, ".vydykhai-lock.json"), null);
  const log = path.join(root, "null-lock-fetch.log"); await writeFile(log, "");
  const failed = cli(target, ["doctor", target, "--json"], { FETCH_LOG: log });
  assert.equal(failed.status, 1);
  const report = JSON.parse(failed.stdout);
  assert.equal(report.ok, false); assert.equal(report.mode, "installed-copy");
  assert.equal(await readFile(log, "utf8"), "");
});

test("doctor selects target major, ignores untrusted URL fields and advertises only forward same-major releases", async () => {
  const executor = await source("1.34.1");
  for (const [version, branch, next] of [["1.34.1", "main", "1.34.2"], ["2.0.1", "release/2.x", "2.0.2"]]) {
    const target = await installed(version), reply = path.join(target, "reply.json"), log = path.join(target, "fetch.log");
    const file = path.join(target, "vydykhai.json"), manifest = await json(file);
    manifest.upstreamManifest = "https://example.invalid/untrusted";
    await putJson(file, manifest);
    const lockFile = path.join(target, ".vydykhai-lock.json"), lock = await json(lockFile);
    lock.managedFiles["vydykhai.json"] = digest(await readFile(file)); await putJson(lockFile, lock);
    for (const candidate of [next, version, "0.9.0", "bad", "3.0.0", "2.0.0", "1.34.0"]) {
      await putJson(reply, { schemaVersion: 1, name: "vydykhai", canonicalSource: canonical, version: candidate });
      const result = JSON.parse(success(cli(executor, ["doctor", target, "--json"], { FETCH_REPLY: reply, FETCH_LOG: log })));
      assert.equal(result.ok, true);
      assert.equal(result.updateAvailable, candidate === next);
      if (candidate !== next && candidate !== version) assert.ok(result.warnings.length > 0);
    }
    for (const changed of [{ schemaVersion: 2 }, { canonicalSource: "https://example.invalid" }, { name: "other" }]) {
      await putJson(reply, { schemaVersion: 1, name: "vydykhai", canonicalSource: canonical, version: next, ...changed });
      const result = JSON.parse(success(cli(executor, ["doctor", target, "--json"], { FETCH_REPLY: reply, FETCH_LOG: log })));
      assert.equal(result.updateAvailable, false);
      assert.match(result.warnings.join("\n"), /identity mismatch/);
    }
    const urls = (await readFile(log, "utf8")).trim().split("\n");
    assert.ok(urls.every(url => url === `https://raw.githubusercontent.com/vonjor-lab/vydykhai-humans-as-agents/${branch}/vydykhai.json`));
    const before = await readFile(log, "utf8");
    success(cli(executor, ["doctor", target, "--offline", "--json"], { FETCH_LOG: log }));
    assert.equal(await readFile(log, "utf8"), before);
    lock.installedVersion = "bad"; await putJson(lockFile, lock);
    const failed = cli(executor, ["doctor", target, "--json"], { FETCH_LOG: log });
    assert.equal(failed.status, 1);
    assert.equal(JSON.parse(failed.stdout).ok, false);
    assert.equal(await readFile(log, "utf8"), before);
  }
});

async function remote({ main = "1.34.2", release = "2.0.1" } = {}) {
  const work = await mkdtemp(path.join(root, "remote-work-"));
  await cp(await source(main), work, { recursive: true });
  const git = args => success(command("git", args, { cwd: work }));
  git(["init", "-b", "main"]); git(["add", "."]); git(["commit", "-m", "1.x fixture"]);
  if (release) {
    git(["checkout", "-b", "release/2.x"]); await setVersion(work, release);
    git(["add", "vydykhai.json"]); git(["commit", "-m", "Opt-in fixture"]); git(["checkout", "main"]);
  }
  const bare = path.join(await mkdtemp(path.join(root, "remote-")), "upstream.git");
  success(command("git", ["clone", "--bare", work, bare]));
  return { bare, env: { GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: `url.${pathToFileURL(bare).href}.insteadOf`, GIT_CONFIG_VALUE_0: upstream } };
}

test("automatic updates select installed major, independent of executing CLI and remote default HEAD", async () => {
  const local = await remote();
  assert.equal(success(command("git", ["--git-dir", local.bare, "symbolic-ref", "HEAD"])).trim(), "refs/heads/main");
  for (const [version, expected, executor] of [["1.34.1", "1.34.2", "2.0.0"], ["2.0.0", "2.0.1", "1.34.1"]]) {
    const target = await installed(version);
    success(cli(await source(executor), ["update", target], local.env));
    assert.equal((await json(path.join(target, ".vydykhai-lock.json"))).installedVersion, expected);
  }
});

test("missing, wrong-major and regressed 2.x channels never fall back or modify the target", async () => {
  for (const release of [null, "1.34.1", "2.0.0"]) {
    const local = await remote({ release }), target = await installed("2.0.1"), before = await tree(target);
    await refusedUnchanged(target, cli(target, ["update", target, "--force"], local.env), before,
      /Unable to clone|channel major mismatch|approval/);
  }
});

test("real historical 1.x updater stays on default main; explicit --from remains outside the new guard", async t => {
  const archive = command("git", ["archive", "v1.34.1"], { cwd: repository, encoding: null });
  if (archive.status !== 0) { t.skip("Historical v1.34.1 Git object unavailable"); return; }
  const old = await mkdtemp(path.join(root, "historical-"));
  success(command("tar", ["-x", "-C", old], { input: archive.stdout }));
  const target = await mkdtemp(path.join(root, "old-installed-"));
  success(cli(old, ["install", target]));
  const reply = path.join(root, "historical-reply.json"), log = path.join(root, "historical-fetch.log");
  await putJson(reply, { schemaVersion: 1, name: "vydykhai", canonicalSource: canonical, version: "1.34.2" });
  success(cli(target, ["doctor", target, "--json"], { FETCH_REPLY: reply, FETCH_LOG: log }));
  assert.equal((await readFile(log, "utf8")).trim(),
    "https://raw.githubusercontent.com/vonjor-lab/vydykhai-humans-as-agents/main/vydykhai.json");
  const local = await remote();
  success(cli(target, ["update", target], local.env));
  assert.equal((await json(path.join(target, ".vydykhai-lock.json"))).installedVersion, "1.34.2");
  const bypass = await mkdtemp(path.join(root, "old-explicit-"));
  success(cli(old, ["install", bypass]));
  success(cli(bypass, ["update", bypass, "--from", await source("2.0.0")]));
  assert.equal((await json(path.join(bypass, ".vydykhai-lock.json"))).installedVersion, "2.0.0");
  const before = await tree(bypass);
  await refusedUnchanged(bypass, cli(bypass, ["update", bypass, "--from", await source("1.34.1")]), before, /approval/);
});
