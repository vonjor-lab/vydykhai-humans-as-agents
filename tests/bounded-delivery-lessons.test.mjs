import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read = path => readFile(new URL("../" + path, import.meta.url), "utf8");

test("ordinary entry routes bounded repair and preserves independent evidence", async () => {
  const entry = await read(".agents/skills/framework-orchestrator/SKILL.md");
  const route = await read("docs/workflows/framework-orchestrator.md");
  assert.match(entry, /Current action and bounded repair/);
  for (const phrase of [
    "one consistent current projection", "superseded commands as labelled history",
    "A bounded acceptance closes only its own", "applicable negative findings",
    "Never replay UNKNOWN effects", "stop automatic redispatch for that cause",
    "Do not reset attempts", "trust boundary needs explicit human agreement",
    "not a new audit", "not model polling"
  ]) assert.ok(route.includes(phrase), phrase);
});

test("safe-boundary adoption reuses existing owner and actual readback", async () => {
  const manifest = JSON.parse(await read("vydykhai.json"));
  const requirement = manifest.adoptionRequirements.find(r => r.id === "resume-or-checkpoint");
  for (const phrase of ["safe checkpoint", "NO_CHANGE", "participant's application",
    "without repeating accepted work", "trust-boundary changes remain human-owned"])
    assert.ok(requirement.action.includes(phrase), phrase);
  assert.match(await read("docs/FRAMEWORK.md"), /current-action-and-bounded-repair/);
  assert.match(await read("docs/FRAMEWORK_RU.md"), /current-action-and-bounded-repair/);
});
