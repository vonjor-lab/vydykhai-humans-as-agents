import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtemp, realpath, rm, writeFile, symlink, readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {observeRepositoryHealth} from "../scripts/control-repo-observation.mjs";

function git(cwd, ...args) {
  return execFileSync("git", args, {cwd, encoding: "utf8", timeout: 2000,
    env: {...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid"}}).trim();
}
async function fixture(t, commit = true) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "repo-observation-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  git(root, "init", "-q", "-b", "main");
  if (commit) {
    await writeFile(path.join(root, "tracked.txt"), "original\n");
    git(root, "add", "tracked.txt"); git(root, "commit", "-qm", "initial");
  }
  return root;
}

test("observes actual refs, repeat-stable facts, canonical paths and changed branch inventory", async t => {
  const root = await fixture(t), sha = git(root, "rev-parse", "HEAD");
  git(root, "update-ref", "refs/remotes/origin/main", sha);
  git(root, "remote", "add", "origin", "https://secret:credential@example.invalid/private");
  const index = await readFile(path.join(root, ".git", "index"));
  const first = await observeRepositoryHealth(root), second = await observeRepositoryHealth(root);
  assert.equal(first.status, "OBSERVED"); assert.equal(first.digest, second.digest);
  assert.equal(first.branchCount, 2); assert.equal(first.worktreeCount, 1); assert.equal(first.dirtyCount, 0);
  assert.deepEqual(first.head, {sha, branch: "refs/heads/main", detached: false, unborn: false});
  assert.deepEqual(first.branches, [{name: "refs/heads/main", sha}, {name: "refs/remotes/origin/main", sha}]);
  assert.equal(first.worktrees[0].path, root);
  assert.equal(JSON.stringify(first).includes("credential"), false);
  assert.deepEqual(await readFile(path.join(root, ".git", "index")), index);
  const alias = `${root}-alias`; await symlink(root, alias); t.after(() => rm(alias, {force: true}));
  assert.equal((await observeRepositoryHealth(alias)).digest, first.digest);
  git(root, "branch", "new-branch");
  const changed = await observeRepositoryHealth(root);
  assert.equal(changed.branchCount, 3); assert.notEqual(changed.digest, first.digest);
  assert.ok(Number.isFinite(Date.parse(changed.observedAt)));
});

test("counts unique dirty entries across real linked worktrees, including renames and unusual paths", async t => {
  const root = await fixture(t), linked = `${root}-linked`;
  t.after(() => rm(linked, {recursive: true, force: true}));
  git(root, "worktree", "add", "-q", "-b", "task", linked);
  git(root, "mv", "tracked.txt", "renamed.txt");
  await writeFile(path.join(root, "renamed.txt"), "changed after rename\n");
  await writeFile(path.join(root, "untracked\nfile.txt"), "private file content\n");
  await writeFile(path.join(linked, "tracked.txt"), "unique linked work\n");
  const result = await observeRepositoryHealth(root);
  assert.equal(result.status, "OBSERVED"); assert.equal(result.worktreeCount, 2);
  assert.equal(result.dirtyCount, 3);
  assert.equal(result.worktrees.find(w => w.path === root).dirtyCount, 2);
  assert.deepEqual(result.worktrees.find(w => w.path === root).dirtyPaths.map(r=>r.path).sort(),["renamed.txt","untracked\nfile.txt"].sort());
  assert.ok(result.worktrees.find(w => w.path === root).dirtyPaths.every(r=>Object.keys(r).every(k=>["path","status","previousPath"].includes(k))));
  assert.equal(result.worktrees.find(w => w.path === linked).dirtyCount, 1);
  assert.equal(result.worktrees.find(w => w.path === linked).branch, "refs/heads/task");
  assert.equal(JSON.stringify(result).includes("private file content"), false);
  assert.equal(result.digest, (await observeRepositoryHealth(root)).digest);
});

test("handles unborn and detached HEAD without inventing a committed head", async t => {
  const root = await fixture(t, false);
  const unborn = await observeRepositoryHealth(root);
  assert.equal(unborn.status, "OBSERVED"); assert.equal(unborn.branchCount, 0);
  assert.deepEqual(unborn.head, {sha: null, branch: "refs/heads/main", detached: false, unborn: true});
  assert.equal(unborn.worktrees[0].head, null);
  await writeFile(path.join(root, "first.txt"), "first\n");
  git(root, "add", "first.txt"); git(root, "commit", "-qm", "initial");
  git(root, "checkout", "-q", "--detach");
  const detached = await observeRepositoryHealth(root);
  assert.equal(detached.status, "OBSERVED"); assert.equal(detached.head.detached, true);
  assert.equal(detached.head.branch, null); assert.equal(detached.head.unborn, false);
  assert.equal(detached.worktrees[0].detached, true);
});

test("nonrepositories, invalid paths and files are LIMITED with unknown counts", async t => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "not-repository-")));
  t.after(() => rm(root, {recursive: true, force: true}));
  const file = path.join(root, "file"); await writeFile(file, "not a directory");
  for (const workspace of [root, `${root}/missing`, file, "relative", null, ""]) {
    const result = await observeRepositoryHealth(workspace);
    assert.equal(result.status, "LIMITED"); assert.ok(result.reason);
    assert.equal(result.head, null); assert.equal(result.branchCount, null);
    assert.equal(result.worktreeCount, null); assert.equal(result.dirtyCount, null);
    assert.match(result.digest, /^[a-f0-9]{64}$/);
  }
});

