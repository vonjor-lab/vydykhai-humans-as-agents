import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, mkdir, readFile, realpath, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {cycleAnswer, cycleCompleted, cycleAcquired, cycleOracle, gradeCycleRecipe,
  requireCycleReads, requireCycleExecution, requireCycleOwnerControl, validateCycleAllocation,
  validateEpisodeCheckpoint,requireCycleRetainedBytes,cycleReviewRun} from "../scripts/qualify-control-cycle.mjs";
import {canonicalJson,sha256} from "../scripts/memory-brief.mjs";
import {retentionKinds} from "../scripts/post-accept.mjs";
import {runContextTransition} from "../scripts/context-run.mjs";
import {runControlledContextTransition} from "../scripts/controlled-context-run.mjs";
import {openControlHost} from "../scripts/control-host.mjs";
import {openReviewSources} from "../scripts/control-review-sources.mjs";
import {decodeReviewAnswer} from "../scripts/control-review-wire.mjs";
import {controlCheckIds} from "../scripts/control-catalog.mjs";
import {ownerControl} from "../scripts/control-owner.mjs";
import {createReturnSync, parseDurableOutboxComment} from "../scripts/vydykhai.mjs";
import {fixture, hash} from "./context-fixture.mjs";

// No runCycle, native CLI, auth home, network, or paid provider is used here.
// Characterization tests expose evidence limits; they do not certify semantics.
const services = {createReturnSync, parseDurableOutboxComment};
const recipe = () => ({...cycleOracle.recipe, producerEdits: [], rejected: ["keep-last"],
  idea: {id: "CSV", disposition: "ASK_OWNER_NOT_IMPLEMENT"}});
const reads = () => cycleOracle.requiredRecall.map(id => ({id, status: "AVAILABLE", sha256: hash(id)}));
const message = answer => ({type: "item.completed", item: {type: "agent_message", text: JSON.stringify(answer)}});
const acquired = (row, overrides = {}) => ({type: "item.completed", item: {type: "mcp_tool_call",
  server: "vydykhai_review", tool: "read_source", status: "completed",
  result: {content: [{type: "text", text: JSON.stringify(row)}]}, ...overrides}});
const trace = events => ({status: "CLI_EXIT_OK", output: events.map(e => JSON.stringify(e)).join("\n") + "\n"});

test("packet repair counts both prior calls and permits exactly one replacement readiness",()=>{
  const setup={terminal:true,budget:{model:"gpt-6.1-sol",effort:"low",maxCalls:8,secondsPerCall:120,retries:0},
    continuation:{schema:"qualification.packet-repair.v1",reason:"INDEPENDENT_PREPARATION_REJECTED",
      priorRuns:[{name:"prepare",status:"CLI_EXIT_OK"},{name:"precheck",status:"CLI_EXIT_OK"}]}};
  assert.doesNotThrow(()=>validateCycleAllocation(setup));
  for(const delta of [{budget:{...setup.budget,maxCalls:9}},{budget:{...setup.budget,retries:1}},
    {continuation:{...setup.continuation,priorRuns:[]}},{continuation:{...setup.continuation,reason:"TIMEOUT"}},
    {terminal:false},{continuation:null}]) assert.throws(()=>validateCycleAllocation({...setup,...delta}),/QUALIFICATION_/);
});

test("stopped POST escalation keeps all six calls and changes only its one review profile",()=>{
  const setup={terminal:true,budget:{model:"gpt-6.1-sol",effort:"low",maxCalls:9,secondsPerCall:120,retries:0},
    continuation:{schema:"qualification.stopped-post-escalation.v1",reason:"TIMEOUT",postEffort:"high",
      priorRuns:["prepare","precheck","precheck-repair","execute","accept","post-accept"].map(name=>({name,status:name==="post-accept"?"STOPPED":"CLI_EXIT_OK"}))}};
  assert.doesNotThrow(()=>validateCycleAllocation(setup));
  for(const delta of [{budget:{...setup.budget,maxCalls:10}},{budget:{...setup.budget,secondsPerCall:180}},
    {continuation:{...setup.continuation,postEffort:"low"}},{continuation:{...setup.continuation,priorRuns:setup.continuation.priorRuns.slice(1)}},
    {continuation:{...setup.continuation,reason:"UNKNOWN"}}]) assert.throws(()=>validateCycleAllocation({...setup,...delta}),/QUALIFICATION_/);
});

