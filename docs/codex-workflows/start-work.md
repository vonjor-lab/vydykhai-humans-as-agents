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

If the topic cannot yet be briefed without long speculation, do not force a task map. Route the narrow unclear part into a Research Thread with one question, sources/options to inspect, stop condition, and expected Research Packet. The orchestrator incorporates the packet later and then resumes `$start-work`, Lab Mode, or task dispatch.

Also check whether the topic would benefit from Lab Mode or Peer Compass Review. Suggest Lab Mode when isolated learning reduces burn/risk and include lab exit/production transfer in the task map. Suggest Peer Compass Review when another participant's context or active task could change safe sequencing.

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
- model/reasoning: `gpt-5.5` or newest available model and `xhigh` / very high reasoning, with explicit fallback if unavailable;
- owner and backup owner or failover condition when the task can block other work;
- task type: `product capability`, `technical enabler`, `maintenance`, `research/spike`, or `future option`;
- goal;
- affected surfaces;
- scope;
- out of scope;
- dependencies;
- DOD impact: which epic or milestone DoD row this task moves or closes;
- Parent Closure: whether this closes the parent issue/milestone row or is a sub-slice with the parent remaining open;
- Product Capability Loop:
  - for `product capability`: actor, entry point, setup/configuration, input/action, processing/enforcement, feedback, state, recovery/next action, audit/provenance, and verification;
  - for `technical enabler`: the linked product capability or later task that will close the loop;
  - for UI/product-surface work: the backing backend/API/data/persistence/permission contracts, realistic states, and scenarios required for the UI to be usable;
  - for `maintenance` or `research/spike`: payoff/question, sources or options to inspect, owner, timing, stop condition, and expected Research Packet when this is a research thread;
- Compass Calibration for high-ambiguity product/design/IA/UI shell/entity-model/AI workflow tasks: target object, source of truth, non-foundation references, nearest visible result, and smoke artifact;
- Burn / Limits: `not material` or a concrete cap/stop condition for generation/API/retry/verification risk;
- Lab Mode: `not needed`, `recommended`, or `active`; when used, include question, proof, stop condition, burn cap, lab exit, production transfer, tests, and real-flow smoke;
- Peer Compass Review: `not needed`, `requested`, `waiting`, or `incorporated`; when needed, include reviewer, review question, output location, safe continuation status, and return-sync instruction;
- Launch expectation: execution should start after a short sanity check, unless the task thread names a blocker or requests rebrief;
- alignment hooks;
- acceptance criteria;
- expected verification;
- Runtime Coherence Check expectation when smoke may require frontend/backend/browser runtime;
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
  - `Task thread launch state`: `recorded`, `manual start pending`, or `thread title pending`;
  - `Model / Reasoning`: `gpt-5.5` or newest available model plus `xhigh` / very high reasoning, or explicit fallback;
  - `Alignment issue`: shared journal for this stream or meeting window;
  - `Owner / backup`: owner plus backup or failover condition for blocking work;
  - `DOD Impact`: named epic/milestone DoD row this task moves or closes;
  - `Parent Closure`: parent closure, accepted sub-slice, or parent remains open;
  - `Task type`: `product capability`, `technical enabler`, `maintenance`, or `research/spike`;
  - `Product Capability Loop`: closed-loop checklist for product capabilities, or linked product-loop task for technical enablers;
  - `Compass Calibration`: required when target object, source of truth, foundation, or visible loop can be misunderstood;
  - `Burn / Limits`: `not material` or a cap/stop condition;
  - `Lab Mode`: `not needed`, `recommended`, or `active`, with lab exit and production transfer expectations when used;
  - `Peer Compass Review`: `not needed`, `requested`, `waiting`, or `incorporated`, with reviewer/request/output when needed;
  - `Launch expectation`: the task thread must start execution, name a blocker, or request rebrief instead of stopping at a plan;
  - `Runtime Coherence Check`: required for user-facing or integration-affecting smoke involving frontend/backend/browser runtime;
  - `Completion`: before final completion, the task thread must run `$accept-work` from inside the task thread and include the result in its final report;
  - `Smoke / merge`: fresh current-branch smoke when required, then manual merge from the task thread after human smoke and confirmation;
  - `Final status`: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`;
  - `Next action`: what the orchestrator should do after reading the result.
- include `Alignment Hooks` in every implementation task:
  - read the latest relevant Team Alignment Delta before touching shared surfaces;
  - if Peer Compass Review is requested or waiting, read the packet before touching the overlapping surface or contract;
  - publish or prepare a Local Alignment Packet only when a material scope or contract change, blocker/conflict, accepted result, or follow-up split affects other participants;
  - do not post routine commit-by-commit updates, branch creation, or ordinary PR-open status;
- include `Completion Gate` in every implementation task:
  - the task is not accepted or moved to Done until `$accept-work` reviews the result against the original issue, latest alignment packets/deltas, verification, and residual risks inside the task thread;
  - the implementation agent should end with the `$accept-work` result, PR or delivered artifact, smoke/merge status, and recommended orchestrator next action;
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
