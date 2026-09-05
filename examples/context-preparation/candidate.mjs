export function buildBundle(input) {
  const entries = input.map(entry => ({ id: entry.id, label: entry.label.trim() }));
  const seen = new Set();
  for (const entry of entries) {
    const key = entry.id;
    if (seen.has(key)) throw new Error("DUPLICATE_ID");
    seen.add(key);
  }
  entries.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { schema: "bundle/v1", entries, count: entries.length };
}
