import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
test("dispatch release has one qualified delivery or bounded wait contract", () => {
  const workflow = read("docs/workflows/production-continuation.md");
  assert.match(workflow, /both successful completion and native errors/);
  assert.match(workflow, /wait timeout means no terminal event, not worker failure/);
  assert.match(workflow, /same inactive error may be returned even with an unchanged cursor/);
  assert.doesNotMatch(workflow, /Do not keep the manager busy waiting/);
  for (const p of ["docs/AGENTS_CORE.md", ".agents/skills/framework-orchestrator/SKILL.md"])
    assert.match(read(p), /terminal-delivery-before-turn-release/);
});
test("recovery retains authority, human attention, evidence and honest limits", () => {
  const workflow = read("docs/workflows/production-continuation.md");
  for (const text of ["UNKNOWN effects forbid replay", "one already-authorized available fallback",
    "without repeating or hiding the question", "sending a message is not recovery proof",
    "cannot guarantee owner", "not automatic wake-up or recovery"])
    assert.ok(workflow.includes(text), text);
});
