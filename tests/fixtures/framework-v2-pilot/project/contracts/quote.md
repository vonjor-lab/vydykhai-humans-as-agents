# Quote Release 2

Public operations: `getQuote({projectId, quoteId, revision})` returns an immutable
approved record; `priceQuote(record)` returns totals grouped by currency using
the accepted pricing policy. Missing records return NOT_FOUND, not a fabricated
empty quotation. Revision is mandatory. Numeric totals are integer minor units.
Currency totals cannot be combined without a separately approved conversion rule.
Records from two projects can share a quoteId. No mutation operation is exposed.
Consumers pin this release; internal pricing implementation is not needed for use.
