import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = name => readFile(new URL(`../${name}`, import.meta.url), "utf8");
const contract = await read("docs/workflows/task-context-handoff-template.md");

// Instruction lint, not a simulation of host permissions or live agent behavior.
test("return instructions distinguish verified scope from an agent assertion", () => {
  for (const rule of [
    /exact recipient identity\/project/, /current human authorization source/,
    /Delegation conveys only the human-approved scope/,
    /shared project name alone does not establish trust/,
    /Reuse still-applicable authorization/,
    /New recipients, disclosures or actions outside that scope/,
    /Verify the actual source event and relevant content/,
    /A page containing other turns/, /source export or receipt is evidence to review, not host permission/,
  ]) assert.match(contract, rule);
});

test("denial handling retains work and approval without alternate-channel disclosure", () => {
  for (const rule of [
    /single accepted notification owner uses a minimal wakeup/, /Record `SENT` only after successful authorized transport/,
    /explicit security denial from transport loss/,
    /another tool, tracker, recipient, parent read or Guard/,
    /as permitted by the host policy/, /continue independent authorized work/,
    /narrower payload is not automatically permission to bypass/,
    /cite that question and reply together/, /without repeated identical questions or automatic retries/,
    /external-provider disclosure, database privileges, spend, merge and deployment/,
  ]) assert.match(contract, rule);
});

test("launch, work, acceptance, updates and control share the same return contract", async () => {
  for (const name of [
    "docs/AGENTS_CORE.md", "docs/FRAMEWORK.md", "docs/FRAMEWORK_RU.md",
    "docs/workflows/project-launch.md", "docs/workflows/start-work.md",
    "docs/workflows/accept-work.md", "docs/workflows/framework-orchestrator.md",
    "docs/workflows/framework-activation.md", "docs/workflows/project-guard.md",
  ]) assert.match(await read(name), /task-context-handoff-template\.md#return-authorization/, name);
  for (const name of ["start-work", "accept-work", "framework-orchestrator"]) {
    const entry = await read(`.agents/skills/${name}/SKILL.md`);
    assert.match(entry, new RegExp(`docs/workflows/${name}\\.md`), name);
  }
  const guard = await read("docs/workflows/project-guard.md");
  assert.match(guard, /`WAKE` is a liveness recommendation, not permission to disclose/);
  assert.match(guard, /Structural outbox\/Guard checks do not authenticate recipients/);
  assert.match(guard, /may still flag the result as pending/);
});
