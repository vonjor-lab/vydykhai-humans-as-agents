# Framework for Collaborative Vibe Coding

Date: 2026-06-10
Version: 1.4.1
Status: universal working framework for several vibe coders and several Codex instances working on one product
Changelog: `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`

## Sources

This framework was distilled from:

- team product daily / brainstorm notes and meeting distillation, 2026-06-10
- practical Codex work on a shared product with several parallel threads, branches, product areas, and autonomous agent runs
- recurring lessons from successful handoffs, failed over-large tasks, stale local branches, lab experiments, visual artifact debugging, and expensive restarts

These sources explain where the framework came from. The framework itself is intended to be universal and reusable across projects.

## Purpose

This framework helps several humans and several AI coding agents work on the same product without drifting apart.

It is meant for teams where:

- people work part-time or asynchronously;
- Codex or similar agents can work autonomously for long stretches;
- tasks touch product, design, architecture, data, UI, tests, deployment, and project memory;
- the cost of wrong direction is high because an agent can produce a lot of plausible but misaligned work.

The goal is to make autonomous AI work practical: enough context for agents to move independently, enough checkpoints for humans to steer early, and enough persistent memory that lessons do not stay trapped in chat threads.

## Diagnosis

There are two common working modes.

### Manual Mode

A human stays near the agent and keeps steering through small prompts.

This works for:

- quick debugging;
- small UI refinements;
- narrow investigation;
- tactical repair.

It fails as the default mode because production stops when the human is away.

### Epic Mode

A human gives the agent a large objective and lets it work autonomously.

This works when the task is well designed. It fails when the task is vague, under-contextualized, or missing constraints. The agent then spends a lot of time building in the wrong direction, and the team later pays for rescue, rework, or restart.

### Main Failure Pattern

Most expensive failures happen when the team starts in epic mode with insufficient task design and then has to finish in manual mode.

The fix is not smaller ambition. The fix is better top-down design:

1. Define the project compass.
2. Break it into epics.
3. Turn epics into self-contained tasks.
4. Let agents work autonomously.
5. Add scheduled checkpoints before drift becomes expensive.
6. Save durable lessons back into the repository.

## Codex Role

Codex is not only an implementer. Use it throughout planning:

- Researcher: inspect docs, code, issues, previous decisions, and similar work before humans finalize direction.
- Brief co-author: draft epic briefs, task bodies, risks, dependencies, and acceptance criteria.
- Consistency reviewer: compare a new epic or task against the compass, other active epics, shared contracts, and known lessons.
- Orchestrator: keep the brief, sequence, alignment journal, task threads, PRs, and acceptance gates connected.
- Implementer: execute a scoped task after the brief and alignment checks are clear.

The human remains accountable for product judgment and final decisions. Codex expands context, exposes conflicts, and turns decisions into durable artifacts.

## Core Repo Skills

The framework is implemented through one project launch skill, one orchestration skill, and three human-level work skills. They are repo-scoped under `.agents/skills`, so every team member gets the same behavior after pulling the repository and starting a new Codex session from inside it.

### `$project-launch`

Use when the team starts a new project or connects the framework to an existing repository.

Output:

- Project Operating Brief: repo, participants, roles, decision owner, coordination sources, and source of truth;
- concise team onboarding: how to use the orchestrator thread, task threads, GitHub issues, and meeting/chat inputs;
- initial compass, DOD, and non-goals;
- list of epics or open questions to route into `$start-work`;
- GitHub shared memory and task board setup after human approval.

### `$framework-orchestrator`

Use in a standing personal Codex thread when a human wants to continue the product stream, start the next task, process a daily or merge event, check sequence, launch a task thread, or coordinate acceptance.

Output:

- current orchestrator state;
- latest brief, task, PR, and alignment links;
- next recommended action: continue, continue narrowly, wait, launch task, accept work, or ask for decision;
- task thread title and startup prompt when a new task should be dispatched;
- GitHub issue or PR updates after human approval;
- handoff back into `$start-work`, `$daily-alignment`, or `$accept-work` when that specialized workflow is required.

The orchestrator thread is for organization only. It must not solve implementation tasks, write product code, fix defects, deploy, smoke test, or merge. The reason is simple: this thread must stay clean as the holder of the overall goal, DOD, sequence, alignment, risks, and next best action. If it performs tasks, its context becomes noisy and less reliable for coordination.

### `$start-work`

Use when a human wants to start a large topic, shape an idea into an epic, process a meeting insight, or decide what should happen first.

Output:

- epic brief;
- affected entities and surfaces;
- cross-epic risks;
- implementation concept;
- task map;
- recommended sequence;
- proposed ownership;
- GitHub epic/task issues after human approval.

### `$daily-alignment`

Use after a meeting or before resuming work during execution.

Output:

- Local Alignment Packet for the participant;
- updated Team Alignment Delta;
- continue, continue with cautions, wait, or blocked guidance;
- Brief Patch when the brief needs a small visible update;
- re-brief signal to `$start-work` when goal, scope, sequence, ownership, or task map changes materially.

### `$accept-work`

Use when a task, PR, milestone, or epic is ready to be accepted or closed.