test("owner current-control witness needs exact successful acquisition before application",()=>{
  const expected={schema:"control.preparation-status.v1",digest:hash("current"),observedAt:"before",rows:[{id:"consumer"}]};
  const read=acquired({...expected,observedAt:"during"},{server:"vydykhai_owner",tool:"read_control"});
  const respond=acquired({action:"CLOSED"},{server:"vydykhai_owner",tool:"respond"});
  const done={type:"turn.completed"};
  assert.doesNotThrow(()=>requireCycleOwnerControl(trace([read,respond,done]),expected));
  for(const events of [[respond,done],[respond,read,done],[{...read,item:{...read.item,status:"failed"}},respond,done],
    [acquired({...expected,digest:hash("stale")},{server:"vydykhai_owner",tool:"read_control"}),respond,done]])
    assert.throws(()=>requireCycleOwnerControl(trace(events),expected),/OWNER_CURRENT_CONTROL_NOT_ACQUIRED/);
});

test("coherent episode allocation retains both stopped POST attempts and two unused owner calls",()=>{
  const names=["prepare","precheck","precheck-repair","execute","accept","post-accept","post-accept"];
  const setup={terminal:true,budget:{model:"gpt-6.1-sol",effort:"low",maxCalls:17,secondsPerCall:120,retries:0},
    continuation:{schema:"qualification.retained-post-episodes.v1",reason:"RETAINED_COHERENT_EPISODES",postEffort:"low",resume:false,
      priorRuns:names.map((name,i)=>({name,status:i>=5?"STOPPED":"CLI_EXIT_OK",...(i>=5?{reason:"TIMEOUT"}:{})}))}};
  assert.doesNotThrow(()=>validateCycleAllocation(setup));
  assert.doesNotThrow(()=>validateCycleAllocation({...setup,continuation:{...setup.continuation,resume:true,
    priorRuns:[...setup.continuation.priorRuns,{name:"post-accept",status:"STOPPED",reason:null}]}}));
  for(const delta of [{budget:{...setup.budget,maxCalls:10}},{budget:{...setup.budget,secondsPerCall:180}},
    {budget:{...setup.budget,retries:1}},{continuation:{...setup.continuation,priorRuns:setup.continuation.priorRuns.slice(1)}},
    {continuation:{...setup.continuation,resume:undefined}},{continuation:{...setup.continuation,postEffort:"high"}},
    {continuation:{...setup.continuation,priorRuns:setup.continuation.priorRuns.map((r,i)=>i===6?{...r,reason:"UNKNOWN"}:r)}}])
    assert.throws(()=>validateCycleAllocation({...setup,...delta}),/QUALIFICATION_/);
});

test("remaining episodes require explicit independent judgment bound to the actual checkpoint",()=>{
  const expected={reviewer:"reviewer",postSha256:hash("actual first checkpoint")};
  const decision={schema:"qualification.episode-checkpoint-decision.v1",...expected,decision:"CONTINUE",
    evidence:"Independent inspection of actual C20 return; no full87 acceptance"};
  assert.doesNotThrow(()=>validateEpisodeCheckpoint(decision,expected));
  for(const value of [undefined,{...decision,reviewer:"owner"},{...decision,decision:"PASS"},
    {...decision,postSha256:hash("other")},{...decision,evidence:""}])
    assert.throws(()=>validateEpisodeCheckpoint(value,expected),/INDEPENDENT_CHECKPOINT_REQUIRED/);
});

