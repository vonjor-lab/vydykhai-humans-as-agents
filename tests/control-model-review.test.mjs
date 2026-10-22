import test from "node:test";
import assert from "node:assert/strict";
import {mkdir,writeFile,readFile,symlink,rm} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {endpointFixture,endpointServices} from "./control-endpoint-fixture.mjs";
import {nativeProvider,codeItem,answerItem} from "./native-provider-fixture.mjs";
import {openModelReview,modelReviewPrompt} from "../scripts/control-model-review.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {runControlledWorker} from "../scripts/control-worker-run.mjs";
import {openControlService,runControlService} from "../scripts/control-service.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {runControlTick} from "../scripts/control-loop.mjs";
import {controlCatalog,controlCheckIds} from "../scripts/control-catalog.mjs";
import {sha256,canonicalJson} from "../scripts/memory-brief.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {sourceWindow} from "../scripts/control-review-acquisition.mjs";
import {openControlNotification} from "../scripts/control-notification.mjs";
const binary=process.env.VYDYKHAI_CODEX_BINARY;
test("readiness criterion reaches the actual review prompt without enlarging the catalog",()=>{
  const criterion=controlCatalog.flatMap(g=>g.checks).find(c=>c.id==="C05.02").criterion;
  assert.equal(controlCheckIds.length,87);
  for(const required of [/independent readiness disposition/,/current packet/,/permitted command/,
    /source revisions/,/before execution/,/authorized binding remains unchanged/])assert.match(criterion,required);
  const prompt=modelReviewPrompt({phase:"POST_ACCEPT",input:{previousFindings:[]}},
    {kind:"controlled-route"},["C05.02"]);
  assert.ok(prompt.includes(`C05.02 ${criterion}`));
  assert.match(prompt,/later worker readback or post-accept judgment cannot backdate/);
  assert.match(prompt,/not every read-only preparation step or legacy task/);
});
async function setup(t,registeredEvidence=false) {
  const x=await endpointFixture(t), dirs={};
  for(const name of ["journal","room","home"]) {dirs[name]=path.join(x.privateRoot,name);await mkdir(dirs[name],{mode:0o700});}
  const sourceFile=path.join(x.privateRoot,"review-sources.json");
  await x.f.put("ledger.md","protocol test evidence, not semantic proof");
  const sources=[{id:"ledger",path:"ledger.md",purpose:"Scoped test facts"}];
  await writeFile(sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,sources}),{mode:0o600});
  if(registeredEvidence) {
    x.profile.directory=path.join(x.privateRoot,"qualified-state");await mkdir(x.profile.directory,{mode:0o700});
    x.profile.config={...x.profile.config,evidenceRegistry:sourceFile};
    x.host=await openControlHost(x.profile.directory,x.profile.config,endpointServices);await x.host.initialize();
  }
  return {...x,dirs,sourceFile,sources};
}
test("source registry denies traversal, symlinks and undeclared private reads; missing stays visible", async t=>{
  const x=await setup(t), sources=await openReviewSources(x.sourceFile);
  const first=await sources.snapshot();assert.equal(first.rows[0].status,"AVAILABLE");
  await assert.rejects(sources.read({id:"ledger",path:x.file}),/REQUEST_INVALID/);
  await assert.rejects(sources.read({id:"../../worker.json"}),/NOT_REGISTERED/);
  await x.f.put("ledger.md","different");assert.notEqual((await sources.snapshot()).digest,first.digest);
  await rm(path.join(x.f.root,"ledger.md"));assert.equal((await sources.read({id:"ledger"})).status,"MISSING");
  await symlink(x.file,path.join(x.f.root,"link.md"));
  await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
    sources:[{id:"link",path:"link.md",purpose:"Not allowed"}]}));
  await assert.rejects((await openReviewSources(x.sourceFile)).read({id:"link"}),/PATH_INVALID/);
});
test("declared source snapshot allowance preserves originals without increasing model read allowance",async t=>{
  const x=await setup(t);
  await x.f.put("ledger.md","x".repeat(900));await x.f.put("other.md","y".repeat(900));
  const sources=[...x.sources,{id:"other",path:"other.md",purpose:"Needed new original"}];
  const config={schema:"control.review-sources.v1",workspace:x.f.root,sources,maxSnapshotBytes:1024};
  await writeFile(x.sourceFile,JSON.stringify(config));
  await assert.rejects((await openReviewSources(x.sourceFile)).snapshot(),/TOTAL_CAPACITY/);
  assert.deepEqual((await(await openReviewSources(x.sourceFile)).list()).map(s=>s.id),["ledger","other"]);
  await writeFile(x.sourceFile,JSON.stringify({...config,maxSnapshotBytes:2048}));
  const snapshot=await(await openReviewSources(x.sourceFile)).snapshot();
  assert.equal(snapshot.bytes,1800);assert.equal(snapshot.rows.length,2);
  assert.equal((await readFile(path.join(x.f.root,"ledger.md"))).length,900);
  for(const maxSnapshotBytes of [0,1.5,16*1024*1024+1,"2048"]){
    await writeFile(x.sourceFile,JSON.stringify({...config,maxSnapshotBytes}));
    await assert.rejects(openReviewSources(x.sourceFile),/SNAPSHOT_BUDGET_INVALID/);
  }
});

