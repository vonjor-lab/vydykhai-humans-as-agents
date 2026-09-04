import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { validateMemoryGraph } from "../scripts/vydykhai.mjs";

const manifest = JSON.parse(await readFile(new URL("../vydykhai.json", import.meta.url), "utf8"));

function graphFixture() {
  return `<!-- vydykhai:project-memory-graph v3 -->
# Project Memory Graph: Example
Project State: shared-state
Watermark: event-1
Declared nodes: 1
Last compaction: none
Last retrieval check: review-1
## Anchor Index
| ID | Kind | Canonical name / real-world aliases | Scope | Source |
| --- | --- | --- | --- | --- |
| ENT-OUTCOME | OUTCOME | coherent user journey | product | accepted brief revision 1 |
## Current Memory Nodes
### MEM-FLOW - Preserve the accepted journey
- Type / status: INVARIANT / ACTIVE
- About: ENT-OUTCOME
- Recall when: change the user journey
- Because: partial success must not break the whole journey
- Apply: preserve accepted state and downstream consumers
- Avoid: accepting an isolated fixture as the whole product
- Verify: exercise the changed boundary and its consumers
- Applies / exceptions: the affected journey only
- Owner gate: none
- Relations: about -> ENT-OUTCOME
- Source / checked: accepted brief revision 1 / review-1
## Pending Memory Events
| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
## Live Retrieval Probes
| Slot | Raw trigger | Expected executable action or gate | Observed brief / evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
| CURRENT | repair the current journey | preserve its contract | brief / review-1 | PASS / review-1 | accepted brief |
| NEXT | change the next stage | check its consumers | brief / review-1 | PASS / review-1 | accepted brief |
| PRIOR_MISS | a local test passed | exercise the actual boundary | brief / review-1 | PASS / review-1 | reviewed failure |
## Legacy Source Map
| Previous id or artifact | Current node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
<!-- vydykhai:project-memory-graph:end -->
`;
}