test("retained episode guard re-reads artifact, acceptance sources, retention and terminal bytes",async t=>{
  const f=await fixture(t),ref=name=>({path:`retained-${name}.md`,sha256:sha256(name)});
  const acceptance={schema:"work.product-acceptance.v1",id:"accepted",project:"synthetic",task:"synthetic-task",
    owner:"owner",executor:"worker",status:"ACCEPTED",acceptedAt:new Date().toISOString(),
    producerReturn:ref("return"),artifact:ref("artifact"),technicalProof:ref("proof"),goal:ref("goal"),
    retention:retentionKinds.map(id=>({id,required:true,expected:ref(id)}))};
  const files=new Map();
  for(const name of ["return","artifact","proof","goal",...retentionKinds])files.set(ref(name).path,name);
  const record={schema:"control.terminal-disposition.v1",acceptanceSha256:hash(acceptance),owner:"owner",action:"DONE",
    producerReturn:acceptance.producerReturn,evidence:"Synthetic recorded disposition, not semantic proof",
    acceptedScope:acceptance.goal,dod:acceptance.technicalProof};
  const terminalText=canonicalJson(record),terminalArtifact={path:"retained-terminal.json",sha256:sha256(terminalText)};
  files.set(terminalArtifact.path,terminalText);
  for(const [name,text]of files)await f.put(name,text);
  const setup={workspace:f.root,runtime:{root:fileURLToPath(new URL("..",import.meta.url))}};
  const accepted={acceptance,terminalArtifact};
  await requireCycleRetainedBytes(setup,accepted);
  for(const [name,text]of files) {
    await f.put(name,"Changed after staging");
    await assert.rejects(requireCycleRetainedBytes(setup,accepted),/ACCEPTED_BYTES_CHANGED/,name);
    await f.put(name,text);await requireCycleRetainedBytes(setup,accepted);
  }
});

test("final merged episode report is JSON-safe without a deferred completedParts field",()=>{
  const usage={input_tokens:2,output_tokens:3},old={runId:"old",usage:{input_tokens:20,output_tokens:30}};
  const run={runId:"final",state:"STOPPED",reason:null,spentTokens:55,
    parts:[{observation:old},{observation:{runId:"final",usage}}],usage:{input_tokens:22,output_tokens:33}};
  const row=cycleReviewRun(run,{seconds:1,episode:true});
  assert.equal(row.completedParts,2);assert.deepEqual(row.usage,usage);
  assert.doesNotThrow(()=>canonicalJson(row));
  assert.equal(cycleReviewRun({...run,completedParts:1},{seconds:1,episode:true}).completedParts,1);
  const failed=cycleReviewRun({...run,parts:[{observation:old}],failedPart:{usage:null}}, {seconds:1,episode:true});
  assert.equal(failed.usage,null);assert.doesNotThrow(()=>canonicalJson(failed));
});

test("cycle answer parses the final message and refuses a failed native exit", () => {
  const result = trace([message({decision: "REPAIR"}), message({decision: "APPROVE"}),
    {type: "turn.completed", usage: {input_tokens: 1, output_tokens: 1}}]);
  assert.deepEqual(cycleAnswer(result), {decision: "APPROVE"});
  assert.throws(() => cycleAnswer({...result, status: "CLI_EXIT_WITH_ERROR"}), /NATIVE_TURN_NOT_COMPLETE/);
});

test("source acquisition ignores other capabilities and unsuccessful tools", () => {
  const row = reads()[0];
  const result = trace([acquired(row), acquired(row, {server: "vydykhai_owner"}),
    acquired(row, {tool: "list_sources"}), acquired(row, {status: "failed"}),
    acquired(row, {result: {isError: true, content: [{type: "text", text: JSON.stringify(row)}]}})]);
  assert.deepEqual(cycleAcquired(result), [row]);
});

