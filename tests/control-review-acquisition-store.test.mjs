import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,mkdir,readFile,writeFile,readdir,rm,symlink,realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {openReviewAcquisitionStore} from "../scripts/control-review-acquisition-store.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
const hash=x=>sha256(canonicalJson(x));
const context={runId:"test"},policy={maxBytes:1310720,maxChars:16384};
async function fixture(t) {
  const dir=await realpath(await mkdtemp(path.join(tmpdir(),"review-acquisition-")));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  return dir;
}
const call=i=>({args:{id:"source",offset:i*16384,length:16384},
  value:{id:`window-${i}`,text:"x".repeat(16384),window:{afterBytes:(i+1)*16384}}});

test("compact acquisition preserves calls and inline history without cumulative text snapshots",async t=>{
  const dir=await fixture(t),old=await openControlStore(dir),first=call(0);
  await old.initialize({context:hash(context),policy:hash(policy),calls:[first]});
  const original=await readFile(path.join(dir,"0000000000.json"));
  const store=await openReviewAcquisitionStore(dir,context,policy);
  for(let i=1;i<9;i++)await store.append(call(i));
  const all=await (await openReviewAcquisitionStore(dir,context,policy)).restore();
  assert.deepEqual(all,Array.from({length:9},(_,i)=>call(i)));
  assert.deepEqual(await readFile(path.join(dir,"0000000000.json")),original);
  const state=(await old.read()).state;
  assert.equal(state.calls[0].value.text,first.value.text);
  assert.ok(state.calls.slice(1).every(r=>Object.keys(r).sort().join()==="schema,sha256"));
  assert.ok(Buffer.byteLength(canonicalJson(state))<20000);
  await assert.rejects(openReviewAcquisitionStore(dir,{runId:"other"},policy),/BINDING_INVALID/);
});

test("compact acquisition rejects tampering, missing and linked blobs; orphan blobs grant no read",async t=>{
  for(const mode of ["tamper","missing","symlink","orphan"]){
    const parent=await fixture(t),dir=path.join(parent,"journal");await mkdir(dir,{mode:0o700});
    const store=await openReviewAcquisitionStore(dir,context,policy);
    await store.append(call(0));
    const blob=path.join(dir,(await readdir(dir)).find(n=>n.startsWith("call-")));
    if(mode==="orphan"){
      await writeFile(path.join(dir,`call-${hash(call(1))}.json`),canonicalJson(call(1)),{mode:0o600});
      assert.deepEqual(await store.restore(),[call(0)]);continue;
    }
    if(mode==="tamper")await writeFile(blob,"{}",{mode:0o600});
    else await rm(blob);
    if(mode==="symlink"){
      const outside=path.join(parent,"outside.json");await writeFile(outside,canonicalJson(call(0)),{mode:0o600});
      await symlink(outside,blob);
    }
    await assert.rejects(store.restore(),/PAYLOAD_CHANGED|PAYLOAD_UNSAFE|ENOENT/);
  }
});
