# Bundle Module

Public entry: buildBundle(input).

Input: an array of id/label entries. Output: bundle/v1 schema, entries sorted by id, and count. Trim labels; preserve original id spelling. Duplicate identifiers fail with DUPLICATE_ID. No state, network, internal AI or private runtime configuration.

Current scoped change: compare duplicate ids case-insensitively, preserving other behavior. CSV remains deferred pending the module owner's decision in the supplied source history.

Maintainer: candidate.mjs owns the implementation. Retained examples B1/B2 and new example N1 in oracle.json are checked by verify.mjs from the public entry. The fixture Candidate intentionally lacks the new behavior; it is not a packaged release. Completing these checks does not accept the enclosing product or prove universal applicability.
