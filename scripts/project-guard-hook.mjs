import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {portableGuard} from './project-guard-open.mjs';
import {parseDurableOutboxComment as parse} from './vydykhai.mjs';
if(process.argv[1] && await realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)){
  try{
    let raw='';for await(const b of process.stdin){raw+=b;if(Buffer.byteLength(raw)>2*1024*1024)throw Error('oversize hook event');}
    const e=JSON.parse(raw);const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    if(['SessionStart','UserPromptSubmit'].includes(e.hook_event_name) && await realpath(e.cwd)===project){
      const r=await portableGuard(project,{parse,session:e.session_id});
      if(r.status==='CHANGED')console.log(JSON.stringify({hookSpecificOutput:{hookEventName:e.hook_event_name,
        additionalContext:'Pending project returns (id, status); reconcile originals, never replay UNKNOWN: '+JSON.stringify(r.changed)+(r.managerView?' Compact dispatch snapshot; verify current authority and pauses: '+JSON.stringify(r.managerView):'')}}));
      else if(r.status==='LIMITED')console.log(JSON.stringify({systemMessage:r.reason}));
    }
  }catch(e){console.log(JSON.stringify({systemMessage:'Local Guard LIMITED: '+e.message}));}
}
