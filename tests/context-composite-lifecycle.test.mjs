import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
import {fixture} from "./context-fixture.mjs";
import {moduleAccessPolicy} from "../scripts/module-access.mjs";
import {prepareNavigation} from "../scripts/context-navigation.mjs";

const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const heldOut = [
  {id:"H_EMPTY", input:[], expected:{schema:"bundle/v1", entries:[], count:0}},
  {id:"H_ORDER", input:[{id:"z",label:" last "},{id:"AA",label:" First "},{id:"a",label:" middle "}],
    expected:{schema:"bundle/v1", entries:[{id:"AA",label:"First"},{id:"a",label:"middle"},{id:"z",label:"last"}],count:3}},
  {id:"H_LABEL", input:[{id:" Q ",label:" \tkept  inner\n "}],
    expected:{schema:"bundle/v1",entries:[{id:" Q ",label:"kept  inner"}],count:1}},
  {id:"H_DISTINCT", input:[{id:"AA",label:" same "},{id:"A",label:"same"}],
    expected:{schema:"bundle/v1",entries:[{id:"A",label:"same"},{id:"AA",label:"same"}],count:2}},
  {id:"H_DUPLICATE", input:[{id:"Red",label:"one"},{id:"rED",label:"different"}],expected:{error:"DUPLICATE_ID"}},
  {id:"H_STATE", input:[], expected:{inputUnchanged:true,argumentUnchanged:true,repeatStable:true,
    detachedOutput:true,errorRecovery:true}}
];

// Real public calls with a trusted fixture owner, not model discovery/adoption proof.
async function composite(t) {
  const f = await fixture(t, {correction:true, actionBody:
    "import {readFileSync} from 'node:fs'; import {buildBundle} from './candidate.mjs'; console.log(JSON.stringify(buildBundle(JSON.parse(readFileSync('consumer-input.json')))));\n"});
  await f.put("consumer-input.json",[{id:"B",label:" before "}]);
  const children = {
    bundle: await f.put("bundle-r2.mjs", f.candidateCode),
    formatter: await f.put("formatter-r1.mjs", "export const render = value => JSON.stringify(value);\n")
  };
  const contract = "buildBundle input id/label array -> bundle/v1; preserve spelling, trim labels, sort and count; reject case-insensitive duplicates with DUPLICATE_ID. Children have no persistent state; formatter must not mutate its argument. Composite owns JSON decoding and propagates child errors; it does not repair children.\n";
  await f.put("public-contract.md", contract);
  const connections = {
    bundle: await f.put("bundle-connection.md", "Accepted bundle-r2 public examples and unchanged artifact.\n"),
    formatter: await f.put("formatter-connection.md", "Accepted formatter-r1 JSON text; no argument mutation or persistent state.\n")
  };
  f.module.access = {schema:"context.module-access.v1", modules:[
    {id:"buildBundle", intent:"create", contractFiles:["public-contract.md"], privatePaths:["candidate.mjs"], release:null},
    ...Object.entries(children).map(([id,artifact]) => ({id, intent:"consume", contractFiles:["public-contract.md"],
      privatePaths:[`${id}-private`], release:{artifact, connection:connections[id]}}))
  ]};
  const wire = formatter => `import {buildBundle as normalize} from './bundle-r2.mjs';
import {render} from './${formatter}';
export const buildBundle = input => JSON.parse(render(normalize(input)));\n`;
  await f.put("candidate.mjs", wire(children.formatter.path));
  const originalOracle = JSON.parse(await readFile(path.join(f.root,"oracle.json")));
  f.module.oracle = await f.put("oracle.json", {...originalOracle, examples:[...originalOracle.examples,
    ...heldOut.map(example => ({...example,sourceAssertionRefs:["S1:1","S2:1","S4:1"]}))]});
  f.task.newExampleIds = [...f.task.newExampleIds,...heldOut.map(example => example.id)];
  const verifier = formatter => `import {readFileSync,appendFileSync} from 'node:fs';
import {buildBundle} from './candidate.mjs';
import {render} from './${formatter}';
const oracle = JSON.parse(readFileSync('oracle.json','utf8'));
const ids = JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES);
appendFileSync('verifications.log',ids.join(',')+'\\n');
const observe = input => {try{return buildBundle(input);}catch(error){return {error:error.message};}};
const observations = ids.map(id => {
  const example = oracle.examples.find(example => example.id === id);
  if(id !== 'H_STATE') return {id,observed:observe(structuredClone(example.input))};
  const input = [{id:'state',label:' kept '}], before = JSON.stringify(input);
  const first = observe(input), encoded = JSON.stringify(first);
  const repeatStable = JSON.stringify(observe(structuredClone(input))) === encoded;
  const failure = observe([{id:'X',label:'one'},{id:'x',label:'two'}]);
  const errorRecovery = failure.error === 'DUPLICATE_ID' && JSON.stringify(observe(structuredClone(input))) === encoded;
  const argument = {schema:'bundle/v1',entries:[{id:'sentinel',label:'kept'}],count:1};
  const argumentBefore = JSON.stringify(argument);
  const rendered = render(argument);
  const argumentUnchanged = JSON.stringify(argument) === argumentBefore &&
    JSON.stringify(JSON.parse(rendered)) === argumentBefore;
  const inputUnchanged = JSON.stringify(input) === before;
  if(first.entries?.[0]) first.entries[0].label = 'changed by consumer';
  if(first.entries) first.entries.push({id:'consumer',label:'local'});
  const detachedOutput = JSON.stringify(input) === before &&
    JSON.stringify(observe(structuredClone(input))) === encoded;
  return {id,observed:{inputUnchanged,argumentUnchanged,repeatStable,detachedOutput,errorRecovery}};
});
console.log(JSON.stringify({schema:'context.observations.v1',candidateSha256:process.env.VYDYKHAI_CANDIDATE_SHA256,
  oracleSha256:process.env.VYDYKHAI_ORACLE_SHA256,observations}));\n`;
  const setRelease = async (artifact, connection) => {
    const child = f.module.access.modules.find(m => m.id === "formatter");
    child.release = {artifact, connection};
    await f.put("candidate.mjs", wire(artifact.path));
    f.module.verificationScript = await f.put("verify.mjs",verifier(artifact.path));
    f.task.module = await f.put("module.json", f.module); await f.refresh();
  };
  await setRelease(children.formatter, connections.formatter);
  const invoke = async () => {
    f.request.capsule = null; f.request.readback = null;
    await f.prepare(); const result = await f.run("accept");
    return result;
  };
  return {f, children, connections, contract, setRelease, invoke};
}

