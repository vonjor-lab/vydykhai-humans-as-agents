// Explicit macOS qualification adapter. Unsupported hosts must not silently run
// an unisolated command. This does not intercept native tools outside this route.
import {realpath, lstat, access} from "node:fs/promises";
import {constants, lstatSync, realpathSync} from "node:fs";
import {execFile} from "node:child_process";
import {promisify} from "node:util";
import path from "node:path";

const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
const execute = promisify(execFile);
const launches = new WeakMap();
export const readSandboxLaunch = launch => {
  const saved=launches.get(launch);
  return saved && JSON.stringify(launch)===saved.launchJson ? structuredClone(saved) : null;
};
async function gitDirectories(cwd) {
  try {
    const {stdout} = await execute("git", ["-c", "core.fsmonitor=false", "rev-parse",
      "--absolute-git-dir", "--path-format=absolute", "--git-common-dir"], {cwd, timeout:2000, maxBuffer:16384,
      env:{PATH:process.env.PATH, LC_ALL:"C", GIT_OPTIONAL_LOCKS:"0", GIT_NO_LAZY_FETCH:"1",
        GIT_CONFIG_NOSYSTEM:"1", GIT_CONFIG_GLOBAL:"/dev/null"}});
    const directories = stdout.trimEnd().split("\n");
    if (directories.length !== 2 || !directories.every(path.isAbsolute)) throw Error();
    return await Promise.all(directories.map(directory => realpath(directory)));
  } catch(error) {
    if (error.code === 128 && error.stderr?.trim() ===
      "fatal: not a git repository (or any of the parent directories): .git") return [];
    throw Error("CONTROL_SANDBOX_WRITE_FILE_INVALID");
  }
}
export async function localControlSandbox({workspace, controlRoot, readOnly = false, writeFiles}) {
  const exact = writeFiles !== undefined;
  if (typeof readOnly !== "boolean" || exact &&
      (readOnly || !Array.isArray(writeFiles) || writeFiles.length !== 1 || !Object.hasOwn(writeFiles,0)))
    throw Error("CONTROL_SANDBOX_MODE_INVALID");
  if (process.platform !== "darwin") throw Error("CONTROL_SANDBOX_UNSUPPORTED");
  const root = await realpath(workspace), protectedRoot = await realpath(controlRoot);
  if (root !== path.resolve(workspace) || protectedRoot !== path.resolve(controlRoot) ||
      inside(root, protectedRoot) || inside(protectedRoot, root) || !(await lstat(root)).isDirectory() ||
      !(await lstat(protectedRoot)).isDirectory()) throw Error("CONTROL_SANDBOX_BOUNDARY_INVALID");
  await access("/usr/bin/sandbox-exec", constants.X_OK);
  let writable, identity;
  if (exact) {
    const relative = writeFiles[0];
    if (typeof relative !== "string" || !relative || /[\\\x00-\x1f\x7f]/.test(relative) || path.isAbsolute(relative) ||
        relative.split("/").some(part => !part || part === "." || part === ".." || part.toLowerCase() === ".git"))
      throw Error("CONTROL_SANDBOX_WRITE_FILE_INVALID");
    writable = path.resolve(root,relative);
    try {
      identity = await lstat(writable);
      if (!inside(root,writable) || !identity.isFile() || identity.nlink !== 1 || await realpath(writable) !== writable)
        throw Error();
      for (const cwd of new Set([root,path.dirname(writable)]))
        if ((await gitDirectories(cwd)).some(directory => inside(directory,writable))) throw Error();
    } catch {throw Error("CONTROL_SANDBOX_WRITE_FILE_INVALID");}
  }
  // Only JSON-compatible path quoting is admitted into the policy language.
  const quote = value => {
    if (/[\x00-\x1f\x7f]/.test(value)) throw Error("CONTROL_SANDBOX_PATH_INVALID");
    return JSON.stringify(value);
  };
  const policy = `(version 1)
(allow default)
(deny network*)
(deny signal)
${readOnly || exact ? "(deny process-fork)" : ""}
(deny file-write*)
${exact ? `(allow file-write-data (literal ${quote(writable)}))` : readOnly ? "" : `(allow file-write* (subpath ${quote(root)}))`}
(deny file-read*)
(allow file-read-metadata)
(allow file-read* (literal "/") (subpath ${quote(root)}) (subpath "/System") (subpath "/usr")
 (subpath "/bin") (subpath "/sbin") (subpath "/Library") (subpath "/private/etc")
 (literal "/dev/null") (literal "/dev/urandom") (literal "/dev/random"))
(deny file-read* (subpath ${quote(protectedRoot)}))
(deny file-write* (subpath ${quote(protectedRoot)}))`;
  return spec => {
    if (!inside(root, spec.cwd) || !path.isAbsolute(spec.executable) || !Array.isArray(spec.args))
      throw Error("CONTROL_SANDBOX_DISPATCH_INVALID");
    // Preserve the synchronous launcher contract; reject replacement or aliases
    // introduced since policy construction. This is not an external-writer lock.
    if (exact) {
      try {
        const current = lstatSync(writable);
        if (!current.isFile() || current.nlink !== 1 || realpathSync(writable) !== writable ||
            current.dev !== identity.dev || current.ino !== identity.ino) throw Error();
      } catch {throw Error("CONTROL_SANDBOX_WRITE_FILE_INVALID");}
    }
    const launch = {executable: "/usr/bin/sandbox-exec", args: ["-p", policy, spec.executable, ...spec.args]};
    if(exact)launches.set(launch,{workspace:root,writeFiles:[path.relative(root,writable)],policy,
      command:{executable:spec.executable,args:[...spec.args],cwd:spec.cwd},launchJson:JSON.stringify(launch)});
    return launch;
  };
}