test("recipe grading rejects stale wiring, producer edits, retired ideas and missing recall", () => {
  assert.deepEqual(gradeCycleRecipe(recipe(), reads()), []);
  for (const [key, value] of Object.entries({entrypoint: "normalizeEntries", revision: "bundle-r1",
    preprocess: "lowercase", format: "csv", producerEdits: ["candidate.mjs"], rejected: [],
    idea: {id: "CSV", disposition: "IMPLEMENT"}})) {
    assert.ok(gradeCycleRecipe({...recipe(), [key]: value}, reads()).length, key);
  }
  for (const id of cycleOracle.requiredRecall) {
    assert.ok(gradeCycleRecipe(recipe(), reads().filter(r => r.id !== id)).includes(`unread:${id}`));
    assert.ok(gradeCycleRecipe(recipe(), reads().map(r => r.id === id ? {...r, status: "MISSING"} : r))
      .includes(`unread:${id}`));
  }
});

test("cycleAnswer rejects absent, failed, errored, or duplicate turn completion", () => {
  for (const endings of [[], [{type: "turn.failed", error: {message: "interrupted"}}],
    [{type: "turn.completed"}, {type: "turn.failed"}],
    [{type: "turn.completed"}, {type: "error", message: "transport failed"}],
    [{type: "turn.completed"}, {type: "turn.completed"}]]) {
    const result = trace([message(recipe()), ...endings]);
    assert.throws(() => cycleAnswer(result), /NATIVE_TURN_NOT_COMPLETE/);
    assert.throws(() => cycleCompleted(result), /NATIVE_TURN_NOT_COMPLETE/);
  }
});

test("recipe grading requires actual goal acquisition, not declared sourceIds", () => {
  assert.ok(cycleOracle.requiredRecall.includes("goal"));
  assert.ok(gradeCycleRecipe({...recipe(), sourceIds: cycleOracle.requiredRecall},
    reads().filter(r => r.id !== "goal")).includes("unread:goal"));
});

test("required readbacks reject missing, unread and stale source hashes", () => {
  const rows = reads(), snapshot = {rows};
  assert.doesNotThrow(() => requireCycleReads(trace(rows.map(r => acquired(r))), cycleOracle.requiredRecall, snapshot));
  for (const id of cycleOracle.requiredRecall) {
    for (const changed of [rows.filter(r => r.id !== id),
      rows.map(r => r.id === id ? {id, status: "MISSING"} : r),
      rows.map(r => r.id === id ? {...r, sha256: "0".repeat(64)} : r)]) {
      assert.throws(() => requireCycleReads(trace(changed.map(r => acquired(r))), cycleOracle.requiredRecall, snapshot),
        {message: `REQUIRED_SOURCE_NOT_ACQUIRED:${id}`});
    }
  }
});

test("worker execution gate requires one successful registered action and a complete native turn", () => {
  const execute = status => acquired({status}, {server: "vydykhai_control", tool: "execute_registered"});
  assert.doesNotThrow(() => requireCycleExecution(trace([execute("ACTION_COMPLETED"), {type: "turn.completed"}])));
  for (const events of [[], [execute("BLOCKED")], [execute("VERIFIED")],
    [execute("ACTION_COMPLETED"), execute("ACTION_COMPLETED")],
    [acquired({status: "ACTION_COMPLETED"})],
    [acquired({status: "ACTION_COMPLETED"}, {server: "vydykhai_control", tool: "execute_registered", status: "failed"})],
    [acquired({status: "ACTION_COMPLETED"}, {server: "vydykhai_control", tool: "execute_registered",
      result: {isError: true, content: [{type: "text", text: '{"status":"ACTION_COMPLETED"}'}]}})]]) {
    assert.throws(() => requireCycleExecution(trace([...events, {type: "turn.completed"}])), /WORKER_ACTION_NOT_COMPLETED/);
  }
  assert.throws(() => requireCycleExecution(trace([execute("ACTION_COMPLETED")])), /NATIVE_TURN_NOT_COMPLETE/);
});