Output:

- acceptance report;
- comparison against the original brief;
- incorporation of Brief Patches and Team Alignment Deltas;
- verification and residual risk summary;
- accept, accept with follow-ups, needs fixes, or blocked decision;
- GitHub/project-memory updates after human approval.

These skills keep the process human-readable: orchestrate the stream, start the work, keep it aligned, accept the result.

## Compatibility With Other Agent Harnesses

The framework is universal in its operating logic, but the current reference implementation is tuned for Codex: repo-scoped skills in `.agents/skills`, Codex threads, thread titles, handoff between orchestrator and task threads, GitHub shared memory, and local verification.

Other harnesses can use the framework if the team runs an adapter capability check before project launch:

- durable project instructions can live in the repo;
- there is a separate work context for task work: thread, session, subagent, cloud agent, worktree run, or issue-run;
- that work context can be named, found, and resumed later;
- the harness can read and update GitHub issues/PRs or another shared source of truth;
- it can see local diff/branch state or work through a PR branch;
- it can run verification and fresh current-branch smoke, or explicitly hand that step to a human;
- it can write a handoff and acceptance result where another participant or agent can find it later.

If a harness cannot create separate threads, that is not a blocker. Map `orchestrator thread` to a standing planning/session chat, `task thread` to a separate chat/run/branch/PR/issue, and `thread id/link` to that run's link or identifier. If no such identifier exists, the GitHub issue becomes the primary coordination handle.

Do not assume `$project-launch`, `$framework-orchestrator`, `$start-work`, `$daily-alignment`, and `$accept-work` auto-activate outside Codex. In another harness, implement them as native workflows, rules, prompts, agents, or runbooks. The logic is the same; the launch mechanism depends on the tool.

## Meeting-To-Codex Loop

Human meetings are where context, judgment, and trade-offs emerge. They should feed agent work directly, not remain separate from it.

Use Fathom or another meeting recorder when possible. After the meeting, ask Codex to turn the transcript into a compact work artifact:

1. Decisions made.
2. Assumptions changed.
3. Epics or tasks affected.
4. Cross-agent alignment risks.
5. Open questions.
6. Docs, issues, or briefs to update.

The human reviews this distillation before it becomes project memory. After approval, Codex updates the relevant briefs, alignment packets, tasks, or docs. Then each team member's Codex can read the same durable artifacts and continue from a shared state.

Meeting transcript is raw input. Codex distillation plus human approval is the operational bridge into agent work.

## Project Launch

A new project starts with a separate Framework Orchestrator thread, not with a task. In that thread the team loads the framework, connects the repo and durable project memory, but does not perform implementation work.

Minimal launch request:

```text
Use $project-launch. Launch this project with the Codex Collaboration Framework.
```

### Project Coordination Sources

Do not split "meetings", "recordings", and "team chat" into separate mechanisms. For the framework, they are one input layer for syncs.

The Project Operating Brief should name:

- working repo and branch policy;
- where GitHub issues, PRs, briefs, and docs live;
- coordination sources: meetings, recordings, transcripts, a dedicated Telegram/Slack/Teams chat, docs, notes, or manual summaries;
- who can read and approve these sources;
- which artifact is source of truth when chat/transcript conflicts with a GitHub issue or brief.

Meetings and chats remain raw inputs. Codex turns them into approved deltas, issues, briefs, and task updates only after human confirmation.

### Team Onboarding

Every participant should understand five rules:

- each participant has a personal Framework Orchestrator thread for the project or product stream;
- no coding, fixing, deploying, smoke testing, or merging happens in the orchestrator thread;
- the orchestrator creates or prepares GitHub tasks, task thread titles, startup prompts, and shared-memory updates;
- implementation happens in separate task threads that receive one task, run `$accept-work`, prepare smoke, and perform merge;
- after a meeting or when returning to work, the participant can say "run daily alignment" or "continue the stream", and Codex restores durable state itself.

Task threads must be named consistently and the rename must be verified. A task is considered launched only after GitHub shared memory contains the thread title and thread id/link or the manual-start prompt.

### Ownership And Backup

Every active task needs an owner and, for critical workstreams, a backup owner. If the owner drops out, the orchestrator should be able to continue from the GitHub issue, task thread handoff, PR, latest Team Alignment Delta, and accepted/unaccepted status. A returning owner runs daily alignment or orchestrator resume before continuing old local work blindly.

## Asynchronous Alignment Journal

Team alignment must not require everyone to be online at the same time. Use a GitHub issue as the shared alignment journal for every meaningful meeting or daily work cycle.

The issue has two roles:

- issue comments are the canonical append-only log;
- issue body is a short dashboard rebuilt from the comments.

Each team member can run their own Codex whenever they return to work. Codex reads the meeting transcript, local repo state, active task context, and the current alignment issue, then posts a Local Alignment Packet as a new comment. It never overwrites another participant's packet.

Local uncommitted work is invisible to other people until the owner's Codex publishes enough of it into the packet. The packet should therefore summarize current local state, branch or PR if available, affected surfaces, changed assumptions, conflicts, and whether the owner can safely continue.

