// Public synthetic evidence; no producer implementation or model outcome.
import assert from "node:assert/strict";
import {mkdtemp, mkdir, writeFile, readFile, rm, realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {canonicalJson, sha256} from "../../../scripts/memory-brief.mjs";
import {openReviewSources} from "../../../scripts/control-review-sources.mjs";

export const request = "Prepare an additional JSON consumer of the existing bundle. Do not change the producer.";
const repository = fileURLToPath(new URL("../../../", import.meta.url));
const facts = [
  {id:"Q1", file:"evidence-14.json", disposition:"superseded", supersededBy:"Q2",
    text:"D1 formerly lowercased output identifiers. D2 supersedes this decision."},
  {id:"Q2", file:"evidence-14.json", disposition:"current_constraint",
    text:"D2 preserves identifier spelling and compares duplicates case-insensitively. Use buildBundle at bundle-r2 with no preprocessing or producer rewrite."},
  {id:"Q3", file:"evidence-26.json", disposition:"evidence_only",
    text:"SL0 was a screenshot after an operator removed a duplicate. It is assisted evidence, not autonomous success."},
  {id:"Q4", file:"evidence-26.json", disposition:"accepted_capability",
    text:"SL2 passed the released bundle examples and duplicate rejection without operator repair. The unfinished enclosing experiment does not revoke this capability; the additional consumer needs its own future result."},
  {id:"Q5", file:"evidence-38.json", disposition:"current_constraint",
    text:"Reject keep-last: it discarded duplicate data. Duplicate identifiers must fail with DUPLICATE_ID."},
  {id:"Q6", file:"evidence-49.json", disposition:"deferred",
    text:"When bundle/export returns to scope, ask module-owner to decide CSV support. Do not implement it. Close only with the owner's decision or explicit retirement.",
    ownerGate:"module-owner", trigger:"bundle/export returns to scope"},
];
const sources = [
  ["s17","module-map.md","Ordinary module index"], ["s28","memory-graph.md","Entity-linked memory"],
  ["s39","bundle-contract.md","Public module contract"], ["s40","connection.json","Public release connection"],
  ["s51","evidence-14.json","Recorded decisions"], ["s62","evidence-26.json","Recorded verification"],
  ["s73","evidence-38.json","Recorded rejected approach"], ["s84","evidence-49.json","Open commitment"],
  ["s95","unrelated.md","Unrelated module contract"],
].map(([id, file, purpose]) => ({id, path:file, purpose}));

const graph = `<!-- vydykhai:project-memory-graph v4 -->
# Project Memory Graph: Synthetic Bundle
Project State: fixture-only
Operating Brief: ordinary-request
Source ledger: this graph
Watermark: fixture-1
Declared anchors: 4
Declared routes: 3
Declared nodes: 4
Last compaction: none
Last retrieval check: NOT_RUN / model recall not tested
## Anchor Index
| ID | Kind | Canonical name / real-world aliases | Scope / identity | Documentation / implementation | Source / checked |
| --- | --- | --- | --- | --- | --- |
| ENT-OUTCOME | OUTCOME | additional JSON consumption | consumer outcome | NOT_REQUIRED: outcome | ordinary request / fixture-1 |
| ENT-MODULE | MODULE | bundle module | accepted public boundary | contract: bundle-contract.md; implementation: opaque bundle-r2 release | connection.json / fixture-1 |
| ENT-BUNDLE | CAPABILITY | existing bundle | buildBundle@bundle-r2 | contract: bundle-contract.md; implementation: opaque bundle-r2 release | connection.json / fixture-1 |
| ENT-ARTIFACT | ARTIFACT | accepted bundle | reusable output | connection.json | released examples / fixture-1 |
## Entity Routes
| From | Relation | To | Applies / qualification | Source / checked |
| --- | --- | --- | --- | --- |
| ENT-MODULE | serves | ENT-OUTCOME | public consumption | ordinary request / fixture-1 |
| ENT-BUNDLE | part-of | ENT-MODULE | existing capability | public contract / fixture-1 |
| ENT-BUNDLE | produces | ENT-ARTIFACT | released examples only | release receipt / fixture-1 |
## Current Memory Nodes
${[
  ["MEM-DECISION","DECISION","Keep current identifier semantics","evidence-14.json"],
  ["MEM-SUCCESS","LESSON","Reuse qualified success, not assisted evidence","evidence-26.json"],
  ["MEM-REJECTION","LESSON","Do not resurrect the rejected shortcut","evidence-38.json"],
  ["MEM-COMMITMENT","COMMITMENT","Return the deferred output decision","evidence-49.json"],
].map(([id,type,meaning,file]) => `### ${id} - ${meaning}
- Type / status: ${type} / ACTIVE
- About: ENT-BUNDLE
- Recall when: consume or extend the existing bundle
- Because: preserve accepted behavior and unresolved decisions
- Apply: ${meaning}; consult original evidence
- Avoid: treating a local assumption as an accepted decision
- Verify: source-backed coverage before dependent action
- Applies / exceptions: bundle consumption only
- Owner gate: ${type === "COMMITMENT" ? "module-owner" : "none"}
- Return / close when: ${type === "COMMITMENT" ? "owner decision or explicit retirement" : "NOT_REQUIRED"}
- Relations: about -> ENT-BUNDLE
- Source / checked: [original evidence](${file}) / fixture-1
`).join("\n")}
## Source Coverage Ledger
| Source / participant | Range / revision | Anchors | Current nodes | Coverage | Gap / supersession | Checked |
| --- | --- | --- | --- | --- | --- | --- |
| connection.json | fixture-1 | ENT-OUTCOME, ENT-MODULE, ENT-BUNDLE, ENT-ARTIFACT | none | COVERED | none | synthetic source binding |
| evidence-14.json | fixture-1 | ENT-BUNDLE | MEM-DECISION | COVERED | D1 superseded by D2 | synthetic source binding |
| evidence-26.json | fixture-1 | ENT-BUNDLE | MEM-SUCCESS | COVERED | assisted SL0 is not SL2 | synthetic source binding |
| evidence-38.json | fixture-1 | ENT-BUNDLE | MEM-REJECTION | COVERED | none | synthetic source binding |
| evidence-49.json | fixture-1 | ENT-BUNDLE | MEM-COMMITMENT | COVERED | none | synthetic source binding |
## Pending Memory Events
| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
## Live Retrieval Probes
| Slot | Raw trigger | Expected route and executable action or gate | Observed brief / application evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
${["CURRENT","NEXT","CROSS_DOMAIN","PRIOR_MISS"].map(slot => `| ${slot} | consume existing bundle | public route plus obligations | NOT_RUN | NOT_RUN / no model | synthetic fixture |`).join("\n")}
## Legacy Source Map
| Previous id or artifact | Current anchor/node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
<!-- vydykhai:project-memory-graph:end -->
`;

export async function coldFixture(t, {missingTarget = false} = {}) {
  // Same isolated workspace/install/CLI pattern as context-prepare.test.mjs.
  const parent = await realpath(await mkdtemp(path.join(tmpdir(), "vydykhai-cold-route-")));
  const root = path.join(parent, "workspace"), control = path.join(parent, "reader");
  await mkdir(root); await mkdir(control, {mode:0o700});
  t.after(() => rm(parent, {recursive:true, force:true}));
  const put = async (file, value) => {
    const bytes = typeof value === "string" ? value : canonicalJson(value) + "\n";
    await writeFile(path.join(root, file), bytes); return {path:file, sha256:sha256(bytes)};
  };
  const cli = (script, ...args) => {
    const result = spawnSync(process.execPath, [script, ...args], {cwd:root, encoding:"utf8", timeout:30000});
    assert.equal(result.error, undefined); assert.equal(result.signal, null);
    assert.equal(result.stderr, ""); assert.ok(result.stdout.trim());
    return {exit:result.status, output:result.stdout};
  };
  assert.equal(cli(path.join(repository,"scripts/vydykhai.mjs"), "install", root).exit, 0);
  await put("module-map.md", "# Module Map\n- Bundle consumption: [memory](memory-graph.md), [contract](bundle-contract.md), [release](connection.json).\n- Unrelated theme: [contract](unrelated.md).\n");
  await put("memory-graph.md", graph);
  await put("bundle-contract.md", "Public entry: buildBundle(input). Release: bundle-r2. Output: bundle/v1, entries and count; trim labels and use codepoint order.\n");
  await put("consumer-contract.md", "Public entry: bundleConsumer(input). Consume the existing JSON boundary without changing the producer.\n");
  const release = await put("opaque-release.txt", "Opaque synthetic bundle-r2 artifact; no producer implementation.\n");
  const connection = await put("connection.json", {entrypoint:"buildBundle",revision:"bundle-r2",format:"json",artifact:release});
  await put("unrelated.md", "Theme-only capability; no bundle obligations.\n");
  for (const file of new Set(facts.map(f => f.file))) {
    if (missingTarget && file === "evidence-38.json") continue;
    await put(file, {schema:"context.events.v1",complete:true,events:facts.filter(f => f.file === file)
      .map(f => ({id:f.id,authorKind:"human",body:f.text}))});
  }
  // Future consumer case is a requirement, not historical success. Commands stay
  // inert and unregistered with the source reader; this fixture only plans.
  const sentinel = "throw new Error('OFFLINE_PLAN_ONLY_NO_EXECUTION');\n";
  await put("consumer.mjs", sentinel); await put("verify.mjs", sentinel);
  await put("oracle.json", {schema:"context.oracle.v1",examples:[{id:"CONSUMER",sourceAssertionRefs:["Q2"],input:[],
    expected:{schema:"bundle/v1",entries:[],count:0}}]});
  const registryFile = path.join(control,"sources.json");
  await writeFile(registryFile, canonicalJson({schema:"control.review-sources.v1",workspace:root,sources}), {mode:0o600});
  const reader = await openReviewSources(registryFile);
  const plan = async (pkg, name) => {
    await put(`${name}.json`, pkg);
    const executed = cli(path.join(root,"scripts/vydykhai.mjs"), "context-prepare", "plan", "--input", `${name}.json`, "--output", name);
    const result = {exit:executed.exit, ...JSON.parse(executed.output)};
    return {...result, ...(result.status === "PLAN_READY" ? {saved:JSON.parse(await readFile(path.join(root,result.plan),"utf8"))} : {})};
  };
  const packageFor = (rows, {omit = [], resurrect = false, promoteAssisted = false} = {}) => {
    const events = rows.filter(r => r.status === "AVAILABLE" && r.path.endsWith(".json") && r.path !== "connection.json")
      .flatMap(row => JSON.parse(row.text).events.map(event => ({row,event})))
      .filter(({event}) => !omit.includes(event.id));
    const selected = [...new Map(events.map(({row}) => [row.id,{id:row.id,path:row.path,scope:["bundle"]}])).values()];
    const classifications = events.map(({row,event}) => {
      const fact = facts.find(f => f.id === event.id);
      let disposition = fact.disposition, supersededBy = fact.supersededBy ?? null;
      if (resurrect && event.id === "Q1") {disposition="current_constraint";supersededBy=null;}
      if (resurrect && event.id === "Q2") {disposition="superseded";supersededBy="Q1";}
      if (promoteAssisted && event.id === "Q3") disposition="accepted_capability";
      if (promoteAssisted && event.id === "Q4") disposition="evidence_only";
      return {sourceId:row.id,eventId:event.id,eventDisposition:"assertions",reason:"Synthetic source classification, not a model verdict",
        assertions:[{id:event.id,quote:event.body,disposition,scope:["bundle"],targetRef:"module:buildBundle",
          reason:"Apply the selected source meaning",supersededBy,ownerGate:fact.ownerGate ?? null,trigger:fact.trigger ?? null}]};
    });
    const command = {executable:"node",args:["consumer.mjs"],cwd:"."};
    const references = rows.filter(r => r.status === "AVAILABLE" && events.some(e => e.row.id === r.id))
      .map(r => ({id:r.id,path:r.path,quote:r.text,purpose:r.purpose,appliesTo:"task"}));
    references.unshift({id:"public-contract",path:"bundle-contract.md",quote:"Public entry: buildBundle(input).",purpose:"Public consumption",appliesTo:"task"},
      {id:"consumer-contract",path:"consumer-contract.md",quote:"Public entry: bundleConsumer(input).",purpose:"Owned boundary",appliesTo:"task"});
    return {schema:"context.package.v2",owner:"module-owner",
      task:{id:"cold-consumer",worker:"consumer-worker",scope:["bundle"],action:command,candidateFiles:["consumer.mjs"]},
      module:{publicBoundary:"bundleConsumer",implementationFiles:["consumer.mjs"],retainedExampleIds:[],newExampleIds:["CONSUMER"],oracle:"oracle.json",
        verificationScript:"verify.mjs",verificationCommand:{...command,args:["verify.mjs"]},contractFiles:["consumer-contract.md","bundle-contract.md"]},
      sources:selected,classifications,dependencies:[{id:"release",path:release.path,scope:["bundle"]},{id:"connection",path:connection.path,scope:["bundle"]}],
      sharedArtifacts:["module-map.md","memory-graph.md"],
      moduleAccess:{schema:"context.module-access.v1",modules:[
        {id:"bundleConsumer",intent:"create",contractFiles:["consumer-contract.md"],privatePaths:["consumer.mjs"],release:null},
        {id:"buildBundle",intent:"consume",contractFiles:["bundle-contract.md"],privatePaths:["producer-private"],release:{artifact:release,connection}}]},
      navigation:{taskId:"cold-consumer",worker:"consumer-worker",preparedBy:"synthetic-preparer",outcome:request,references,
        constraints:[{text:"Consume public JSON only; no producer change.",appliesTo:"task",referenceIds:["public-contract"]}],gaps:[],
        assignment:{owner:"module-owner",requestId:"cold-initial",question:request,phase:"initial",previous:null}}};
  };
  return {root, reader, registryFile, put, plan, packageFor};
}
