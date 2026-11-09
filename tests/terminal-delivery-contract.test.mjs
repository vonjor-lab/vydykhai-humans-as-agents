import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("dispatch release has one qualified delivery or bounded wait contract", () => {
  const workflow = read("docs/workflows/production-continuation.md");
  assert.match(workflow, /results and stops delivered to this owner, including termination before Return Sync/);
  assert.match(workflow, /wait timeout means no terminal event, not worker failure/);
  assert.match(workflow, /reuse existing handles and saved cursors/);
  assert.doesNotMatch(workflow, /Do not keep the manager busy waiting/);
  for (const p of ["docs/AGENTS_CORE.md", ".agents/skills/framework-orchestrator/SKILL.md"])
    assert.match(read(p), /terminal-delivery-before-turn-release/);
});
test("recovery retains authority, human attention, evidence and honest limits", () => {
  const workflow = read("docs/workflows/production-continuation.md");
  for (const text of ["UNKNOWN forbids replay", "one already-authorized available fallback",
    "without repeating or hiding the question", "sending a message is not recovery proof",
    "cannot resurrect an ended application", "not revival of an ended owner"])
    assert.ok(workflow.includes(text), text);
});
