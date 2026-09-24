import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = (name) => readFile(new URL(`../${name}`, import.meta.url), "utf8");

test("structural route: authorized continuation omits global reread and repeated approval", async () => {
  const core = await source("docs/AGENTS_CORE.md");
  const entry = await source(".agents/skills/framework-orchestrator/SKILL.md");
  const shaping = await source("docs/workflows/start-work.md");
  assert.match(core, /do not reread the same text/);
  assert.match(entry, /ordinary current-contract continuation/);
  assert.match(entry, /not a routine prerequisite/);
  assert.match(shaping, /ordinary continuation within that approved contract needs no second approval/);
});

test("structural route: consumer boundary, new boundary and retained meaning remain linked", async () => {
  const entry = await source(".agents/skills/start-work/SKILL.md");
  const route = await source("docs/workflows/start-work.md");
  assert.match(entry, /consumer reads a public contract/);
  assert.match(entry, /new or changed module boundary needs explicit human agreement/);
  assert.match(route, /For each consumed module, read its public contract/);
  assert.match(route, /complete applicable `Memory Brief`/);
});

test("structural route: lost return and unknown outcome retain one delivery owner", async () => {
  const entry = await source(".agents/skills/accept-work/SKILL.md");
  const returnContract = await source("docs/workflows/task-context-handoff-template.md");
  assert.match(entry, /Unknown external outcomes require reconciliation before replay/);
  assert.match(returnContract, /single accepted notification owner/);
  assert.match(returnContract, /never both/);
});

test("structural route: unchanged hot path does not require State reread or write", async () => {
  const entry = await source(".agents/skills/framework-orchestrator/SKILL.md");
  const workflow = await source("docs/workflows/framework-orchestrator.md");
  const hotRead = entry.split("For an ordinary current-contract continuation,")[1].split("For a cold decision,")[0];
  const hotFinish = entry.split("## Finish")[1].split("For a material control decision,")[0];
  assert.match(hotRead, /latest relevant event and its lease/);
  assert.doesNotMatch(hotRead, /snapshot|Project State/);
  assert.match(hotFinish, /leave Project State untouched/);
  assert.match(hotFinish, /direct user question/);
  assert.match(workflow, /For every material State transition render one complete authoritative Candidate/);
});
