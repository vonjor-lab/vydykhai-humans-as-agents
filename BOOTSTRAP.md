# Vydykhai Agent Bootstrap

This file is for the coding agent, not the human. When a user asks to connect Vydykhai to the current project, own the technical setup end to end.

The bootstrap request authorizes creation of a setup branch, framework install/update, validation, a setup commit or PR, Project State, and a dedicated Framework Orchestrator. When the user explicitly starts a project with no repository, it also authorizes preparation of a private Git-backed operating repo after owner/host confirmation. It does not authorize merge, public visibility, destructive overwrite, paid actions, production changes, or disclosure of private data.

## Preconditions

1. Confirm the target project repository. If none exists, ask only for unresolved host, owner, or visibility, then create or prepare a private Git-backed operating repo when tools allow. If the target is otherwise ambiguous, ask one short question and nothing else.
2. Inspect existing `AGENTS.md`, repository instructions, git state, remotes, and privacy constraints. Preserve unrelated and uncommitted work.
3. Use available shell, network, repository host, tracker, and context tools yourself. Ask the human only for missing access, trust, or a decision; do not ask them to type setup commands.
4. Never treat the standalone Vydykhai repository as the target product repository.
5. Inspect how the current agent environment loads project instructions and skills, creates or resumes contexts, accesses durable shared state, returns events between contexts, and runs verification.
6. Identify the durable tracker, coordination-input sources, and protected operational sources. GitHub with Issues and PRs is the default; meeting inputs may come from Fathom, Read AI, tl;dv, another recorder, team chat, docs, or manual notes. Keep secret values in the project's secret system and record only least-privilege references to environments, owners, private runbooks, and backup/restore routes.

## Install

1. Fetch the canonical repository into a temporary directory or reuse a verified local canonical checkout.
2. Read `vydykhai.json` and this file from the same revision.
3. Create a setup branch when repository policy allows it.
4. Run the canonical installer against the target repository, then run `node scripts/vydykhai.mjs doctor` from the target.
5. Do not use `--force` when managed files were changed locally. Reconcile them explicitly or request approval.
6. Preserve the managed `docs/VYDYKHAI_NOTICE.md`, creator/license metadata, and required notice. They cover the imported framework kit, not the target project's own code, license, or content.
7. If the environment does not read `AGENTS.md` or `.agents/skills` natively, create one thin project-local adapter in its supported instruction format. Point it to the canonical files; do not copy their rules.
8. Review the complete diff. Keep project rules outside the managed `AGENTS.md` block and reject secrets, transcripts, customer data, private links, or product internals in universal files.
9. Commit and open a setup change or PR when repository-host access exists. Follow the target repository's merge policy; do not merge merely because bootstrap was requested.

## Resolve The Agent Profile

The default policy is `latest available flagship / deepest bounded reasoning`.

1. Resolve the strongest broadly capable coding and agentic model available in the current agent environment and account. Use its model catalog or current official model guidance; do not choose by version number alone.
2. Use the deepest stable reasoning mode that fits the agreed burn boundary. Map this to Extra High / `xhigh` when that label exists. Do not silently substitute Max, Ultra, an unbounded tier, a faster model, or a cheaper model.
3. If model discovery is unavailable, use the agent environment's current recommended flagship and mark verification pending.
4. If the preferred bounded mode is unavailable, use the closest supported mode and record the fallback; do not automatically jump to Max or Ultra.
5. Record policy, resolved model id, reasoning effort, check date/source, and any fallback in Project State.
6. Re-resolve at framework update, new or rotated orchestrator, model rejection/deprecation, and active-project Health Review at least every seven days.
7. Pass the resolved profile explicitly to new and resumed agent contexts when tools support it. Any fallback must be visible to the human and durable state.

An explicit human decision may choose a lower-cost or faster profile for a named scope. Universal framework files never pin a model id or require a vendor-specific configuration file.

## Activate

1. Apply `$project-launch` from the installed target repository.
2. Create or update the compact Project Operating Brief, Project State, Shared Sync Contract, and pointers for Idea Memory, the Intent Trail decision map, and safe operational sources: Git-backed repo, durable tracker, coordination-input route, privacy boundary, and access coverage.
3. Register participants, active orchestrator links, framework versions, resolved agent profiles, current tasks, sync readiness, and safe continuation.
4. Test each active participant's human access and their orchestrator's required read/write access to the repo/tracker plus read access to relevant meeting and operational instructions. Use individual least-privilege authentication, never shared credentials or copied secret values. Record missing coverage as `SYNC_LIMITED` and do not claim complete alignment for affected work.
5. Create the dedicated organization-only Framework Orchestrator context. Verify its actual title or stable handle, pin/foreground it when the environment supports that control, and confirm it can reconstruct compass, DOD, tasks, blockers, and next-best-action.
6. Configure task Return Sync in this order: native cross-context message, shared-tracker event/hook, then one fallback monitor. Record and test the mapping in Project State; do not make the human poll tasks.
7. If the environment cannot create resumable contexts, use the closest tracker-linked handle and explain the limitation once.
8. Tell other participants to pull the accepted setup change. Their orchestrators confirm `doctor` and Shared Sync access when they next resume.

## Return

Report only:

- installed version and `doctor` result;
- creator, license, and attribution integrity;
- environment adapter and context mapping;
- Shared Sync Contract, coordination-input route, safe operational source pointers, and access status;
- task Return Sync mapping;
- setup change/PR or the exact access blocker;
- Project State and orchestrator link/status;
- resolved agent profile and last-check date;
- one next human action, if any.
