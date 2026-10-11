// Neutral supervisor for three frozen fixture commands. Not a general shell/tool API.
import childProcess from "node:child_process";
import { syncBuiltinESMExports, registerHooks } from "node:module";
import { readFileSync, realpathSync, lstatSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = fileURLToPath(import.meta.url), spawn = childProcess.spawn;
const need = (value, code) => { if (!value) throw Error(code); };
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const outputFor = { "action.mjs": "consumer-output.json", "verify.mjs": "verifications.log", "continuation.mjs": "continued.json" };

const pinned = (file, digest, code) => {
  const stat = lstatSync(file);
  need(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 4 * 1024 * 1024 &&
    realpathSync(file) === file && sha(readFileSync(file)) === digest, code);
};
function checkEnvironment(script, env) {
  need(Object.keys(env).every(k => ["PATH", "VYDYKHAI_REQUIRED_EXAMPLES", "VYDYKHAI_CANDIDATE_SHA256", "VYDYKHAI_ORACLE_SHA256"].includes(k)), "COMPARISON_COMMAND_ENV_REFUSED");
  if (script === "verify.mjs") need(JSON.stringify(JSON.parse(env.VYDYKHAI_REQUIRED_EXAMPLES).slice().sort()) ===
    JSON.stringify(["B1", "B2", "N1"]), "COMPARISON_COMMAND_ORACLE_SCOPE");
}

// Read-only launch planning, shared by the legacy spawn adapter and controlled C.
// recipeSha256 pins the caller's actual bytes; this function has no semantic oracle.
export function fixedComparisonLaunch(fixed, spec, { helper = here, helperSha256, env } = {}) {
  const workspace = fixed.workspace;
  need(path.isAbsolute(workspace) && realpathSync(workspace) === workspace, "COMPARISON_COMMAND_WORKSPACE");
  need(spec.executable === process.execPath && Array.isArray(spec.args) && spec.args.length === 1 &&
    Object.hasOwn(outputFor, spec.args[0]) && spec.cwd === workspace, "COMPARISON_COMMAND_NOT_DECLARED");
  for (const [name, digest] of Object.entries(fixed.files)) {
    need(!path.isAbsolute(name) && !name.includes("\\") && !name.split("/").some(p => !p || p === "." || p === ".."), "COMPARISON_COMMAND_PATH");
    pinned(path.join(workspace, name), digest, `COMPARISON_COMMAND_INPUT_DRIFT:${name}`);
  }
  pinned(path.join(workspace, "recipe.json"), fixed.recipeSha256, "COMPARISON_COMMAND_RECIPE_DRIFT");
  if (helper !== here || helperSha256 !== undefined) pinned(helper, helperSha256, "COMPARISON_COMMAND_HELPER_DRIFT");
  const script = spec.args[0], output = path.join(workspace, outputFor[script]);
  need(Object.hasOwn(fixed.files, script), "COMPARISON_COMMAND_NOT_PINNED");
  try { lstatSync(output); throw Error("COMPARISON_COMMAND_EFFECT_ALREADY_EXISTS"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }
  if (env !== undefined) checkEnvironment(script, env);
  const reads = [...Object.keys(fixed.files).map(name => path.join(workspace, name)), path.join(workspace, "recipe.json"), helper];
  if (script === "continuation.mjs") reads.push(path.join(workspace, "consumer-output.json"));
  return { executable: spec.executable, cwd: workspace, args: ["--permission",
    ...reads.map(file => `--allow-fs-read=${file}`), `--allow-fs-write=${output}`,
    helper, "--fixture-command", workspace, script] };
}

export function installFixedComparisonCommands(fixed, observations, { wrap = spec => spec, helper = here, helperSha256, scope = "SYNTHETIC_PROTOCOL_ONLY" } = {}) {
  const workspace = process.cwd();
  need(fixed.workspace === workspace && realpathSync(workspace) === workspace, "COMPARISON_COMMAND_WORKSPACE");
  childProcess.spawn = (binary, args, options) => {
    need(options.shell === false && options.detached === (process.platform !== "win32"), "COMPARISON_COMMAND_NOT_DECLARED");
    const env = options.env ?? {};
    const launch = wrap(fixedComparisonLaunch(fixed, { executable: binary, args, cwd: options.cwd }, { env, helper, helperSha256 }));
    observations.push({ script: args[0], executable: binary, args: [...args], actualArgs: launch.args, cwd: workspace,
      inputHashes: fixed.files, recipeSha256: fixed.recipeSha256, scope });
    return spawn(launch.executable, launch.args, { ...options, env });
  };
  for (const name of ["spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"])
    childProcess[name] = () => { throw Error("COMPARISON_ARBITRARY_PROCESS_REFUSED"); };
  syncBuiltinESMExports();
}

if (process.argv[1] && path.resolve(process.argv[1]) === here) {
  const [, , mode, workspace, script] = process.argv;
  need(mode === "--fixture-command" && Object.hasOwn(outputFor, script) && process.cwd() === workspace &&
    process.permission && !process.permission.has("child") && !process.permission.has("worker"), "COMPARISON_COMMAND_CHILD_UNSAFE");
  if (script === "verify.mjs") need(JSON.stringify(JSON.parse(process.env.VYDYKHAI_REQUIRED_EXAMPLES).slice().sort()) ===
    JSON.stringify(["B1", "B2", "N1"]), "COMPARISON_COMMAND_ORACLE_SCOPE");
  globalThis.fetch = () => { throw Error("COMPARISON_NETWORK_DISABLED"); };
  registerHooks({ resolve(specifier, context, next) {
    const result = next(specifier, context);
    if (result.url.startsWith("node:")) need(result.url === "node:fs", "COMPARISON_COMMAND_BUILTIN_REFUSED");
    else {
      need(result.url.startsWith("file:"), "COMPARISON_IMPORT_ESCAPE");
      const file = fileURLToPath(result.url);
      need([script, "candidate.mjs"].some(name => path.join(workspace, name) === file) && realpathSync(file) === file, "COMPARISON_IMPORT_ESCAPE");
    }
    return result;
  } });
  await import(pathToFileURL(path.join(workspace, script)).href);
}
