import test from "node:test";
import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import path from "node:path";
import {coldFixture, request} from "./fixtures/framework-v2/cold-route.mjs";
import {canonicalJson, sha256, checkPreparedContext} from "../scripts/memory-brief.mjs";
import {prepareNavigation} from "../scripts/context-navigation.mjs";
import {validateMemoryGraph} from "../scripts/vydykhai.mjs";

// Independent expected obligations: never registered with the controlled reader.
const expected = Object.freeze({
  Q1:{disposition:"superseded",supersededBy:"Q2",meaning:/D1 formerly lowercased.*D2 supersedes/},
  Q2:{disposition:"current_constraint",meaning:/preserves identifier spelling.*duplicates case-insensitively.*bundle-r2.*no preprocessing or producer rewrite/},
  Q3:{disposition:"evidence_only",meaning:/operator removed a duplicate.*assisted evidence, not autonomous success/},
  Q4:{disposition:"accepted_capability",meaning:/without operator repair.*does not revoke.*additional consumer needs its own future result/},
  Q5:{disposition:"current_constraint",meaning:/Reject keep-last.*discarded duplicate data.*DUPLICATE_ID/},
  Q6:{disposition:"deferred",ownerGate:"module-owner",trigger:"bundle/export returns to scope",
    meaning:/ask module-owner to decide CSV.*Do not implement.*decision or explicit retirement/},
});