for(const mode of ["valid","eight-source-batch","unread","drift","transient","registry-drift","required-unread","forgotten-finding",
  "windowed-valid","windowed-unread","windowed-limit","windowed-legacy"])test(`native model reviewer ${mode}: retained source-bound result without worker authority`,
  {skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
    const x=await setup(t);
    if(mode==="windowed-limit")await x.f.put("ledger.md","x".repeat(2048));
    const original=await readFile(path.join(x.f.root,"ledger.md"));
    let evidence=`source:ledger:${sha256(mode==="transient"?"temporary wrong source":original)}`;
    if(mode==="windowed-legacy") {
      const r=sourceWindow({id:"ledger",status:"AVAILABLE",text:original.toString(),sha256:sha256(original)},
        {id:"ledger"},{maxBytes:1024,maxChars:16});
      evidence=`source:${r.id}:${r.sha256}`;
    }
    if(mode==="required-unread") {
      x.sources.push({id:"memory",path:"memory.md",purpose:"Required current memory"});
      await x.f.put("memory.md","Current retained knowledge");
      await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,sources:x.sources}));
    }
    if(mode==="eight-source-batch"){
      for(let i=2;i<=8;i++){
        x.sources.push({id:`ledger${i}`,path:`ledger${i}.md`,purpose:"Protocol batch source"});
        await x.f.put(`ledger${i}.md`,`Protocol evidence ${i}; no semantic proof`);
      }
      await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,sources:x.sources}));
    }
    await writeFile(path.join(x.dirs.room,"AGENTS.md"),"POISON_MANAGER_CONTEXT_MUST_NOT_LOAD");
    const windowed=mode.startsWith("windowed-"),valid=mode==="valid"||mode==="eight-source-batch"||mode==="windowed-valid";
    const answer=windowed && mode!=="windowed-legacy" ? {schema:"control.review-answer.v2",
      rowGroups:[{ids:[...controlCheckIds],status:"PASS",sourceIds:["ledger"]}],newFindings:[],resolutions:[]} :
      valid?{evidence:{S1:evidence},rowGroups:[{ids:[...controlCheckIds],status:"PASS",evidenceRef:"S1"}],findings:[]}:
      {rows:controlCheckIds.map(id=>({id,status:"PASS",evidence})),findings:[]};
    const requests=windowed ? (mode==="windowed-valid"?[0,16,32]:mode==="windowed-limit"?[0,128,256,384,512,640,768,896,1024]:[0])
      .map(offset=>({id:"ledger",offset})) : (mode==="eight-source-batch"?x.sources.map(s=>s.id):["ledger"]).map(id=>({id}));
    const sourceRead="const a=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));"+
      `for(const args of ${JSON.stringify(requests)})text(await tools[a.name](args));`;
    const provider=await nativeProvider(t,async n=>{
      if(mode==="transient")await x.f.put("ledger.md",n===1?"temporary wrong source":original.toString());
      if(n===1 && mode!=="unread")return codeItem(sourceRead);
      if(mode==="drift")await x.f.put("ledger.md","changed during review");
      if(mode==="registry-drift")await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
        sources:[...x.sources,{id:"extra",path:"missing.md",purpose:"New obligation"}]}));
      return answerItem(answer);
    });
    const config={directory:x.dirs.journal,controlRoot:x.privateRoot,reviewer:"reviewer",sourceFile:x.sourceFile,
      native:{binary,workspace:x.dirs.room,home:x.dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider,
        ...(windowed?{reviewAcquisition:{maxBytes:1024,maxChars:mode==="windowed-limit"?128:16}}:{})},
      maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),scope:{kind:"protocol-fixture",
        ...(windowed?{requiredSourceIds:mode==="windowed-legacy"?[]:["ledger"]}:mode==="required-unread"?{requiredSourceIds:["ledger","memory"]}:
          mode==="eight-source-batch"?{requiredSourceIds:x.sources.map(s=>s.id)}:{})}};
    const review=await openModelReview(config);await review.initialize();
    const prior={id:"C27.01-cost",checkId:"C27.01",area:"C27",criterion:controlCatalog.find(g=>g.id==="C27").checks[0].criterion,
      evidence:"Retained unknown cost",owner:"owner",work:"measurement",status:"OPEN",attempts:0,
      firstSeen:new Date().toISOString(),reviewAt:new Date(Date.now()+60000).toISOString(),blocksResume:false};
    const offer={runId:randomUUID(),key:sha256("offer"),input:{previousFindings:mode==="forgotten-finding"?[prior]:[]}};
    if(valid) {
      const verdict=await review.review(offer);assert.equal(verdict.reviewer,"reviewer");
      if(windowed)assert.equal(verdict.rows[0].evidence,evidence);
      else assert.deepEqual(verdict.evidenceIndex,{S1:evidence});
      const restored=await openModelReview(config);assert.deepEqual((await restored.observe(offer.runId)).verdict,verdict);
    } else {
      await assert.rejects(review.review(offer),mode==="forgotten-finding"?/MODEL_REVIEW_FINDINGS_INVALID/:mode==="unread"?/NO_SOURCE_ACQUISITION/:
        mode==="windowed-legacy"?/WINDOW_V2_REQUIRED/:mode==="required-unread"||windowed?/REQUIRED_SOURCE_UNREAD/:/SOURCE_DRIFT|REGISTRY_CHANGED/);
      assert.equal((await review.observe(offer.runId)).verdict,undefined);
    }
    const refusedId=randomUUID();
    await assert.rejects(review.review({...offer,runId:refusedId}),/BUDGET_EXHAUSTED/);
    assert.equal((await review.observe(refusedId)).state,"STOPPED");
    assert.equal((await review.observe(refusedId)).dispatched,false);
    await assert.rejects(review.review(offer),/ALREADY_DISPATCHED/);
    assert.equal((await review.observe(offer.runId)).state,"STOPPED");
    const observed=await review.observe(offer.runId);
    if(mode==="forgotten-finding") {
      assert.equal(observed.code,0);assert.equal(observed.state,"STOPPED");
      assert.equal(observed.validationFailure.action,"RECONCILE_FINDINGS");
      assert.deepEqual(observed.candidate.findings,[]);assert.equal(observed.verdict,undefined);
      assert.equal((await review.capacity()).remaining,0);
    }
    assert.equal(observed.offerKey,offer.key);
    const trace=await readFile(path.join(x.dirs.journal,observed.trace.file));assert.equal(sha256(trace),observed.trace.sha256);
    if(mode==="eight-source-batch"){
      assert.equal(provider.requests.length,2,"native client reached the post-acquisition response");
      assert.deepEqual(observed.readSources.map(s=>s.id).sort(),x.sources.map(s=>s.id).sort());
      assert.ok(JSON.parse(trace).timing.stdoutChunks.length>0);
      assert.equal(observed.verdict.rows.length,87);
    }
    assert.doesNotMatch(JSON.stringify(provider.requests),/POISON_MANAGER_CONTEXT_MUST_NOT_LOAD/);
  });

