import {runControlChild} from "./control-child.mjs";
import {realpath, stat, lstat, open, readlink} from "node:fs/promises";
import {constants} from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";

const LIMIT = 512 * 1024, TIMEOUT = 2000, MAX_WORKTREES = 32;
const MAX_FILE = 2 * 1024 * 1024, MAX_DIRTY_BYTES = 16 * 1024 * 1024;
const shaPattern = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const failure = reason => Object.assign(new Error(reason), {reason});
async function git(cwd, args, allowed = [0]) {
    const env = {PATH: process.env.PATH, LC_ALL: "C", GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_LAZY_FETCH: "1", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null"};
    if (process.env.SystemRoot) env.SystemRoot = process.env.SystemRoot;
    const result = await runControlChild({executable:"git",args:["-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false", ...args],
      cwd,env,input:"",timeoutMs:TIMEOUT,maxBytes:LIMIT});
    if(result.reason === "OUTPUT_CAPACITY")throw failure("OUTPUT_LIMIT");
    if(result.reason || result.state !== "CLOSED")throw failure(result.reason === "SPAWN_FAILED" ? "GIT_UNAVAILABLE" : "COMMAND_TIMEOUT");
    if(!allowed.includes(result.code))throw failure("GIT_COMMAND_FAILED");
    return {code:result.code,output:result.output};
}
function worktreeFacts(output) {
  const result = [];
  let entry;
  for (const field of output.split("\0")) {
    if (!field) {if (entry) result.push(entry); entry = undefined; continue;}
    const space = field.indexOf(" "), key = space < 0 ? field : field.slice(0, space);
    const value = space < 0 ? "" : field.slice(space + 1);
    if (key === "worktree") {
      if (entry || !path.isAbsolute(value)) throw failure("INVALID_GIT_OUTPUT");
      entry = {path: value, head: null, branch: null, detached: false, bare: false};
    } else if (!entry) throw failure("INVALID_GIT_OUTPUT");
    else if (key === "HEAD") {
      if (!shaPattern.test(value)) throw failure("INVALID_GIT_OUTPUT");
      entry.head = /^0+$/.test(value) ? null : value;
    } else if (key === "branch") entry.branch = value;
    else if (key === "detached") entry.detached = true;
    else if (key === "bare") entry.bare = true;
  }
  if (entry) throw failure("INVALID_GIT_OUTPUT");
  if (!result.length || result.length > MAX_WORKTREES) throw failure("WORKTREE_LIMIT_OR_INVALID_OUTPUT");
  return result;
}
function dirtyEntries(output) {
  if (!output) return [];
  const entries = output.split("\0");
  if (entries.pop() !== "") throw failure("INVALID_GIT_OUTPUT");
  const rows = [];
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!/^[ MTADRCU?!]{2} .+$/s.test(entry)) throw failure("INVALID_GIT_OUTPUT");
    const row = {status:entry.slice(0,2),path:entry.slice(3)};
    if (/[RC]/.test(row.status)) {
      row.previousPath = entries[++i];
      if(!row.previousPath)throw failure("INVALID_GIT_OUTPUT");
    }
    rows.push(row);
  }
  return rows;
}

