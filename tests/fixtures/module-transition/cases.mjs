// Raw, sanitized inputs. Expected results are frozen from the retained implementation.
export function producer(id, status = "ACCEPT") {
  return `<!-- vydykhai:return-sync v1 -->
# Return Sync
Status: ${status}
Return receipt id: ${id}
Return lifecycle: WRITTEN
Task / context / PR / commit / artifact: synthetic-task / worker / retained-artifact
Memory candidates: NO_MEMORY_DELTA
Artifact disposition: retained for review
Recommended orchestrator next action: review retained result
<!-- vydykhai:return-sync:end -->`;
}

export function route(id) {
  return `<!-- vydykhai:return-route v1 -->
# Return Route
Return receipt id: ${id}
Return lifecycle: RECEIVED -> CONSUMED -> ROUTED
Consumer: synthetic-owner
Routed next action: review next boundary
Evidence: synthetic-check
<!-- vydykhai:return-route:end -->`;
}

export function rawCases(prefix = "CASE") {
  const a = `${prefix}-A`, b = `${prefix}-B`, p = producer(a), r = route(a);
  return [
    { id: "ordinary-prose", text: "# Return Sync\nNothing has been sent or accepted.", pending: [], routed: [] },
    { id: "written-pending", text: p, pending: [a], routed: [] },
    { id: "paired", text: `${p}\n${r}`, pending: [], routed: [a] },
    { id: "older-pending", text: `${producer(b)}\n${p}\n${r}`, pending: [b], routed: [a] },
    { id: "reverse-order", text: `${r}\n${p}\n${producer(b)}`, pending: [b], routed: [a] },
    { id: "duplicate-return", text: `${p}\n${p}\n${r}`, pending: [a], routed: [] },
    { id: "duplicate-route", text: `${p}\n${r}\n${r}`, pending: [a], routed: [] },
    { id: "missing-field", text: `${p.replace("Memory candidates: NO_MEMORY_DELTA", "Memory candidates:")}\n${r}`, pending: [a], routed: [] },
    { id: "missing-route-evidence", text: `${p}\n${r.replace("Evidence: synthetic-check", "Evidence: <missing>")}`, pending: [a], routed: [] },
    { id: "partial-route", text: `${p}\n${r.replace("RECEIVED -> CONSUMED -> ROUTED", "RECEIVED -> CONSUMED")}`, pending: [a], routed: [] },
    { id: "orphan-route", text: r, pending: [], routed: [] },
    { id: "legacy-aliases", text: `${producer(a, "NEEDS_FIXES / RETAINED")}\n${r.replace("Consumer:", "Consumer / route:").replace("Evidence:", "Accepted evidence:")}`, pending: [], routed: [a] },
    { id: "mixed-alias", text: `${p}\n${r.replace("Consumer: synthetic-owner", "Consumer: synthetic-owner\nConsumer / route: another")}`, pending: [a], routed: [] },
    { id: "crlf", text: `${p}\n${r}`.replaceAll("\n", "\r\n"), pending: [], routed: [a] },
    { id: "incomplete-framing", text: `${p}\n${r.replace("<!-- vydykhai:return-route:end -->", "")}`, pending: [a], routed: [] },
    { id: "unmarked", text: `${p}\n${r}\nReturn receipt id: UNMARKED`, pending: [], routed: [a] },
  ];
}