Any later Codex instance can read all packets, rebuild the issue dashboard, and publish a Team Alignment Delta that says:

- which packets and meetings are covered;
- who has not yet published a packet;
- which packet updates have already been incorporated;
- what changed in shared briefs, tasks, rules, or assumptions;
- whether a Brief Patch or re-brief through `$start-work` is required;
- whether work is READY, READY_WITH_CAUTIONS, WAITING, or BLOCKED.

This makes the loop fully asynchronous. The first participant can continue if the current delta says their work is safe or isolated. Missing packets remain visible. When another participant returns later, their Codex adds a new packet and either updates the team delta or leaves a clear waiting state. The latest delta supersedes earlier deltas but does not delete them.

Keep the journal short operationally. Close or archive old alignment issues after their final delta has been incorporated into durable docs, tasks, or briefs. The long-term source of truth is not the transcript or journal history; it is the updated project memory.

### Event-Triggered Alignment

Daily or meeting alignment is not the only synchronization mechanism. During active implementation, publish a short alignment packet when an event changes what another person or Codex instance needs to know.

Post or prepare a packet only for events that change another participant's next action, risk model, or shared understanding:

- implementation plan, task boundary, shared contract, affected entity, or owner dependency materially changed;
- conflict, overlap, blocker, or missing decision was discovered;
- PR accepted, merged, blocked, or sent back for fixes;
- follow-up work was split out of the original task.

Do not post routine commit-by-commit updates, branch creation, or ordinary PR-open status. Those belong in GitHub tasks and PRs. The alignment issue is a coordination journal, not a development log. A packet should answer: what changed for others, which surfaces or contracts are affected, whether work can safely continue, and what review or decision is needed.

When work is accepted or rejected with material follow-ups, the accepting agent should leave an Acceptance Packet or update the existing packet/delta so other participants know what changed, what is safe to build on, and which follow-ups remain.

### Product Compass Note Triage

During a large product stream, humans often add comments that refine the target vision while implementation is already running. Treat these comments as product compass notes first, not as automatic scope expansion.

Classify every material product comment into one of four buckets:

- `scope change`: the comment should change the current task only if the human explicitly confirms the scope change and the orchestrator verifies that it does not break the task's DOD, owner split, or acceptance boundary.
- `DOD gap`: the comment reveals a missing step required to satisfy a named epic or milestone DOD. The orchestrator should propose a named follow-up with a clear parent issue, sequence, blocker status, owner, and expected timing before creating or launching it.
- `vision guardrail`: the comment clarifies the target product model, user mental model, or architectural direction. Record it in the brief, alignment issue, or vision doc as a guardrail without adding implementation scope to the active task.
- `future option`: the comment is a possible later idea that is not needed for the current DOD. Do not create backlog noise. Keep it in a vision/parking note only when losing it would be costly.

Before creating another follow-up in the same area, the orchestrator must show closure discipline: how many slices remain before the parent task or milestone can be accepted, whether the parent can be accepted now, and why the new slice is necessary instead of being deferred.

### Product Capability Closed Loop

Tasks that promise a product capability must describe and eventually prove the role's closed loop. A product capability is not accepted merely because backend state, APIs, projections, readiness cards, or stored records exist.

For every task or backlog item, classify the task type before dispatch:

- `product capability`: a user or operator can do something valuable in the product. The task needs a closed loop.
- `technical enabler`: backend, data, API, contract, migration, infrastructure, or projection work. The task may be accepted without UI only when it names the product capability or later task that closes the loop.
- `maintenance`: quality, debt, tooling, performance, or guardrail work. It needs a clear payoff, timing, owner, and stop condition.
- `research/spike`: uncertainty reduction. It needs a concrete question, output artifact, and stop condition.
- `future option`: a possible later idea. Do not turn it into backlog work unless the human explicitly promotes it.

The closed loop for a product capability should answer:

1. Actor: who owns or uses the capability.
2. Entry point: where the actor finds it in the product.
3. Setup or configuration: where rules, limits, imports, access, or defaults are set and by whom.
4. Input or action: what the actor does.
5. Processing or enforcement: what the system does before and after the action.
6. Feedback: what the actor sees immediately.
7. State: where status, usage, readiness, errors, limits, or exhausted states are visible later.
8. Recovery or next action: what the actor can do when blocked, invalid, conflicting, or out of limit.
9. Audit and provenance: what is recorded without exposing private data, secrets, prompts, provider internals, or protected partner information.
10. Verification: how a reviewer can smoke the loop from UI, API, or both.

When the loop is missing, the orchestrator should not wait until acceptance to discover the gap. It should proactively draft the likely loop, ask the human to confirm or trim the MVP, and then either update the current task, split a technical enabler from a product-loop task, link existing tasks as parent/child, or mark the task as not product-complete until the linked loop is accepted.

Backend-only slices are still valid when they are intentionally scoped as technical enablers. They must not be presented as completed product capabilities unless their linked closed-loop task is already accepted or explicitly out of scope by human decision.

The check is bidirectional:

