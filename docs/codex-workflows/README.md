# Codex Workflows

This folder contains reference workflows for repo-local Codex collaboration. Repo-scoped skills live under `.agents/skills` and point Codex here.

Canonical framework changes belong in the standalone upstream repository first. Product repositories may copy this folder for execution, but those copies are mirrors; keep product-specific rules in product-local docs or `AGENTS.md`.

Use repo-scoped skills for this project before creating global `$CODEX_HOME/skills` entries. Global skills are useful for cross-repo reuse, but they require local installation and can drift between participants. Repo skills are available to everyone after pulling the repository and starting a new Codex session from inside it.

## Available Workflows

- `project-launch.md`: start a new project or import the framework into an existing repo by defining the operating brief, coordination sources, team onboarding, compass, DOD, and first route into planning or orchestration.
- `framework-orchestrator.md`: keep a personal Codex orchestrator thread aligned with the brief, GitHub shared memory, task sequence, task threads, DOD impact, burn checks, merge events, and acceptance gates.
- `start-work.md`: turn a large idea, meeting outcome, or re-brief signal into an epic brief and task map.
- `daily-alignment.md`: run after a meeting or before resuming work; publishes a Local Alignment Packet, reads other packets, and updates the Team Alignment Delta.
- `accept-work.md`: accept a task, PR, milestone, or epic against the original brief and alignment history.
- `local-alignment-packet.md`: comment format for each participant's local state and meeting impact.
- `team-alignment-delta.md`: comment format for the shared status after reading packets.
- `brief-patch-template.md`: compact format for small approved changes to an epic or task brief.
- `alignment-issue-template.md`: GitHub issue body used as the rebuildable dashboard.
- `task-thread-handoff-template.md`: startup prompt and handoff contract for implementation task threads launched by the orchestrator.

## Human Trigger

In a standing Codex thread, the human command can stay short:

```text
Use $project-launch to set up this project with the framework.
Use $framework-orchestrator to continue this product stream.
Use $start-work to turn this topic into an epic and task map.
Run daily alignment after the latest meeting.
Use $accept-work to verify whether this task can be accepted.
Launch the next task thread if the next task is ready.
Check DOD burndown and continue with the next best action.
Check the product loop: backend tasks need the linked user/operator workflow; UI tasks need backing backend/data/permissions/scenarios.
Run compass calibration before launching this ambiguous task.
Launch a research thread first if the source of truth or foundation is unclear.
Check runtime coherence before accepting this smoke.
```

or:

```text
Запусти этот проект через $project-launch.
Продолжи этот поток через $framework-orchestrator.
Запусти большую тему по итогам встречи.
Сделай daily alignment после последней встречи.
Прими эту задачу с учетом brief и alignment history.
Запусти следующий task thread, если следующая задача готова.
Проверь DOD-burndown и продолжи следующим лучшим действием.
Проверь product loop: у backend-задач должен быть связанный пользовательский/операторский workflow, у UI-задач - backing backend/data/permissions/scenarios.
Проведи compass calibration перед запуском этой неоднозначной задачи.
Сначала запусти research thread, если непонятны source of truth или foundation.
Проверь runtime coherence перед приемкой этого smoke.
```
