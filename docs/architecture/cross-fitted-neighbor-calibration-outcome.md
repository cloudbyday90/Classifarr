# Cross-fitted neighbor calibration: outcome

## Outcome and scope

Cross-fitting removes the measured small-library calibration blocker: **all 300
cases across all ten movie/TV libraries now have available calibration**. The
previous disjoint split had none. No library was dropped, no operator declaration
was requested, and the minimum number of reference examples for an individual
calibration score was not lowered.

Keep this as evaluation evidence, not a replacement for the current live rule.
The calibrated arm supports fewer proposals overall than the full-corpus strict
rule, although it supports some cases the strict rule rejects. The next useful
component is a selective calibrated fallback evaluated with the existing AI,
metadata and fresh-routing safeguards.

The [design document](cross-fitted-neighbor-calibration-design.md) records the
fixed protocol, official September-verified sources, alternatives, pros/cons,
security boundaries and recommendation stack.

## Implementation and reconciliation

The previous commit `236460f5` introduced the four-arm neighbor comparison. This
change keeps it intact and adds `--neighbor-cross-fit` alongside
`--neighbor-calibration`. Without the new option, the old protocol and report are
unchanged. Both modes remain grouped, zero-generation, read-only evaluations.

- A shared ESM arithmetic service now owns top-three similarity scoring, contrastive
  margins, empirical tails and result construction for both methods.
- A separate cross-fit kernel and deterministic selection helper reuse exclusive
  training descriptions, removing the scored hash before capping references.
- The existing snapshot-scoped session retains identity/fold validation, copied
  vectors, protocol-bound keys, interruption eviction and resource limits.
- Existing orchestration/reporting adds three paired arms and explicit availability
  changes. No new singleton, dependency, database schema, API, UI, setting,
  scheduler or live-authority integration was introduced.

This is not model-weight fine-tuning. It learns empirical description-match
distributions from the library snapshot and keeps them private to the evaluation.
Nothing is persisted as verified training labels or a live routing receipt.

## Rebuilt Compose validation

On 12 September 2026 local time, the healthy rebuilt Compose service evaluated
the original deterministic **300-item regression cohort: 150 movies and 150 TV
shows, across ten libraries and five 60-item folds**. Every library supplied test
cases and retained training descriptions. This reuses earlier items for comparison;
it is not an additional collection of 300 new items or an untouched final test set.

- Seed: `classifarr-profile-20260912`.
- Sample fingerprint: `ed0ba4c466ffafd78edb483d8c3b5d23296aa4a9ae17f8e097c7c13868b30528`.
- Snapshot fingerprint: `fe51ea1cdc08880dc57d0a7ac5861601f7423021cb50b42c9c57c2bb2f423631`.
- Embeddings: local `mxbai-embed-large:latest`, 1,024 dimensions, pinned digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Two cross-fit runs produced **identical complete reports**, taking 10,921 ms
  and 9,594 ms. The original mode took 7,008 ms after refactoring and its entire
  report exactly matched the preceding commit's saved baseline.
- No heavy test or build ran during these measurements. Times describe this local
  snapshot and host, not a general performance guarantee or a statistical timing study.
- All seven deployed production-file hashes matched the workspace. Compose remained
  healthy with a read-only root filesystem. The working-tree image correctly has
  `VCS_REF=unknown`; it is not release-provenance evidence.

Database writes were prohibited with `PGOPTIONS=-c default_transaction_read_only=on`.
The runs made zero generation or embedding-generation calls and did not change
media routes, stored confirmation preferences, policies or learned state.

## Coverage and proposal support

| Check | Available cases | Supported proposals | Supported placement agreement | Supported placement disagreement |
| --- | ---: | ---: | ---: | ---: |
| Original full-corpus strict | 300 | 169 | 146 | 23 |
| Original disjoint calibrated | 0 | 0 | 0 | 0 |
| Cross-fit-reference strict | 300 | 132 | 127 | 5 |
| Same-reference mean | 300 | 213 | 190 | 23 |
| Cross-fitted calibrated | 300 | 120 | 116 | 4 |

The calibrated arm supported 65 movie proposals (64 placement agreements, one
disagreement) and 55 TV proposals (52 agreements, three disagreements). All 50
library/fold calibration records were available, without sparse or degenerate
exceptions. In the smallest movie stratum, **21–22 references** remained after
excluding each scored description; in the smallest TV stratum, **38 remained**.
The per-score minimum is still 20. Query reference sets contain up to 64 groups.

