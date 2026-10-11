// One append-only spend ledger per frozen arm. No refunds, retries or lock stealing.
import { open, readFile, readdir, lstat, realpath, mkdir, rmdir } from "node:fs/promises";
import path from "node:path";
import { canonicalJson, sha256 } from "./memory-brief.mjs";

const hash = value => sha256(canonicalJson(value));
const need = (v, code) => { if (!v) throw Error(code); };
const digest = v => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const kinds = ["ROLE_DISPATCH", "POST_ACCEPT_REVIEW"];
async function directory(dir) {
  const stat = await lstat(dir);
  need(path.isAbsolute(dir) && path.resolve(dir) === dir && stat.isDirectory() && !stat.isSymbolicLink() &&
    !(stat.mode & 0o077) && await realpath(dir) === dir, "NATIVE_LEDGER_DIRECTORY_UNSAFE");
}
async function json(file) {
  const stat = await lstat(file);
  need(stat.isFile() && !stat.isSymbolicLink() && !(stat.mode & 0o077) && stat.size <= 2 * 1024 * 1024 &&
    await realpath(file) === file, "NATIVE_LEDGER_FILE_UNSAFE");
  const bytes = await readFile(file);
  need(bytes.length <= 2 * 1024 * 1024, "NATIVE_LEDGER_FILE_UNSAFE");
  return JSON.parse(bytes);
}
async function save(file, value) {
  const body = canonicalJson(value) + "\n";
  need(Buffer.byteLength(body) <= 2 * 1024 * 1024, "NATIVE_LEDGER_CAPACITY");
  const handle = await open(file, "wx", 0o600);
  try { await handle.writeFile(body); await handle.sync(); } finally { await handle.close(); }
  const dir = await open(path.dirname(file), "r");
  try { await dir.sync(); } finally { await dir.close(); }
}
function header({ expectedDigest, arm, maxCalls }) {
  need(digest(expectedDigest) && ["baseline", "candidate", "control"].includes(arm) && Number.isSafeInteger(maxCalls) &&
    maxCalls > 0 && maxCalls <= 32, "NATIVE_LEDGER_CONFIG_INVALID");
  return { schema: "qualification.arm-budget.v1", freezeDigest: expectedDigest, arm, maxCalls };
}

// Only staging creates this header. Open never recreates missing state.
export async function initializeComparisonLedger(options) {
  const value = header(options), base = path.join(options.directory, value.arm);
  await directory(options.directory); await directory(base); await directory(path.join(base, "turns"));
  need((await readdir(path.join(base, "turns"))).length === 0, "NATIVE_LEDGER_NOT_EMPTY");
  await save(path.join(base, "ledger.json"), value);
}

