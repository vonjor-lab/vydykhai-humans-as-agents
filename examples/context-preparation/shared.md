# Bundle module

<!-- bundle:start -->
Accepted boundary: buildBundle emits bundle/v1, normalized labels, identifier order,
entries and count. The unfinished workspace does not revoke this acceptance.
Duplicate identifiers must fail with DUPLICATE_ID even when labels differ.
The next revision must compare identifiers without case sensitivity while keeping
their original spelling. This correction is integrated as a requirement; the
Candidate still needs implementation and verification against B1, B2 and N1.
CSV remains deferred. When bundle/export returns to scope, ask module-owner for
an explicit decision; do not implement or silently close the deferred obligation.
<!-- bundle:end -->

<!-- unrelated:start -->
Unrelated module has no bearing on this task.
<!-- unrelated:end -->
