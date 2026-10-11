// Maintainer preparation only: no command dispatch, grant or independent verdict.
import {readFile, writeFile, realpath, lstat, access} from "node:fs/promises";
import {constants} from "node:fs";
import path from "node:path";
import {canonicalJson, sha256} from "./memory-brief.mjs";
const need = (ok, code) => { if (!ok) throw Error(code); };
const hash = value => sha256(canonicalJson(value));

export async function prepareUsefulRepair(setup, ctx, targetFile, expectedBytes, acceptedMap) {
  need(targetFile === "current-map.md" && (typeof expectedBytes === "string" || Buffer.isBuffer(expectedBytes)) &&
    typeof setup.config.executor === "string" && setup.config.executor.trim(), "USEFUL_REPAIR_ARGUMENT_INVALID");
  const root = await realpath(setup.workspace), expected = Buffer.from(expectedBytes);
  need(root === setup.workspace && expected.length <= 256 * 1024, "USEFUL_REPAIR_SCOPE_INVALID");
  const acquire = async name => {
    need(typeof name === "string" && !path.isAbsolute(name) && !name.split(/[\\/]/).includes(".."), "USEFUL_REPAIR_PATH_INVALID");
    const file = path.join(root,name), stat = await lstat(file);
    need(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && await realpath(file) === file && stat.size <= 1024 * 1024,
      "USEFUL_REPAIR_SOURCE_UNSAFE");
    const bytes = await readFile(file); return {ref:{path:name,sha256:sha256(bytes)},bytes};
  };
  const put = async (name,value) => {
    await writeFile(path.join(root,name),typeof value === "string" ? value : canonicalJson(value) + "\n",{flag:"wx",mode:0o400});
    return (await acquire(name)).ref;
  };
  const before = await acquire(targetFile), module = await acquire(setup.task.module.path);
  need(acceptedMap && acceptedMap.path !== targetFile, "USEFUL_REPAIR_ACCEPTED_MAP_REQUIRED");
  const accepted = await acquire(acceptedMap.path);
  need(accepted.ref.sha256 === acceptedMap.sha256 && accepted.bytes.equals(expected), "USEFUL_REPAIR_ACCEPTED_MAP_CHANGED");
  const dependencies = JSON.parse((await acquire(setup.task.dependencies)).bytes);
  need(module.ref.sha256 === setup.task.module.sha256 && !setup.task.candidateFiles.includes(targetFile) &&
    !dependencies.dependencies.some(d => d.path === targetFile) && setup.task.sourceSet !== targetFile &&
    !JSON.parse(module.bytes).implementationFiles.includes(targetFile), "USEFUL_REPAIR_PROTECTED_TARGET");
  const executable = await realpath(setup.task.action.executable);
  await access(executable,constants.X_OK);
  need((await lstat(executable)).isFile() && setup.task.action.cwd === ".", "USEFUL_REPAIR_EXECUTABLE_INVALID");
  // The generated action uses one descriptor and explicit offsets, with no second path lookup.
  const actionText = `import{openSync,readFileSync,writeSync,ftruncateSync,closeSync,fstatSync,constants}from'node:fs';
import{createHash}from'node:crypto';
const fd=openSync(${JSON.stringify(path.join(root,targetFile))},constants.O_RDWR|constants.O_NOFOLLOW);
try{const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1)throw Error('REPAIR_TARGET_UNSAFE');
if(createHash('sha256').update(readFileSync(fd)).digest('hex')!==${JSON.stringify(before.ref.sha256)})throw Error('REPAIR_TARGET_CHANGED');
const bytes=Buffer.from(${JSON.stringify(expected.toString("base64"))},'base64');
let offset=0;while(offset<bytes.length){const n=writeSync(fd,bytes,offset,bytes.length-offset,offset);if(n<=0)throw Error('REPAIR_SHORT_WRITE');offset+=n;}
ftruncateSync(fd,bytes.length);closeSync(fd);}catch(e){try{closeSync(fd)}catch{}throw e;}
`;
  const actionRef = await put("useful-repair-action.mjs",actionText);
  const planRef = await put("repair-plan.json",{target:targetFile,expectedSha256:sha256(expected),acceptedMap,
    scope:"Correct contradictory working map only; immutable accepted records and producer unchanged",
    beforeSha256:before.ref.sha256,executionAuthorized:false});
  const deps = await put("useful-repair-dependencies.json",{...dependencies,dependencies:[...dependencies.dependencies,
    {id:"useful-repair-action",path:actionRef.path,scope:setup.task.scope},
    {id:"useful-repair-plan",path:planRef.path,scope:setup.task.scope}]});
  const task = {...setup.task,id:"USEFUL-REPAIR",owner:setup.config.executor,dependencies:deps.path,
    action:{...setup.task.action,executable,args:[actionRef.path]}};
  const request = {schema:"context.request.v1",operation:"prepare",workspace:root,task:await put("useful-repair-task.json",task),
    capsule:null,readback:null,integrationPlan:null};
  const prepared = await ctx.runContextTransition(request);
  need(prepared.status === "PREPARED", "USEFUL_REPAIR_NOT_PREPARED");
  request.capsule = await put("useful-repair-capsule.json",prepared.capsule);
  const acquired = [];
  for (const ref of [request.task,request.capsule,actionRef,planRef,module.ref,before.ref,deps]) {
    const actual = await acquire(ref.path); need(actual.ref.sha256 === ref.sha256,"USEFUL_REPAIR_BYTES_CHANGED"); acquired.push(actual.ref);
  }
  const environment = {observedAt:new Date().toISOString(),method:"DIRECT_PROTECTED_NODE_DEPENDENT",executable,
    executableSha256:sha256(await readFile(executable)),cwd:root,extraEnv:{},
    inherited:Object.fromEntries(["PATH","SystemRoot","TMPDIR","TEMP"].filter(k => process.env[k]).map(k => [k,process.env[k]])),
    nativeLauncherUsed:false,executionAuthorized:false};
  const evidence = {schema:"qualification.useful-repair-preparation.v1",actor:task.owner,acquired,environment,
    action:{ref:actionRef,bytes:actionText},module:{ref:module.ref,bytes:module.bytes.toString("utf8")},
    target:{path:targetFile,before:{sha256:before.ref.sha256,base64:before.bytes.toString("base64"),status:"OBSERVED"},
      after:{sha256:sha256(expected),base64:expected.toString("base64"),status:"EXPECTED_NOT_EXECUTED"}},
    readiness:"PENDING_INDEPENDENT_PRE",executionAuthorized:false};
  const evidenceRef = await put("useful-repair-adapter-ack.json",evidence);
  request.readback = await put("useful-repair-readback.json",{schema:"context.readback.v1",worker:task.owner,
    taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,capability:"retained-progress-v1",evidenceRef});
  const binding = {operation:"resume",taskId:task.id,taskSha256:request.task.sha256,capsuleSha256:request.capsule.sha256,
    sourceDigest:prepared.coverageBasis.sourceDigest,dependencyDigest:prepared.coverageBasis.dependencyDigest,
    commandSha256:hash(task.action),cwd:root,executable,kind:"dependent"};
  return {request:{...request,operation:"resume"},task,prepared,binding,evidence,evidenceRef,actionRef,planRef,
    dependenciesRef:deps,executionAuthorized:false};
}