- When a task starts from backend, data, API, permissions, storage, AI, or infrastructure work, the orchestrator should identify the product capability, actor, surface, and scenario loop that this technical work enables. If that product loop is missing, draft it and ask the human to confirm or trim it before dispatch.
- When a task starts from UI, product surface, design, navigation, or copy, the orchestrator should identify the backing contracts: data source, backend/API, persistence, permissions, loading/empty/error states, recovery path, audit/provenance, and the realistic scenarios the UI must support. If the backing implementation is missing, link or create the technical enabler before treating the UI as product-complete.

This reciprocity is meant to protect product coherence. It should help the team build intuitive end-to-end workflows where front, backend, data, permissions, and recovery states fit together, rather than separate plausible slices that do not add up to a usable product.

## Personal Framework Orchestrator

Each participant should keep one personal Framework Orchestrator thread per active product stream or epic. This thread is not the implementation worker. It is the local control room for the participant's Codex work.

The orchestrator owns:

- the current compass, brief, and task sequence;
- links to active GitHub epic/task issues, PRs, and the shared alignment issue;
- latest Local Alignment Packet and Team Alignment Delta;
- active task threads, their titles, branches, PRs, owners, and status;
- pending decisions, missing inputs, merge events, and acceptance gates;
- the instruction to launch or resume the next task thread.

The orchestrator must not edit product code, deploy, run acceptance smoke, or merge. Its ordinary work is to read durable artifacts, update GitHub shared memory, decide whether the participant can continue safely, and create or prepare task threads for implementation.

### Task Thread Dispatch

Use a separate task thread for every implementation task that can run autonomously.

Dispatch rules:

- one task thread owns one primary task outcome;
- the thread title should be stable and scannable: `[#<issue>] <sequence> <short title>`; if the task has an epic or milestone sequence, it is required in the title, for example `[#42] 02.1 Data import access boundary`;
- the task thread receives the task issue, latest relevant Team Alignment Delta, scope, out of scope, verification expectations, current-branch smoke rule, and handoff destination;
- the orchestrator creates the thread, immediately verifies or requests its rename, sends the startup prompt, and records the task thread link/id, exact title, pending worktree, or manual-start prompt in the task issue or orchestrator state;
- if Codex thread tools or rename are unavailable, the orchestrator prepares the exact title and startup prompt for a human to create or rename manually, and marks launch as `thread title pending`;
- the task is not considered launched until the title and id/link or manual-start prompt are recorded in GitHub shared memory;
- when the task thread finishes implementation, it runs `$accept-work` inside the task thread, organizes fresh current-branch smoke when required, prepares manual merge after human smoke, includes the result in its final report, and returns that report to the orchestrator.

### Task Thread Auto-Launch And Resume

Automation should feel native, but it is not hidden background work. When the human says "continue", "launch the next task", "check the stream", or a similar short command in the orchestrator thread, the orchestrator restores durable state and chooses the action:

- if the next approved/ready task has no task thread, create it with Codex thread tools or prepare the exact manual-start prompt;
- if the task thread already exists, open or inspect it by the recorded id/link;
- if the task thread completed implementation without `$accept-work`, send it a short command to run `$accept-work` from its current task context;
- if `$accept-work` already returned `ACCEPT` or `ACCEPT_WITH_FOLLOWUPS`, check whether fresh current-branch smoke passed and merge was performed in the task thread after human confirmation, then update the sequence, DOD impact, and choose the next best action.

Dispatch is allowed only for a task with clear scope, out of scope, acceptance criteria, verification, `Codex Task Contract`, `DOD Impact`, and `Burn / Limits`. The orchestrator must not become the implementation worker.

Manual smoke and merge happen in the task thread, not in the orchestrator. If smoke or merge needs corrections, the task thread has the full implementation context and can fix the result quickly. The orchestrator only reads the outcome and decides what should happen next.

### Orchestrator Health Review

The orchestrator should pause for a short health review:

- after a milestone or large merge;
- after 3-5 accepted task slices;
- when the same follow-up repeats;
- when a task stalls, an owner drops out, or scope keeps growing;
- when accepted technical enablers are not turning into a product loop.

The health review answers:

- whether the team is moving toward the compass and DOD;
- which blockers, stale assumptions, or repeated costs appeared;
- whether scope is drifting;
- which tasks should stop, merge, be resequenced, or move to a backup owner;
- whether the brief, rules, or lessons need an update.

This is not retro for its own sake. It is a short pause to avoid continuing an expensive wrong trajectory.

### Lessons From Parallel Work

Recent parallel work showed several reusable lessons:

- shared consumer/producer contracts must be written into the task or alignment issue before implementation threads diverge;
- stacked PRs need an explicit baton: what merged, what continues next, what is paused, and what review or smoke remains;
- missing inputs such as design references or exact source links must become pending inputs, not chat-only memory;
- relevant merge events are alignment events and should trigger a short delta before dependent work continues;
- acceptance is stronger when the orchestrator verifies scope, latest alignment, handoff, and current-branch smoke before the task is treated as done;
- DOD burndown matters more than the number of closed slices: every new task should move a named epic or milestone DoD row, otherwise it stays backlog/follow-up;
- product comments during implementation need triage before tasking: distinguish current scope changes, DOD gaps, vision guardrails, and future options so the product compass improves without uncontrolled slice growth;
- burn should be checked only where there is real cost risk: AI generation, paid APIs, long agent loops, heavy smoke/build cycles, external demos, or repeated retries.