test("changed registry and mismatched host offer are refused before native dispatch", async t => {
  for (const mode of ["registry", "offer"]) {
    const x = await setup(t, true);
    const config = {directory:x.dirs.journal,controlRoot:x.privateRoot,reviewer:"reviewer",sourceFile:x.sourceFile,
      native:{binary:"/missing-native-binary",workspace:x.dirs.room,home:x.dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:1000},
      maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),scope:{kind:"preflight-only"}};
    const transport = await openModelReview(config); await transport.initialize();
    const snapshot = await (await openReviewSources(x.sourceFile)).snapshot();
    if(mode === "registry") await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,
      sources:[...x.sources,{id:"extra",path:"extra.md",purpose:"New contract"}]}));
    else snapshot.digest = "f".repeat(64);
    const offer = {runId:randomUUID(),key:sha256("offer"),input:{sourceEvidence:snapshot}};
    await assert.rejects(transport.review(offer),mode === "registry" ? /REGISTRY_CHANGED/ : /OFFER_EVIDENCE_MISMATCH/);
    const saved = await transport.observe(offer.runId);
    assert.equal(saved.state,"STOPPED"); assert.equal(saved.dispatched,false);
    assert.equal(saved.verdict,undefined); assert.equal(saved.transportError,undefined);
  }
});

