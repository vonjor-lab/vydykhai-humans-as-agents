# Framework Orchestrator Workflow

Use this repo-local workflow inside a standing personal Codex thread for one participant and one product stream or epic.

Goal: keep the brief, task sequence, GitHub shared memory, daily/merge alignment, task threads, and acceptance gates connected without making humans discuss implementation mechanics.

## What This Thread Owns

The orchestrator thread owns coordination, not implementation:

- current compass, brief, and task sequence;
- links to the epic, task issues, PRs, and shared alignment issue;
- latest Local Alignment Packet and Team Alignment Delta;
- active task/research thread ids or links when available;
- pending decisions, missing inputs, merge events, and acceptance gates;
- next recommended action for the participant.

Implementation, product-code fixes, deploys, acceptance smoke, and merges must happen in task threads. The orchestrator stays clean so it can protect the project goal, DOD, sequence, alignment state, and next best action.

## Inputs To Read

1. Human request and the active product stream or epic.
2. `AGENTS.md` and the collaboration framework.
3. Relevant brief, epic issue, task issues, PRs, and docs.
4. Current shared alignment issue and latest Team Alignment Delta.
5. Latest task handoffs and local repo state.
6. Latest meeting transcript or summary when the request follows a meeting.

## Steps

### 1. Restore Orchestrator State

Rebuild the compact state:

```md
## Framework Orchestrator State

Owner:
Product stream / epic:
Compass / brief:
Alignment issue:
Latest meeting or event processed:
Latest Team Alignment Delta:

Active tasks:
- <issue> | <sequence/title> | <owner> | <task thread/pending> | <branch/PR> | <DOD impact> | <status> | <next>

Pending decisions or inputs:

Can continue:
Next action:
```

If the state already exists in an issue comment or body, update it from durable sources instead of trusting stale text.

### 2. Classify The Request

Choose one mode:

- `launch`: the project is being started or imported into the framework;
- `plan`: the human is starting or reshaping a large topic;
- `align`: a meeting, daily, merge, blocked event, accepted result, or follow-up split may affect shared work;
- `research`: source of truth, foundation, design template, or affected contracts must be clarified before implementation;
- `dispatch`: the next approved task should be launched or resumed;
- `accept`: a task, PR, milestone, or epic needs acceptance;
- `sequence`: the human asks what should happen next;
- `maintain`: stale tasks, missing inputs, stale branches, or unclear GitHub state need cleanup.

Route to the specialized workflow when appropriate:

- `launch` -> `$project-launch`;
- `plan` -> `$start-work`;
- `align` -> `$daily-alignment`;
- `accept` -> `$accept-work`.

The orchestrator can perform `sequence`, `dispatch`, and light `maintain` directly.

When the request contains product vision, future-state commentary, or concerns about slice growth, also run Product Compass Note Triage before changing scope or sequence:

- `scope change`: requires explicit human confirmation before changing the active task;
- `DOD gap`: propose a named follow-up with parent issue, sequence, owner, blocker status, and expected timing;
- `vision guardrail`: record or propose a brief/alignment/doc update without expanding the current task;
- `future option`: keep as a parking/vision note only when it is valuable enough to preserve.

Do not turn a compass note into a GitHub issue or task thread until it is classified and the human has approved the resulting action.

When inspecting or preparing backlog/tasks, classify each item by task type before dispatch:

- `product capability`;
- `technical enabler`;
- `maintenance`;
- `research/spike`;
- `future option`.

For a `product capability`, require a closed user/operator loop: actor, entry point, setup/configuration, input/action, processing/enforcement, feedback, state, recovery/next action, audit/provenance, and verification. If the loop is missing, draft the likely loop, ask the human to confirm or trim it, and update the task map before launch.

Do not treat route existence, backend/API tests, projections, readiness cards, or passive records as product capability closure. There must be a visible UI/operator entry/action or a human-approved linked exception.

For a `technical enabler`, require a named linked product capability or later task that will close the loop. Do not describe a technical enabler as a completed product capability unless the linked loop has already been accepted or explicitly moved out of scope by human decision.

For UI, product surface, design, navigation, or copy work, run the reverse check: identify the backend/API/data/persistence/permission contracts, loading/empty/error states, recovery path, audit/provenance, and realistic scenarios required underneath the UI. If they are missing, draft the missing technical enabler and ask the human to confirm sequencing before launch.

For high-ambiguity product/design/IA/UI shell/entity-model/AI workflow work, run Compass Calibration Check before dispatch or continuation. Ask the task or research thread to state:

- what exactly is being built;
- which source of truth is available and in what form;
- what is not a foundation or reference;
- which nearest user/operator result should be visible;
- which nearest smoke artifact proves the object was understood correctly.

If the agent confuses a technical/internal surface with a product template, a visual shell with a finished capability, or a route/test/backend state with a visible product loop, stop implementation and correct the brief/task first.

### 3. Check Alignment Freshness

Before recommending work that touches shared surfaces, verify:

- latest relevant meeting or event has been processed;
- this participant has a current Local Alignment Packet when needed;
- latest Team Alignment Delta covers the packets that matter for this task;
- missing participants or stale packets are visible;
- relevant merge events have a delta or clear handoff.

If alignment is incomplete, return one of:

- `continue with cautions`: safe only inside named boundaries;
- `wait`: missing packet or decision may change the next action;
- `blocked`: known conflict or missing decision prevents work.

Do not invent another participant's uncommitted local state.

### 4. Maintain The Sequence

Keep the task order human-readable:

- what is already merged or accepted;
- what is active now;
- what is paused for review, smoke, or decision;
- what follows next;
- how many implementation slices remain before the nearest parent epic or milestone DOD row can be accepted;
- which tasks are parallel-safe and which are sequential;
- which contracts or shared surfaces must not be changed silently.

