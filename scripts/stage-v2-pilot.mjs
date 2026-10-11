// Maintainer-only staging. No model call, product read or installed runtime change.
import {mkdir, readdir, lstat, readFile, writeFile, realpath} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {sha256} from "./memory-brief.mjs";
const fixture = fileURLToPath(new URL("../tests/fixtures/framework-v2-pilot/", import.meta.url));
export async function pilotFiles(root, prefix = "") {
  const out = [];
  for (const name of (await readdir(path.join(root, prefix))).sort()) {
    const rel = path.join(prefix, name), full = path.join(root, rel), stat = await lstat(full);
    if (stat.isSymbolicLink()) throw new Error("PILOT_SYMLINK_FORBIDDEN");
    if (stat.isDirectory()) out.push(...await pilotFiles(root, rel));
    else if (stat.isFile()) out.push({path: rel, sha256: sha256(await readFile(full)), bytes: stat.size});
    else throw new Error("PILOT_NONREGULAR_SOURCE");
  }
  return out;
}
export async function stagePilot(output) {
  if (!path.isAbsolute(output)) throw new Error("PILOT_ABSOLUTE_OUTPUT_REQUIRED");
  const dest = path.join(await realpath(path.dirname(output)), path.basename(output));
  const repo = fileURLToPath(new URL("../", import.meta.url));
  if (dest === repo.slice(0, -1) || dest.startsWith(repo)) throw new Error("PILOT_OUTPUT_MUST_BE_EXTERNAL");
  const files = await pilotFiles(fixture), contents = new Map();
  for (const file of files) {
    const bytes = await readFile(path.join(fixture, file.path));
    if (sha256(bytes) !== file.sha256) throw new Error("PILOT_SOURCE_CHANGED");
    contents.set(file.path, bytes);
  }
  const prompts = JSON.parse(contents.get("prompts.json"));
  await mkdir(dest);
  const save = async (name, bytes) => {
    const full = path.join(dest, name); await mkdir(path.dirname(full), {recursive: true});
    await writeFile(full, bytes, {flag: "wx"});
  };
  for (const phase of ["prepare", "review"]) {
    for (const [name, bytes] of contents) if (name.startsWith("project/"))
      await save(`${phase}/${name.slice("project/".length)}`, bytes);
    await save(`${phase}/AGENTS.md`, contents.get("policy.md"));
    await save(`${phase}/PROMPT.md`, `${prompts[phase]}\n\n${prompts.common}\n`);
  }
  await save("review/proposed-plan.json", contents.get("proposed-plan.json"));
  await save("grading/oracle.json", contents.get("oracle.json"));
  const freeze = {schema: "framework.v2-pilot.freeze.v1", inputs: files,
    prepare: await pilotFiles(path.join(dest, "prepare")), review: await pilotFiles(path.join(dest, "review")),
    oracleSha256: sha256(contents.get("oracle.json")), modelsLaunched: 0,
    limitations: ["policy slice, not whole installed framework", "no comparative baseline or economics proof",
      "filesystem separation still requires host preflight", "author-frozen rubric requires later independent challenge"]};
  await save("freeze.json", JSON.stringify(freeze, null, 2) + "\n");
  return {output: dest, phaseFiles: [freeze.prepare.length, freeze.review.length], modelsLaunched: 0};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(await stagePilot(process.argv[2]), null, 2));
