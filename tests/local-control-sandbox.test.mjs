import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,realpath,writeFile,readFile,lstat,symlink,link,rename,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {execFileSync,spawnSync} from "node:child_process";
import {localControlSandbox} from "../scripts/local-control-sandbox.mjs";

const darwin={skip:process.platform!=="darwin",timeout:15000};
async function fixture(t) {
  const root=await realpath(await mkdtemp(path.join(tmpdir(),"exact-write-sandbox-")));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const workspace=path.join(root,"workspace"),controlRoot=path.join(root,"control");
  await mkdir(workspace);await mkdir(controlRoot);
  execFileSync("git",["init","--quiet",workspace],{env:{PATH:process.env.PATH},stdio:"pipe"});
  for(const file of ["owned.txt","other.txt"])await writeFile(path.join(workspace,file),"before");
  await writeFile(path.join(controlRoot,"private.txt"),"private");
  return {root,workspace,controlRoot,file:path.join(workspace,"owned.txt")};
}
const exact=x=>localControlSandbox({...x,writeFiles:["owned.txt"]});
function run(x,launch,body) {
  const spec=launch({executable:process.execPath,args:["-e",`const fs=require('node:fs');${body}`],cwd:x.workspace});
  const result=spawnSync(spec.executable,spec.args,{cwd:x.workspace,env:{PATH:process.env.PATH},
    encoding:"utf8",timeout:5000,maxBuffer:65536});
  assert.equal(result.error,undefined,result.error?.message);
  assert.equal(result.signal,null,result.stderr);
  assert.equal(result.status,0,result.stderr||result.stdout);
  return result;
}
const denied=body=>`try{${body};process.exit(9)}catch(e){if(!['EPERM','EACCES'].includes(e.code))throw e}process.stdout.write('DENIED');`;

test("exact writeFiles changes permitted bytes in place",darwin,async t=>{
  const x=await fixture(t),before=await lstat(x.file),launch=await exact(x);
  run(x,launch,"const fd=fs.openSync('owned.txt','r+');fs.writeSync(fd,'AFTER!',0,'utf8');fs.closeSync(fd);");
  assert.equal(await readFile(x.file,"utf8"),"AFTER!");
  const after=await lstat(x.file);
  for(const field of ["dev","ino","mode","nlink"])assert.equal(after[field],before[field]);
});

for(const [name,body,absent] of [
  ["other file","fs.writeFileSync('other.txt','bad')"],
  ["new file","fs.writeFileSync('new.txt','bad')","new.txt"],
  ["parent directory","fs.mkdirSync('new-directory')","new-directory"],
  ["Git metadata","fs.appendFileSync('.git/config','bad')"],
  ["rename permitted file","fs.renameSync('owned.txt','moved.txt')","moved.txt"],
  ["rename over permitted file","fs.renameSync('other.txt','owned.txt')"],
  ["unlink permitted file","fs.unlinkSync('owned.txt')"],
  ["chmod permitted file","fs.chmodSync('owned.txt',0o777)"],
  ["symlink creation","fs.symlinkSync('owned.txt','symlink.txt')","symlink.txt"],
  ["hardlink creation","fs.linkSync('owned.txt','hardlink.txt')","hardlink.txt"]
])test(`exact writeFiles denies ${name}`,darwin,async t=>{
  const x=await fixture(t),before=await lstat(x.file),gitConfig=await readFile(path.join(x.workspace,".git/config"));
  assert.equal(run(x,await exact(x),denied(body)).stdout,"DENIED");
  assert.equal(await readFile(x.file,"utf8"),"before");
  assert.equal(await readFile(path.join(x.workspace,"other.txt"),"utf8"),"before");
  assert.deepEqual(await readFile(path.join(x.workspace,".git/config")),gitConfig);
  const after=await lstat(x.file);
  for(const field of ["dev","ino","mode","nlink"])assert.equal(after[field],before[field]);
  if(absent)await assert.rejects(lstat(path.join(x.workspace,absent)),{code:"ENOENT"});
});

test("exact writeFiles denies actual child process creation",darwin,async t=>{
  const x=await fixture(t);
  run(x,await exact(x),"const child=require('node:child_process').spawnSync('/usr/bin/true',[],{encoding:'utf8'});if(!child.error||!['EPERM','EACCES'].includes(child.error.code))throw Error('FORK_NOT_DENIED');");
});

test("exact writeFiles keeps control contents and writes protected",darwin,async t=>{
  const x=await fixture(t),launch=await exact(x),secret=JSON.stringify(path.join(x.controlRoot,"private.txt"));
  for(const body of [`fs.readFileSync(${secret})`,`fs.writeFileSync(${secret},'bad')`])
    assert.equal(run(x,launch,denied(body)).stdout,"DENIED");
  assert.equal(await readFile(path.join(x.controlRoot,"private.txt"),"utf8"),"private");
});