On identical cross-fit reference pools, replacing strict separation with a mean
added 81 supported proposals: 63 agreed with placement and 18 disagreed. Applying
calibration to that mean withdrew support from 93 proposals. Reference selection
and calibration therefore matter independently; more permissive means alone
are not the proposed fix.

Compared with the original full-corpus strict arm, calibration **gained 27**
supported proposals (26 placement agreements, one disagreement) and **lost 76**.
That is a net reduction of 49 supported proposals, not a demonstrated reduction
in user reviews. The 300-case gain over disjoint calibration is an availability
gain; there were no jointly calibrated cases on which to claim paired support
improvement against that unavailable arm.

## Interpretation and limitations

Existing placement can be wrong. The 116 agreements are not verified correct
routes, and the four disagreements are not automatically errors. No accuracy,
calibrated correctness probability or conformal coverage claim is made.

These arms isolate the description-neighbor check. They do not evaluate AI or
metadata agreement, explicit policy restrictions, familiarity, freshness or
routing authorization. The same full-corpus proposal and shared-copy veto are
retained in every arm; there is no candidate selection using the observed label.

Group exclusion follows exact hashes of the existing normalized, length-bounded
synopsis projection. Near-duplicates, paraphrases and case-only rewrites may
remain distinct. Cross-fit observations are dependent, and small-library query
fits can contain one more reference than calibration fits. These limitations
remain even though the new protocol has full coverage on this snapshot.

## Automated verification

- Focused coverage: **8 suites, 84 tests passed**, with **100% lines and 97.84%
  branches** across six affected numeric/orchestration/report services.
- Broader policy/routing/code-health selection: **605 suites, 28,404 tests passed**.
- Real PostgreSQL integration selection: **6 suites, 29 tests passed**.
- Backend's configured typecheck scope, changed-file ESLint, static-import and
  service ESM mock-shape checks passed, as did Markdown lint and whitespace checks.
- Tests cover exact reference exclusion and cap order against an independent
  brute-force oracle, small-library coverage, invalid/shared identities, memory
  and work bounds, mutation isolation, cancellation/retry and baseline parity.
- Frontend code is unchanged and Compose reused its build layer; no new client
  test result is claimed. Scoped coverage does not replace the global ratchet.
- The production naming gate still fails on **26 pre-existing references** against
  its zero-reference baseline. No CI gate was weakened or declared fully green.

## Reproduction

From the repository root with the configured local Compose service:

```powershell
docker exec -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --neighbor-calibration --neighbor-cross-fit --max-minutes 5
```

Omit `--neighbor-cross-fit` to reproduce the original four-arm protocol. The CLI
rejects a standalone cross-fit option, mixed modes, missing folds and generation
before loading runtime. Public output contains aggregate counts and anonymous
strata. Repeat/coverage artifacts remain ignored in `.tmp/`, not committed as
private media data. Interrupted or incomplete runs must not be treated as complete.

## Final recommendation and next component

Keep PostgreSQL/pgvector, pinned local embeddings, modular ESM, bounded snapshot
reuse and fresh live authorization. Prefer group-excluded cross-fitting over
requiring operators to enlarge libraries or complete declaration forms. Its
benefit is useful small-library coverage; its costs are added computation and
dependent, weakly labeled calibration observations.

**Next: evaluate a selective calibrated fallback within the existing AI/metadata
review check.** Preserve proposals already supported by the strict rule. For
cases blocked only by neighbor overlap, test whether calibrated separation plus
the existing AI, learned-metadata, identity, familiarity and freshness checks can
resolve the review. Start with the 27 newly supported cases and explicitly inspect
contradictions; do not replace the strict rule and discard its 76 lost cases.

Reuse the current evaluation/receipt infrastructure and report jointly qualified
outcomes before any live promotion. Do not turn an empirical rank into a policy
score, bypass explicit restrictions, or add more acknowledgements/settings.

## PR, changelog and release

GitHub MCP returned no open Classifarr PRs in both checks on 12 September 2026 local
time. No eligible random PR could be selected, and none was substituted or merged.
High-level changes are under Unreleased; no version bump, tag or release was made.
