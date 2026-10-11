# Pricing Decision 12: Accepted

This decision supersedes Pricing Decision 4. Sum net amounts per currency first,
then round tax once per currency subtotal using the quote release. Do not round
each line's tax or reimplement pricing in an export adapter. The changed rule fixes
small-amount quotations that previously accumulated rounding error.
Acceptance must preserve an existing case with three one-minor-unit lines and a
20 percent tax: subtotal 3, tax 1, total 4. Per-line rounding would yield total 3.
The public pricing module already implements this rule; no pricing rewrite is due.
