// Fixture evidence publication only; a crashed exclusive lock is never stolen.
import {open,readFile,rename,unlink} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {canonicalJson,sha256} from "./memory-brief.mjs";
const need=(v,c)=>{if(!v)throw Error(c);};
export function validateRepairRegistry(registry) {
  need(Array.isArray(registry?.sources)&&registry.sources.length>0&&registry.sources.length<=500&&
    new Set(registry.sources.map(s=>s.id)).size===registry.sources.length&&
    Buffer.byteLength(canonicalJson(registry))<=1024*1024,"REPAIR_REGISTRY_CAPACITY");
}
export function validateRepairSourceExtension(before,after,addedIds) {
  need(Array.isArray(addedIds)&&new Set(addedIds).size===addedIds.length&&
    before.rows.every(row=>after.rows.some(next=>canonicalJson(next)===canonicalJson(row)))&&
    after.rows.length===before.rows.length+addedIds.length&&
    addedIds.every(id=>!before.rows.some(row=>row.id===id)&&after.rows.some(row=>row.id===id&&row.status==="AVAILABLE")),
    "REPAIR_EXISTING_SOURCE_CHANGED");
}
export async function replaceRepairRegistry(file,expectedBytes,registry) {
  validateRepairRegistry(registry);
  const lock=await open(`${file}.repair-lock`,"wx",0o600),temp=`${file}.pending-${randomUUID()}`;
  let created=false;
  try {
    need(sha256(await readFile(file))===sha256(expectedBytes),"REPAIR_PRIOR_SOURCES_CHANGED");
    const handle=await open(temp,"wx",0o600);created=true;
    try{await handle.writeFile(canonicalJson(registry));await handle.sync();}finally{await handle.close();}
    need(sha256(await readFile(file))===sha256(expectedBytes),"REPAIR_PRIOR_SOURCES_CHANGED");
    await rename(temp,file);created=false;
  }finally{if(created)await unlink(temp);await lock.close();await unlink(`${file}.repair-lock`);}
}
export async function recordRepairCall({runs,name,result,seconds,saveTrace}) {
  let usage=null;try{usage=result.output.split("\n").filter(Boolean).map(JSON.parse).find(e=>e.type==="turn.completed")?.usage??null;}catch{}
  const row={name,status:result.status,reason:result.reason??null,seconds,usage};runs.push(row);
  try{await saveTrace(result);row.tracePublication="RETAINED";}
  catch(e){row.tracePublication="FAILED";row.publicationFailure=e.message;throw Error(`REPAIR_TRACE_PUBLICATION_FAILED:${e.message}`);}
  return row;
}
