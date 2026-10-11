// Bounded one-file observations, not a write trace or external-writer lock.
import {lstat,realpath,readdir,readFile,readlink} from "node:fs/promises";
import path from "node:path";
import {canonicalJson,sha256} from "./memory-brief.mjs";
import {observeRepositoryHealth} from "./control-repo-observation.mjs";
import {readCommandSuccess} from "./context-run.mjs";

const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
const sealed=new WeakMap();
export const readCommandEffects=observed=>sealed.has(observed)?structuredClone(sealed.get(observed)):null;
export async function observeConfinedFile(workspace,file) {
  need(process.platform==="darwin","HEALTH_DOMAIN_HOST_UNSUPPORTED");
  need(typeof file==="string" && !path.isAbsolute(file) && file.split("/").every(p=>p&&p!=="."&&p!==".."&&p.toLowerCase()!==".git") &&
    !/[\\\x00-\x1f\x7f]/.test(file),"HEALTH_DOMAIN_FILE_INVALID");
  need(await realpath(workspace)===workspace,"HEALTH_DOMAIN_WORKSPACE_INVALID");
  const target=path.join(workspace,file),before=await lstat(target);
  need(before.isFile()&&before.nlink===1&&await realpath(target)===target,"HEALTH_DOMAIN_FILE_INVALID");
  // This narrow route supports a normal worktree with local Git metadata only.
  const git=await lstat(path.join(workspace,".git"));
  need(git.isDirectory()&&!git.isSymbolicLink(),"HEALTH_DOMAIN_GIT_LAYOUT_UNSUPPORTED");
  const repository=await observeRepositoryHealth(workspace);
  need(repository.status==="OBSERVED","HEALTH_DOMAIN_REPOSITORY_UNKNOWN");
  const worktree=repository.worktrees.find(w=>w.path===workspace);
  need(worktree?.dirtyPaths.some(r=>r.path===file&&!r.previousPath&&!["D","R","C","U","!"].some(c=>r.status.includes(c))),"HEALTH_DOMAIN_ALREADY_DIRTY_REQUIRED");
  let count=0,total=0,fileSha256;
  const rows=[];
  const walk=async relative=>{
    need(++count<=4096,"HEALTH_DOMAIN_OBSERVATION_CAPACITY");
    const full=path.join(workspace,relative),s=await lstat(full);
    const row={path:relative,dev:s.dev,ino:s.ino,mode:s.mode,nlink:s.nlink};
    if(relative!==file)Object.assign(row,{size:s.size,mtimeMs:s.mtimeMs,ctimeMs:s.ctimeMs});
    if(s.isDirectory()) {
      for(const name of (await readdir(full)).sort())await walk(relative?`${relative}/${name}`:name);
      const after=await lstat(full);
      need(["dev","ino","mode","nlink","size","mtimeMs","ctimeMs"].every(k=>s[k]===after[k]),"HEALTH_DOMAIN_OBSERVATION_DRIFT");
    } else if(s.isFile()) {
      need(s.size<=2*1024*1024&&(total+=s.size)<=16*1024*1024,"HEALTH_DOMAIN_OBSERVATION_CAPACITY");
      const bytes=await readFile(full),after=await lstat(full);
      need(["dev","ino","mode","nlink","size","mtimeMs","ctimeMs"].every(k=>s[k]===after[k]) && bytes.length===s.size,"HEALTH_DOMAIN_OBSERVATION_DRIFT");
      if(relative===file)fileSha256=sha256(bytes);else row.sha256=sha256(bytes);
    } else if(s.isSymbolicLink())row.sha256=sha256(await readlink(full));
    else throw Error("HEALTH_DOMAIN_FILE_TYPE_UNSUPPORTED");
    rows.push(row);
  };
  await walk("");
  const repositoryAgain=await observeRepositoryHealth(workspace);
  const repositoryFacts=({observedAt,...facts})=>facts;
  need(hash(repositoryFacts(repositoryAgain))===hash(repositoryFacts(repository)),"HEALTH_DOMAIN_OBSERVATION_DRIFT");
  const after=await lstat(target);
  need(["dev","ino","mode","nlink","size","mtimeMs","ctimeMs"].every(k=>before[k]===after[k]),"HEALTH_DOMAIN_OBSERVATION_DRIFT");
  const {observedAt,digest,...protectedRepository}=repository;
  // The omitted digest is derived from bytes also covered by the bounded tree.
  protectedRepository.worktrees=protectedRepository.worktrees.map(w=>{
    if(w.path!==workspace)return w;
    const {dirtyDigest,...facts}=w;return facts;
  });
  return {schema:"control.confined-file-observation.v1",file,identity:{dev:after.dev,ino:after.ino,mode:after.mode,nlink:after.nlink},
    fileSha256,repositorySha256:hash(repositoryFacts(repository)),
    protectedSha256:hash({repository:protectedRepository,rows})};
}

