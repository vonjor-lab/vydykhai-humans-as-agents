# Start Work Workflow

Use this workflow when a human wants to turn a large idea, meeting outcome, product theme, or vague request into an epic and task map.

Goal: make large work safe for several humans and several Codex instances by turning intent into a clear brief, affected entities, sequence, and GitHub task set.

## Inputs To Read

1. Human request, meeting transcript, Fathom summary, or Team Alignment Delta that triggered the topic.
2. Project compass and collaboration framework.
3. Relevant docs, GitHub issues, PRs, and previous epic briefs.
4. Current repo state for affected areas.
5. Active alignment journal when this is a re-brief from daily alignment.

## Steps

### 1. Restore Context

Summarize:

- product goal;
- user or actor;
- current state;
- why the topic matters now;
- known constraints;
- related epics, tasks, PRs, and docs;
- decisions or assumptions already made.

Do not start with implementation details. Start with the product problem and the shape of the desired outcome.

If the input includes product commentary captured during implementation, classify it before changing the brief or task map:

- current scope change;
- DOD gap;
- vision guardrail;
- future option.

Only current scope changes and DOD gaps should become task-map changes. Vision guardrails belong in the brief, alignment issue, or product model docs. Future options should stay out of GitHub tasks unless preserving them is materially useful.

Also classify each proposed task or backlog item by task type:

- `product capability`;
- `technical enabler`;
- `maintenance`;
- `research/spike`;
- `future option`.

If a proposed product capability lacks a closed user/operator loop, draft the likely loop and ask the human to confirm or trim it before creating tasks. If a proposed technical task is actually only an enabler for a promised product capability, keep it technical but link it to the task that will close the product loop. If a proposed UI/product-surface task lacks backing contracts, identify the missing backend/API/data/persistence/permission/error-state work and link or create the required technical enabler before treating the UI as product-complete.

### 2. Define The Epic Brief

Draft an epic brief with:

- goal;
- non-goals;
- current state;
- target behavior;
- affected users or roles;
- affected entities, flows, APIs, data, permissions, docs, and integrations;
- dependencies;
- risks;
- owner or decision maker;
- acceptance criteria;
- verification expectations;
- handoff expectations.

If the epic cannot be explained compactly, split it before tasking.

### 3. Check Cross-Epic Consistency

Compare the brief with:

- active epics and task issues;
- shared concepts and contracts;
- recent Team Alignment Deltas;
- known lessons and project rules.

Call out overlaps, duplicated work, assumptions that conflict, and surfaces that should not be edited in parallel.

### 4. Propose Implementation Concepts

Offer one recommended implementation concept and, when useful, one or two alternatives.

For each concept, state:

- why it fits the goal;
- what it avoids;
- major dependencies;
- risk level;
- expected verification.

Keep this at the planning level. Do not implement.

### 5. Build Task Map

Create task concepts sized for autonomous Codex execution.

Each task concept should include:

- short title;
- thread title in the form `[#<issue>] <sequence> <short title>` when an issue id or sequence exists;
- task type: `product capability`, `technical enabler`, `maintenance`, `research/spike`, or `future option`;
- goal;
- affected surfaces;
- scope;
- out of scope;
- dependencies;
- DOD impact: which epic or milestone DoD row this task moves or closes;
- Product Capability Loop:
  - for `product capability`: actor, entry point, setup/configuration, input/action, processing/enforcement, feedback, state, recovery/next action, audit/provenance, and verification;
  - for `technical enabler`: the linked product capability or later task that will close the loop;
  - for UI/product-surface work: the backing backend/API/data/persistence/permission contracts, realistic states, and scenarios required for the UI to be usable;
  - for `maintenance` or `research/spike`: payoff/question, owner, timing, and stop condition;
- Burn / Limits: `not material` or a concrete cap/stop condition for generation/API/retry/verification risk;
- alignment hooks;
- acceptance criteria;
- expected verification;
- completion gate;
- suggested owner or owner type;
- whether it is sequential or parallel.

Prefer several clear tasks over one broad task. Do not create tasks that require an agent to infer the epic from chat history.

Before adding another task in an already active area, show the parent closure view:

- slices already closed;
- slices still required before parent acceptance;
- whether the parent can be accepted now with follow-ups;
- why this new task is a DOD gap rather than a future option or polish.

### 6. Sequence And Assign

Recommend order:

- first tasks that reduce uncertainty or create shared contracts;
- then enabling implementation tasks;
- then integration and polish;
- then acceptance and cleanup.

For each task, explain why it is first, parallel, blocked, or later.

Suggest distribution between people when useful, but keep assignment as a proposal until the human confirms.

### 7. Ask For Approval

Before creating or updating GitHub issues, show:

- epic brief summary;
- task map;
- sequence;
- product capability loops, missing loops, and technical enabler links;
- parent closure view and expected slice count when this is a follow-up inside an active epic;
- proposed ownership;
- open decisions;
- risks.

Ask for human approval or edits.

### 8. Create Or Update GitHub Issues

After approval:

- create or update the epic issue;
- create or update task issues;
- link tasks to the epic;
- include the relevant brief, sequence, dependencies, and acceptance criteria;
- include a compact `Codex Task Contract` in every implementation task:
  - `Orchestrator thread`: link or id when available;
  - `Task thread`: deterministic title plus link/id, pending worktree, or manual-start prompt when created;
  - `Alignment issue`: shared journal for this stream or meeting window;
  - `DOD Impact`: named epic/milestone DoD row this task moves or closes;
  - `Task type`: `product capability`, `technical enabler`, `maintenance`, or `research/spike`;
  - `Product Capability Loop`: closed-loop checklist for product capabilities, or linked product-loop task for technical enablers;
  - `Burn / Limits`: `not material` or a cap/stop condition;
  - `Completion`: before final completion, the task thread must run `$accept-work` from inside the task thread and include the result in its final report;
  - `Final status`: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`;
  - `Next action`: what the orchestrator should do after reading the result.
- include `Alignment Hooks` in every implementation task:
  - read the latest relevant Team Alignment Delta before touching shared surfaces;
  - publish or prepare a Local Alignment Packet only when a material scope or contract change, blocker/conflict, accepted result, or follow-up split affects other participants;
  - do not post routine commit-by-commit updates, branch creation, or ordinary PR-open status;
- include `Completion Gate` in every implementation task:
  - the task is not accepted or moved to Done until `$accept-work` reviews the result against the original issue, latest alignment packets/deltas, verification, and residual risks inside the task thread;
  - the implementation agent should end with the `$accept-work` result, PR or delivered artifact, and recommended orchestrator next action;
- add links to meeting transcript, alignment issue, or Team Alignment Delta when applicable.

Return the approved task sequence to the Framework Orchestrator. If the first task is ready, the orchestrator should launch or prepare a separate task thread using `task-thread-handoff-template.md`; do not start implementation inside the planning workflow.

Before creating another follow-up in the same area, check whether the parent epic or milestone DoD row can be closed, or whether the remaining work should become one end-to-end slice instead of several small slices.

End with the issue links and the first recommended action.

## Re-Brief From Daily Alignment

Use this workflow when `$daily-alignment` finds that a meeting changes goal, scope, task map, sequencing, or ownership materially.

Carry forward:

- original epic brief;
- latest Team Alignment Delta;
- relevant Local Alignment Packets;
- proposed Brief Patch;
- unresolved decisions.

The output should clearly say whether this is:

- a small brief update;
- a task map revision;
- a full re-brief;
- a new epic.
