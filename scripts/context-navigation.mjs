// Structural checks cannot establish semantic completeness or grant authority.
import { createHash } from "node:crypto";

const object = v => v !== null && typeof v === "object" && !Array.isArray(v);
const keys = (v, expected) => object(v) && Object.keys(v).sort().join() === [...expected].sort().join();
const text = v => typeof v === "string" && v.trim().length > 0;
const list = v => Array.isArray(v) && v.length <= 256;
const need = (v, code) => { if (!v) throw new Error(code); };

export async function prepareNavigation(navigation, task, read, requiredContracts) {
  need(keys(navigation, ["taskId", "worker", "preparedBy", "outcome", "references", "constraints", "gaps"]) &&
    navigation.taskId === task.id && navigation.worker === task.worker &&
    text(navigation.preparedBy) && navigation.preparedBy !== task.worker && text(navigation.outcome), "NAVIGATION_IDENTITY_INVALID");
  need(list(navigation.references) && navigation.references.length > 0 && list(navigation.constraints) &&
    list(navigation.gaps), "NAVIGATION_SCHEMA_INVALID");
  need(list(requiredContracts) && requiredContracts.length > 0 && requiredContracts.every(text), "NAVIGATION_CONTRACT_ROUTE_MISSING");
  need(requiredContracts.every(p => navigation.references.some(r => r.path === p && r.appliesTo === "task")), "NAVIGATION_CONTRACT_UNREAD");
  const ids = new Set(), references = [];
  for (const r of navigation.references) {
    need(keys(r, ["id", "path", "startLine", "endLine", "quote", "purpose", "appliesTo"]) && text(r.id) && !ids.has(r.id) &&
      text(r.path) && text(r.quote) && text(r.purpose) && ["task", "preparation"].includes(r.appliesTo), "NAVIGATION_REFERENCE_INVALID");
    const bytes = await read(r.path);
    const lines = bytes.toString("utf8").split(/\r?\n/);
    if (lines.at(-1) === "") lines.pop();
    need(Number.isSafeInteger(r.startLine) && Number.isSafeInteger(r.endLine) &&
      r.startLine >= 1 && r.endLine >= r.startLine && r.endLine <= lines.length, "NAVIGATION_LINE_RANGE_INVALID");
    need(lines.slice(r.startLine - 1, r.endLine).join("\n").includes(r.quote), "NAVIGATION_QUOTE_MISMATCH");
    ids.add(r.id);
    references.push({ ...r, sha256: createHash("sha256").update(bytes).digest("hex") });
  }
  const constraints = [];
  for (const c of navigation.constraints) {
    need(keys(c, ["text", "appliesTo", "referenceIds"]) && text(c.text) &&
      ["task", "preparation"].includes(c.appliesTo) && list(c.referenceIds) && c.referenceIds.length > 0 &&
      c.referenceIds.every(id => ids.has(id)), "NAVIGATION_CONSTRAINT_INVALID");
    if (c.appliesTo === "task") {
      need(c.referenceIds.every(id => references.find(r => r.id === id).appliesTo === "task"), "NAVIGATION_ROLE_CONFLICT");
      constraints.push(c);
    }
  }
  for (const gap of navigation.gaps) {
    need(keys(gap, ["text", "critical"]) && text(gap.text) && typeof gap.critical === "boolean", "NAVIGATION_GAP_INVALID");
    need(!gap.critical, "NAVIGATION_CRITICAL_GAP");
  }
  return { schema: "context.navigation.v1", taskId: task.id, worker: task.worker,
    outcome: navigation.outcome, references: references.filter(r => r.appliesTo === "task"), constraints, gaps: navigation.gaps };
}
