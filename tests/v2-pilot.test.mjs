import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm, readFile, access} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {stagePilot, pilotFiles} from "../scripts/stage-v2-pilot.mjs";
test("pilot stages source-complete phases without oracle or previous answer leakage", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "framework-v2-pilot-"));
  t.after(() => rm(root, {recursive: true, force: true}));
  const output = path.join(root, "run"), result = await stagePilot(output);
  assert.equal(result.modelsLaunched, 0);
  const oracle = JSON.parse(await readFile(path.join(output, "grading/oracle.json"), "utf8"));
  for (const phase of ["prepare", "review"]) {
    const files = await pilotFiles(path.join(output, phase));
    assert.equal(files.some(f => /oracle|answer|rubric/.test(f.path)), false);
    for (const criterion of oracle[phase]) for (const source of criterion.sources)
      await access(path.join(output, phase, source));
  }
  await assert.rejects(access(path.join(output, "prepare/proposed-plan.json")));
  const prompt = await readFile(path.join(output, "prepare/PROMPT.md"), "utf8");
  assert.doesNotMatch(prompt, /pricing\.md|memory\.json|lab-run\.md|rounding|operator|journal/);
  await assert.rejects(stagePilot(output), /EEXIST/);
});
