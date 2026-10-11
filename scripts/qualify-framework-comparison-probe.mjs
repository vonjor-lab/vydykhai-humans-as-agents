// Child-only zero-inference transport. Arm code resolves only inside its frozen tree.
import { registerHooks } from "node:module";
import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installFixedComparisonCommands } from "./qualify-framework-comparison-command.mjs";
import { localControlSandbox } from "./local-control-sandbox.mjs";

const need = (value, code) => { if (!value) throw Error(code); };
const [root, arm] = process.argv.slice(2), loaded = new Set();
need(root && ["baseline", "candidate"].includes(arm) && realpathSync(root) === root, "COMPARISON_PROBE_ARGUMENTS");
const parts = []; for await (const chunk of process.stdin) { parts.push(chunk); need(parts.reduce((n, b) => n + b.length, 0) <= 1024 * 1024, "COMPARISON_REQUEST_TOO_LARGE"); }
const request = JSON.parse(Buffer.concat(parts).toString()), commands = [];
need(process.permission && process.permission.has("child") === Boolean(request.fixed) && !process.permission.has("worker"), "COMPARISON_PROBE_PERMISSION_REQUIRED");
if (request.supervision) {
  need(arm === "baseline" && request.fixed, "COMPARISON_NATIVE_BASELINE_ONLY");
  const wrap = await localControlSandbox({ workspace: process.cwd(), controlRoot: request.supervision.controlRoot });
  installFixedComparisonCommands(request.fixed, commands, { ...request.supervision, wrap, scope: "PINNED_CALLER_RECIPE_NOT_SEMANTIC_PROOF" });
} else if (request.fixed) installFixedComparisonCommands(request.fixed, commands);
const prohibited = new Set(["http", "https", "http2", "net", "tls", "dgram", "dns", "dns/promises"]);
globalThis.fetch = () => { throw Error("COMPARISON_NETWORK_DISABLED"); };
registerHooks({ resolve(specifier, context, next) {
  const result = next(specifier, context);
  if (result.url.startsWith("node:")) {
    need(!prohibited.has(result.url.slice(5)), "COMPARISON_NETWORK_DISABLED");
  } else {
    need(result.url.startsWith("file:"), "COMPARISON_IMPORT_ESCAPE");
    const file = fileURLToPath(result.url);
    need(file.startsWith(root + path.sep) && realpathSync(file) === file, "COMPARISON_IMPORT_ESCAPE");
    loaded.add(path.relative(root, file));
  }
  return result;
} });
const load = name => import(pathToFileURL(path.join(root, "scripts", name)).href);
const prepare = await load("context-prepare.mjs"), context = await load("context-run.mjs"), returns = await load("vydykhai.mjs");
const read = async name => {
  need(typeof name === "string" && name && !path.isAbsolute(name) && !name.includes("\\") &&
    !name.split("/").some(p => !p || p === "." || p === ".."), "COMPARISON_INPUT_PATH_INVALID");
  const absolute = path.resolve(name);
  need(realpathSync(absolute) === absolute, "COMPARISON_INPUT_PATH_INVALID");
  return readFile(absolute, "utf8");
};
let result;
if (request.operation === "capabilities") {
  const APIs = { prepareContext: typeof prepare.prepareContext, runContextTransition: typeof context.runContextTransition,
    createReturnSync: typeof returns.createReturnSync, createReturnRoute: typeof returns.createReturnRoute,
    validateDurableOutbox: typeof returns.validateDurableOutbox };
  if (arm === "candidate") {
    APIs.openControlHost = typeof (await load("control-host.mjs")).openControlHost;
    APIs.openControlService = typeof (await load("control-service.mjs")).openControlService;
    APIs.runControlledWorker = typeof (await load("control-worker-run.mjs")).runControlledWorker;
  }
  need(Object.values(APIs).every(value => value === "function"), "COMPARISON_API_MISSING");
  const unprepared = await context.runContextTransition({});
  need(unprepared.status !== "VERIFIED" && unprepared.status !== "READY" && unprepared.stats?.commands === 0, "COMPARISON_UNPREPARED_NOT_BLOCKED");
  result = { APIs, unprepared, emptyOutbox: returns.validateDurableOutbox("") };
} else if (request.operation === "prepare") {
  need(Array.isArray(request.args) && request.args.every(s => typeof s === "string") &&
    ["plan", "confirm", "read", "ack"].includes(request.args[0]), "COMPARISON_PREPARATION_OPERATION_REFUSED");
  if (request.args[0] === "plan") {
    const index = request.args.indexOf("--input");
    need(index > 0, "COMPARISON_PACKAGE_REQUIRED");
    const pkg = JSON.parse(await read(request.args[index + 1]));
    need(pkg.schema === "context.package.v3", "COMPARISON_ACTUAL_V3_PACKAGE_REQUIRED");
  } else {
    const index = request.args.indexOf("--output");
    need(index > 0, "COMPARISON_PACKAGE_REQUIRED");
    const plan = JSON.parse(await read(`${request.args[index + 1]}/plan.json`));
    need(plan.semanticPackage?.schema === "context.package.v3", "COMPARISON_ACTUAL_V3_PACKAGE_REQUIRED");
  }
  result = await prepare.prepareContext(request.args, returns);
} else if (request.operation === "context") {
  const input = JSON.parse(await read(request.file));
  need(["preflight", "integrate", ...(request.fixed ? ["resume", "accept"] : [])].includes(input.operation), "COMPARISON_ACTION_EXECUTION_DISABLED");
  result = await context.runContextTransition(input, returns);
} else if (request.operation === "outbox") {
  const content = await read(request.file);
  result = { source: request.file, parsed: returns.validateDurableOutbox(content) };
} else if (request.operation === "route") {
  result = { route: returns.createReturnRoute(JSON.parse(await read(request.file))) };
} else throw Error("COMPARISON_OPERATION_REFUSED");
console.log(JSON.stringify({ result, loaded: [...loaded].sort(), commands,
  actionExecution: request.supervision ? "PINNED_CALLER_COMMAND_SHARED_SANDBOX" : request.fixed ? "FROZEN_SYNTHETIC_COMMANDS_ONLY" : "DISABLED", modelDispatch: "ABSENT" }));
