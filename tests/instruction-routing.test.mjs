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

test("structural route: closed modules have evidence and separate consumer and maintainer views", async () => {
  const contract = await source("docs/workflows/module-contract-template.md");
  assert.match(contract, /A closed module is an accepted, independently connectable capability at a fixed release/);
  assert.match(contract, /Use accepted module boundaries as context boundaries/);
  assert.match(contract, /not a promise of unlimited scale or measured savings without evidence/);
  assert.match(contract, /Project architecture:.*accepted decisions/);
  assert.match(contract, /source decision and retained tests/);
  assert.match(contract, /applicability and known failure cases/);
  assert.match(contract, /Independent connection:.*no producer source tree/);
});

test("structural route: composite acceptance preserves child obligations without recursively loading internals", async () => {
  const contract = await source("docs/workflows/module-contract-template.md");
  assert.match(contract, /name the accepted child releases and prove the combined input-to-output behavior/);
  assert.match(contract, /child constraints, failures, side effects and operational requirements/);
  assert.match(contract, /child public contracts, not their private algorithms/);
  assert.match(contract, /children passing alone does not establish the composite's acceptance/);
  assert.match(contract, /Record parent\/child composition in this map/);
});

test("structural route: completeness and cheap preparation cannot override accepted module context boundaries", async () => {
  const preparation = await source("docs/workflows/context-preparation.md");
  const route = await source("docs/workflows/context-route.md");
  assert.match(preparation, /Stop retrieval at an accepted public boundary, including composites/);
  assert.match(preparation, /Cheap retrieval is not permission to scan every closed module/);
  const completion = route.split("Completion means")[1].split("\n\n")[0];
  assert.match(completion, /implementation is examined only inside the authorized change or evidenced diagnostic boundary/);
  assert.match(completion, /no seven-node or two-hop ceiling for relevant obligations/);
  assert.match(completion, /stops automatic internal-tree expansion/);
});
