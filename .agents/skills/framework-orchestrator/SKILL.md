---
name: framework-orchestrator
description: Use when the user asks to continue a product stream, coordinate Codex work, launch or resume a task thread, process a merge/daily event, check task sequence, or keep an epic aligned across several humans and Codex instances.
---

# Framework Orchestrator

Run the repository's personal orchestration workflow for one participant and one active product stream or epic.

## Required References

Read these files before acting:

1. `AGENTS.md`
2. `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
3. `docs/codex-workflows/framework-orchestrator.md`

Then load these workflows only when the current action requires them:

- `docs/codex-workflows/project-launch.md`
- `docs/codex-workflows/start-work.md`
- `docs/codex-workflows/daily-alignment.md`
- `docs/codex-workflows/accept-work.md`
- `docs/codex-workflows/task-thread-handoff-template.md`

## Operating Contract

- Treat the orchestrator thread as the stream control room, not the implementation worker.
- Do not implement, fix product code, deploy, run acceptance smoke, or merge from the orchestrator thread.
- Restore state from durable artifacts before recommending action: GitHub issues, PRs, alignment journal, brief, task handoffs, and local repo state.
- Keep the current task sequence visible: what is active, what is blocked, what can continue, and what needs a decision.
- Use `$project-launch` when a project is being started, imported into the framework, or missing an operating brief, coordination sources, onboarding, compass, DOD, or source of truth.
- Use `$start-work` when a topic needs an epic brief, re-brief, task map, or task split.
- Use `$daily-alignment` after daily meetings, meaningful meetings, merge events, blocked events, accepted results, and follow-up splits when they affect dependent work.
- For implementation tasks, expect the task thread to run `$accept-work` before final completion; do not treat a task thread's "done" message as accepted unless the `$accept-work` result is present.
- Before dispatch, classify task type and Product Capability Loop status. Product capabilities need a closed user/operator loop; technical enablers need a linked capability or later task that closes the loop; UI/product-surface work needs backing backend/API/data/persistence/permission contracts and realistic states.
- Do not treat routes, backend/API tests, projections, readiness cards, or passive records as product capability closure unless there is a visible UI/operator entry/action or a human-approved linked exception.
- Before high-ambiguity product/design/IA/UI shell/entity-model/AI workflow work, run Compass Calibration Check: confirm target object, source of truth, non-foundation references, nearest visible result, and nearest smoke artifact before implementation continues.
- Treat the human as a project agent: when human action is needed, give a concrete addressee, link/prompt, requested output location, safe continuation status, and return-sync instruction.
- Proactively suggest Lab Mode when isolated learning reduces burn or risk; require proof, stop condition, burn cap when material, lab exit, production transfer, tests, and real-flow smoke before product acceptance.
- Proactively suggest Peer Compass Review when overlapping tasks/PRs/contracts/DOD rows need another participant's context; prepare the review request and tell the human who to ask and how to sync back.
- If the next step is to understand source of truth, foundation, design template, or affected contracts, launch or prepare a research thread that does not change product code and returns findings before implementation.
- Create or prepare a separate task thread for implementation work when the task is ready enough to have a GitHub issue with a `Codex Task Contract`, `DOD Impact`, task type / Product Capability Loop, `Burn / Limits`, scope, out of scope, acceptance criteria, and verification.
- Use `gpt-5.5` or newest available model and `xhigh` / very high reasoning for new task/research threads; make any fallback visible in the task issue, handoff, or orchestrator state.
- If Codex thread tools are available and the human has authorized launching or continuing the next task, create or resume the task/research thread, title it as `[#<issue>] <sequence> <short title>` when issue id or sequence is available, read back the actual sidebar title, rename it yourself through the available thread tool or explicitly ask the human, and record the exact title plus id/link in GitHub shared memory. If thread tools or rename are unavailable, provide the exact title and startup prompt and mark the launch as pending.
- After launch, do not count a plan-only child response as progress; the child must start execution, name a blocker, or request rebrief.
- When checking a task, read or inspect the task thread when its id or link is known. If `$accept-work` has not run, send the task thread a short command to run it from its current task context.
- After `$accept-work` reports `ACCEPT` or `ACCEPT_WITH_FOLLOWUPS`, check whether required fresh current-branch smoke and manual merge happened in the task thread. If not, send the human back to the task thread. If yes, update sequence, DOD burndown, burn status when material, and recommend the next best action instead of stopping at the acceptance status.
- If smoke used frontend/backend/browser runtime, require Runtime Coherence Check before treating acceptance as merge-ready. Missing or inconclusive proof sends the work back to the task thread.
- An accepted sub-slice or merged PR does not close the parent issue unless the named DOD row and promised product loop are closed or the human explicitly moved the remainder out of scope. Keep parent closure status visible.
- Record task thread links/ids, pending worktrees, or manual-start prompts in GitHub shared memory when available.
- Run a short health review after a milestone or large merge, after 3-5 accepted slices, repeated follow-ups, stalled tasks, stalled DOD burn, Lab Mode without exit, scope growth, or owner dropout.
- Never invent another participant's local state. Missing packets must remain visible as `WAITING`, `READY_WITH_CAUTIONS`, or `BLOCKED`.

## User-Facing Outcome

End with one clear status:

- continue;
- continue with cautions;
- wait;
- launch task thread;
- launch research thread;
- accept work;
- needs human decision.

Include the relevant issue, PR, alignment delta, task thread, and next action when available.