export function sealCommandEffects(observed,{result,grant,claim,before,after}) {
  const closed=readCommandSuccess(result),confined=grant.binding.confined;
  need(closed?.exitCode===0&&closed.signal===null&&closed.process.pid>0&&closed.process.launchExecutable==="/usr/bin/sandbox-exec"&&
    closed.confinement?.workspace===grant.executionRequest?.workspace && hash(closed.confinement.writeFiles)===hash(confined.writeFiles)&&
    closed.commandSha256===grant.binding.commandSha256&&closed.executable===grant.binding.executable&&closed.cwd===grant.binding.cwd&&
    before.file===confined.writeFiles[0]&&hash(before.identity)===hash(after.identity)&&before.protectedSha256===after.protectedSha256,
    "HEALTH_COMMAND_EFFECTS_UNPROVEN");
  const resultRecord={exitCode:result.exitCode,commandSha256:result.commandSha256,stdoutSha256:result.stdoutSha256,executable:result.executable,cwd:result.cwd};
  need(Object.keys(resultRecord).every(k=>resultRecord[k]===closed[k]) && hash(resultRecord)===observed.resultSha256,"HEALTH_COMMAND_RESULT_UNBOUND");
  const {decision,stateRevision,...storedGrant}=grant;
  sealed.set(observed,{schema:"control.command-effects.v1",grantSha256:hash(storedGrant),bindingSha256:claim.bindingSha256,
    claimSha256:hash(claim),resultSha256:observed.resultSha256,result:resultRecord,process:closed.process,
    confinement:closed.confinement,before,after});
}

export function validCompletedEffects(reservation,grant,domain) {
  const e=reservation?.effects;
  const {completionSha256,...record}=reservation??{};
  return reservation?.status==="COMPLETED"&&!reservation.failure&&!reservation.reconciliation&&e?.schema==="control.command-effects.v1"&&
    completionSha256===hash(record)&&reservation.grantId===grant.id&&reservation.reservationId===grant.id&&
    reservation.bindingSha256===grant.bindingSha256&&reservation.nextTask===grant.binding.taskId&&
    hash(reservation.dependencies)===hash(grant.dependencies)&&hash(reservation.dispositions)===hash({})&&
    e.grantSha256===hash(grant)&&e.bindingSha256===grant.bindingSha256&&e.resultSha256===reservation.resultSha256&&
    hash(e.result)===e.resultSha256&&e.result.exitCode===0&&e.result.commandSha256===grant.binding.commandSha256&&
    e.result.cwd===grant.binding.cwd&&e.result.executable===grant.binding.executable&&
    e.before?.file===domain.file&&e.after?.file===domain.file&&hash(e.before.identity)===hash(domain.observation.identity)&&
    hash(e.after.identity)===hash(domain.observation.identity)&&e.before.protectedSha256===domain.observation.protectedSha256&&
    e.after.protectedSha256===e.before.protectedSha256&&e.before.fileSha256===domain.observation.fileSha256&&
    e.process?.pid>0&&e.process.launchExecutable==="/usr/bin/sandbox-exec"&&
    Number.isFinite(Date.parse(e.process.closedAt))&&Date.parse(e.process.closedAt)>=Date.parse(e.process.startedAt)&&
    e.confinement?.workspace===grant.executionRequest?.workspace&&hash(e.confinement.writeFiles)===hash(grant.binding.confined.writeFiles)&&
    e.claimSha256===hash({status:"RESERVED",grantId:reservation.grantId,bindingSha256:reservation.bindingSha256,
      stateRevision:reservation.stateRevision,reservationId:reservation.reservationId});
}