test("real composite uses two pinned children with public-only context; data changes reuse their identity", async t => {
  const x = await composite(t), {f} = x;
  const access = moduleAccessPolicy(f.module.access, "buildBundle", f.task.candidateFiles);
  const nav = {taskId:f.task.id, worker:f.task.owner, preparedBy:"preparer", outcome:"Connect the public aggregate",
    references:[{id:"public", path:"public-contract.md", quote:x.contract.trim(), purpose:"Public children and errors", appliesTo:"task"}],
    constraints:[], gaps:[], assignment:{owner:"preparer",requestId:"composite-initial",phase:"initial",previous:null}};
  const prepared = await prepareNavigation(nav, {id:f.task.id,worker:f.task.owner}, file => readFile(path.join(f.root,file)), ["public-contract.md"]);
  assert.doesNotMatch(JSON.stringify(prepared), /const seen|toLowerCase|JSON.stringify/);
  for (const name of ["bundle-private/internal.mjs", "formatter-private/internal.mjs", "bundle-r2.mjs"])
    assert.throws(() => access.assertRead(name), /CONSUMED_MODULE_CONTEXT_FORBIDDEN/);
  assert.throws(() => access.assertMutation("bundle-r2.mjs"), /CONSUMED_MODULE_MUTATION_FORBIDDEN/);
  const before = await readFile(path.join(f.root,"bundle-r2.mjs")), formatter = await readFile(path.join(f.root,"formatter-r1.mjs"));
  const result = await x.invoke(); assert.equal(result.status,"VERIFIED",result.raw);
  assert.deepEqual(result.receipt.observations.map(row => row.id),["B1","B2","N1",...heldOut.map(example => example.id)]);
  for(const example of heldOut)
    assert.deepEqual(result.receipt.observations.find(row => row.id === example.id).observed,example.expected);
  assert.equal(result.coverageBasis.moduleAccess,"DECLARED_BOUNDARIES");
  assert.equal(result.coverageBasis.processIsolation,"NOT_ENFORCED");
  assert.equal(result.coverageBasis.replayProtection,"CALLER_OWNED");
  assert.equal(result.receipt.productAcceptance,"NOT_ESTABLISHED");
  const initial = await f.run("resume"); assert.equal(initial.status,"ACTION_COMPLETED",initial.raw);
  assert.equal(initial.action.stdoutSha256,digest(JSON.stringify({schema:"bundle/v1",entries:[{id:"B",label:"before"}],count:1})+"\n"));
  const packetFiles = ["task.json","module.json","capsule.json","readback.json","action.mjs"];
  const packet = await Promise.all(packetFiles.map(file => readFile(path.join(f.root,file))));
  await f.put("consumer-input.json",[{id:"Q",label:" other "}]);
  const reused = await f.run("resume"); assert.equal(reused.status,"ACTION_COMPLETED",reused.raw);
  assert.equal(reused.action.commandSha256,initial.action.commandSha256);
  assert.equal(reused.action.stdoutSha256,digest(JSON.stringify({schema:"bundle/v1",entries:[{id:"Q",label:"other"}],count:1})+"\n"));
  for(const [index,file] of packetFiles.entries()) assert.deepEqual(await readFile(path.join(f.root,file)),packet[index],file);
  assert.equal((await f.run("accept")).status,"VERIFIED");
  assert.deepEqual(await readFile(path.join(f.root,"bundle-r2.mjs")),before);
  assert.deepEqual(await readFile(path.join(f.root,"formatter-r1.mjs")),formatter);
  assert.equal(f.module.access.modules.find(m => m.id === "bundle").release.artifact.sha256,x.children.bundle.sha256);
});

