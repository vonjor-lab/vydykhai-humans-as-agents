import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, writeFile, readFile, rm, realpath} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {runControlChild} from "../scripts/control-child.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const xml = s => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
async function ctl(args) {
  const r = await runControlChild({executable: "/bin/launchctl", args, cwd: "/",
    env: {PATH: "/usr/bin:/bin"}, input: "", timeoutMs: 5000, maxBytes: 32768});
  assert.equal(r.state, "CLOSED"); assert.equal(r.reason, null);
  return r;
}
async function until(check) {
  for (let i = 0; i < 100; i++) {if (await check()) return; await sleep(50);}
  assert.fail("Disposable launchd probe did not reach its checkpoint");
}
async function exists(file) {
  try {await readFile(file); return true;} catch (e) {if (e.code === "ENOENT") return false; throw e;}
}

// Force the pre-entry failure window. No framework service, model, credentials,
// product state, retry policy or observer lease is modified by this OS probe.
test("launchd kickstart does not queue a replacement for a still-exiting RunAtLoad child", {
  skip: process.platform !== "darwin", timeout: 20000
}, async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "launchd-window-")));
  const domain = `gui/${process.getuid()}`;
  const program = path.join(root, "probe.mjs");
  await writeFile(program, `import fs from 'node:fs';
const root = process.argv[2];
if (fs.existsSync(root + '/held')) {
  fs.writeFileSync(root + '/rejected', 'pre-entry lease held');
  const timer = setInterval(() => {
    if (fs.existsSync(root + '/exit')) {clearInterval(timer); process.exitCode = 75;}
  }, 10);
} else fs.writeFileSync(root + '/observed', 'one entry');
`);
  try {
    for (const atLoad of [true, false]) {
      const label = `com.vydykhai.test.${randomUUID()}`, target = `${domain}/${label}`;
      const plist = path.join(root, `${label}.plist`);
      for (const name of ["rejected", "observed", "exit"]) await rm(path.join(root, name), {force: true});
      await writeFile(path.join(root, "held"), "registration lease");
      await writeFile(plist, `<?xml version="1.0"?><plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${[process.execPath, program, root].map(x => `<string>${xml(x)}</string>`).join("")}</array>
<key>RunAtLoad</key><${atLoad ? "true" : "false"}/>
<key>StartInterval</key><integer>3600</integer>
</dict></plist>`, {mode: 0o600});
      let registered = false;
      try {
        assert.equal((await ctl(["bootstrap", domain, plist])).code, 0); registered = true;
        if (atLoad) await until(() => exists(path.join(root, "rejected")));
        await rm(path.join(root, "held"));
        assert.equal((await ctl(["kickstart", target])).code, 0);
        if (atLoad) {
          await writeFile(path.join(root, "exit"), "allow pre-entry failure to exit");
          await until(async () => !/^\s*pid = \d+/m.test((await ctl(["print", target])).output));
          assert.equal(await exists(path.join(root, "observed")), false,
            "kickstart success is not evidence that an exiting child will be replaced");
        } else {
          await until(() => exists(path.join(root, "observed")));
          assert.equal(await exists(path.join(root, "rejected")), false);
        }
      } finally {if (registered) assert.equal((await ctl(["bootout", target])).code, 0);}
    }
  } finally {await rm(root, {recursive: true, force: true});}
});