test("native eight-source HEALTH v2 verdict reaches owned UNKNOWN host admission without inference",
 {skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
  const x=await setup(t);
  for(let i=2;i<=8;i++){
    x.sources.push({id:`ledger${i}`,path:`ledger${i}.md`,purpose:"Scripted transport evidence"});
    await x.f.put(`ledger${i}.md`,`Protocol source ${i}; not a semantic judgment`);
  }
  await writeFile(x.sourceFile,JSON.stringify({schema:"control.review-sources.v1",workspace:x.f.root,sources:x.sources}));
  const directory=path.join(x.privateRoot,"health-v2");await mkdir(directory,{mode:0o700});
  const config={...x.profile.config,evidenceRegistry:x.sourceFile,health:{scope:"Protocol-only health transport",
    intervalMs:60000,maxBranches:2,maxWorktrees:1,triggerSourceIds:x.sources.map(s=>s.id),repairTasks:["repair"]}};
  const host=await openControlHost(directory,config,endpointServices);await host.initialize();
  const answer={schema:"control.review-answer.v2",rowGroups:[
    {ids:controlCheckIds.filter(id=>!["C15.01","C12.01"].includes(id)),status:"NOT_APPLICABLE",sourceIds:["ledger"],reason:"Scripted protocol fixture, not semantic applicability"},
    {ids:["C15.01"],status:"UNKNOWN",sourceIds:["ledger"],reason:"Scripted missing proof",findingId:"owned-gap"},
    {ids:["C12.01"],status:"UNKNOWN",sourceIds:["ledger"],reason:"Repository observation unavailable",findingId:"repo-gap"}],
    newFindings:[{id:"owned-gap",checkId:"C15.01",evidence:"Scripted missing current memory evidence"},
      {id:"repo-gap",checkId:"C12.01",evidence:"Repository observation unavailable"}].map(f=>({...f,sourceIds:["ledger"],
      owner:"owner",work:"repair",reviewAt:new Date(Date.now()+60000).toISOString(),blocksResume:true})),resolutions:[]};
  const provider=await nativeProvider(t,async n=>n===1?codeItem(
    "const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));"+
    `for(const id of ${JSON.stringify(x.sources.map(s=>s.id))})text(await tools[t.name]({id}));`):answerItem(answer));
  const review=await openModelReview({directory:x.dirs.journal,controlRoot:x.privateRoot,reviewer:"reviewer",sourceFile:x.sourceFile,
    native:{binary,workspace:x.dirs.room,home:x.dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider},
    maxCalls:1,expiresAt:new Date(Date.now()+60000).toISOString(),scope:{kind:"protocol-only",requiredSourceIds:x.sources.map(s=>s.id)}});
  let failure;
  await review.initialize();const tick=await runControlTick({...host,review:async(...args)=>{
    try{return await host.review(...args);}catch(e){failure=e.message;throw e;}
  }},{review:async(...args)=>{try{return await review.review(...args);}catch(e){failure=e.message;throw e;}},timeoutMs:20000});
  assert.equal(tick.results[0].action,"OWNER_DISPOSITION_DUE",failure);assert.equal(provider.requests.length,2);
  const health=(await host.snapshot()).health;
  assert.equal(health.review.rows.length,87);assert.equal(health.findings[0].id,"owned-gap");
  assert.equal(health.findings[0].status,"OPEN");assert.equal(health.findings[0].blocksResume,true);
  assert.equal(health.disposition,null);assert.deepEqual((await host.snapshot()).reservations,{});
});