test("unannounced child replacement denies execution; compatible upgrade needs fresh packet and rollback preserves prior release", async t => {
  const x = await composite(t), {f} = x;
  assert.equal((await x.invoke()).status,"VERIFIED");
  const original = await readFile(path.join(f.root,"formatter-r1.mjs"));
  await f.put("formatter-r1.mjs","export const render = value => JSON.stringify({...value,count:value.count+1});\n");
  const actionsBefore = await readFile(path.join(f.root,"verifications.log"));
  const deniedAction = await f.run("resume");
  assert.equal(deniedAction.code,"MODULE_RELEASE_CHANGED"); assert.equal(deniedAction.stats.commands,0);
  assert.equal(deniedAction.actionOutcome,"NOT_INVOKED");
  const unannounced = await f.run("accept");
  assert.equal(unannounced.code,"MODULE_RELEASE_CHANGED"); assert.equal(unannounced.stats.commands,0);
  assert.deepEqual(await readFile(path.join(f.root,"verifications.log")),actionsBefore);
  await f.put("formatter-r1.mjs",original.toString());
  const r2 = await f.put("formatter-r2.mjs","export const render = value => JSON.stringify(value,null,2);\n");
  const connection = await f.put("formatter-r2-connection.md","Formatter-r2 changes only JSON whitespace; retains decoded semantics, errors and no argument mutation.\n");
  await x.setRelease(r2,connection);
  const stale = await f.run("accept"); assert.equal(stale.status,"BLOCKED"); assert.equal(stale.stats.commands,0);
  assert.equal((await x.invoke()).status,"VERIFIED");
  await x.setRelease(x.children.formatter,x.connections.formatter);
  assert.equal((await f.run("accept")).status,"BLOCKED");
  assert.equal((await x.invoke()).status,"VERIFIED");
  assert.deepEqual(await readFile(path.join(f.root,"formatter-r1.mjs")),original);
  assert.equal((await readFile(path.join(f.root,"formatter-r2.mjs"))).toString(),"export const render = value => JSON.stringify(value,null,2);\n");
});