export async function openComparisonLedger(options) {
  const expected = header(options), budgetId = hash(expected), base = path.join(options.directory, expected.arm);
  const turns = path.join(base, "turns"), lock = path.join(base, ".dispatch-lock");
  const check = async () => {
    await directory(options.directory); await directory(base); await directory(turns);
    need(hash(await json(path.join(base, "ledger.json"))) === budgetId, "NATIVE_LEDGER_CONFIG_CHANGED");
  };
  await check();
  const readAllocation = async number => {
    need(Number.isSafeInteger(number) && number > 0 && number <= expected.maxCalls, "NATIVE_RECORD_SELECTOR_INVALID");
    const allocation = await json(path.join(turns, `allocation-${number}.json`));
    need(allocation.budgetId === budgetId && allocation.freezeDigest === expected.freezeDigest &&
      allocation.arm === expected.arm && allocation.maxCalls === expected.maxCalls && allocation.number === number &&
      allocation.allocationId === `${expected.arm}-${number}` && kinds.includes(allocation.kind) &&
      allocation.calls === 1 && allocation.status === "RESERVED", "NATIVE_LEDGER_ALLOCATION_MISMATCH");
    return allocation;
  };
  const readReceipt = async (number, allocation) => {
    try {
      const receipt = await json(path.join(turns, `receipt-${number}.json`));
      need(receipt.allocationSha256 === hash(allocation) && receipt.budgetId === budgetId &&
        receipt.arm === expected.arm && receipt.number === number && receipt.kind === allocation.kind &&
        ["RECORDED", "FAILED", "UNRESOLVED"].includes(receipt.status), "NATIVE_LEDGER_RECEIPT_MISMATCH");
      return receipt;
    } catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const inspect = async () => {
    await check();
    const names = await readdir(turns);
    const numbers = names.filter(name => /^allocation-\d+\.json$/.test(name))
      .map(name => Number(name.match(/\d+/)[0])).sort((a, b) => a - b);
    need(numbers.length <= expected.maxCalls && numbers.every((n, i) => n === i + 1) &&
      names.filter(name => /^receipt-\d+\.json$/.test(name)).every(name => numbers.includes(Number(name.match(/\d+/)[0]))),
      "NATIVE_LEDGER_HISTORY_INVALID");
    const slots = [];
    for (const number of numbers) {
      const allocation = await readAllocation(number), receipt = await readReceipt(number, allocation);
      slots.push({ allocation, receipt });
    }
    return { budgetId, maxCalls: expected.maxCalls, used: slots.length, remaining: expected.maxCalls - slots.length,
      blocked: slots.some(slot => slot.receipt?.status !== "RECORDED"), slots };
  };
  return {
    id: budgetId, maxCalls: expected.maxCalls, inspect,
    async read(number) {
      await check();
      const allocation = await readAllocation(number);
      return { allocation, receipt: await readReceipt(number, allocation) };
    },
    async exclusive(action) {
      await check();
      await mkdir(lock, { mode: 0o700 });
      let active = true;
      const reserveMany = async (kind, count, build) => {
        need(active && kinds.includes(kind), "NATIVE_LEDGER_LEASE_INVALID");
        const state = await inspect();
        need(state.used + count <= expected.maxCalls, "NATIVE_ARM_CALL_CAP");
        need(state.slots.every(slot => slot.receipt), "NATIVE_UNRESOLVED_ALLOCATION");
        need(!state.blocked, "NATIVE_PREVIOUS_TURN_FAILED");
        const allocations = [];
        for (let index = 0; index < count; index++) {
          const number = state.used + index + 1, details = await build(number, index);
          allocations.push({ ...details, schema: "qualification.native-allocation.v1", kind,
            budgetId, freezeDigest: expected.freezeDigest, arm: expected.arm, maxCalls: expected.maxCalls,
            number, allocationId: `${expected.arm}-${number}`, calls: 1, status: "RESERVED" });
        }
        need(active, "NATIVE_LEDGER_LEASE_INVALID");
        // Capacity and builders are checked before writes. A partial durable
        // write is deliberately unresolved; it can never refund or enter review.
        for (const allocation of allocations) await save(path.join(turns, `allocation-${allocation.number}.json`), allocation);
        return allocations;
      };
      try {
        await check();
        return await action({
          async reserve(kind, build) {
            return (await reserveMany(kind, 1, build))[0];
          },
          async reserveBatch(kind, count, build) {
            need(kind === "POST_ACCEPT_REVIEW" && count === 3, "NATIVE_LEDGER_BATCH_INVALID");
            return reserveMany(kind, count, build);
          },
          async settle(allocation, result) {
            need(active && ["RECORDED", "FAILED", "UNRESOLVED"].includes(result?.status), "NATIVE_LEDGER_LEASE_INVALID");
            const stored = await readAllocation(allocation.number);
            need(hash(stored) === hash(allocation), "NATIVE_LEDGER_ALLOCATION_MISMATCH");
            const receipt = { ...result, budgetId, number: stored.number, arm: expected.arm, kind: stored.kind,
              allocationSha256: hash(stored), armCallsUsed: stored.number };
            const previous = await readReceipt(stored.number, stored);
            if (previous) {
              need(hash(previous) === hash(receipt), "NATIVE_LEDGER_SETTLEMENT_CONFLICT");
              return previous;
            }
            await save(path.join(turns, `receipt-${stored.number}.json`), receipt);
            return receipt;
          }
        });
      } finally { active = false; await rmdir(lock); }
    }
  };
}
