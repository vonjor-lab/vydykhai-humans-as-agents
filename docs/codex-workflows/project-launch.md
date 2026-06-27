# Project Launch Workflow

Use this repo-local workflow when a team starts a new project, imports the framework into an existing project, or reconnects a project that has no reliable operating memory yet.

Goal: create the minimum shared operating system before implementation starts: repo, sources, team, orchestrator discipline, compass, DOD, and first planning path.

## Inputs To Read

1. Human project description, existing brief, meeting notes, transcript, or chat summary.
2. Target repository and current `AGENTS.md` or project instructions when available.
3. Existing GitHub issues, PRs, docs, or task board when available.
4. Team members, decision owners, and expected availability.
5. Coordination sources: meetings, recordings, transcripts, dedicated chat, docs, notes, or manual summaries.
6. Agent harnesses the team plans to use: Codex, Claude Code, Cursor, Windsurf/Devin Desktop, GitHub Copilot cloud agent, Gemini CLI, or another tool.

## Steps

### 1. Create The Project Operating Brief

Draft a compact brief:

- project name and target repo;
- framework upstream and local framework copy path, if the framework is imported into the repo;
- source of truth for issues, PRs, briefs, decisions, and docs;
- coordination sources used for syncs;
- who can read and approve those sources;
- team members, roles, decision owner, owner/backup owner convention;
- branch/merge policy at the level humans need to know;
- privacy constraints and what must not be pasted into durable memory.

Treat meetings, recordings, transcripts, and team chats as one coordination input layer. They are raw inputs until Codex distills them and a human approves the resulting artifact.

The standalone framework repo is the canonical source for universal framework rules. Product-local copies are execution mirrors. If the project needs a local rule, keep it in the project `AGENTS.md`, project docs, or runbooks rather than silently changing the universal framework copy.

### 2. Onboard The Team

Explain the working model in plain language:

- each participant keeps a personal Framework Orchestrator thread for the project or product stream;
- the orchestrator thread organizes work only: no coding, fixing, deploying, smoke testing, or merging there;
- implementation happens in separate task threads launched or prepared by the orchestrator;
- task threads run `$accept-work`, organize fresh current-branch smoke when required, and handle manual merge after human smoke;
- after a meeting or when returning to work, the participant can use short commands such as "run daily alignment" or "continue the stream".

### 3. Establish Compass And DOD

Draft:

- product outcome;
- users or actors;
- first useful flow or slice;
- non-goals;
- constraints;
- DOD rows for the first milestone;
- risks or open decisions.

If the goal is still vague, route to `$start-work` before creating implementation tasks.

### 4. Check Harness Adapter

Codex is the reference implementation. If the team uses another harness, or a mixed setup, verify the adapter before implementation:

- where repo instructions live;
- what replaces a Codex task thread: thread, session, subagent, cloud agent, worktree run, PR, or issue-run;
- how that context is named, linked, resumed, and recorded;
- whether it can update GitHub issues/PRs or another source of truth;
- whether it can run verification and fresh current-branch smoke, or must hand that to a human;
- where handoff and `$accept-work` equivalent results are written.

If no resumable task context exists, use GitHub issue/PR links as the coordination handle and make the orchestrator/task split a team rule.

### 5. Prepare GitHub Shared Memory

After human approval, create or update:

- project/epic issue or operating brief issue;
- alignment issue for the first meeting or work window;
- initial task board labels or milestones if the repo uses them;
- links from the operating brief to docs, meeting sources, team chat, and current tasks.
- framework sync note: upstream repo, local copied paths, last sync point when known, and where project-specific rules live.

Do not paste raw transcripts, secrets, customer data, private prompts, or proprietary context into public or broadly shared artifacts.

### 6. Route First Work

Choose the next path:

- `$start-work` when the team needs an epic brief, task map, or decomposition;
- `$daily-alignment` when recent meeting or chat inputs must be reconciled first;
- `$framework-orchestrator` when a ready task already exists and should be launched in a task thread;
- `needs decision` when ownership, source of truth, access, or DOD is unclear.

### 7. Tell The Human The Launch State

End with:

- whether the project can start;
- where the Project Operating Brief lives;
- framework upstream, local copied paths, and project-specific rule location when the framework is imported;
- coordination sources and source of truth;
- harness adapter status;
- team onboarding summary;
- first DOD rows;
- first recommended next action;
- what is missing, if anything.

Use one status:

- `READY_FOR_START_WORK`;
- `READY_FOR_ORCHESTRATOR`;
- `NEEDS_DECISION`;
- `BLOCKED_BY_ACCESS`.