## Operating Cycle

### 0. Project Launch

Before the first task, create or open the personal Framework Orchestrator thread and run `$project-launch`.

Launch result:

- repo, task board, and durable project memory are defined;
- sync sources are named as one coordination input;
- adapter capability check is done when the team uses non-Codex or mixed harnesses;
- team onboarding is explained;
- compass, DOD, and non-goals are drafted;
- owners, backup owners, and the failover rule are named at least for the first active streams;
- first epics or questions are routed into `$start-work`.

Do not start implementation in the orchestrator thread just because the project is still small.

### 1. Project Compass

Before large work begins, define the compass:

- what product outcome matters;
- who the users or actors are;
- what full flow should eventually work;
- what already exists and must not be duplicated;
- which constraints are non-negotiable;
- what the first useful slice is.

The compass should be short. It defines direction and scale, not all details.

### 2. Epic Brief

Every meaningful epic needs a brief before implementation.

The brief should cover:

- purpose;
- current state;
- target behavior;
- scope;
- out of scope;
- dependencies;
- risks;
- owner or decision maker;
- acceptance criteria;
- expected tests or smoke checks;
- handoff expectations.

If an agent cannot understand the epic without reading a long chat thread, the brief is not good enough.

### 3. Cross-Agent Alignment

Before an epic becomes implementation work, use Codex to check how it touches other epics.

The output should be a short alignment packet:

- what this epic assumes;
- which other epics or surfaces it depends on;
- which contracts or shared concepts it may change;
- what another team's agent must know;
- what must be added to project memory before dispatch.

This packet is the practical bridge between Codex instances guided by different humans. They do not need to talk directly if they read and update the same durable artifacts.

### 4. Task Design

Each autonomous task needs enough context to be executed by a fresh agent.

Minimum task format:

```md
## Short Description

## Goal

## Read First

## Current State

## Scope

## Out Of Scope

## Contracts And Rules

## Alignment Hooks

## Codex Task Contract

## DOD Impact

## Burn / Limits

## Acceptance Criteria

## Verification

## Completion Gate

## Handoff
```

A good task says not only what to build, but also what not to break.

The `Alignment Hooks` section should state when the agent must read the latest Team Alignment Delta and when it must publish or prepare a Local Alignment Packet for material scope changes, conflicts, blockers, accepted results, or follow-up splits.

The `Codex Task Contract` section should name the orchestrator thread, task thread, alignment issue, and final completion rule: before final completion, the task thread runs `$accept-work` and reports one status: `ACCEPT`, `ACCEPT_WITH_FOLLOWUPS`, `NEEDS_FIXES`, or `BLOCKED`.

The `DOD Impact` section should briefly state which epic/milestone DoD row the task moves or closes. If a task does not move a named DoD row, the orchestrator should ask why it is not backlog or polish.

The `Burn / Limits` section should be short: `not material`, or a cap/stop condition for tasks involving AI generation, paid APIs, long agent loops, heavy verification, or demo risk. `$accept-work` checks burn only when it is material.

The `Completion Gate` section should state that the task thread must run `$accept-work` inside the task thread before final completion. The issue is not accepted or moved to Done until that result reviews the original brief, latest alignment packets/deltas, verification, current-branch smoke when required, and residual risks. If merge is needed, it is performed manually after manual smoke inside the task thread.

### 5. Dispatch

Assign one clear task to one human-agent pair.

At the human level, decide:

- owner;
- expected output;
- review owner;
- whether the task is exploratory, design-only, implementation, fix, or rollout.
- backup owner or failover condition for tasks that block others.

At the orchestration level, Codex prepares the technical dispatch details: task body, affected docs, alignment packet, suggested branch/worktree, verification expectations, and handoff requirements.

Do not let several agents edit the same unclear product surface at the same time.

### 6. Agent Run

The agent should:

- read the project instructions and task brief;
- read the latest relevant Team Alignment Delta before changing shared surfaces;
- inspect existing code/docs before proposing changes;
- state its plan when the task is non-trivial;
- keep edits scoped;
- preserve unrelated user changes;
- publish or prepare an alignment packet when a trigger event changes shared understanding;
- verify before claiming completion;
- run `$accept-work` inside the task thread before final completion;
- prepare fresh current-branch smoke and manual merge in the task thread when the task is user-facing, integration-affecting, or should land in the main branch;
- leave a handoff.

The human should not micromanage every line. The human should steer at checkpoints.

### 7. Checkpoints

Use checkpoints to catch divergence early.

Recommended checkpoints:

- after context gathering and plan;
- after cross-agent alignment changes;
- before touching shared architecture or contracts;
- after the first working slice;
- before PR;
- before deploy;
- after smoke;
- when the agent finds an unexpected conflict or hidden dependency.

Checkpoint output should answer:

- what changed;
- what was learned;
- what is risky;
- what is blocked;
- what needs a human decision;
- what will happen next.