// Scripted, fixture-specific link following, not a canonical retrieval engine.
const links = text => [...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map(m => m[1]);
async function ordinaryRoute(reader) {
  const index = await reader.list(), rows = [], trace = [], visited = new Set();
  const acquire = async (file, from) => {
    const entry = index.find(e => e.path === file);
    assert.ok(entry, `Unregistered fixture link: ${file}`);
    if (visited.has(entry.id)) return rows.find(r => r.id === entry.id);
    visited.add(entry.id);
    const row = await reader.read({id:entry.id}); rows.push(row);
    trace.push({from, path:file, id:row.id, status:row.status, ...(row.sha256 ? {sha256:row.sha256} : {})});
    if (row.status === "AVAILABLE") assert.equal(row.sha256, sha256(row.text));
    return row;
  };
  const map = await acquire("module-map.md", "ordinary module index");
  const entry = map.text.split("\n").find(line => line.startsWith("- Bundle consumption:"));
  assert.ok(entry); const entryLinks = links(entry);
  for (const file of entryLinks) await acquire(file, map.id);
  const graph = rows.find(r => r.path === "memory-graph.md");
  const nodeSection = graph.text.split("## Current Memory Nodes\n")[1].split("## Source Coverage Ledger\n")[0];
  for (const node of nodeSection.split(/^### /m).slice(1)) {
    assert.match(node, /- About: ENT-BUNDLE\n/);
    const sourceLine = node.split("\n").find(line => line.startsWith("- Source / checked:"));
    for (const file of links(sourceLine)) await acquire(file, `${graph.id}/${node.split(" ")[0]}`);
  }
  return {rows, trace};
}

function oracleGaps(pkg, route) {
  const gaps = [], available = new Map(route.rows.filter(r => r.status === "AVAILABLE").map(r => [r.id,r]));
  for (const row of route.rows) if (row.status !== "AVAILABLE") gaps.push(`unavailable:${row.path}`);
  const actual = new Map(pkg.classifications.flatMap(c => c.assertions.map(a => [a.id,{...a,sourceId:c.sourceId,eventId:c.eventId}])));
  for (const [id, obligation] of Object.entries(expected)) {
    const a = actual.get(id);
    if (!a) {gaps.push(`omitted:${id}`); continue;}
    if (a.disposition !== obligation.disposition || (a.supersededBy ?? null) !== (obligation.supersededBy ?? null) ||
        (a.ownerGate ?? null) !== (obligation.ownerGate ?? null) || (a.trigger ?? null) !== (obligation.trigger ?? null) ||
        !obligation.meaning.test(a.quote)) gaps.push(`meaning:${id}`);
    const source = available.get(a.sourceId), declared = pkg.sources.find(s => s.id === a.sourceId);
    const event = source && JSON.parse(source.text).events.find(e => e.id === a.eventId);
    if (!source || source.sha256 !== sha256(source.text) || declared?.path !== source.path || !event?.body.includes(a.quote)) gaps.push(`source:${id}`);
    if (!pkg.navigation.references.some(r => r.path === source?.path && r.quote.includes(a.quote))) gaps.push(`navigation:${id}`);
  }
  return gaps.sort();
}

function declaredCheck(pkg, route, omitDelivered = []) {
  const inventory = [], dispositions = [], items = [];
  for (const source of pkg.sources) {
    const row = route.rows.find(r => r.id === source.id);
    for (const event of JSON.parse(row.text).events) inventory.push({sourceId:source.id,eventId:event.id,
      sha256:sha256(canonicalJson(event)),scope:source.scope});
  }
  for (const c of pkg.classifications) {
    const event = inventory.find(i => i.sourceId === c.sourceId && i.eventId === c.eventId);
    dispositions.push({sourceId:c.sourceId,eventId:c.eventId,sourceSha256:event.sha256,reviewRef:"offline-fixture-only",
      integrated:true,localOwner:null,localTask:null,reason:c.reason,
      assertions:c.assertions.map(({quote, ...a}) => a)});
    for (const a of c.assertions) if (["current_constraint","accepted_capability","deferred"].includes(a.disposition) && !omitDelivered.includes(a.id))
      items.push({id:`item-${a.id}`,text:a.quote,sourceAssertionRefs:[a.id]});
  }
  return checkPreparedContext({inventory,dispositions,phase:"bind",prepared:{scope:pkg.task.scope,taskId:pkg.task.id,
    owner:pkg.task.worker,allowLocalOverlay:false,items,envelope:null,atomicRender:""}});
}

async function navigation(w, pkg) {
  return prepareNavigation(pkg.navigation, pkg.task, file => readFile(path.join(w.root,file)), pkg.module.contractFiles);
}
async function onlyPlan(w, pkg, name) {
  const result = await w.plan(pkg,name);
  if (result.status === "PLAN_READY") {
    assert.equal(result.exit,0); assert.equal(result.approval,"REQUIRED");
    assert.deepEqual(await readdir(path.join(w.root,name)),["plan.json"]);
    assert.deepEqual(result.saved.semanticPackage,pkg);
  }
  return result;
}

test("cold public map/graph links reach applicable evidence; installed plan is not a model verdict", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows);
  assert.equal(request,"Prepare an additional JSON consumer of the existing bundle. Do not change the producer.");
  assert.equal((await w.reader.list()).length,9);
  assert.equal(route.rows.length,8); assert.ok(!route.rows.some(r => r.path === "unrelated.md"));
  assert.ok(route.trace.filter(r => r.from.includes("MEM-")).length === 4);
  await assert.rejects(w.reader.read({id:"oracle"}), /REVIEW_SOURCE_NOT_REGISTERED/);
  assert.ok(!(await w.reader.list()).some(r => /producer|oracle|verify|consumer\.mjs/.test(r.path)));
  assert.deepEqual(oracleGaps(pkg,route),[]);
  const checked = declaredCheck(pkg,route);
  assert.deepEqual(checked.requiredAssertionIds,["Q2","Q4","Q5","Q6"]);
  assert.equal(checked.semanticTruth,"NOT_VERIFIED");
  const nav = await navigation(w,pkg);
  assert.ok(nav.references.every(r => /^[a-f0-9]{64}$/.test(r.sha256)));
  const result = await onlyPlan(w,pkg,"complete"); assert.equal(result.status,"PLAN_READY");
  assert.ok(result.saved.inputFiles.some(r => r.path === "opaque-release.txt"));
  assert.ok(!result.saved.inputFiles.some(r => r.path.startsWith("producer-private")));
  const manifest = JSON.parse(await readFile(new URL("../vydykhai.json",import.meta.url)));
  const issues = validateMemoryGraph(route.rows.find(r => r.path === "memory-graph.md").text,manifest);
  assert.deepEqual(issues,["CURRENT","NEXT","CROSS_DOMAIN","PRIOR_MISS"].map(slot => `Project Memory Graph: ${slot} retrieval probe has not passed`));
});

