---
name: start-work
description: Use when the user wants to start a large topic, shape an idea into an epic, plan a major feature, turn meeting outcomes into an epic, create a task map, or decide what should happen first.
---

# Start Work

Turn a large product or engineering topic into an agreed epic and task map.

## Required References

Read these files before acting:

1. `AGENTS.md`
2. `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
3. `docs/codex-workflows/start-work.md`

Load `docs/codex-workflows/daily-alignment.md` when the topic comes from recent meeting alignment or re-briefing.

## Operating Contract

- Start from product intent, not implementation mechanics.
- Restore context from meetings, docs, issues, PRs, and current repo state before proposing an epic.
- Produce an epic brief, affected entities, dependency map, task concepts, sequencing, and proposed ownership.
- Classify task concepts by type (`product capability`, `technical enabler`, `maintenance`, `research/spike`, or `future option`) before tasking.
- For product capabilities, define the closed user/operator loop before creating tasks; for technical enablers, link the task to the capability or later task that closes the loop; for UI/product-surface work, identify backing backend/API/data/persistence/permission contracts and realistic states.
- Ask for human approval before creating or updating GitHub issues.
- Keep tasks sized for autonomous Codex execution with clear acceptance and verification.
- Include a compact `Codex Task Contract` in implementation task issues so task threads know their deterministic thread title, `DOD Impact`, task type / Product Capability Loop, `Burn / Limits`, and requirement to run `$accept-work` before final completion.
- Include owner/backup or failover condition for blocking tasks.
- State that fresh current-branch smoke when required and manual merge after human smoke happen inside the task thread, not the orchestrator thread.
- Return approved task sequence to the Framework Orchestrator so implementation can happen in separate task threads.
- If the topic is too large or ambiguous, decompose it before writing tasks.

## User-Facing Outcome

End with one of:

- ready for approval: epic brief and task map are coherent;
- needs decision: named product or scope decision is missing;
- needs split: topic must be decomposed before planning.
