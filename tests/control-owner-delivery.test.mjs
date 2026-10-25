import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {endpointFixture} from "./control-endpoint-fixture.mjs";
import {nativeProvider,codeItem,answerItem} from "./native-provider-fixture.mjs";
import {openOwnerDelivery} from "../scripts/control-owner-delivery.mjs";
import {openControlNotification} from "../scripts/control-notification.mjs";
import {openControlStore} from "../scripts/control-store.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {runControlledWorker} from "../scripts/control-worker-run.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";
const hash=v=>sha256(canonicalJson(v));
const binary=process.env.VYDYKHAI_CODEX_BINARY;
async function setup(t,provider,{automatic=false,terminal=false,mutateVerdict=v=>v}={}) {
  const x=await endpointFixture(t),dirs={};
  for(const n of ["delivery","notices","owner-room","owner-home"]) {
    dirs[n]=path.join(x.privateRoot,n);await mkdir(dirs[n],{mode:0o700});
  }
  const notificationConfig={directory:dirs.notices,transportActor:"control-owner-transport"};
  const notifications=await openControlNotification({...notificationConfig,owner:x.profile.config.owner});await notifications.initialize();
  const ref=n=>x.f.put(`${n}.md`,n);
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"fixture",task:"earlier",owner:x.profile.config.owner,
    executor:x.profile.config.executor,status:"ACCEPTED",acceptedAt:new Date().toISOString(),producerReturn:await ref("return"),
    artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)acceptance.retention.push({id,required:true,expected:await ref(id)});
  const terminalArtifact=terminal?await x.f.put("terminal.json",{schema:"control.terminal-disposition.v1",acceptanceSha256:hash(acceptance),
    owner:acceptance.owner,action:"DONE",evidence:"fixture accepted scope",producerReturn:acceptance.producerReturn,acceptedScope:acceptance.goal,dod:acceptance.technicalProof}):null;
  await x.host.accept(acceptance,terminal?{terminalArtifact}:{});
  await runControlTick(x.host,{review:async offer=>mutateVerdict({phase:"POST_ACCEPT",key:offer.key,runId:offer.runId,
    reviewer:x.profile.config.reviewer,observedAt:new Date().toISOString(),findings:[],
    resultUse:{status:"ALLOW",acceptanceSha256:hash(acceptance),evidence:"fixture independent result",findingIds:[]},
    ...(terminal?{terminalDisposition:{action:"DONE",recordSha256:terminalArtifact.sha256,evidence:"fixture independent terminal"}}:{}),
    rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture"}))})});
  const config={directory:dirs.delivery,endpoint:{schema:"control.owner-endpoint.v1",capability:"CONTROL_DISPOSITION_ONLY",directory:x.profile.directory,
    config:x.profile.config,notifications:notificationConfig},maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),
    delegation:{mode:automatic?"EXACT_CONTROL_DISPOSITION":"NATIVE_CONTROL_DISPOSITION",owner:x.profile.config.owner,authorizedBy:x.profile.config.owner,
      ...(automatic?{automatic:{healthContinue:false,nextActions:{accepted:"TASK-1"},terminalActions:["DONE"]}}:{}),
      evidence:"fixture:explicit-bounded-delegation",nextAction:"TASK-1"},
    native:{binary:binary??"/not-executed",workspace:dirs["owner-room"],home:dirs["owner-home"],
      model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,...(provider?{provider}:{})}};
  const delivery=await openOwnerDelivery(config,{host:x.host,notifications});await delivery.initialize();
  const queue=async(action="OWNER_DISPOSITION_DUE")=>notifications.enqueueObservation({complete:true,
    receipt:{schema:"control.observer-readback.v1",owner:x.profile.config.owner,status:"ONE_TICK_OBSERVED"},
    actionable:[{id:"accepted",action,reviewKey:hash((await x.host.snapshot()).acceptances.accepted.review)}]});
  return {...x,config,delivery,notifications,queue};
}
const consumeCode=`const ts=ALL_TOOLS.filter(t=>t.name.includes('vydykhai_owner'));
  const call=async(name,args)=>{const r=await tools[ts.find(t=>t.name.endsWith(name)).name](args);text(r);return JSON.parse(r.content.find(c=>c.type==='text').text);};
  const notices=await call('read_notices',{});
  for(const n of notices)await call('acknowledge_notice',{id:n.notice.id,deliveryToken:n.deliveryToken});
  await call('read_verdict',{id:'accepted'});
  await call('respond',{id:'accepted',decision:{action:'CONTINUE',nextAction:'TASK-1',evidence:'fixture:actual-owner-readback'}});`;
for(const consume of [true,false])test(`inactive scoped owner native wake: consumption=${consume}, restart never repeats`,
 {skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
  const provider=await nativeProvider(t,n=>n===1&&consume?codeItem(consumeCode):answerItem("done"));
  const x=await setup(t,provider.provider);await x.queue();
  const result=await x.delivery.deliver();
  assert.equal(result.status,consume?"DISPOSITION_OBSERVED":"OWNER_ATTENTION_REQUIRED");
  assert.equal(result.calls,1);assert.equal(result.continuation,"NOT_CERTIFIED");
  const n=provider.requests.length;
  const reopened=await openOwnerDelivery(x.config,{host:x.host,notifications:x.notifications});
  await reopened.initialize();assert.equal((await reopened.deliver()).calls,0);assert.equal(provider.requests.length,n);
  assert.equal((await reopened.capacity()).used,1);
  if(consume){assert.equal((await x.host.assess("accepted")).action,"VERIFY_CONTINUATION");
    assert.equal((await x.notifications.snapshot()).pendingOwnerApplication,0);
    await x.approve();const grant=Object.values((await x.host.snapshot()).grants)[0];
    await x.host.approveCommand(grant.binding,{reviewer:x.profile.config.reviewer,reviewReceipt:"fixture:independent-preparation",
      dependencies:["accepted"],expiresAt:Date.now()+60000});
    const worker=await nativeProvider(t,n=>n===1?codeItem(`const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_control')&&t.name.endsWith('execute_registered'));text(await tools[t.name]({requestId:'next'}));`):answerItem("Executed"));
    const result=await runControlledWorker({...x.config.native,workspace:x.f.root,endpointFile:x.file,
      role:"worker",provider:worker.provider,prompt:"Use only the approved next public consumer."});
    assert.equal(result.status,"CLI_EXIT_OK",result.errors);
    assert.equal(await readFile(path.join(x.f.root,"actions.log"),"utf8"),"called\n");
    assert.equal((await x.host.assess("accepted")).action,"CONTROL_CONFIRMED");
    await x.host.close("accepted");assert.equal((await x.host.snapshot()).acceptances.accepted.enrollment,"CLOSED");
    await assert.rejects(x.host.control.authorize(grant.binding),/COMMAND_NOT_APPROVED/);
    assert.equal(await readFile(path.join(x.f.root,"artifact.md"),"utf8"),"artifact");
  }
  else assert.equal((await x.notifications.snapshot()).pendingOwnerApplication,1);
});
test("exact delegated continuation applies through existing owner gates without a model and stays idempotent",async t=>{
  const x=await setup(t,null,{automatic:true});await x.queue();
  assert.equal((await x.delivery.deliver()).status,"DISPOSITION_OBSERVED");
  assert.equal((await x.delivery.capacity()).used,0);
  assert.equal((await x.notifications.snapshot()).pendingOwnerApplication,0);
  assert.equal((await x.host.snapshot()).acceptances.accepted.disposition.nextAction,"TASK-1");
  const before=await (await openControlStore(x.config.directory)).read();
  const reopened=await openOwnerDelivery(x.config,{host:x.host,notifications:x.notifications});
  assert.equal((await reopened.deliver()).status,"QUIET");
  assert.deepEqual(await (await openControlStore(x.config.directory)).read(),before);
  assert.equal(Object.values(before.state.runs)[0].mode,"EXACT_DELEGATED");
});
test("exact terminal application requires independently bound DONE and closes through host readback",async t=>{
  const x=await setup(t,null,{automatic:true,terminal:true});await x.queue();
  assert.equal((await x.delivery.deliver()).status,"DISPOSITION_OBSERVED");
  assert.equal((await x.host.snapshot()).acceptances.accepted.enrollment,"CLOSED");
  assert.equal((await x.host.assess("accepted")).action,"CONTROL_DONE_CONFIRMED");
  assert.equal((await x.delivery.capacity()).used,0);
});
test("exact delegation never invents an unmapped next action or downgrades to a native model",async t=>{
  const x=await setup(t,null,{automatic:true});
  const config=structuredClone(x.config);config.delegation.automatic.nextActions={};
  config.directory=path.join(x.privateRoot,"delivery-unmapped");await mkdir(config.directory,{mode:0o700});
  const delivery=await openOwnerDelivery(config,{host:x.host,notifications:x.notifications});await delivery.initialize();await x.queue();
  assert.equal((await delivery.deliver()).status,"OWNER_ATTENTION_REQUIRED");
  assert.equal((await delivery.capacity()).used,0);
  assert.equal((await x.host.snapshot()).acceptances.accepted.disposition,null);
});
test("exact delegation keeps negative verdicts and pauses for the real owner",async t=>{
  const x=await setup(t,null,{automatic:true,mutateVerdict:v=>({...v,resultUse:{...v.resultUse,status:"REJECT",findingIds:["bad"]},
    findings:[{id:"bad",area:"C20",checkId:"C20.02",criterion:"result",evidence:"bad",owner:"owner",work:"earlier",reviewAt:new Date(Date.now()+60000).toISOString(),blocksResume:true}],
    rows:v.rows.map(r=>r.id==="C20.02"?{...r,status:"FAIL"}:r)})});
  await x.queue();assert.equal((await x.delivery.deliver()).status,"OWNER_ATTENTION_REQUIRED");
  await x.host.pause(true);assert.equal((await x.delivery.deliver()).status,"PAUSED");
  assert.equal((await x.delivery.capacity()).used,0);
});
test("source drift during exact application stays unresolved and is never replayed",async t=>{
  const x=await setup(t,null,{automatic:true});await x.queue();
  await writeFile(path.join(x.f.root,"artifact.md"),"changed");
  assert.equal((await x.delivery.deliver()).status,"UNKNOWN_RECONCILIATION_REQUIRED");
  assert.equal((await x.delivery.deliver()).status,"UNKNOWN_RECONCILIATION_REQUIRED");
  assert.equal((await x.delivery.capacity()).used,0);
  assert.equal((await x.host.snapshot()).acceptances.accepted.disposition,null);
});
test("pause, unowned actions, missing delegation and changed endpoint never launch",async t=>{
  const x=await setup(t);await x.queue();await x.host.pause(true);
  assert.equal((await x.delivery.deliver()).status,"PAUSED");assert.equal((await x.delivery.capacity()).used,0);
  await x.host.pause(false);await x.queue("REVIEW_DUE");
  assert.equal((await x.delivery.deliver()).status,"HOST_ATTENTION_REQUIRED");assert.equal((await x.delivery.capacity()).used,0);
  await assert.rejects(openOwnerDelivery({...x.config,delegation:{}},{host:x.host,notifications:x.notifications}),/CONFIG_INVALID/);
  await writeFile(path.join(path.dirname(x.config.directory),"owner-endpoint.json"),"{}");
  await assert.rejects(x.delivery.deliver(),/ENDPOINT_CHANGED/);
});
test("lost dispatch retains exclusive unknown attempt and allocation",async t=>{
  const x=await setup(t);await x.queue();
  const store=await openControlStore(x.config.directory);
  await store.transact(s=>{s.calls=1;s.runs.lost={state:"IN_FLIGHT"};return s;});
  const before=await store.read();
  const reopened=await openOwnerDelivery(x.config,{host:x.host,notifications:x.notifications});
  assert.equal((await reopened.deliver()).status,"UNKNOWN_RECONCILIATION_REQUIRED");
  assert.deepEqual(await store.read(),before);
  await assert.rejects((await openOwnerDelivery({...x.config,maxCalls:2},{host:x.host,notifications:x.notifications})).capacity(),/CONFIG_MISMATCH/);
});
test("a new notice id or mixed batch cannot repeat an attempted verdict",async t=>{
  const x=await setup(t);const first=await x.queue();
  const item=first.notice.body.actionable[0],obligation={id:item.id,reviewKey:item.reviewKey};
  const store=await openControlStore(x.config.directory);
  await store.transact(s=>{s.calls=0;s.runs.failed={state:"STOPPED",status:"OWNER_ATTENTION_REQUIRED",
    obligations:[{key:hash(obligation),...obligation}]};return s;});
  await x.notifications.enqueueObservation({complete:true,
    receipt:{schema:"control.observer-readback.v1",owner:x.profile.config.owner,status:"ONE_TICK_OBSERVED"},actionable:[]});
  const second=await x.queue();assert.notEqual(second.notice.body.id,first.notice.body.id);
  assert.equal((await x.delivery.deliver()).status,"ALREADY_ATTEMPTED_NO_REPLAY");
  await x.notifications.enqueueObservation({complete:true,
    receipt:{schema:"control.observer-readback.v1",owner:x.profile.config.owner,status:"ONE_TICK_OBSERVED"},
    actionable:[item,{...item,id:"another",reviewKey:"d".repeat(64)}]});
  assert.equal((await x.delivery.deliver()).status,"ALREADY_ATTEMPTED_NO_REPLAY");
  assert.equal((await x.delivery.capacity()).used,0);
});