function graphV4Fixture() {
  return `<!-- vydykhai:project-memory-graph v4 -->
# Project Memory Graph: Example
Project State: shared-state
Operating Brief: accepted-brief/rev-1
Source ledger: this graph
Watermark: event-2
Declared anchors: 4
Declared routes: 3
Declared nodes: 2
Last compaction: none
Last reflection: event-2 / NONE / PASS
Last retrieval check: probes-2 / independent reviewer / PASS
## Anchor Index
| ID | Kind | Canonical name / real-world aliases | Scope / identity | Documentation / implementation | Source / checked |
| --- | --- | --- | --- | --- | --- |
| ENT-OUTCOME | OUTCOME | coherent user journey | accepted product outcome | NOT_REQUIRED: outcome | accepted brief / rev-1 |
| ENT-MODULE | MODULE | planning module | durable planning behavior | contract: docs/modules/planning.md; implementation: src/planning/ | accepted design / rev-2 |
| ENT-CAPABILITY | CAPABILITY | arrangement generation | layout capability inside planning | contract: docs/modules/arrangement.md; implementation: src/arrangement/ | accepted design / rev-2 |
| ENT-ARTIFACT | ARTIFACT | accepted layout | reusable planning result | accepted artifact revision 2 | accepted task / rev-2 |
## Entity Routes
| From | Relation | To | Applies / qualification | Source / checked |
| --- | --- | --- | --- | --- |
| ENT-MODULE | serves | ENT-OUTCOME | module exists for this outcome | accepted brief / rev-1 |
| ENT-CAPABILITY | part-of | ENT-MODULE | capability belongs to planning | accepted design / rev-2 |
| ENT-CAPABILITY | produces | ENT-ARTIFACT | accepted result only | accepted task / rev-2 |
## Current Memory Nodes
### MEM-REQUIREMENT - Preserve consumer-ready output
- Type / status: REQUIREMENT / ACTIVE
- About: ENT-CAPABILITY
- Recall when: change arrangement generation or accepted layout
- Because: downstream work consumes the accepted layout
- Apply: preserve the accepted artifact contract
- Avoid: treating an isolated preview as final output
- Verify: exercise the capability and its artifact consumer
- Applies / exceptions: current planning route only
- Owner gate: none
- Return / close when: NOT_REQUIRED
- Protected pointer (POINTER only): none
- Relations: about -> ENT-CAPABILITY; verified-by -> ENT-ARTIFACT
- Source / checked: accepted brief and task / rev-2
### MEM-COMMITMENT - Revisit placement reuse
- Type / status: COMMITMENT / ACTIVE
- About: ENT-MODULE, ENT-CAPABILITY
- Recall when: plan placement or extend the planning module
- Because: the accepted algorithm may support another placement path
- Apply: return the reuse decision before extending placement behavior
- Avoid: silently duplicating the algorithm
- Verify: owner records a decision and affected consumers
- Applies / exceptions: next placement planning checkpoint
- Owner gate: product owner
- Return / close when: planning checkpoint produces an accepted decision or explicit retirement
- Protected pointer (POINTER only): none
- Relations: about -> ENT-CAPABILITY; requires -> ENT-MODULE
- Source / checked: user decision / rev-2
## Source Coverage Ledger
| Source / participant | Range / revision | Anchors | Current nodes | Coverage | Gap / supersession | Checked |
| --- | --- | --- | --- | --- | --- | --- |
| accepted brief | rev-1 | ENT-OUTCOME, ENT-MODULE, ENT-CAPABILITY, ENT-ARTIFACT | MEM-REQUIREMENT | COVERED | none | reviewer / 2026-09-04 / receipt-1 |
| user decision | rev-2 | ENT-MODULE, ENT-CAPABILITY | MEM-COMMITMENT | COVERED | none | reviewer / 2026-09-04 / receipt-2 |
## Pending Memory Events
| Event | Trigger | Before / Now / Why | Anchors | Miss | Action | Source | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
## Live Retrieval Probes
| Slot | Raw trigger | Expected route and executable action or gate | Observed brief / application evidence | Result / checked | Regression source |
| --- | --- | --- | --- | --- | --- |
| CURRENT | change arrangement output | goal through capability to artifact and requirement | brief plus task receipt | PASS / 2026-09-04 | accepted task |
| NEXT | extend placement behavior | module contract plus open commitment | brief plus owner gate | PASS / 2026-09-04 | user decision |
| CROSS_DOMAIN | use accepted layout downstream | producing capability plus artifact consumers | route plus application receipt | PASS / 2026-09-04 | accepted brief |
| PRIOR_MISS | avoid rebuilding known planning logic | prior decision and current implementation | brief plus code receipt | PASS / 2026-09-04 | reviewed miss |
## Legacy Source Map
| Previous id or artifact | Current anchor/node(s) | Coverage | Recall / action check |
| --- | --- | --- | --- |
| graph v3 | ENT-MODULE, MEM-REQUIREMENT | covered | ordinary arrangement change retrieves the route |
<!-- vydykhai:project-memory-graph:end -->
`;
}

test("a complete memory record passes structural validation without claiming semantic proof", () => {
  assert.deepEqual(validateMemoryGraph(graphFixture(), manifest), []);
});

test("a complete v4 graph connects outcomes, modules, artifacts, commitments and source coverage", () => {
  assert.deepEqual(validateMemoryGraph(graphV4Fixture(), manifest), []);
});

test("v4 rejects undocumented modules, disconnected entities and orphan commitments", () => {
  const undocumented = graphV4Fixture().replace(
    "contract: docs/modules/arrangement.md; implementation: src/arrangement/",
    "NOT_REQUIRED: helper",
  );
  assert.match(validateMemoryGraph(undocumented, manifest).join("\n"), /requires explicit current contract and implementation references/);
  const missingImplementation = graphV4Fixture().replace(
    "contract: docs/modules/arrangement.md; implementation: src/arrangement/",
    "contract: docs/modules/arrangement.md",
  );
  assert.match(validateMemoryGraph(missingImplementation, manifest).join("\n"), /requires explicit current contract and implementation references/);

  const disconnected = graphV4Fixture()
    .replace("Declared routes: 3", "Declared routes: 2")
    .replace(/^\| ENT-CAPABILITY \| produces \| ENT-ARTIFACT .*\n/m, "");
  assert.match(validateMemoryGraph(disconnected, manifest).join("\n"), /ENT-ARTIFACT has no entity route to an OUTCOME/);

  const noOwner = graphV4Fixture().replace("- Owner gate: product owner", "- Owner gate: none");
  assert.match(validateMemoryGraph(noOwner, manifest).join("\n"), /commitment lacks an owner gate/);
  const noReturn = graphV4Fixture().replace(
    "- Return / close when: planning checkpoint produces an accepted decision or explicit retirement",
    "- Return / close when: TBD",
  );
  assert.match(validateMemoryGraph(noReturn, manifest).join("\n"), /commitment lacks a return or close condition/);
});