async function dirtyIdentity(root, rows, budget) {
  const within = p => p === root || p.startsWith(root + path.sep);
  const stable = (a,b) => ["dev","ino","size","mtimeMs","ctimeMs","mode"].every(k => a[k] === b[k]);
  for(const row of rows) {
    const file = path.resolve(root,row.path);
    if(path.isAbsolute(row.path) || !within(file))throw failure("DIRTY_PATH_INVALID");
    let before;
    try {before = await lstat(file);} catch(error) {
      if(error.code === "ENOENT") {row.identity = "MISSING"; continue;}
      throw error;
    }
    row.mode = before.mode;
    if(!within(await realpath(path.dirname(file))))throw failure("DIRTY_PATH_EXTERNAL");
    if(before.isSymbolicLink()) {
      row.identity = createHash("sha256").update(await readlink(file)).digest("hex");
      if(!stable(before,await lstat(file)))throw failure("DIRTY_SOURCE_CHANGED");
      continue;
    }
    if(!before.isFile())throw failure("DIRTY_NON_FILE");
    if(before.size > MAX_FILE || budget.bytes + before.size > MAX_DIRTY_BYTES)throw failure("DIRTY_BYTE_LIMIT");
    budget.bytes += before.size;
    const fd = await open(file,constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if(!stable(before,await fd.stat()))throw failure("DIRTY_SOURCE_CHANGED");
      const digest = createHash("sha256"), buffer = Buffer.alloc(Math.min(before.size+1,65536));
      let offset = 0;
      while(offset <= before.size) {
        const {bytesRead} = await fd.read(buffer,0,Math.min(buffer.length,before.size+1-offset),offset);
        if(!bytesRead)break;
        offset += bytesRead; digest.update(buffer.subarray(0,bytesRead));
      }
      if(offset !== before.size || !stable(before,await fd.stat()) || !stable(before,await lstat(file)))
        throw failure("DIRTY_SOURCE_CHANGED");
      row.identity = digest.digest("hex");
    } finally {await fd.close();}
  }
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

export async function observeRepositoryHealth(workspace) {
  let facts = {schema: "control.repo-observation.v1", status: "LIMITED", head: null,
    branchCount: null, worktreeCount: null, dirtyCount: null, branches: [], worktrees: []};
  try {
    if (typeof workspace !== "string" || !path.isAbsolute(workspace)) throw failure("INVALID_WORKSPACE");
    let cwd;
    try {cwd = await realpath(workspace); if (!(await stat(cwd)).isDirectory()) throw Error();}
    catch {throw failure("INVALID_WORKSPACE");}
    const inside = await git(cwd, ["rev-parse", "--is-inside-work-tree"], [0, 128]);
    if (inside.code !== 0 || inside.output.trim() !== "true") throw failure("NOT_A_WORKTREE");
    const symbolic = await git(cwd, ["symbolic-ref", "--quiet", "HEAD"], [0, 1]);
    const resolved = await git(cwd, ["rev-parse", "--verify", "--quiet", "HEAD"], [0, 1]);
    const branch = symbolic.code === 0 ? symbolic.output.trim() : null;
    const sha = resolved.code === 0 ? resolved.output.trim() : null;
    if ((branch && !branch.startsWith("refs/heads/")) || (sha && !shaPattern.test(sha)) || (!sha && !branch))
      throw failure("INVALID_HEAD");
    const head = {sha, branch, detached: branch === null, unborn: sha === null};
    const refs = (await git(cwd, ["for-each-ref", "--format=%(refname)%00%(objectname)%00",
      "refs/heads/", "refs/remotes/"])).output;
    const branches = refs ? refs.trimEnd().split("\n").map(line => {
      const [name, sha, end, extra] = line.split("\0");
      if (!/^refs\/(heads|remotes)\/.+/.test(name) || !shaPattern.test(sha) || end !== "" || extra !== undefined)
        throw failure("INVALID_GIT_OUTPUT");
      return {name, sha};
    }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0) : [];
    const listed = worktreeFacts((await git(cwd, ["worktree", "list", "--porcelain", "-z"])).output);
    const worktrees = [], seen = new Set(), budget = {bytes:0};
    for (const item of listed) {
      if (item.bare) throw failure("BARE_WORKTREE");
      let canonical;
      try {canonical = await realpath(item.path);} catch {throw failure("WORKTREE_UNAVAILABLE");}
      if (seen.has(canonical)) throw failure("DUPLICATE_WORKTREE");
      seen.add(canonical);
      const statusArgs = ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignore-submodules=none"];
      const status = (await git(canonical,statusArgs)).output, rows = dirtyEntries(status);
      const dirtyDigest = await dirtyIdentity(canonical,rows,budget);
      const staged = (await git(canonical,["diff","--cached","--raw","-z","--no-abbrev","--no-renames","--no-ext-diff"])).output;
      if(status !== (await git(canonical,statusArgs)).output)throw failure("DIRTY_SOURCE_CHANGED");
      const indexDigest = createHash("sha256").update(staged).digest("hex");
      const dirtyPaths=rows.map(({path,status,previousPath})=>({path,status,...(previousPath?{previousPath}:{})}));
      worktrees.push({path: canonical, head: item.head, branch: item.branch, detached: item.detached,
        dirtyCount:rows.length,dirtyPaths,dirtyDigest,indexDigest});
    }
    worktrees.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    const observed = {...facts, status: "OBSERVED", head, branchCount: branches.length, worktreeCount: worktrees.length,
      dirtyCount: worktrees.reduce((sum, item) => sum + item.dirtyCount, 0), branches, worktrees};
    if(Buffer.byteLength(JSON.stringify(observed))>LIMIT)throw failure("OBSERVATION_LIMIT");
    facts=observed;
  } catch (error) {facts.reason = error.reason ?? "OBSERVATION_FAILED";}
  return {...facts, digest: createHash("sha256").update(JSON.stringify(facts)).digest("hex"),
    observedAt: new Date().toISOString()};
}