for(const [name,writeFiles,readOnly] of [
  ["null",null,false],["string","owned.txt",false],["empty",[],false],
  ["multiple",["owned.txt","other.txt"],false],["duplicate",["owned.txt","owned.txt"],false],
  ["sparse",Array(1),false],["readOnly conflict",["owned.txt"],true]
])test(`writeFiles rejects invalid mode: ${name}`,darwin,async t=>{
  const x=await fixture(t);
  await assert.rejects(localControlSandbox({...x,writeFiles,readOnly}),/CONTROL_SANDBOX_MODE_INVALID/);
});

for(const file of ["../outside.txt","./owned.txt","dir/../owned.txt","dir//owned.txt","owned.txt/","owned\\txt","owned\n.txt","",42])
  test(`writeFiles rejects invalid relative target ${JSON.stringify(file)}`,darwin,async t=>{
    const x=await fixture(t);
    await assert.rejects(localControlSandbox({...x,writeFiles:[file]}),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
  });

test("writeFiles rejects missing, directory, absolute and Git metadata targets",darwin,async t=>{
  const x=await fixture(t);
  for(const file of ["missing.txt",".git",x.file,".git/config"])
    await assert.rejects(localControlSandbox({...x,writeFiles:[file]}),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
});

test("writeFiles rejects symlink file and parent aliases",darwin,async t=>{
  const x=await fixture(t);
  await symlink(x.file,path.join(x.workspace,"alias.txt"));
  await mkdir(path.join(x.workspace,"files"));
  await writeFile(path.join(x.workspace,"files/nested.txt"),"before");
  await symlink(path.join(x.workspace,"files"),path.join(x.workspace,"alias-directory"));
  for(const file of ["alias.txt","alias-directory/nested.txt"])
    await assert.rejects(localControlSandbox({...x,writeFiles:[file]}),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
});

test("writeFiles rejects a hardlinked target even when its other name is outside workspace",darwin,async t=>{
  const x=await fixture(t);await link(x.file,path.join(x.root,"outside-alias.txt"));
  assert.equal((await lstat(x.file)).nlink,2);
  await assert.rejects(exact(x),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
});

for(const change of ["symlink","hardlink","replacement"])test(`writeFiles rechecks target identity before launch after ${change}`,darwin,async t=>{
  const x=await fixture(t),launch=await exact(x);
  if(change==="hardlink")await link(x.file,path.join(x.root,"late-alias.txt"));
  else {
    await rename(x.file,path.join(x.root,"original.txt"));
    if(change==="symlink")await symlink(path.join(x.workspace,"other.txt"),x.file);
    else await writeFile(x.file,"replacement");
  }
  assert.throws(()=>launch({executable:process.execPath,args:["-e",""],cwd:x.workspace}),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
});

test("writeFiles rejects relocated Git metadata",darwin,async t=>{
  const x=await fixture(t);
  await rm(path.join(x.workspace,".git"),{recursive:true});
  execFileSync("git",["init","--quiet",`--separate-git-dir=${path.join(x.workspace,"admin")}`,x.workspace],
    {env:{PATH:process.env.PATH},stdio:"pipe"});
  await assert.rejects(localControlSandbox({...x,writeFiles:["admin/config"]}),/CONTROL_SANDBOX_WRITE_FILE_INVALID/);
});

test("legacy workspace and readOnly modes retain actual process behavior",darwin,async t=>{
  const x=await fixture(t);
  run(x,await localControlSandbox(x),"fs.writeFileSync('other.txt','legacy');const child=require('node:child_process').spawnSync('/usr/bin/true',[]);if(child.status!==0)throw Error('LEGACY_FORK_CHANGED');");
  assert.equal(await readFile(path.join(x.workspace,"other.txt"),"utf8"),"legacy");
  const launch=await localControlSandbox({...x,readOnly:true});
  assert.equal(run(x,launch,denied("fs.writeFileSync('owned.txt','bad')")).stdout,"DENIED");
  run(x,launch,"if(fs.readFileSync('owned.txt','utf8')!=='before')throw Error('READ_FAILED');const child=require('node:child_process').spawnSync('/usr/bin/true',[]);if(!child.error||!['EPERM','EACCES'].includes(child.error.code))throw Error('READONLY_FORK_CHANGED');");
});

test("unsupported hosts refuse every sandbox mode",async t=>{
  const descriptor=Object.getOwnPropertyDescriptor(process,"platform");
  Object.defineProperty(process,"platform",{...descriptor,value:"linux"});
  t.after(()=>Object.defineProperty(process,"platform",descriptor));
  for(const options of [{},{readOnly:true},{writeFiles:["owned.txt"]}])
    await assert.rejects(localControlSandbox({workspace:"/unused",controlRoot:"/unused-control",...options}),/CONTROL_SANDBOX_UNSUPPORTED/);
});
