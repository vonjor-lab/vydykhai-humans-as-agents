// Extract the unchanged stageCycle input expressions with Node's module parser.
// Every effectful dependency is inert; stop before runtime staging or f.prepare.
import { SourceTextModule, SyntheticModule, createContext } from "node:vm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = process.argv[2], captured = {}, stop = Error("INPUTS_CAPTURED");
const need = (v, code) => { if (!v) throw Error(code); };
const unexpected = () => { throw Error("COMPARISON_CAPTURE_UNEXPECTED_EFFECT"); };
const file = path.join(root, "scripts/qualify-control-cycle.mjs"), source = await readFile(file, "utf8");
const context = createContext({ URL, process: Object.freeze({ argv: Object.freeze([]) }) }, { codeGeneration: { strings: false, wasm: false } });
let actionBody = null, prepared = false;
const dependencies = {
  "node:fs/promises": { mkdir: async () => {}, realpath: async p => p, writeFile: unexpected,
    readFile: async url => { need(fileURLToPath(url) === path.join(root, "NOTICE.md"), "COMPARISON_CAPTURE_READ_ESCAPE"); return readFile(url, "utf8"); } },
  "node:path": { default: path }, "node:url": { fileURLToPath, pathToFileURL },
  "../tests/context-fixture.mjs": { fixture: async (_t, options) => {
    need(options.correction === true && typeof options.actionBody === "string", "COMPARISON_CAPTURE_FIXTURE_DRIFT");
    actionBody = options.actionBody;
    return { put: async (name, value) => { need(!Object.hasOwn(captured, name), "COMPARISON_CAPTURE_DUPLICATE"); captured[name] = value; },
      prepare: () => { prepared = true; unexpected(); } };
  } },
  "./memory-brief.mjs": { canonicalJson: unexpected, sha256: unexpected },
  "./control-runtime.mjs": { inspectControlRuntime: () => { throw stop; }, stageControlRuntime: unexpected, loadControlRuntime: unexpected },
  "./control-review-sources.mjs": { openReviewSources: unexpected }
};
const module = new SourceTextModule(source, { context, identifier: pathToFileURL(file).href,
  initializeImportMeta: meta => { meta.url = pathToFileURL(file).href; }, importModuleDynamically: unexpected });
await module.link(specifier => {
  need(Object.hasOwn(dependencies, specifier), "COMPARISON_CAPTURE_IMPORT_DRIFT");
  const exports = dependencies[specifier];
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await module.evaluate({ timeout: 1000 });
try { await module.namespace.stageCycle({ output: "/capture", binary: "/disabled", authHome: "/disabled" }); unexpected(); }
catch (error) { if (error !== stop) throw error; }
need(!prepared && actionBody && Object.keys(captured).sort().join() ===
  ["scope.md", "goal.md", "contract.md", "decisions.md", "success.md", "ideas.md", "map.md", "consumer-input.json"].sort().join(), "COMPARISON_CAPTURE_INCOMPLETE");
const continuation = "import {readFileSync,writeFileSync} from 'node:fs'; const v=JSON.parse(readFileSync('consumer-output.json','utf8')); if(v.count!==2)throw Error('BAD_INPUT'); writeFileSync('continued.json',JSON.stringify({used:v.entries.map(x=>x.id)}),{flag:'wx'});\n";
need(source.includes(`await put("continuation.mjs",${JSON.stringify(continuation)});`), "COMPARISON_CONTINUATION_SOURCE_DRIFT");
console.log(JSON.stringify({ captured, actionBody, continuation, oracle: module.namespace.cycleOracle,
  source: file, preparationExecuted: false, runtimeStaged: false, modelsLaunched: 0 }));