test("resume executes the consumer but does not run retained verification", async t => {
  const f = await fixture(t, {actionBody: "import {writeFileSync} from 'node:fs'; import {buildBundle} from './candidate.mjs'; writeFileSync('consumer-output.json', JSON.stringify(buildBundle([{id:'b',label:' two '},{id:'AA',label:' one '}])));\n"});
  await f.prepare();
  const result = await runContextTransition({...f.request, operation: "resume"}, services);
  assert.equal(result.status, "ACTION_COMPLETED");
  assert.equal(result.stats.verificationCommands, 0);
  assert.deepEqual(JSON.parse(await readFile(path.join(f.root, "consumer-output.json"), "utf8")),
    cycleOracle.retainedOutput);
  await assert.rejects(readFile(path.join(f.root, "verifications.log")), {code: "ENOENT"});
});

test("verification API is accept, not verify; default fixture omits the N1 case", async t => {
  const f = await fixture(t);
  await f.prepare();
  const unsupported = await runContextTransition({...f.request, operation: "verify"}, services);
  assert.equal(unsupported.status, "BLOCKED");
  assert.equal(unsupported.stats.commands, 0);
  const accepted = await runContextTransition({...f.request, operation: "accept"}, services);
  assert.equal(accepted.stats.verificationCommands, 1);
  const verified = (await readFile(path.join(f.root, "verifications.log"), "utf8")).trim().split(",");
  assert.deepEqual(verified, ["B1", "B2"]);
  assert.ok(!verified.includes("N1"));
});

async function hostFixture(t, actionBody) {
  const f = await fixture(t, {actionBody}), prepared = await f.prepare();
  const privateRoot = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-cycle-preflight-")));
  t.after(() => rm(privateRoot, {recursive: true, force: true}));
  const directory = path.join(privateRoot, "host");
  await mkdir(directory, {mode: 0o700});
  const refs = {};
  for (const id of ["goal", "artifact", "proof", "return", "memory", "map", "tracker", "custody"])
    refs[id] = await f.put(`${id}.md`, id === "goal" ? "Continue using accepted bundle output." : "done");
  const registryFile = path.join(privateRoot, "sources.json");
  await writeFile(registryFile, JSON.stringify({schema: "control.review-sources.v1", workspace: f.root,
    sources: Object.keys(refs).map(id => ({id, path: `${id}.md`, purpose: id}))}), {mode: 0o600});
  const config = {workspace: f.root, policy: hash(cycleOracle), owner: "owner", executor: "worker",
    reviewer: "reviewer", evidenceRegistry: registryFile};
  const host = await openControlHost(directory, config, services);
  await host.initialize();
  const binding = {operation: "resume", taskId: f.task.id, taskSha256: f.request.task.sha256,
    capsuleSha256: f.request.capsule.sha256, sourceDigest: prepared.coverageBasis.sourceDigest,
    dependencyDigest: prepared.coverageBasis.dependencyDigest, commandSha256: hash(f.task.action),
    cwd: f.root, executable: await realpath(process.execPath), kind: "dependent"};
  const acceptance = {schema: "work.product-acceptance.v1", id: "consumer", project: "synthetic-bundle",
    task: "TASK-1", owner: config.owner, executor: config.executor, status: "ACCEPTED",
    acceptedAt: new Date().toISOString(), producerReturn: refs.return, artifact: refs.artifact,
    technicalProof: refs.proof, goal: refs.goal,
    retention: ["memory", "map", "tracker", "custody"].map(id => ({id, required: true, expected: refs[id]}))};
  await host.accept(acceptance);
  return {f, host, directory, config, binding, registryFile};
}

