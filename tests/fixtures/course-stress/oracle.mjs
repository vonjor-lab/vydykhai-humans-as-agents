import {readFile, writeFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {pathToFileURL} from "node:url";
import path from "node:path";

// Maintainer-only: execute the submitted adapter; reopen JSON in a fresh process.
export async function verifyComposition(modulePath, directory) {
  const inputs = [
    {owner: "red", id: "same", payload: "red-data"},
    {owner: "blue", id: "same", payload: "blue-data"},
    {owner: "red:x", id: "y", payload: "tuple-a"},
    {owner: "red", id: "x:y", payload: "tuple-b"},
  ];
  const moduleUrl = pathToFileURL(modulePath).href;
  const adapter = await import(moduleUrl);
  const archive = adapter.buildArchive(inputs);
  const stored = path.join(directory, "archive.json");
  await writeFile(stored, JSON.stringify(archive), {flag: "wx"});
  const queries = inputs.map(({owner, id}) => ({owner, id}))
    .concat([{id: "same"}, {owner: "", id: "same"}, {owner: "absent", id: "same"}]);
  const program = `import {readFileSync} from "node:fs";
    const adapter=await import(process.argv[1]);
    const records=JSON.parse(readFileSync(process.argv[2],"utf8"));
    const queries=JSON.parse(process.argv[3]);
    console.log(JSON.stringify(queries.map(q=>adapter.lookup(records,q))));`;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", program,
    moduleUrl, stored, JSON.stringify(queries)], {encoding: "utf8", timeout: 5000});
  if (child.status !== 0) return {status: "FAIL", error: child.stderr, childExit: child.status};
  const actual = JSON.parse(child.stdout);
  const checks = inputs.map((record, i) => ({
    id: `identity-${i + 1}`,
    pass: actual[i]?.owner === record.owner && actual[i]?.id === record.id &&
      actual[i]?.payload === record.payload,
  })).concat(queries.slice(inputs.length).map((_, i) => ({
    id: `reject-${i + 1}`, pass: actual[inputs.length + i] === null,
  })));
  const storedAgain = JSON.parse(await readFile(stored, "utf8"));
  return {status: checks.every(c => c.pass) ? "PASS" : "FAIL",
    oldCountSmoke: Array.isArray(archive) && archive.length === inputs.length,
    checks, actual, stored: storedAgain, childExit: child.status, coldProcess: true};
}
