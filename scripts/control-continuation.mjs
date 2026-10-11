// No planner or new authority. Only a trusted grant can opt its exact request
// into deterministic continuation; the same admission, sandbox and journal apply.
import {runControlledContextTransition} from "./controlled-context-run.mjs";
import {localControlSandbox} from "./local-control-sandbox.mjs";
import {canonicalJson,sha256} from "./memory-brief.mjs";
const hash=v=>sha256(canonicalJson(v));
const need=(v,c)=>{if(!v)throw Error(c);};
export async function runRegisteredContinuations(config,{host,workspace,controlRoot,services}) {
  need(config?.mode==="REGISTERED_PREAPPROVED_ONLY"&&Number.isSafeInteger(config.maxActions)&&
    config.maxActions>=1&&config.maxActions<=4,"CONTINUATION_CONFIG_INVALID");
  const before=await host.snapshot();
  if(before.paused)return {status:"PAUSED",calls:0,results:[]};
  const results=[];let calls=0;
  for(const id of Object.keys(before.acceptances)) {
    const current=await host.snapshot(),row=current.acceptances[id];
    if(current.paused)return {status:"PAUSED",calls,results};
    if(row.enrollment==="CLOSED"||row.disposition?.action!=="CONTINUE")continue;
    const assessed=await host.assess(id);
    if(assessed.action==="CONTROL_CONFIRMED") {
      await host.close(id);results.push({id,action:"CLOSED_FROM_RETAINED_OBSERVATION"});continue;
    }
    if(assessed.action!=="VERIFY_CONTINUATION") {results.push({id,action:assessed.action});continue;}
    if(calls>=config.maxActions){results.push({id,action:"TICK_CAPACITY"});continue;}
    const routes=Object.values(current.grants).filter(g=>g.executionRequest&&g.expiresAt>Date.now()&&
      !current.reservations[g.id]&&g.dependencies.includes(id)&&g.binding.operation==="resume"&&
      g.binding.taskId===row.disposition.nextAction);
    if(routes.length!==1){results.push({id,action:routes.length?"AMBIGUOUS_APPROVED_ROUTE":"NO_CURRENT_APPROVED_ROUTE"});continue;}
    const grant=routes[0],sandboxLaunch=await localControlSandbox({workspace,controlRoot});
    const control={...host.control,authorize:async binding=>{
      need(hash(binding)===grant.bindingSha256,"CONTINUATION_BINDING_CHANGED");
      const authorized=await host.control.authorize(binding);
      const {decision,stateRevision,...currentGrant}=authorized;
      need(hash(currentGrant)===hash(grant),"CONTINUATION_APPROVAL_CHANGED");
      return authorized;
    }};
    calls++;
    const result=await runControlledContextTransition(grant.executionRequest,{...services,control,sandboxLaunch});
    if(result.status!=="ACTION_COMPLETED") {
      results.push({id,action:"CONTINUATION_NOT_COMPLETED",code:result.code??null,
        outcome:result.actionOutcome??"UNKNOWN"});continue;
    }
    const final=await host.assess(id);
    if(final.action==="CONTROL_CONFIRMED") {
      await host.close(id);results.push({id,action:"CLOSED_AFTER_OBSERVED_CONTINUATION"});
    } else results.push({id,action:final.action});
  }
  return {status:"REGISTERED_CONTINUATIONS_OBSERVED",calls,results};
}
