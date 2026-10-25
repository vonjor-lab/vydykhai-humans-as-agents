// Retained source bodies are immutable blobs; CAS history carries only hashes.
// Existing inline history remains readable and is never rewritten.
import {open, readFile, lstat, realpath, link, unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {openControlStore} from "./control-store.mjs";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
const schema="control.review-acquisition-call.v1";
const validCall=c=>c && Object.keys(c).sort().join()==="args,value" &&
  c.args && typeof c.args==="object" && !Array.isArray(c.args) &&
  c.value && typeof c.value==="object" && !Array.isArray(c.value);

export async function openReviewAcquisitionStore(directory,context,policy) {
  const store=await openControlStore(directory);
  const check=s=>need(s.context===hash(context) && s.policy===hash(policy??null) && Array.isArray(s.calls),
    "MODEL_REVIEW_ACQUISITION_BINDING_INVALID");
  const initial=await store.read();
  if(!initial)await store.initialize({context:hash(context),policy:hash(policy??null),calls:[]});
  else check(initial.state);
  const payload=async ref=>{
    need(Object.keys(ref).sort().join()==="schema,sha256" && ref.schema===schema &&
      /^[a-f0-9]{64}$/.test(ref.sha256),"MODEL_REVIEW_ACQUISITION_REFERENCE_INVALID");
    const file=path.join(store.root,`call-${ref.sha256}.json`),stat=await lstat(file);
    need(stat.isFile() && !stat.isSymbolicLink() && !(stat.mode&0o077) && stat.size<=8*1024*1024 &&
      await realpath(file)===file,"MODEL_REVIEW_ACQUISITION_PAYLOAD_UNSAFE");
    const bytes=await readFile(file);
    need(bytes.length<=8*1024*1024 && sha256(bytes)===ref.sha256,"MODEL_REVIEW_ACQUISITION_PAYLOAD_CHANGED");
    const call=JSON.parse(bytes);
    need(validCall(call),"MODEL_REVIEW_ACQUISITION_CALL_INVALID");
    return call;
  };
  const restore=async()=>{
    const saved=(await store.read()).state;check(saved);
    const calls=[];
    for(const ref of saved.calls) {
      if(ref?.schema===schema)calls.push(await payload(ref));
      else {need(validCall(ref),"MODEL_REVIEW_ACQUISITION_CALL_INVALID");calls.push(ref);}
    }
    return calls;
  };
  return {restore,async append(call) {
    need(validCall(call),"MODEL_REVIEW_ACQUISITION_CALL_INVALID");
    const bytes=canonicalJson(call),ref={schema,sha256:sha256(bytes)};
    need(Buffer.byteLength(bytes)<=8*1024*1024,"MODEL_REVIEW_ACQUISITION_PAYLOAD_CAPACITY");
    const file=path.join(store.root,`call-${ref.sha256}.json`),temp=path.join(store.root,`.call-${randomUUID()}`);
    const handle=await open(temp,"wx",0o600);
    try {await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
    try {await link(temp,file);}catch(e){if(e.code!=="EEXIST")throw e;await payload(ref);}
    finally{await unlink(temp);}
    const dir=await open(store.root,"r");try{await dir.sync();}finally{await dir.close();}
    // A crash before this publication leaves an inert unreferenced blob, not a read.
    await store.transact(s=>{check(s);s.calls.push(ref);return s;});
  }};
}
