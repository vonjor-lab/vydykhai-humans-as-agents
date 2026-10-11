// Append-only CAS snapshots for the local control host, not product memory.
// Publication uses an exclusive hard link; interrupted unpublished temp files
// cannot become a state revision. No crashed lock is stolen on restart.
import {realpath, lstat, readdir, readFile, open, link, unlink} from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {canonicalJson, sha256} from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const name = revision => `${String(revision).padStart(10, "0")}.json`;
const MAX_BYTES = 8 * 1024 * 1024;

export async function openControlStore(directory) {
  const root = await realpath(directory), info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink() || root !== path.resolve(directory) || (info.mode & 0o077))
    throw Error("CONTROL_STORAGE_NOT_PRIVATE");
  const read = async () => {
    const names = (await readdir(root)).filter(n => /^\d{10}\.json$/.test(n)).sort();
    if (!names.length) return null;
    let last = null;
    for (let i = 0; i < names.length; i++) {
      if (names[i] !== name(i)) throw Error("CONTROL_HISTORY_GAP");
      const file = path.join(root, names[i]), stat = await lstat(file);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw Error("CONTROL_REVISION_INVALID");
      const bytes = await readFile(file);
      if (bytes.length > MAX_BYTES) throw Error("CONTROL_REVISION_INVALID");
      const row = JSON.parse(bytes);
      if (row.revision !== i || row.parent !== (last?.digest ?? null) || row.digest !== hash({revision: i, parent: row.parent, state: row.state}))
        throw Error("CONTROL_HISTORY_INVALID");
      last = row;
    }
    return last;
  };
  const publish = async (previous, state) => {
    const revision = previous ? previous.revision + 1 : 0;
    if (revision > 9999999999) throw Error("CONTROL_REVISION_CAPACITY");
    const row = {revision, parent: previous?.digest ?? null, state};
    row.digest = hash(row);
    const body = canonicalJson(row) + "\n";
    if (Buffer.byteLength(body) > MAX_BYTES) throw Error("CONTROL_STATE_CAPACITY");
    const temp = path.join(root, `.pending-${randomUUID()}`), file = path.join(root, name(revision));
    const handle = await open(temp, "wx", 0o600);
    try { await handle.writeFile(body); await handle.sync(); } finally { await handle.close(); }
    try { await link(temp, file); }
    catch (e) { if (e.code === "EEXIST") return false; throw e; }
    finally { await unlink(temp); }
    const dir = await open(root, "r");
    try { await dir.sync(); } finally { await dir.close(); }
    return row;
  };
  return {root, read,
    async initialize(state) {
      const old = await read();
      if (old) throw Error("CONTROL_ALREADY_INITIALIZED");
      const row = await publish(null, state);
      if (!row) throw Error("CONTROL_ALREADY_INITIALIZED");
      return row;
    },
    async transact(update) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const old = await read();
        if (!old) throw Error("CONTROL_NOT_INITIALIZED");
        // Update is pure and may run again after a concurrent CAS conflict.
        const next = update(structuredClone(old.state), old.digest);
        if (hash(next) === hash(old.state)) return old;
        const saved = await publish(old, next);
        if (saved) return saved;
      }
      throw Error("CONTROL_BUSY");
    }};
}
