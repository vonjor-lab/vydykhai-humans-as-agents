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

test("a complete memory record passes structural validation without claiming semantic proof", () => {
  assert.deepEqual(validateMemoryGraph(graphFixture(), manifest), []);
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
