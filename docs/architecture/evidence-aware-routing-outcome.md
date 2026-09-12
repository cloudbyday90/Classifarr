# Evidence-aware routing outcome

## Delivered component

The previous commit (`f6733e47`) improved the live AI shortlist using organically
learned library patterns. This component connects a narrow class of supported
AI comparisons to the actual routing decision: threshold-qualified ambiguity.

An active, policy-eligible destination can proceed automatically when its real
policy score already meets the configured automatic threshold and the existing
70-point floor, the local Ollama proposal selects it, and complete fresh
description evidence plus learned fit clearly favors it over every compared
alternative. An explicit manual-review veto still wins. No library-name rules,
manual purpose declarations, new acknowledgements or UI panels were introduced.

This is **not a fix for a 45-point score against an 85 threshold**. The local
policy replay found no eligible cases, so no reduction in your current review
workload is claimed. The score itself remains the next substantive limitation.

See the separate [design and research document](evidence-aware-routing-design.md)
for admission rules, official sources, alternatives and tradeoffs.

## Implementation and safety

- Small ESM services separate assessment, post-generation revalidation,
  request-local routing authority and recovery to review.
- Capture provider configuration before generation; compare it afterward and
  again after revalidation. Re-read policies, active library configuration and
  description evidence. Any change or read failure preserves review.
- Keep model confidence and explanation out of the authorization calculation.
  Preserve the original policy result and selected candidate's actual score.
- Issue a 60-second in-memory receipt bound to item identity, destination and
  policy snapshot. Validate it during question construction and before Arr.
  A method label, stored JSON, changed destination or expired receipt cannot
  recreate authority. Administrator and provider-recovery vetoes still apply.
- If a grant becomes unusable after initial persistence, restore the review
  question and queue state. Do not overwrite already routed records or erase
  stored classification evidence.
- Exclude these automatic placements from history-score aggregation and
  downweight them in RAG quality assessment. They are observations, not reviewed
  labels. Current inventory remains contextual evidence and may contain mistakes.
- No database migration, dependency change, public endpoint, release or tag.
  Existing reviews are not automatically retried or moved.

## Local 100-title policy replay

Seed: `classifarr-profile-20260912`. Current Compose inventory has 10 active
libraries and 10 active policies. The learner excluded all 100 sampled synopsis
groups together. The probe used current source metadata and read-only policy
scorers, an empty cached RAG match list, and the pure decision projection rather
than the metrics-writing finalizer. It made no model calls or routing writes.

| Observation | Result |
| --- | --- |
| Sampled titles | 100 |
| Valid reviewable comparison contracts | 94 |
| Explicit weak-evidence review flags within those contracts | 85 |
| Ambiguous selections without an explicit veto | 1 |
| Threshold-qualified cases for the new path | 0 |
| New automatic admissions | 0 |
| Changed learned shortlist sets | 8 |
| Policy-leader or eligibility violations | 0 |

Actions were 79 selections, 8 confirmations, 9 manual decisions and 4 existing
automatic policy decisions. This diagnostic is not a full live AI pipeline
accuracy measurement, because its initial policy evaluation had no cached RAG
matches. It demonstrates why merely changing the finalizer cannot solve the
dominant weak-evidence scoring issue.

## Separate local AI and description benchmark

The existing benchmark also completed all 300 local generations: 100 titles
with 9, 30 and 100 retrieved examples. It used learned-profile candidate
selection, 6,542 training descriptions across 10 libraries, cached
`mxbai-embed-large:latest` vectors (1,024 dimensions), and installed
`gemma4:e4b` with context 32,768, temperature 0 and thinking disabled.
Database access was read-only; there were no media routes, model pulls, remote
provider fallbacks or stored private case reports.

| Retrieved examples | Valid proposals | Agreement with observed placement | Mean prompt tokens | Mean generation latency |
| --- | --- | --- | --- | --- |
| 9 | 100/100 | 79/100 | 802 | 328 ms |
| 30 | 100/100 | 78/100 | 2,176 | 336 ms |
| 100 | 100/100 | 80/100 | 6,723 | 821 ms |

There were no abstentions, invalid outputs, reported output-limit failures or
suspected context-limit failures. Actual input truncation remains unknown.
The 9-example mean includes an 8.4-second outlier; its p95 was 297 ms.
Thirty examples changed seven proposals versus nine; 100 examples changed five.
Learned candidate selection recovered three observed destinations missing from
description-only shortlists, with no new observed-destination misses.

These are **placement-agreement measurements, not accuracy**: the corpus has
zero independent correctness labels. The benchmark's learned-profile shortlist
is also distinct from the live policy-constrained shortlist. It does not prove
the new automatic-routing heuristics' precision. Increasing every request to
100 examples consumed about 8.4 times the input tokens for only one more
agreement in this sample; that does not justify a global increase.

Reproduce the separate benchmark inside local Compose with
`node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 100 --generate-cases 100 --context 32768 --max-minutes 20 --learned-profiles`.
Require a verified local provider and read-only PostgreSQL connections.

## Verification

Focused service and policy-path tests cover eligibility, threshold preservation,
configuration/evidence changes, failed reads, receipt forgery/expiry/mutation,
administrator overrides and mocked Arr invocation. PostgreSQL integration tests
cover review recovery, history exclusion, description freshness and the existing
AI authority pipeline. Final checks on September 12, 2026:

- Full backend coverage run: 1,228 suites and 34,882 tests passed.
- Targeted PostgreSQL integration run: 6 suites and 20 tests passed.
- Backend coverage: 90.01% statements/lines, 81.33% branches, 92.09% functions.
- Backend lint and typecheck, ESM import/mock checks, and all 1,252 Markdown
  files passed. No coverage baseline was lowered.
- Coverage ratchet passed with the fresh backend report and the existing
  September 11 client report. Client code was unchanged and its tests were not
  rerun in this component.
- Local Compose was rebuilt and became healthy. The five new/changed core
  consensus-routing module hashes matched the workspace; the default service's
  configuration preflight succeeded against the live database read-only.
- The unchanged frontend build layer was reused by Docker. No production media
  was moved as part of testing; Arr invocation was exercised with a mock.

GitHub MCP returned no open repository PRs on both checks; no random PR was
available to implement, and none was merged. The existing production naming
gate still reports 26 production references against a zero baseline, unchanged
from the previous commit. That unrelated CI gate is not green and was not
weakened to hide the failure.

## Final recommendation stack and next item

1. Keep hard eligibility, configured thresholds, current evidence and explicit
   operator vetoes as the routing boundary.
2. Use the new qualified-ambiguity path when those conditions actually hold.
3. Next, improve **library-agnostic evidence scoring**: connect description fit,
   contrastive learned metadata and competing-library separation to the score
   and weak-evidence decision, rather than only the AI prompt.
4. Compare that scoring change on held-out titles; report review reduction,
   contradictions and corrected outcomes separately from placement agreement.
   Do not use the system's own automatic decisions as verified labels or add a
   manual declaration workflow.
5. Consider extra retrieval only for genuinely ambiguous cases. Keep the
   default evidence budget bounded until a larger one demonstrates benefit.

The practical benefit of the next component should be fewer unnecessary reviews
for well-supported matches, including cases like the low-scored Movies example.
Its tradeoff is that calibration needs trustworthy outcome evidence; raw cosine
similarity, learned fit and model agreement are not interchangeable percentages.

The first scoring follow-up is now implemented; see
[learned inventory scoring outcome](learned-inventory-scoring-outcome.md) for
the additional 200-title test, its limited gains and the next evaluation step.
