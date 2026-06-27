# Codex Collaboration Framework

Private standalone repository for a team operating framework for collaborative AI-assisted product development.

The framework is designed for teams where several people and several Codex instances work asynchronously on the same product and need a shared operating model, durable memory, task orchestration, acceptance gates, and product-loop control.

## Start Here

- Russian framework: `docs/COLLABORATION_FRAMEWORK_RU_2026-06-10.md`
- English framework: `docs/COLLABORATION_FRAMEWORK_2026-06-10.md`
- Changelog: `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`
- Workflow index: `docs/codex-workflows/README.md`
- Repo-scoped skills: `.agents/skills`

## Core Ideas

- One personal Framework Orchestrator thread per participant and product stream.
- Separate implementation task threads for focused work.
- Daily and event-triggered alignment through durable shared memory.
- `$start-work` for shaping large topics into epics and task maps.
- `$daily-alignment` for meeting and event alignment.
- `$accept-work` for acceptance against brief, alignment history, verification, product loop, and DOD.
- Product Capability Closed Loop: backend/API/data work must link to the user/operator workflow it enables; UI/product-surface work must link to backing backend/data/permissions/scenarios.

## Privacy

This repository intentionally contains the reusable framework and workflow mechanics only. Do not add private product data, meeting transcripts, credentials, customer information, proprietary prompts, or project-specific implementation details unless the repository's sharing model is explicitly changed.

No open-source license is included yet. Treat the contents as private unless the owner decides otherwise.