test("unavailable registered worktrees produce LIMITED instead of a clean total", async t => {
  const root = await fixture(t), linked = `${root}-missing`;
  git(root, "worktree", "add", "-q", "-b", "missing", linked);
  await rm(linked, {recursive: true, force: true});
  const result = await observeRepositoryHealth(root);
  assert.equal(result.status, "LIMITED"); assert.equal(result.reason, "WORKTREE_UNAVAILABLE");
  assert.equal(result.dirtyCount, null);
});

test("type changes are dirty and oversized actual ref output is LIMITED", async t => {
  const root = await fixture(t), sha = git(root, "rev-parse", "HEAD");
  await rm(path.join(root, "tracked.txt"));
  await symlink("target", path.join(root, "tracked.txt"));
  const changed = await observeRepositoryHealth(root);
  assert.equal(changed.status, "OBSERVED"); assert.equal(changed.dirtyCount, 1);
  const refs = Array.from({length: 5000}, (_, i) => `${sha} refs/heads/branch-${i}-${"x".repeat(80)}\n`);
  await writeFile(path.join(root, ".git", "packed-refs"), refs.join(""));
  const limited = await observeRepositoryHealth(root);
  assert.equal(limited.status, "LIMITED"); assert.equal(limited.reason, "OUTPUT_LIMIT");
  assert.equal(limited.branchCount, null); assert.equal(limited.dirtyCount, null);
});

test("dirty bytes and staged-only blob changes invalidate evidence without exposing content",async t=>{
  const root=await fixture(t),file=path.join(root,"tracked.txt");
  await writeFile(file,"first");
  const first=await observeRepositoryHealth(root);
  await writeFile(file,"other");
  const second=await observeRepositoryHealth(root);
  assert.equal(first.dirtyCount,second.dirtyCount);assert.notEqual(first.digest,second.digest);
  git(root,"add","tracked.txt");await writeFile(file,"unchanged working bytes");
  const third=await observeRepositoryHealth(root);
  await writeFile(file,"different staged content");git(root,"add","tracked.txt");
  await writeFile(file,"unchanged working bytes");
  const fourth=await observeRepositoryHealth(root);
  assert.equal(third.worktrees[0].dirtyDigest,fourth.worktrees[0].dirtyDigest);
  assert.notEqual(third.worktrees[0].indexDigest,fourth.worktrees[0].indexDigest);
  assert.notEqual(third.digest,fourth.digest);
  assert.equal(JSON.stringify(fourth).includes("unchanged working bytes"),false);
});
test("oversized dirty content is unknown, not stable evidence from only its count",async t=>{
  const root=await fixture(t);
  await writeFile(path.join(root,"large.bin"),Buffer.alloc(2*1024*1024+1));
  const result=await observeRepositoryHealth(root);
  assert.equal(result.status,"LIMITED");assert.equal(result.reason,"DIRTY_BYTE_LIMIT");
  assert.equal(result.dirtyCount,null);
});