test("v4 rejects missing source coverage and cross-domain retrieval proof", () => {
  const missingCoverage = graphV4Fixture().replace(/^\| user decision \| rev-2 .*\n/m, "");
  assert.match(validateMemoryGraph(missingCoverage, manifest).join("\n"), /MEM-COMMITMENT is absent from Source Coverage Ledger/);

  const missingProbe = graphV4Fixture().replace(/^\| CROSS_DOMAIN .*\n/m, "");
  assert.match(validateMemoryGraph(missingProbe, manifest).join("\n"), /missing CROSS_DOMAIN retrieval probe/);
});

test("memory validation rejects missing meaning and an unresolvable anchor", () => {
  for (const field of ["About", "Because", "Apply", "Avoid", "Verify", "Applies / exceptions", "Relations", "Source / checked"]) {
    const graph = graphFixture().split("\n").filter((line) => !line.startsWith(`- ${field}:`)).join("\n");
    assert.ok(validateMemoryGraph(graph, manifest).some((issue) => issue.includes(field)), field);
  }
  const graph = graphFixture().replace("- About: ENT-OUTCOME", "- About: ENT-MISSING");
  assert.match(validateMemoryGraph(graph, manifest).join("\n"), /unknown anchor ENT-MISSING/);
});

test("memory validation rejects dangling, ambiguous and untyped relations", () => {
  for (const relation of ["requires -> MEM-MISSING", "similar-to -> ENT-OUTCOME", "requires MEM-FLOW"]) {
    const graph = graphFixture().replace("about -> ENT-OUTCOME", relation);
    assert.ok(validateMemoryGraph(graph, manifest).length, relation);
  }
  const duplicate = graphFixture().replace("- Apply: preserve accepted state and downstream consumers", "- Apply: preserve the flow\n- Apply: replace the flow");
  assert.match(validateMemoryGraph(duplicate, manifest).join("\n"), /duplicate field Apply/);
});

test("PASS in evidence does not override a missed or duplicated retrieval result", () => {
  const missed = graphFixture().replace("brief / review-1 | PASS / review-1", "old PASS / review-1 | MISS / review-2");
  assert.match(validateMemoryGraph(missed, manifest).join("\n"), /CURRENT retrieval probe has not passed/);
  const row = graphFixture().split("\n").find((line) => line.startsWith("| CURRENT |"));
  const duplicate = graphFixture().replace(row, `${row}\n${row}`);
  assert.match(validateMemoryGraph(duplicate, manifest).join("\n"), /duplicate CURRENT retrieval probe/);
});

test("a complete graph can contain more than seven relevant records and policy does not cap the brief", () => {
  let graph = graphFixture().replace("Declared nodes: 1", "Declared nodes: 9");
  const record = graph.split("### MEM-FLOW")[1].split("## Pending Memory Events")[0];
  const extra = Array.from({ length: 8 }, (_, i) => `### MEM-DETAIL-${i}${record}`).join("");
  graph = graph.replace("## Pending Memory Events", `${extra}## Pending Memory Events`);
  assert.deepEqual(validateMemoryGraph(graph, manifest), []);
  assert.equal(manifest.memoryPolicy.taskBriefMaxNodes, null);
  assert.equal(manifest.memoryPolicy.contextRoutingPolicy, "goal-to-evidence-completeness");
});

