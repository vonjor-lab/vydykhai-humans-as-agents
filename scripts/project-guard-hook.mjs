import {realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {portableGuard} from './project-guard-open.mjs';
import {parseDurableOutboxComment as parse,readProductionContinuation} from './vydykhai.mjs';
if(process.argv[1] && await realpath(process.argv[1]).catch(()=>null)===fileURLToPath(import.meta.url)){
  try{
    let raw='';for await(const b of process.stdin){raw+=b;if(Buffer.byteLength(raw)>2*1024*1024)throw Error('oversize hook event');}
    const e=JSON.parse(raw);const project=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
    if(['SessionStart','UserPromptSubmit','Stop'].includes(e.hook_event_name) && await realpath(e.cwd)===project){
      const stop=e.hook_event_name==='Stop';
      const r=await portableGuard(project,{parse:stop?undefined:parse,session:e.session_id,event:e,readContinuation:readProductionContinuation});
      if(r.status==='OWNER_STEP_READY')console.log(JSON.stringify({decision:'block',
        reason:'Framework checkpoint, not new human authority. Reconcile current instructions, pause, effects, allowance and review against the saved next action. If still ready, start or hand off that authorized step now without replay. Otherwise preserve the actual gate and stop.'}));
      else if(r.status==='CHANGED')console.log(JSON.stringify({hookSpecificOutput:{hookEventName:e.hook_event_name,
        additionalContext:'Pending project returns (id, status); reconcile originals, never replay UNKNOWN: '+JSON.stringify(r.changed)+(r.managerView?' Compact dispatch snapshot; verify current authority and pauses: '+JSON.stringify(r.managerView):'')}}));
      else if(r.status==='LIMITED')console.log(JSON.stringify({systemMessage:r.reason}));
      else if(stop)console.log('{}');
    }
  }catch(e){console.log(JSON.stringify({systemMessage:'Local Guard LIMITED: '+e.message}));}
}
