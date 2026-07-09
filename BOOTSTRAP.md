# Vydykhai Agent Bootstrap

This file is for the coding agent, not the human. When a user asks to connect Vydykhai to the current project, own the technical setup end to end.

The bootstrap request authorizes creation of a setup branch, framework install/update, validation, a setup commit or PR, Project State, and a dedicated Framework Orchestrator. It does not authorize merge, destructive overwrite, paid actions, production changes, or disclosure of private data.

## Preconditions

1. Confirm the current task is attached to the target product repository. If the target is ambiguous, ask one short question and nothing else.
2. Inspect existing `AGENTS.md`, repository instructions, git state, remotes, and privacy constraints. Preserve unrelated and uncommitted work.
3. Use available shell, network, GitHub, and thread tools yourself. Ask the human only for missing access, trust, or a decision; do not ask them to type setup commands.
4. Never treat the standalone Vydykhai repository as the target product repository.

## Install

1. Fetch the canonical repository into a temporary directory or reuse a verified local canonical checkout.
2. Read `vydykhai.json` and this file from the same revision.
3. Create a setup branch when repository policy allows it.
4. Run the canonical installer against the target repository, then run `node scripts/vydykhai.mjs doctor` from the target.
5. Do not use `--force` when managed files were changed locally. Reconcile them explicitly or request approval.
6. Review the complete diff. Keep project rules outside the managed `AGENTS.md` block and reject secrets, transcripts, customer data, private links, or product internals in universal files.
7. Commit and open a setup PR when GitHub access exists. Follow the target repository's merge policy; do not merge merely because bootstrap was requested.

## Resolve The Agent Profile

The default policy is `latest available flagship / xhigh`.

1. Resolve the strongest broadly capable coding and agentic model available in the current harness and account. Use the harness model catalog or current official model guidance; do not choose by version number alone.
2. Use Extra High / `xhigh` reasoning. Do not silently substitute Max, Ultra, a faster model, or a cheaper model.
3. If model discovery is unavailable, use the harness's current recommended flagship and mark verification pending.
4. If no available flagship supports `xhigh`, use its highest supported reasoning effort and record the fallback; do not automatically jump to Max or Ultra.
5. Record policy, resolved model id, reasoning effort, check date/source, and any fallback in Project State.
6. Re-resolve at framework update, new or rotated orchestrator, model rejection/deprecation, and active-project Health Review at least every seven days.
7. Pass the resolved profile explicitly to new and resumed agent contexts when tools support it. Any fallback must be visible to the human and durable state.

An explicit human decision may choose a lower-cost or faster profile for a named scope. Universal framework files never pin a model id.

For Codex, prefer a project-scoped reasoning default of `xhigh` while leaving the model unpinned, so Codex can move to a newer recommended model. Merge this into an existing trusted `.codex/config.toml` without disturbing unrelated settings. Do not override centrally managed policy or an explicit human scope override.

## Activate

1. Apply `$project-launch` from the installed target repository.
2. Create or update the compact Project Operating Brief and Project State.
3. Register participants, active orchestrator links, framework versions, resolved agent profiles, current tasks, and safe continuation.
4. Create the dedicated organization-only Framework Orchestrator when thread tools exist. Verify its actual title and that it can reconstruct compass, DOD, tasks, blockers, and next-best-action.
5. If the harness cannot create resumable contexts, create the closest supported handle and explain the limitation once.
6. Tell other participants to pull the accepted setup change. Their orchestrators confirm activation with `doctor` when they next resume.

## Return

Report only:

- installed version and `doctor` result;
- setup branch/PR or the exact access blocker;
- Project State and orchestrator link/status;
- resolved agent profile and last-check date;
- one next human action, if any.