### 8. Review

Review should prioritize:

- behavioral correctness;
- alignment with the compass;
- blast radius;
- hidden coupling;
- missing tests;
- stale downstream state;
- rollout risk;
- whether new lessons should be written down.

Avoid reviewing only the diff. Review the task against the intended flow.

Substantial tasks should use `$accept-work` as the acceptance gate. The implementation agent may summarize its own result, but acceptance should be a separate review step whenever the work changes shared contracts, user-facing behavior, data shape, or cross-epic assumptions.

After `ACCEPT` or `ACCEPT_WITH_FOLLOWUPS`, the human performs manual smoke, then manual merge in the task thread. Then it is enough to tell the orchestrator: "Check status and continue." The orchestrator finds the task issue, task thread, PR, accept-work result, and merge state from durable memory.

### 9. Handoff

Every completed task should leave a concise handoff:

```md
## Handoff

Branch:
Worktree:
PR:
Commit:

Changed files:

What changed:

Verification:

Known gaps:

Follow-up decisions:

Docs or issues updated:
```

The test is simple: another agent should be able to continue without reconstructing the whole thread.

### 10. Memory Update

When a repeated mistake, architectural decision, or product rule appears, write it into durable project memory:

- main agent instructions;
- project compass;
- epic brief;
- rules document;
- lessons document;
- issue body;
- decision log.

Meeting notes and chat history are useful inputs, but they are not sufficient project memory.

## Human Meeting Format

### Daily Product Conversation, 15-30 Minutes

Purpose: let humans discuss product meaning, trade-offs, and decisions in natural language.

Agenda:

- What is now clearer than before?
- What changed in product direction, user understanding, constraints, or priority?
- What decisions did we make?
- What are we unsure about?
- What work should move next?
- Who owns the human decision or review?

Output:

- meeting recording or transcript;
- human decisions;
- open questions;
- rough next work areas.

Humans do not need to discuss branches, worktrees, test plans, or detailed agent checklists unless those details affect a product decision.

### Post-Meeting Codex Alignment, Async

After each meaningful meeting, each participant runs the same Codex alignment workflow when they next return to work. The participant can simply say: "run the daily alignment after the latest meeting."

Codex should:

- distill decisions, changed assumptions, open questions, and affected epics;
- inspect the participant's local work and active task context;
- post or supersede that participant's Local Alignment Packet in the shared GitHub alignment issue;
- read other packets already present in the issue;
- rebuild the issue dashboard from all packets;
- publish or update the Team Alignment Delta when enough context is available;
- turn rough next work areas into ready or almost-ready tasks;
- flag conflicts, duplicated work, missing context, and risky assumptions.

The workflow is asynchronous. If other participants have not published packets yet, Codex leaves the issue in WAITING or READY_WITH_CAUTIONS and tells the human whether they can continue, continue narrowly, or should wait. When the missing participant returns later, their Codex repeats the same workflow and reconciles the newer packet against the existing journal.

### Agent Dispatch

After alignment, each team member starts or continues their own Codex from the updated artifacts. For implementation work, the personal Framework Orchestrator should launch or prepare a separate task thread rather than mixing long-running coding work into the orchestration thread.

Minimal dispatch instruction:

```text
Read the latest project instructions, meeting distillation, relevant brief, and alignment packet. Continue only within the task scope. If you find a conflict with another active epic or assumption, stop and report it before implementation.
```

Codex handles the technical checklist: branch/worktree, files, tests, smoke checks, and handoff.

### Lightweight Async Update

When useful, people share only:

- what decision is needed;
- what is blocked;
- what is ready to review;
- which artifact to read.

Technical details stay in agent handoffs unless they affect a human decision.

### Personal Framework Orchestrator Thread

Keep one standing personal Codex thread per participant per active product stream or epic. This thread lives on the framework, brief, GitHub shared memory, task sequence, daily/merge alignment, and acceptance gates. It should not become the place where large implementation work happens.

The ordinary human command can stay short:

```text
Use $framework-orchestrator to continue this stream.
Use $start-work to turn this topic into an epic and task map.
Run daily alignment after the latest meeting. Use the repo workflow.
Use $accept-work to verify whether this task can be accepted.
Launch the next task thread if the next task is ready.
```

Codex should then use the matching repo-scoped skill, follow the referenced workflow in `docs/codex-workflows`, and keep GitHub issues, briefs, deltas, task threads, and project memory aligned.

During implementation, the task thread can publish or prepare event-triggered alignment packets, but the orchestrator should decide how that packet affects the stream. Use the lightweight packet when there is meaningful coordination value, and avoid noisy updates for routine local progress.

Minimal orchestrator state:

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

## Weekly Work Format

### Weekly Product Alignment, 45-60 Minutes

Purpose: keep humans aligned on direction, not on tool mechanics.

Agenda:

- What did we learn about users, product, market, quality, or constraints?
- What changed in the compass?
- Which decisions still feel unresolved?
- What are next week's 1-3 outcomes?
- What should stop, continue, or be simplified?

Output:

