# Vydykhai: Collaborative Vibe Coding with Humans as Agents

«Выдыхай» - это фреймворк для совместного вайбкодинга, где люди определяют цель и работают как агенты, а AI-оркестратор разворачивает вокруг операционную систему и координирует next-best-action каждого участника.

Оркестратор помогает брейнстормить идею до продуманной концепции, определить эпики, описать задачи, скоординировать совместную работу людей, чтобы они "не наступали друг другу на ноги" работая в одном проекте с отдельных машин.

Vydykhai is a framework for collaborative vibe coding with humans as agents: people carry meaning and direction, while an AI orchestrator helps turn a raw goal into a compass, briefs, tasks, alignment, acceptance, and next-best-action.

The orchestrator helps brainstorm the idea, shape the product compass, write briefs, split epics into tasks, coordinate people and agents, run alignment, accept work, and keep the next-best-action visible when the team has uneven context, time, or confidence.

This repo contains the current Codex-first reference implementation. The same operating model can be adapted to other agent harnesses when they provide equivalent task contexts, shared memory, verification, and handoff mechanics.

Техническое ядро текущей версии отлажено на Codex. Другие harnesses могут использовать ее через adapter mapping: отдельный task context, общий source of truth, проверка результата и видимый handoff.

## Start Here

- Russian framework: `docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md`
- English framework: `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
- Changelog: `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`
- Workflow index: `docs/codex-workflows/README.md`
- Repo-scoped skills: `.agents/skills`

## Canonical Source

This repository is the canonical source for Vydykhai framework rules, docs, workflows, and repo-scoped skills.

Target product repositories may keep local copies so Codex can run the framework inside that project. Treat those copies as execution mirrors: universal framework changes should land here first, then be synced into product repos. Product-specific rules belong in the target repo's `AGENTS.md`, project docs, or local runbooks.

## Add The Framework To Your Project

Repo-scoped skills do not activate from a link to this repository. They activate when the framework kit is present inside the target repository and a new Codex session starts from that target repository.

Recommended import:

1. Copy these paths into the target repo:
   - `.agents/skills`
   - `docs/codex-workflows`
   - `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
   - `docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md`
   - `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`
2. Add the core rules from this repo's `AGENTS.md` into the target repo's `AGENTS.md`. If the target already has `AGENTS.md`, append the framework rules instead of replacing project-specific instructions.
3. Record this repository as the framework upstream for future syncs.
4. Keep project-specific rules in the target repo's own `AGENTS.md`, project docs, or local runbooks instead of changing the universal framework copy silently.
5. Commit and pull the changes on each teammate's machine.
6. Start a new Codex thread from inside the target repo.
7. In the first orchestrator thread, run:

```text
Use $project-launch to set up this project with Vydykhai: Collaborative Vibe Coding with Humans as Agents.
```

External users need GitHub access to the target repo and permission to read/create issues and PRs if Codex should update shared memory. Meeting recorders or Telegram/Slack/Teams chats are optional coordination sources; if no connector exists, paste approved summaries or transcripts manually.

## Using Another Agent Harness

The framework is Codex-first in implementation, not Codex-only in concept. The repo-scoped skills, thread naming, and orchestrator/task-thread handoff are guaranteed only in Codex.

For Claude Code, Cursor, Windsurf/Devin Desktop, GitHub Copilot cloud agent, Gemini CLI, or another harness, use the same operating model only after mapping these capabilities:

- project instructions in the repo;
- separate task context: thread, session, subagent, cloud agent, worktree run, PR, or issue-run;
- stable context id/link that can be recorded in GitHub;
- shared memory through GitHub issues/PRs or an equivalent tracker;
- verification and fresh-branch smoke path;
- handoff and acceptance result visible to the next participant.

If a tool cannot create resumable task threads, use GitHub issue/PR links as the coordination handle and keep the orchestration/implementation split as a human convention.

## Core Ideas

- Start from a goal, not from a perfect spec.
- The human holds the compass: meaning, direction, decisions, and risk.
- The orchestrator helps research, brainstorm, brief, split, sync, accept, recover the work, and keep the next-best-action visible.
- One personal Framework Orchestrator thread per participant and product stream.
- Separate implementation task threads for focused work.
- `$project-launch` for setting up a repo, team, coordination sources, onboarding, compass, DOD, and first planning route.
- Daily and event-triggered alignment through durable shared memory.
- `$start-work` for shaping large topics into epics and task maps.
- `$daily-alignment` for meeting and event alignment.
- `$accept-work` for acceptance against brief, alignment history, verification, product loop, and DOD.
- The orchestrator thread organizes work only; implementation, acceptance smoke, and merge stay in task threads.
- Product Capability Closed Loop: backend/API/data work must link to the user/operator workflow it enables; UI/product-surface work must link to backing backend/data/permissions/scenarios.

## Privacy

This repository intentionally contains the reusable framework and workflow mechanics only. Do not add private product data, meeting transcripts, credentials, customer information, proprietary prompts, or project-specific implementation details unless the repository's sharing model is explicitly changed.

No open-source license is included yet. Treat the contents as private unless the owner decides otherwise.