test("ordinary omission: same available graph, both source sets omit rejection/idea; PLAN_READY but oracle fails", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader);
  const complete = w.packageFor(route.rows), incomplete = w.packageFor(route.rows,{omit:["Q5","Q6"]});
  const before = route.rows.filter(r => /map|graph/.test(r.path)).map(r => [r.path,r.sha256]);
  assert.deepEqual(incomplete.sources.map(s => s.id),["s51","s62"]);
  assert.deepEqual(oracleGaps(incomplete,route),["omitted:Q5","omitted:Q6"]);
  assert.equal((await navigation(w,incomplete)).gaps.length,0);
  assert.equal((await onlyPlan(w,complete,"complete")).status,"PLAN_READY");
  assert.equal((await onlyPlan(w,incomplete,"incomplete")).status,"PLAN_READY");
  const again = await ordinaryRoute(w.reader);
  assert.deepEqual(again.rows.filter(r => /map|graph/.test(r.path)).map(r => [r.path,r.sha256]),before);
  assert.equal(declaredCheck(incomplete,route).coverageBasis,"declared-source-snapshots");
});

test("known-but-undelivered assertion blocks instead of inheriting compiler readiness", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows);
  const result = await onlyPlan(w,pkg,"known"); assert.equal(result.status,"PLAN_READY");
  // plan renders declared obligations itself; mutate delivery only at the bind checker.
  assert.deepEqual(declaredCheck(result.saved.semanticPackage,route,["Q5"]),{status:"BLOCKED",code:"BRIEF_ASSERTION_MISSING",ref:"Q5"});
});

test("missing graph target: actual reader reports MISSING, selected reference and declared gap block", async t => {
  const w = await coldFixture(t,{missingTarget:true}), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows);
  const missing = route.rows.find(r => r.status === "MISSING");
  assert.equal(missing.path,"evidence-38.json");
  assert.deepEqual(oracleGaps(pkg,route),["omitted:Q5","unavailable:evidence-38.json"]);
  const selected = structuredClone(pkg);
  selected.navigation.references.push({id:missing.id,path:missing.path,quote:"Rejected approach evidence",purpose:missing.purpose,appliesTo:"task"});
  const unread = await onlyPlan(w,selected,"missing-reference");
  assert.equal(unread.status,"BLOCKED"); assert.equal(unread.code,"PREPARATION_IO_INVALID");
  pkg.navigation.gaps.push({text:`MEMORY_COVERAGE_GAP: ${missing.path} is unavailable`,critical:true});
  const gap = await onlyPlan(w,pkg,"declared-gap");
  assert.equal(gap.status,"BLOCKED"); assert.equal(gap.code,"NAVIGATION_CRITICAL_GAP");
});

test("missing target silently left out remains a caller coverage gap, not a false compiler completeness claim", async t => {
  const w = await coldFixture(t,{missingTarget:true}), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows);
  assert.equal((await onlyPlan(w,pkg,"ignored-gap")).status,"PLAN_READY");
  assert.deepEqual(oracleGaps(pkg,route),["omitted:Q5","unavailable:evidence-38.json"]);
});

test("current versus superseded: source-valid reversed dispositions can compile but cannot satisfy oracle", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows,{resurrect:true});
  assert.equal((await onlyPlan(w,pkg,"reversed")).status,"PLAN_READY");
  assert.deepEqual(oracleGaps(pkg,route),["meaning:Q1","meaning:Q2"]);
  assert.deepEqual(declaredCheck(pkg,route).requiredAssertionIds,["Q1","Q4","Q5","Q6"]);
});

test("assisted historical success cannot replace released success qualification", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows,{promoteAssisted:true});
  assert.equal((await onlyPlan(w,pkg,"assisted")).status,"PLAN_READY");
  assert.deepEqual(oracleGaps(pkg,route),["meaning:Q3","meaning:Q4"]);
});

test("all acquired sources alone cannot establish meaning or genuine byte bindings", async t => {
  const w = await coldFixture(t), route = await ordinaryRoute(w.reader), pkg = w.packageFor(route.rows);
  const fabricated = structuredClone(pkg);
  fabricated.classifications.find(c => c.eventId === "Q5").assertions[0].quote="keep-last is now safe";
  assert.deepEqual(oracleGaps(fabricated,route),["meaning:Q5","navigation:Q5","source:Q5"]);
  const forged = structuredClone(route); forged.rows.find(r => r.id === "s73").sha256="0".repeat(64);
  assert.deepEqual(oracleGaps(pkg,forged),["source:Q5"]);
});