- updated compass if needed;
- priorities and non-goals;
- decisions for Codex to turn into artifacts;
- open questions for research or design.

### Weekly Codex Orchestration Review, 20-30 Minutes

Purpose: let Codex audit the project mechanics so humans do not have to discuss them manually.

Codex should inspect:

- active branches;
- dirty worktrees;
- stale local servers;
- untracked files;
- PRs waiting for review;
- stale tasks or briefs;
- meeting decisions not converted into work artifacts;
- experiments that should be merged, split, isolated, or archived.

Output:

- short human summary;
- cleanup recommendations;
- risks that require a human decision;
- task/doc updates Codex can perform after approval.

### Weekly Lessons Review, 20 Minutes

Purpose: convert pain into process.

For each costly moment, write:

- what happened;
- why it was expensive;
- early signal we missed;
- new rule or checklist item;
- where the rule now lives.

If a lesson is not written down, assume it will be repeated.

### Orchestrator Health Review, 15-25 Minutes

Purpose: detect when the team is stalled, drifting in scope, or producing slices without DOD progress.

Codex checks:

- progress toward the compass and nearest DOD;
- tasks accepted, waiting, blocked, or stale;
- repeated follow-ups and burn;
- product loop gaps between UI, backend, data, permissions, and scenarios;
- owners, backup owners, and dropout risk;
- what should stop, merge, be resequenced, or move into `$start-work`.

The result is a short next best action, not a long report.

## Monthly Or Per-Epic Rituals

### Epic Kickoff

Before a large epic:

- write the epic brief;
- identify shared contracts;
- define first slice;
- define out-of-scope;
- ask Codex to draft the alignment packet and task breakdown;
- review the proposed risks and open questions.

### Epic Closeout

After an epic:

- compare outcome to compass;
- list shipped artifacts;
- list missed assumptions;
- document follow-up tasks;
- archive stale experiments;
- update rules or lessons.

## Rules

### Context Rules

- No large task without a compass.
- No autonomous implementation without an epic brief or task brief.
- Do not rely on chat history as the only source of truth.
- Keep project memory in the repository.
- When context changes, update the task or brief before continuing.
- Treat product comments inside an active epic as compass notes until triaged as a confirmed scope change, DOD gap, vision guardrail, or future option.

### Task Rules

- One task should have one primary outcome.
- State out-of-scope explicitly.
- State what existing behavior must remain valid.
- State expected verification before the agent starts.
- Split tasks when they mix product design, architecture, implementation, and rollout without a clear boundary.

### Agent Rules

- Read instructions and task docs first.
- Inspect the existing system before editing.
- Use Codex for brief drafting and consistency review before large implementation work.
- Use a personal Framework Orchestrator thread to keep brief, sequence, alignment state, task threads, and acceptance gates connected.
- Do not do large implementation work inside the orchestrator thread; dispatch it to a task thread with a clear title and startup prompt.
- Name task threads consistently: `[#<issue>] <sequence> <short title>` when an issue id or sequence is available.
- Prefer existing patterns over new abstractions.
- Keep edits scoped.
- Preserve unrelated dirty work.
- Stop for a checkpoint when touching shared contracts or when assumptions change.
- Verify before claiming completion.

### Orchestration Rules

- The orchestrator must read the latest durable state before recommending the next action: framework, brief, relevant GitHub issues/PRs, latest Team Alignment Delta, and active task handoffs.
- The orchestrator thread is for organization only. It must not implement, fix product code, deploy, run acceptance smoke, or merge.
- The orchestrator may create or prepare a new task thread only when the task is approved or ready enough to have a clear scope, out of scope, acceptance criteria, verification expectation, `DOD Impact`, and `Burn / Limits`.
- The task thread name must include the issue id and sequence when they exist, so humans and Codex can map the sidebar to the brief/GitHub without opening the issue.
- The orchestrator must verify task thread rename and record exact title, active task thread links/ids, pending worktree, or manual-start prompt in GitHub shared memory when available.
- The task thread is not considered launched until title and id/link or manual-start prompt are recorded.
- On a short continuation command, the orchestrator launches or resumes the next ready task thread itself; if a task thread finished without `$accept-work`, the orchestrator sends it the `$accept-work` command.
- If a task thread is accepted but smoke or merge is not done yet, the orchestrator sends the human back to the task thread. Merge and corrective fixes do not happen in the orchestrator.
- When the human adds product vision or future-state commentary during implementation, the orchestrator must run Product Compass Note Triage before adding scope, creating follow-ups, or changing task order.
- After a daily, meaningful meeting, merge, blocked event, accepted result, or follow-up split, the orchestrator must run or route to `$daily-alignment` before dependent work continues.
- After a task thread reports completion, the orchestrator must check whether the task thread already ran `$accept-work`. If not, it sends that command back to the task thread. If yes, it uses the result to choose the next best action.
- Each substantial task must include `DOD Impact`; a new slice is allowed only if it moves a named epic/milestone DoD or is explicitly accepted as an exception.
- `Burn / Limits` is required for tasks with material cost/retry/generation risk and may be `not material` for ordinary tasks.
- If shared packets are missing, the orchestrator should return `continue with cautions`, `wait`, or `blocked` rather than inventing another participant's local state.
- The orchestrator should run a health review after a milestone/large merge, after 3-5 accepted slices, or when follow-ups repeat, a task stalls, scope grows, or an owner drops out.