test("owner inbox requires exact verdict acquisition and cannot mint independent authority",async t=>{
  const x=await setup(t), config=x.profile.config;
  const ref=name=>({path:`${name}.md`,sha256:sha256(name)});
  for(const name of ["return","artifact","proof","goal",...retentionKinds])await x.f.put(`${name}.md`,name);
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"fixture",task:"previous",
    owner:config.owner,executor:config.executor,status:"ACCEPTED",acceptedAt:new Date().toISOString(),
    producerReturn:ref("return"),artifact:ref("artifact"),technicalProof:ref("proof"),goal:ref("goal"),
    retention:retentionKinds.map(id=>({id,required:true,expected:ref(id)}))};
  await x.host.accept(acceptance);
  const result=await runControlTick(x.host,{review:async offer=>({phase:"POST_ACCEPT",key:offer.key,runId:offer.runId,
    resultUse:{status:"ALLOW",acceptanceSha256:sha256(canonicalJson(acceptance)),evidence:"fixture:independent-result",findingIds:[]},
    reviewer:config.reviewer,observedAt:new Date().toISOString(),findings:[],rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture"}))})});
  assert.equal(result.calls,1);
  const restarted=await openControlHost(x.profile.directory,config,endpointServices);
  const owner=ownerControl(restarted,config.owner), inbox=await owner.inbox();assert.equal(inbox[0].action,"OWNER_DISPOSITION_DUE");
  const decision={owner:config.owner,reviewKey:inbox[0].reviewKey,action:"CONTINUE",nextAction:x.f.task.id,evidence:"fixture:applied"};
  await assert.rejects(owner.respond("accepted",decision),/READBACK_REQUIRED/);
  const read=await owner.readVerdict("accepted");assert.equal(sha256(canonicalJson(read.verdict)),decision.reviewKey);
  assert.equal((await owner.respond("accepted",decision)).action,"VERIFY_CONTINUATION");
  assert.deepEqual(Object.keys(owner),["inbox","readControl","readVerdict","respond","recordRetentionRepair"]);
});

test("service timer survives owner inactivity, honors pause and stops spending after its retained budget",
 {skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
  const x=await setup(t,true), c=x.profile.config;
  const ref=async name=>x.f.put(`${name}.md`,name);
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"fixture",task:"previous",
    owner:c.owner,executor:c.executor,status:"ACCEPTED",acceptedAt:new Date().toISOString(),
    producerReturn:await ref("return"),artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)acceptance.retention.push({id,required:true,expected:await ref(id)});
  await x.host.accept(acceptance);
  const evidence=`source:ledger:${sha256(await readFile(path.join(x.f.root,"ledger.md")))}`;
  const provider=await nativeProvider(t,async n=>n===1?codeItem("const t=ALL_TOOLS.find(t=>t.name.includes('vydykhai_review')&&t.name.includes('read_source'));text(await tools[t.name]({id:'ledger'}));"):
    answerItem({rows:controlCheckIds.map(id=>({id,status:"PASS",evidence})),findings:[]}));
  const profile={schema:"control.service.v1",directory:x.profile.directory,config:c,maxReviewsPerTick:1,timeoutMs:16000,
    review:{directory:x.dirs.journal,controlRoot:x.privateRoot,reviewer:c.reviewer,sourceFile:x.sourceFile,maxCalls:1,
      expiresAt:new Date(Date.now()+60000).toISOString(),scope:{kind:"protocol-fixture"},
      native:{binary,workspace:x.dirs.room,home:x.dirs.home,model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider}}};
  const service=await openControlService(profile);await service.review.initialize();await service.host.pause(true);
  assert.equal(service.sourceCoverage,"REGISTRY_AND_RETENTION");
  await assert.rejects(openControlService({...profile,review:{...profile.review,sourceFile:"/wrong-registry.json"}}),/SOURCE_REGISTRY_MISMATCH/);
  assert.equal((await service.tick()).calls,0);assert.equal(provider.requests.length,0);
  await service.host.pause(false);
  const ticks=await runControlService(service,{ticks:2,intervalMs:1});
  assert.deepEqual(ticks.map(r=>r.calls),[1,0]);assert.equal(ticks[1].inbox[0].action,"OWNER_DISPOSITION_DUE");
  const restarted=await openControlService(profile);
  await restarted.host.accept({...acceptance,id:"later",task:"another"});
  assert.equal((await restarted.tick()).calls,0);assert.equal(provider.requests.length,2);
  assert.ok((await restarted.owner.inbox()).some(r=>r.id==="later"&&r.action==="REVIEW_DUE"));
});

test("native owner consumes the exact verdict through MCP without gaining worker or reviewer tools",
 {skip:!binary||process.platform!=="darwin",timeout:30000},async t=>{
  const x=await setup(t), c=x.profile.config;
  const ref=async name=>x.f.put(`${name}.md`,name);
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"fixture",task:"previous",
    owner:c.owner,executor:c.executor,status:"ACCEPTED",acceptedAt:new Date().toISOString(),
    producerReturn:await ref("return"),artifact:await ref("artifact"),technicalProof:await ref("proof"),goal:await ref("goal"),retention:[]};
  for(const id of retentionKinds)acceptance.retention.push({id,required:true,expected:await ref(id)});
  await x.host.accept(acceptance);
  await runControlTick(x.host,{review:async offer=>({phase:"POST_ACCEPT",key:offer.key,runId:offer.runId,reviewer:c.reviewer,
    observedAt:new Date().toISOString(),findings:[],rows:controlCheckIds.map(id=>({id,status:"PASS",evidence:"fixture"}))})});
  const file=path.join(x.privateRoot,"owner.json");
  const notificationConfig={directory:path.join(x.privateRoot,"notices"),transportActor:"control-owner-transport"};
  await mkdir(notificationConfig.directory,{mode:0o700});
  const notifications=await openControlNotification({...notificationConfig,owner:c.owner});await notifications.initialize();
  const reviewKey=sha256(canonicalJson((await x.host.snapshot()).acceptances.accepted.review));
  await notifications.enqueueObservation({receipt:{schema:"control.observer-readback.v1",owner:c.owner,status:"ONE_TICK_OBSERVED"},
    actionable:[{id:"accepted",action:"OWNER_DISPOSITION_DUE",reviewKey}]});
  await writeFile(file,JSON.stringify({schema:"control.owner-endpoint.v1",directory:x.profile.directory,config:c,
    notifications:notificationConfig}),{mode:0o600});
  const provider=await nativeProvider(t,async n=>n===1?codeItem(`
    const ts=ALL_TOOLS.filter(t=>t.name.includes('vydykhai_owner'));text(ts.map(t=>t.name));
    const notices=await tools[ts.find(t=>t.name.endsWith('read_notices')).name]({});
    const notice=JSON.parse(notices.content.find(c=>c.type==='text').text)[0];
    text(await tools[ts.find(t=>t.name.endsWith('acknowledge_notice')).name]({id:notice.notice.id,deliveryToken:notice.deliveryToken}));
    const read=await tools[ts.find(t=>t.name.includes('read_verdict')).name]({id:'accepted'});
    const body=JSON.parse(read.content.find(c=>c.type==='text').text);
    text(await tools[ts.find(t=>t.name.endsWith('respond')).name]({id:'accepted',decision:{
      reviewKey:body.reviewKey,action:'CONTINUE',nextAction:'TASK-1',evidence:'native:read-and-applied'}}));
  `):answerItem({done:true}));
  const result=await runControlledWorker({binary,workspace:x.dirs.room,home:x.dirs.home,endpointFile:file,
    role:"owner",model:"gpt-6.1-sol",effort:"low",timeoutMs:15000,provider:provider.provider,prompt:"Consume the retained verdict."});
  assert.equal(result.status,"CLI_EXIT_OK",result.errors);
  assert.equal((await x.host.assess("accepted")).action,"VERIFY_CONTINUATION",result.output);
  assert.equal((await x.host.snapshot()).acceptances.accepted.disposition.owner,c.owner);
  assert.equal((await notifications.snapshot()).pendingDelivery,0);
  assert.equal((await notifications.snapshot()).pendingOwnerApplication,0);
  assert.doesNotMatch(result.output,/vydykhai_control.*execute_registered|vydykhai_review.*read_source/);
});