For stacked PRs, write the baton explicitly: merged PR, next PR, remaining validation, and whether dependent work may continue.

### 5. Dispatch A Task Thread

Only dispatch when the task has:

- task issue or approved task brief;
- `Model / Reasoning`: `gpt-5.5` or newest available model and `xhigh` / very high reasoning, with explicit fallback if unavailable;
- `Codex Task Contract` in the task issue;
- `DOD Impact` that maps the task to a named epic or milestone DoD row, unless the human explicitly accepted an exception;
- `Parent Closure` stating whether this is parent closure or an accepted sub-slice;
- `Task type` and `Product Capability Loop` status:
  - product capabilities need the closed loop in scope or a named human-approved exception;
  - technical enablers need the linked product-loop task or parent capability;
  - UI/product-surface tasks need the backing backend/API/data/permissions/scenario contracts in scope or linked;
- `Burn / Limits` set to `not material` or a concrete cap/stop condition;
- clear scope and out of scope;
- Compass Calibration result when the target object/source of truth can be misunderstood;
- acceptance criteria;
- verification expectation;
- latest relevant Team Alignment Delta;
- handoff destination back to this orchestrator.

Use `task-thread-handoff-template.md` to prepare the startup prompt.

If the next step is `research`, launch a research thread with the same title/readback/recording discipline, but explicitly forbid product-code changes. Its output should identify what exists, source of truth, usable foundation, gaps/blockers, and whether implementation can start or the brief/task must change first.

If Codex thread tools are available and the human has authorized launching the next task, create the task thread. Title it from the task:

```text
[#<issue>] <sequence> <short task title>
[<epic>] <short task title>
```

If the task title already contains the sequence, keep it visible in the sidebar title. Then send the startup prompt to the new thread, read back the actual sidebar title, rename the thread yourself through the available thread tool or ask the human to rename it, and record the task thread link/id, exact title, or pending worktree in GitHub shared memory when available. The startup title inside a child thread is only a hint; the orchestrator owns readback and rename verification.

If thread tools or rename are unavailable, provide the exact title and startup prompt for manual creation or manual rename, and record that manual-start prompt as the task's current dispatch state. A task is not considered launched until the title and id/link or manual-start prompt are recorded in GitHub shared memory.

### 6. Supervise Task Thread

When the human asks to check a task, continue a stream, or inspect task status, the orchestrator should inspect the GitHub task issue, task thread, PR, and latest alignment state.

Use this simple state machine:

- no task thread exists: create or prepare it, then record the thread id/link, pending worktree, or manual-start prompt;
- task thread is still working: summarize current state and next expected checkpoint;
- task thread says work is complete but no `$accept-work` result is present: send the task thread a short command to run `$accept-work` from its task context;
- `$accept-work` result is `NEEDS_FIXES`: send the concrete fix request back to the task thread;
- `$accept-work` result is `BLOCKED`: record the blocker or missing decision in GitHub shared memory and tell the human what decision is needed;
- `$accept-work` result is `ACCEPT` or `ACCEPT_WITH_FOLLOWUPS` and required smoke or merge is not done: send the human back to the task thread for manual smoke and merge after human confirmation;
- `$accept-work` result is `ACCEPT` or `ACCEPT_WITH_FOLLOWUPS` and PR is merged or no merge is needed: update the sequence, DOD impact/burndown, parent closure status, burn status when material, and choose the next best action.

The task thread is responsible for running `$accept-work` before final completion. The orchestrator is responsible for noticing whether that happened and for moving the stream forward from the accepted result.

An accepted sub-slice or merged PR does not close a parent issue unless the named DOD row and promised product loop are closed or the human explicitly moved the remainder out of scope. Keep the parent open and route the next best action to the missing visible loop, follow-up, decision, or health review.

Do not merge from the orchestrator. If smoke or merge fails, the task thread has the implementation context needed to correct the work.

### 7. Choose Next Best Action

After an accepted task, merge, blocker, or follow-up split, do not stop at status reporting. Choose the next useful action:

- launch or prepare the next ready task thread;
- run a parent epic/milestone DOD burndown check before creating another slice in the same area;
- check whether accepted technical enablers now require the linked product-loop task to be launched, updated, or re-sequenced;
- classify any new product compass notes before deciding whether they are current scope, DOD gaps, vision guardrails, or future options;
- run a health review after a milestone/large merge, after 3-5 accepted slices, or when follow-ups repeat, a task stalls, scope grows, or an owner drops out;
- run or route to `$daily-alignment` when the accepted result or merge affects another participant's work;
- send fixes back to the current task thread;
- ask for a named human decision;
- wait for a named packet, review, merge, or external input;
- close or archive completed alignment artifacts when their final delta is already reflected in durable docs, tasks, or PRs.

### 8. Update Shared Memory

When the human approves updates, write the durable result into the right place:

- task or epic issue body;
- alignment issue dashboard or comments;
- PR body or comment;
- brief patch;
- repository docs or rules when a lesson should persist.

Keep the alignment issue operationally short. Archive or close it after the final delta is reflected in durable briefs, tasks, or docs.

### 9. Tell The Human The Next Move

End with:

- current status;
- latest durable links;
- whether work can continue;
- exact next action;
- what is missing, if anything.

Use one of these statuses:

- `CONTINUE`;
- `CONTINUE_WITH_CAUTIONS`;
- `WAIT`;
- `LAUNCH_TASK_THREAD`;
- `LAUNCH_RESEARCH_THREAD`;
- `SEND_ACCEPT_WORK_TO_TASK_THREAD`;
- `NEEDS_DECISION`;
- `BLOCKED`.
