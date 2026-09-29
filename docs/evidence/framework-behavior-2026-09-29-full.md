# Framework Decision Comparison: Complete Screen

Date: 2026-09-29. Status: C01-C08 COMPLETE, 16/16 attempts reviewed. Maintainer evidence, not an installed workflow, product-adoption receipt or release authorization. The [first-batch report](framework-behavior-2026-09-29.md) remains a historical snapshot.

The simplified candidate passed the same 24 criteria as the published rules with 27.6% less input and 11.1% less summed attempt time across eight synthetic cases. This supports retaining the simplification. It does not prove better decision reliability, lower subscription allowance use or successful end-to-end delivery. The baseline also passed every case: this screen did not reproduce the reported live failures.

Budget correction, 2026-09-29: the later [executable pilot](module-transition-2026-09-29.md#budget-correction) demonstrated that the native threshold is not a gross input/output token limit. The earlier claim of enforced combined-token bounds is withdrawn. Raw usage, responses and rubric scores are unchanged; per-response compliance is not established, and aggregate overages cannot be certified as final-response-only. Historical `protocolValid` fields in the evidence do not certify this budget property.

## Method And Integrity

- Baseline: published `v1.32.8`, commit `72086069e853e785392d8ec722b03a4b1bacba75`. Candidate: the frozen unpublished simplified instructions.
- [Frozen protocol, scenarios and rubric](../../tests/fixtures/framework-behavior/README.md): SHA-256 `53b4569f95da9c5761b82c67f64c982635529144c9f2dc7c1da086a3bf2f4eb4`. The source freeze passed again after all attempts. No participant instructions, cases or criteria changed during the comparison.
- Requested model `gpt-6-astra`, effort `low`, native CLI `0.158.0-alpha.2.1`, existing ChatGPT login. One fresh attempt per case/arm, alternating arm order by pair. Two separately authorized batches of eight attempts; no retries, additional judges, product changes or product-work pause.
- Both batches used the same adapter hash and normalized CLI arguments. Paired scenario and prompt hashes match. The runner hash changed only because its allowlist and approval-receipt selection were extended for the separately authorized second batch; the original runner was retained and the exact diff reviewed. Model, effort, permissions, provider, thresholds and result capture did not change.
- Minimal read-only command permissions exposed only each trial's scenario and local framework instructions. External skills, delegation, plugins and apps were disabled. All 62 observed shell calls were successful local scenario/instruction reads or searches; none operated on a product. The preflight proves selected native shell boundaries, not all tools or production harnesses.
- The approved bounds were 120 seconds, 350 final-answer words and an 80,000 combined input/output threshold, allowing final-response overshoot. The native counter did not establish enforcement of that token metric. All attempts completed within 50 seconds and 320 words. Five baseline attempt totals exceeded 80,000: C02 86,249; C04 86,404; C05 84,834; C06 81,871; C08 84,587. These costs remain included; their per-response threshold compliance is UNKNOWN.
- The maintainer scored each pair against the frozen source-backed rubric, knowing the variants. This is not independent blind judging. Exact quoted evidence, valid scenario source ids, response hashes and protocol bounds were mechanically checked. C02 recognizes the missing raw-input transformation semantically rather than repeating the prepared-array noun. C08 candidate retains read-only observation rather than ordering another observation call against an already supplied current checkpoint; it also preserves the acceptance gate and advances independent work.

## Results

Input includes cached input; uncached input is input minus cached. Output already includes its reported reasoning subset. Positive reductions below mean lower candidate usage/time, not measured subscription savings.

| Measure | Published baseline | Simplified candidate | Observed reduction |
| --- | ---: | ---: | ---: |
| Rubric checks passed | 24/24 | 24/24 | Quality tie |
| Input tokens | 611,747 | 442,772 | 27.6% |
| Cached input tokens | 411,648 | 277,632 | Not a separate savings claim |
| Uncached input tokens | 200,099 | 165,140 | 17.5% |
| Output tokens | 5,735 | 5,573 | 2.8% |
| Sum of attempt elapsed time | 317.365 s | 282.055 s | 11.1% |
| Completed shell read/search calls | 33 | 29 | 12.1% |

| Case | Checks passed, baseline/candidate | Input, baseline/candidate | Output, baseline/candidate | Seconds, baseline/candidate | Reads, baseline/candidate |
| --- | --- | --- | --- | --- | --- |
| C01: public-only module connection | 3/3 and 3/3 | 60,795 / 21,281 | 729 / 506 | 35.033 / 24.288 | 3 / 1 |
| C02: assisted Lab output is not a ready module | 3/3 and 3/3 | 85,448 / 72,037 | 801 / 752 | 49.261 / 42.461 | 4 / 4 |
| C03: continue an authorized local repair | 3/3 and 3/3 | 60,176 / 21,207 | 693 / 541 | 34.489 / 24.329 | 4 / 1 |
| C04: route unresolved design to Discovery | 3/3 and 3/3 | 85,741 / 72,905 | 663 / 878 | 41.325 / 40.486 | 5 / 5 |
| C05: recover a retained Return after uncertain delivery | 3/3 and 3/3 | 84,056 / 70,589 | 778 / 923 | 43.832 / 47.394 | 4 / 6 |
| C06: duplicate signal during human review | 3/3 and 3/3 | 81,265 / 50,080 | 606 / 454 | 39.793 / 26.794 | 5 / 3 |
| C07: resume due mapping and module preparation | 3/3 and 3/3 | 70,414 / 59,994 | 730 / 799 | 35.903 / 37.337 | 4 / 5 |
| C08: preserve direct human control of a Lab | 3/3 and 3/3 | 83,852 / 74,679 | 735 / 720 | 37.729 / 38.966 | 4 / 4 |

Both arms preserved accepted artifacts and module boundaries, rejected assisted Lab output as whole-capability proof, continued in-scope repair, routed unresolved design to Discovery, recovered the existing Return without duplicate work, kept unchanged Guard signals quiet, resumed previously authorized preparation after its checkpoint, and respected direct human Lab control while other work continued. No critical unsafe proposed action or fabricated execution result was found in these answers.

The benefit is uneven. Ordinary continuation accounts for much of the reduction. In C05, C07 and C08 the candidate was slightly slower; C05 and C07 made more reads and produced more output. Second-batch totals alone were baseline/candidate input 319,587/255,342 (-20.1%), uncached input 95,331/103,534 (+8.6%), output 2,849/2,896 (+1.6%), time 157.257/150.491 seconds (-4.3%) and reads 17/18. Less total input did not guarantee less uncached input, fewer tool calls or faster handling of each organizational event. Cache differences are observable; their causes and subscription effect are not established.

## Cost And Limits

The newly authorized second batch used 574,929 input tokens, including 376,064 cached, plus 5,745 output tokens. Sum of attempt time was 307.748 seconds; its collection window was 12:50:09-13:03:34 UTC, including review pauses.

Across both batches the experiment used 1,054,519 input tokens, including 689,280 cached, plus 11,308 output tokens: 1,065,827 combined. Summed attempt time was 599.420 seconds. Collection ran from 12:27:08 to 13:03:34 UTC, including separate authorization and review pauses. These are neither task-wide development time nor whole-chain framework cost. An attempt includes native instructions and internal tool turns; 16 attempts are not 16 individual inference requests.

Maintainer setup, debugging, review and reporting usage remains UNKNOWN and excluded. No account-wide quota delta or API-price proxy was used; monetary cost and attributable subscription allowance remain UNKNOWN. There is one sample per case/arm, no confidence interval and no independent judge. Run order, caching and service latency can influence the observations; product work was not paused to isolate them.

All relevant facts were supplied in short synthetic scenarios. This did not test forgotten-history retrieval, long-context drift, compaction, real worker dispatch, actual Return delivery, real module packaging or multi-turn completion. Passing proposed decisions does not prove those actions will happen. An all-pass baseline/candidate tie does not prove higher reliability, nor does it establish why a live orchestrator previously failed.

[Machine-readable evidence](framework-behavior-2026-09-29-full.json) preserves all answers, quotes, source ids, metrics, timestamps and hashes. Raw transcripts, approval receipts, both runner revisions, native preflight, manual scorecards and post-comparison TAP evidence remain in the external staged archive. The unchanged executable candidate passed all 315 local tests after the final model attempt. Framework validation, frozen-input checks and whitespace checks passed separately.

## Evolution Review And Next Gate

Benefit: lower observed decision-context overhead without losing the checked safety and continuity decisions. Evidence: eight fixed scenarios, equal 24/24 scores, and heterogeneous usage/time results with the limits above. Complexity: no new installed role, scheduler, control loop or instruction added during evaluation; only maintainer evidence. Verdict: retain the simplification and defer release pending the transition/adoption proof.

Do not add another layer of rules to explain an all-pass tie or repeat this screen until a demonstrated cause justifies it. The next useful evidence is one project-owned, isolated end-to-end pilot: package a bounded legacy capability from raw input without hidden human/model repair, verify independent cases and retained behavior, then connect the fixed artifact through its public contract in two consumers without reading producer source. Count preparation, implementation, review, repair and human corrections; separate one-time transition investment from reuse. A declared permission boundary is not proof of native enforcement.

That pilot needs an agreed owner, isolated scope, protected baseline, acceptance and budget. It must not require whole-project refactoring or interrupt ongoing production. The evaluation authorization does not permit it automatically. Stage 3's decision screen is complete; real transition/reuse and adoption/publication gates remain open. No merge, release, installation, product refactoring or deployment was performed.