### Git And Environment Rules

- Codex should manage branch/worktree and local runtime details as part of technical orchestration.
- Humans should discuss these details only when they affect product risk, rollout risk, or another person's work.
- Experiments must be isolated until a human approves their product direction.
- Before PR, Codex should summarize changed files, blast radius, and verification in human language.

### Review Rules

- Review against the product flow, not only the diff.
- Review whether the work is consistent with other active epics.
- Check for hidden downstream effects.
- Check whether state can become stale.
- Check whether the next agent can understand the handoff.
- If the same issue appears twice, turn it into a rule.

### Verification Rules

- Tests prove only what they cover.
- Browser or product smoke is required for user-facing behavior when feasible.
- At task completion, Codex must arrange a fresh smoke pass on the exact current branch/worktree being accepted. It must not rely on old local servers, old browser tabs, or frontend/backend processes started from another branch.
- Before smoke, Codex must confirm the branch/worktree identity, start or restart the required backend and frontend from that same worktree, and record what commit or local state was tested.
- Manual smoke and merge happen in the task thread after `$accept-work`, because only the task thread has the full implementation context for quick fixes.
- If a verification step is skipped, state why.
- Do not claim completion without fresh verification.
- Do not trust generated artifacts without checking that they are meaningful, current, and traceable.

### Memory Rules

- Every durable product decision must live outside chat.
- Meeting transcripts are raw inputs, not project memory, until Codex distills them and humans approve the result.
- Every cross-epic assumption must be written where other agents can see it.
- Every repeated trap must become a rule, checklist item, or documented lesson.
- Every epic should leave enough memory for a new agent to continue.
- Handoff is part of the work, not an afterthought.

## Minimal Templates

### Project Operating Brief

```md
# Project Operating Brief

Project:
Repo:
Source of truth:

Coordination sources:
- meetings / recordings / transcripts:
- team chat:
- docs / notes:

Team:
- <person> | role | availability | owner/backup notes

Decision owner:

Compass:

Milestone DOD:
- <row>

Non-goals:

Privacy constraints:

Harness adapter:
- Codex reference implementation | other harness:
- Separate task context mechanism:
- Context id/link:
- Shared memory:
- Verification/smoke mechanism:

First route:
- $start-work | $daily-alignment | $framework-orchestrator | needs decision
```

### Meeting-To-Codex Prompt

```md
# Meeting-To-Codex Orchestration

Use this framework to process the meeting transcript.

Input:
- meeting recording/transcript:
- current compass or brief:
- active epics/tasks:

Produce:
1. decisions made;
2. changed assumptions;
3. affected epics/tasks;
4. cross-agent alignment risks;
5. open questions;
6. docs/issues/briefs to update;
7. ready or almost-ready tasks;
8. what each team member's Codex should read next;
9. what needs human approval before dispatch.
```

### Daily Human Note

```md
# Daily Human Note

Date:
Main decision or shift:

Open questions:

Next work areas:

Needs Codex distillation:
```

### Weekly Human Note

```md
# Weekly Human Note

Week:

What we learned:

Compass changes:

Decisions made:

Next outcomes:

Open questions:

Needs Codex orchestration:
```

### Agent Task Handoff

```md
# Agent Task Handoff

Task:
Owner:
Branch / worktree:
PR / commit:

Changed:

Verified:

Not verified:

Risks:

Next:

Docs updated:
```

### Task Thread Startup Prompt

```md
# Task Thread Startup

Thread title:
Task issue:
Owner:
Backup owner / failover:
Orchestrator thread:
Alignment issue:
Task thread launch state:
Latest Team Alignment Delta:
DOD impact:
Burn / Limits:

Read first:
- AGENTS.md
- collaboration framework
- task issue
- latest relevant Team Alignment Delta
- related brief or design doc

Scope:

Out of scope:

Acceptance criteria:

Verification:
- include current-branch smoke when user-facing or integration-affecting

Completion gate:
- before final completion, run $accept-work inside this task thread
- for user-facing or integration-affecting work, organize fresh current-branch smoke from this worktree
- if merge is needed, perform manual merge from this task thread after manual smoke and human confirmation
- include the acceptance status in the final report

Handoff back to orchestrator:
- branch/worktree
- PR/commit
- accept-work status
- DOD impact result
- burn check
- changed surfaces
- verification
- open risks
- whether an event-triggered alignment packet is needed
- recommended orchestrator next action
```

### Alignment Packet

```md
# Alignment Packet

Epic / task:
Owner:

Assumptions:

Depends on:

May affect:

Shared contracts or concepts:

Other agents must know:

Docs/issues to update before dispatch:
```

### Meeting Distillation

```md
# Meeting Distillation

Meeting:
Date:
Transcript / recording:

Decisions:

Changed assumptions:

Affected epics / tasks:

Alignment risks:

Open questions:

Docs / issues / briefs to update:

Approved by:
```
