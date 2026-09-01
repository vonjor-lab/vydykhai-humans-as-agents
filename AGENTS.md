# AGENTS.md

## Purpose

This repository is the canonical source for the universal Vydykhai team-autopilot framework. Keep it concise, reusable, safe to publish, and independent of any product repository or private thread.

## Maintenance Rules

- Treat `vydykhai.json` as the machine-readable version and managed-path manifest.
- Keep `docs/FRAMEWORK.md` and `docs/FRAMEWORK_RU.md` aligned in meaning and version.
- Record conceptual changes in `docs/COLLABORATION_FRAMEWORK_CHANGELOG.md`.
- Keep the dated framework files as compatibility pointers only. Preserve detailed historical material through Git tags instead of duplicating it in the active tree.
- Keep `.agents/skills` concise and environment-neutral. `SKILL.md` owns behavior; files such as `agents/openai.yaml` are optional interface adapters.
- Keep `docs/AGENTS_CORE.md`, skill contracts, and workflows behaviorally aligned.
- Keep `BOOTSTRAP.md` as the agent-owned installation contract. Human-facing setup should remain one natural-language request, not a list of shell commands.
- Keep `doctor` limited to installed-kit integrity. Live repo/tracker permissions, participant self-readiness, coordination inputs, first-DOD operations, compass, and control-loop proof belong to the evidence-backed `$project-launch` receipt; never let one machine certify another. Framework-update activation must additionally read back the active orchestrator's own cwd, accepted HEAD, live/offline doctor, updated core, title, and Project State; a maintenance or verification worktree proves only the Candidate.
- Route reasoning by role on the latest available flagship: maximum available for the persistent orchestrator, deep bounded for solution discovery, and efficient bounded for execution. Map these to `Ultra / XHigh / Low` only where those labels exist; record the nearest fallback and never pin a vendor model id. Keep `defaultAgentProfile` only for older updater compatibility; `agentRoutingPolicy` is authoritative.
- Product-local copies are execution mirrors. Universal changes land here first, then product repos update through `scripts/vydykhai.mjs`.
- This maintenance context is not a project orchestrator. Publish universal releases, but do not install them into product repositories or start, inspect, rename, rotate, or steer project orchestrators from here. Never request or consume a project's task Return Sync, Project State, backlog, private links, or next-best-action. A project lesson enters this repository only after an explicit separate review as a sanitized universal compatibility case.
- Treat `LICENSE.md`, `NOTICE.md`, `CITATION.cff`, and `docs/PROVENANCE.md` as ownership records. Do not change the creator, license, required notice, or provenance claims without the creator's explicit approval.
- Do not merge substantive external contributions until the contributor agreement described in `CONTRIBUTING.md` has been executed.
- Product-specific rules stay outside framework-managed files in the target repo.
- Do not add product names, customer data, meeting transcripts, credentials, proprietary prompts, internal thread ids, or implementation details from another repository.
- Prefer deleting duplication over adding another rule or skill.
- The Framework Orchestrator is the control plane: what/why/when/who and what changed. Task contexts are the execution plane: how to implement and prove one accepted increment, including corrective fixes, `$accept-work`, exact-current-code smoke, and manual merge after human confirmation. Tasks detect wider boundaries; the orchestrator decides the project response.
- Preserve source precedence, explicit human checkpoints, asynchronous participant visibility, dashboard freshness, Work Hygiene Check, monitor cleanup, and orchestrator rotation.
- Treat orchestrator rotation as a memory migration: previous packet, independent candidate coverage, visible delta, human-confirmed switch, and retained history context.
- Treat Project Memory Graph as one compact active semantic/decision memory: stable anchors, atomic nodes, typed relations, executable retrieval, Memory Miss reflection, and independent regression scenarios. Project State is working memory; comments and task history are evidence; task briefs are working capsules. Existing Idea Memory and Intent Trail are migration inputs. Preserve open recall commitments and prove their concrete meaning, source, return condition, and human gate through ordinary future-work queries; old-id mapping alone is insufficient. Migrate through a side-by-side candidate and human-confirmed cutover, and never copy secret values from protected systems or private runbooks.
- Run `node scripts/validate-framework.mjs` and `node --test tests/*.test.mjs` before committing.
- Run `git diff --check` before committing documentation changes.

## Repo Skills

- `.agents/skills/project-launch/SKILL.md`
- `.agents/skills/framework-orchestrator/SKILL.md`
- `.agents/skills/start-work/SKILL.md`
- `.agents/skills/daily-alignment/SKILL.md`
- `.agents/skills/accept-work/SKILL.md`