test("equal-shape incompatible child fails retained behavior after explicit rebrief; it cannot silently become accepted", async t => {
  const x = await composite(t), {f} = x;
  assert.equal((await x.invoke()).status,"VERIFIED");
  const bad = await f.put("formatter-breaking.mjs","export const render = value => JSON.stringify({...value,count:value.count+1});\n");
  const connection = await f.put("formatter-breaking-connection.md","Proposed formatter has equal JSON shape; compatibility NOT_PROVEN, owner migration decision required.\n");
  await x.setRelease(bad,connection);
  const refused = await x.invoke(); assert.equal(refused.code,"BEHAVIOR_MISMATCH");
  assert.equal(refused.receipt,undefined); assert.equal(refused.returnSync,undefined);
  assert.equal(refused.stats.verificationCommands,1);
  assert.equal(refused.stats.dependentCommands,0);
  assert.equal(refused.replayRequiresReconciliation,true);
  await x.setRelease(x.children.formatter,x.connections.formatter);
  assert.equal((await x.invoke()).status,"VERIFIED");
});

for(const [name,body] of [
  ["argument mutation","export const render = value => {const encoded=JSON.stringify(value);value.entries.length=0;return encoded;};\n"],
  ["cross-call state","let calls=0;export const render = value => JSON.stringify({...value,count:value.count+calls++});\n"]
]) test(`correct-shaped child with ${name} cannot pass the public state contract`, async t => {
  const x = await composite(t), {f} = x;
  assert.equal((await x.invoke()).status,"VERIFIED");
  const baseline = await readFile(path.join(f.root,"bundle-r2.mjs"));
  const bad = await f.put("formatter-state-breaking.mjs",body);
  const connection = await f.put("formatter-state-connection.md","Proposed public child; no-mutation/stateless compatibility requires actual proof.\n");
  await x.setRelease(bad,connection);
  const result = await x.invoke();
  assert.equal(result.code,"BEHAVIOR_MISMATCH",result.raw);
  if(name === "argument mutation") assert.equal(result.reference,"H_STATE");
  assert.equal(result.receipt,undefined); assert.equal(result.returnSync,undefined);
  assert.equal(result.stats.dependentCommands,0);
  assert.deepEqual(await readFile(path.join(f.root,"bundle-r2.mjs")),baseline);
  await x.setRelease(x.children.formatter,x.connections.formatter);
  assert.equal((await x.invoke()).status,"VERIFIED");
});

test("child self-modification during verification is an observed refusal, not physical write prevention", async t => {
  const x = await composite(t), {f} = x;
  const body = "import {appendFileSync} from 'node:fs';let changed=false;export const render=value=>{if(!changed){appendFileSync(new URL(import.meta.url),'\\n// observed child mutation\\n');changed=true;}return JSON.stringify(value);};\n";
  const bad = await f.put("formatter-self-changing.mjs",body);
  const connection = await f.put("formatter-self-changing-connection.md","Candidate child must retain its exact release bytes.\n");
  await x.setRelease(bad,connection);
  const bundleBefore = await readFile(path.join(f.root,"bundle-r2.mjs"));
  const result = await x.invoke();
  assert.equal(result.code,"MODULE_RELEASE_CHANGED",result.raw);
  assert.equal(result.receipt,undefined); assert.equal(result.returnSync,undefined);
  assert.equal(result.stats.verificationCommands,1); assert.equal(result.stats.dependentCommands,0);
  assert.equal(result.actionOutcome,"OUTCOME_UNKNOWN"); assert.equal(result.replayRequiresReconciliation,true);
  assert.equal(await readFile(path.join(f.root,bad.path),"utf8"),body+"\n// observed child mutation\n");
  assert.deepEqual(await readFile(path.join(f.root,"bundle-r2.mjs")),bundleBefore);
  const retry = await f.run("accept");
  assert.equal(retry.code,"MODULE_RELEASE_CHANGED"); assert.equal(retry.stats.commands,0);
  await x.setRelease(x.children.formatter,x.connections.formatter);
  assert.equal((await x.invoke()).status,"VERIFIED");
});