async function syntheticReview(x) {
  const offer = await x.host.claimReview("consumer");
  const sources = await openReviewSources(x.registryFile);
  const readbacks = [];
  for (const source of await sources.list()) readbacks.push(await sources.read({id: source.id}));
  // Synthetic reviewer transport, deliberately not semantic or native proof.
  const observedAt = new Date().toISOString();
  const answer = decodeReviewAnswer({schema: "control.review-answer.v2",
    rowGroups: [{ids: controlCheckIds, status: "PASS", sourceIds: readbacks.map(r => r.id)}], newFindings: [], resolutions: []},
  {readbacks, offer, reviewer: x.config.reviewer, observedAt});
  await x.host.review("consumer", offer, {...answer, phase: "POST_ACCEPT", key: offer.key,
    reviewer: x.config.reviewer, runId: offer.runId, observedAt});
  const owner = ownerControl(x.host, x.config.owner);
  await owner.readVerdict("consumer");
  await owner.respond("consumer", {owner: x.config.owner, action: "CONTINUE",
    nextAction: x.binding.taskId, evidence: "synthetic test disposition, not work evidence"});
  await x.host.approveCommand(x.binding, {reviewer: x.config.reviewer,
    reviewReceipt: "trusted test adapter only", dependencies: ["consumer"], expiresAt: Date.now() + 120000});
}

test("successful continued action after reopen preserves pause, acceptance and replay refusal", async t => {
  const x = await hostFixture(t, "import {writeFileSync} from 'node:fs'; writeFileSync('continued.json', JSON.stringify({used:['AA','b']}));\n");
  await syntheticReview(x);
  await x.host.pause(true);
  const reopened = await openControlHost(x.directory, x.config, services);
  assert.equal((await reopened.snapshot()).paused, true);
  await assert.rejects(reopened.control.authorize(x.binding), /CONTROL_PAUSED/);
  await reopened.pause(false);
  const result = await runControlledContextTransition({...x.f.request, operation: "resume"},
    {...services, control: reopened.control});
  assert.equal(result.status, "ACTION_COMPLETED");
  assert.deepEqual(JSON.parse(await readFile(path.join(x.f.root, "continued.json"), "utf8")), {used: ["AA", "b"]});
  assert.equal((await reopened.assess("consumer")).action, "CONTROL_CONFIRMED");
  await reopened.close("consumer");
  assert.equal((await reopened.snapshot()).acceptances.consumer.enrollment, "CLOSED");
  await assert.rejects(reopened.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
});

test("BLOCKED final context readback leaves continuation IN_FLIGHT and cannot close", async t => {
  const x = await hostFixture(t, "import {appendFileSync,writeFileSync} from 'node:fs'; writeFileSync('continued.json', JSON.stringify({used:['AA','b']})); appendFileSync('task.json',' ');\n");
  await syntheticReview(x);
  const before = (await x.host.snapshot()).acceptances.consumer;
  const result = await runControlledContextTransition({...x.f.request, operation: "resume"},
    {...services, control: x.host.control});
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.code, "TASK_CHANGED_DURING_ACTION");
  const reservations = Object.values((await x.host.snapshot()).reservations);
  assert.equal(reservations.length, 1);
  assert.equal(result.actionOutcome, "OUTCOME_UNKNOWN");
  assert.equal(result.replayRequiresReconciliation, true);
  assert.equal(result.stats.dependentCommands, 1);
  assert.ok(result.sourceReceipt);
  assert.equal(reservations[0].status, "IN_FLIGHT");
  assert.equal(reservations[0].resultSha256, undefined);
  assert.equal((await x.host.assess("consumer")).action, "RECONCILE_EXTERNAL_OUTCOME");
  await assert.rejects(x.host.close("consumer"), /CONTROL_NOT_COMPLETE/);
  await assert.rejects(x.host.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
  assert.deepEqual((await x.host.snapshot()).acceptances.consumer, before);
  const reopened = await openControlHost(x.directory, x.config, services);
  assert.equal((await reopened.assess("consumer")).action, "RECONCILE_EXTERNAL_OUTCOME");
  await assert.rejects(reopened.close("consumer"), /CONTROL_NOT_COMPLETE/);
  await assert.rejects(reopened.control.authorize(x.binding), /COMMAND_NOT_APPROVED/);
});
