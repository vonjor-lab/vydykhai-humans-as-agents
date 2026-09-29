# Framework Decision Comparison: First Batch

Date: 2026-09-29. Status: C01-C04 COMPLETE; C05-C08 NOT_RUN. Maintainer evidence, not an installed workflow or release authorization.

Historical snapshot: the separately authorized second batch is now covered by the [complete-screen report](framework-behavior-2026-09-29-full.md). Measurements and rubric scores remain unchanged. Budget correction, 2026-09-29: the later [executable pilot](module-transition-2026-09-29.md#budget-correction) disproved enforcement of the stated combined-token metric. Aggregate overages cannot be certified as final-response-only; historical `protocolValid` fields do not certify token-budget compliance.

The simplified candidate used less input and less observed attempt time while receiving the same passing assessment as the published rules on these four synthetic cases. This supports keeping the candidate. It does not prove improved decision reliability, subscription savings or a working production loop.

## Method

- Baseline: published `v1.32.8`, commit `72086069e853e785392d8ec722b03a4b1bacba75`. Candidate: the frozen unpublished simplified instruction bundle.
- [Frozen cases and protocol](../../tests/fixtures/framework-behavior/README.md): SHA-256 `53b4569f95da9c5761b82c67f64c982635529144c9f2dc7c1da086a3bf2f4eb4`. No case, criterion or participant instruction changed during the comparison.
- Eight fresh native CLI attempts, requested model `gpt-6-astra`, effort `low`, CLI `0.158.0-alpha.2.1`, existing ChatGPT login. One attempt per case and arm; order alternated by pair. Adapter, runner and normalized runtime settings matched across all eight receipts. No retries or extra judges.
- Each attempt could read its scenario and relevant framework instructions, but not the private rubric or other trials. External skills, delegation, plugins and apps were disabled; command permissions were minimal read-only. All observed commands were local instruction/scenario reads or searches, not product operations.
- User-approved bounds: 120 seconds per attempt, 350 final-answer words, 80,000 combined input/output tokens checked between responses, allowing final-response overshoot. Native enforcement of that token metric was not established. All attempts completed within 50 seconds and 313 words. Baseline C02 and C04 ended at 86,249 and 86,404 combined tokens; their per-response compliance is UNKNOWN and all usage remains included.
- The maintainer reviewed decisions against the frozen rubric after each pair, with prior knowledge of variants. This was not independent blind judging. Every scored claim has exact response quotes and scenario source ids, mechanically checked against saved answers. C02's raw-input gap is recognized semantically; neither answer repeats the prepared partition-array noun verbatim.

## Results

Totals compare the same four cases. Input includes cached input; uncached input is input minus cached. Output already includes its reported reasoning subset.

| Measure | Published baseline | Simplified candidate | Observed reduction |
| --- | ---: | ---: | ---: |
| Rubric checks passed | 12/12 | 12/12 | Quality tie |
| Input tokens | 292,160 | 187,430 | 35.8% |
| Cached input tokens | 187,392 | 125,824 | Not a separate savings claim |
| Uncached input tokens | 104,768 | 61,606 | 41.2% |
| Output tokens | 2,886 | 2,677 | 7.2% |
| Sum of attempt elapsed time | 160.108 s | 131.564 s | 17.8% |
| Completed shell read/search calls | 16 | 11 | 31.3% |

| Case | Passing checks, baseline/candidate | Input, baseline/candidate | Output, baseline/candidate | Seconds, baseline/candidate | Reads, baseline/candidate |
| --- | --- | --- | --- | --- | --- |
| C01: public-only module connection | 3/3 and 3/3 | 60,795 / 21,281 | 729 / 506 | 35.033 / 24.288 | 3 / 1 |
| C02: assisted Lab output is not a ready module | 3/3 and 3/3 | 85,448 / 72,037 | 801 / 752 | 49.261 / 42.461 | 4 / 4 |
| C03: continue an authorized local repair | 3/3 and 3/3 | 60,176 / 21,207 | 693 / 541 | 34.489 / 24.329 | 4 / 1 |
| C04: route unresolved design to Discovery | 3/3 and 3/3 | 85,741 / 72,905 | 663 / 878 | 41.325 / 40.486 | 5 / 5 |

Both arms preserved module boundaries and accepted results, rejected assisted Lab output as whole-module proof, continued ordinary local fixes without another approval, and routed unresolved design to authorized High-profile Discovery with a human decision before implementation. No critical unsafe decision, unnecessary stop or unsupported execution claim was found in these answers.

The largest observed reduction came from ordinary continuation: the candidate needed only the scenario read, while the baseline additionally read acceptance/routing procedures. Organizational cases still read several workflows. In C04, elapsed time barely changed and candidate output was longer. This is not evidence that every kind of work becomes proportionally cheaper.

## Cost And Evidence Limits

The experiment used 479,590 input tokens, including 313,216 cached, plus 5,563 output tokens. Sum of attempt time was 291.672 seconds. The first attempt began at 12:27:08 UTC and the last ended at 12:36:35 UTC; the approximately 9.5-minute collection window includes pauses for review between attempts. Neither figure is the whole framework-development cost.

Attempt usage includes native instructions and internal tool turns, not just final answers. Eight attempts do not mean eight single inference requests. Maintainer preparation, local-runner debugging and review token cost are UNKNOWN and excluded from these totals. No account-wide quota delta or monetary proxy was used. Subscription allowance savings therefore remain UNKNOWN.

There is one sample per case/arm, no confidence interval and no independent judge. Cache history, run order and service latency can affect measurements. Product work was not paused to isolate them. All relevant scenario facts were supplied; successful retrieval of forgotten project history was not tested. This replay predicts next decisions; it does not observe their implementation, Return delivery, recovery or continuing control of a real project.

[Machine-readable evidence](framework-behavior-2026-09-29.json) retains answers, quotes, source ids, hashes, timestamps, usage and explicit NOT_RUN cases. Raw CLI transcripts, runner settings, approval receipt, native preflight and the post-comparison TAP log remain in the external staged evaluation archive. Response digests and quotes were checked before publishing this report. The unchanged candidate passed all 315 local tests, framework validation and whitespace checks; those are separate from the model assessment.

## Decision And Next Gate

Keep the frozen candidate; do not add more runtime rules to explain an all-pass tie. The measured benefit is lower decision-context overhead in this screen, not newly proven production reliability. Evaluation files add no installed roles, agents or recurring controls.

Next, separately authorize the remaining four pairs: durable Return recovery, duplicate Guard signal during human wait, due mapping/module preparation after update, and direct human control of a Lab. Then run the project-owned isolated module-transition and two public-only reuse checks. Do not repeat completed cases, expand the budget or claim a release-ready whole loop from this first batch. No merge, release, project installation, product refactoring or deployment was performed.
