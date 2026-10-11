# Export Candidate

Proposed public operation: `exportQuotes({actorId, selections})`, where each
selection names projectId, quoteId and revision. Output retains these identities,
currency and release versions. No active release is accepted yet.
The module owns orchestration and output formatting, not pricing or authorization.
Integration should consume existing public releases. Errors and retry behavior
must be specified before packaging. The full public-use acceptance is still due.