test("malformed anchors and truncated last records cannot pass through heading counts", () => {
  const emptyIndex = graphFixture().replace(/^\| ENT-OUTCOME.*\n/m, "");
  assert.match(validateMemoryGraph(emptyIndex, manifest).join("\n"), /unknown anchor ENT-OUTCOME/);
  const invalidKind = graphFixture().replace("| OUTCOME |", "| GUESS | ");
  assert.match(validateMemoryGraph(invalidKind, manifest).join("\n"), /unknown anchor kind/);
  const unresolvedSource = graphFixture().replace("- Source / checked: accepted brief revision 1 / review-1", "- Source / checked: <source>");
  assert.match(validateMemoryGraph(unresolvedSource, manifest).join("\n"), /missing Source \/ checked/);
  const truncated = graphFixture().replace(/### MEM-FLOW[\s\S]*?(?=## Pending Memory Events)/, "### MEM-FLOW\n");
  assert.match(validateMemoryGraph(truncated, manifest).join("\n"), /MEM-FLOW missing Apply/);
});

test("consumer links and multiple parent anchors remain valid without requiring a single tree", () => {
  const graph = graphFixture()
    .replace("## Current Memory Nodes", "| ENT-OTHER | OUTCOME | another consumer | product | another accepted source |\n## Current Memory Nodes")
    .replace("- About: ENT-OUTCOME", "- About: ENT-OUTCOME, ENT-OTHER")
    .replace("- Relations: about -> ENT-OUTCOME", "- Relations: about -> ENT-OUTCOME; constrains -> ENT-OTHER");
  assert.deepEqual(validateMemoryGraph(graph, manifest), []);
  const legacy = graph.replace("about -> ENT-OUTCOME; constrains -> ENT-OTHER", "about -> ENT-OUTCOME, ENT-OTHER");
  assert.deepEqual(validateMemoryGraph(legacy, manifest), []);
  assert.match(validateMemoryGraph(legacy.replace("about -> ENT-OUTCOME, ENT-OTHER", "about -> ENT-OUTCOME, ENT-MISSING"), manifest).join("\n"), /unknown relation target ENT-MISSING/);
});

test("Markdown emphasis on canonical field labels preserves their identity", () => {
  for (const replacement of ["- **$1:** ", "- **$1**: "]) {
    const graph = graphFixture().replace(/^- ([^:\n]+): /gm, replacement);
    assert.deepEqual(validateMemoryGraph(graph, manifest), []);
    assert.deepEqual(validateMemoryGraph(graph.replace(/\n/g, "\r\n"), manifest), []);
  }
});

test("mixed emphasized and plain labels cannot hide duplicates or empty meaning", () => {
  const graph = graphFixture().replace("- Apply: preserve accepted state and downstream consumers",
    "- Apply: preserve accepted state and downstream consumers\n- **Apply:** replace the journey");
  assert.match(validateMemoryGraph(graph, manifest).join("\n"), /duplicate field Apply/);
  const empty = graphFixture().replace("- Because: partial success must not break the whole journey", "- **Because**: <missing>");
  assert.match(validateMemoryGraph(empty, manifest).join("\n"), /missing Because/);
});

test("legacy meaning labels require reconciliation, not inferred canonical fields or lost-memory claims", () => {
  const graph = graphFixture()
    .replace(/^- (Type \/ status|About|Applies \/ exceptions):.*\n/gm, "")
    .replace("- Because:", "- Why / change:")
    .replace("- Source / checked:", "- Sources / aliases:")
    .replace("- Apply:", "- Current meaning: preserve the accepted journey\n- Apply:")
    .replace(/^- ([^:\n]+): /gm, "- **$1:** ");
  const issues = validateMemoryGraph(graph, manifest);
  assert.equal(issues.length, 1);
  assert.match(issues[0], /legacy field layout requires reconciliation/);
  for (const missing of ["Type / status", "About", "Because", "Applies / exceptions", "Source / checked"]) {
    assert.ok(issues[0].includes(missing), missing);
  }
  assert.doesNotMatch(issues[0], /missing Apply|invalid Type|unknown anchor|lost|deleted/);
});

test("emphasis does not weaken type, reference or retrieval-result checks", () => {
  const graph = graphFixture().replace(/^- ([^:\n]+): /gm, "- **$1:** ");
  for (const [from, to, expected] of [
    ["INVARIANT / ACTIVE", "INVARIANT / GUESS", /invalid Type \/ status/],
    ["about -> ENT-OUTCOME", "requires -> MEM-MISSING", /unknown relation target MEM-MISSING/],
    ["about -> ENT-OUTCOME", "requires -> OLD-1", /invalid relation/],
    ["brief / review-1 | PASS / review-1", "old PASS / review-1 | MISS / review-2", /CURRENT retrieval probe has not passed/],
  ]) {
    assert.match(validateMemoryGraph(graph.replace(from, to), manifest).join("\n"), expected);
  }
});
