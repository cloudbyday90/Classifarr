# Provisional-leader challenge: implementation and outcome

## What changed

Implemented on 2026-09-20 as a read-only evaluation of the existing policy and
content-matching path. Four small ESM services separate challenge selection,
fold-local evidence, aggregate reporting and orchestration. Shared fresh-policy
evaluation now exposes its deterministic preparation separately from AI prompt
construction, and its repository can capture training provenance in the same
read-only transaction.

The experiment supports two through 64 eligible libraries. It requires a unique
positive metadata leader and a matching description leader with three nonshared
examples. It retains the policy leader on ties, failures and disagreement, and
never removes manual-review vetoes. Blocked nominations are reported separately
as hypothetical evidence, not applied recommendations.

No live shortlist order, fallback identity, routing threshold, API, UI, version,
release or user setting changed. No AI generation, embedding generation, domain
writes, training records or routing receipts were created. The existing live
stale-while-revalidate implementation remains untouched.

## Review of the preceding commit

Commit `f250b5ef` evaluated a linear content ranker rather than promoting it. Its
600-item placement agreement was lower than the existing organic metadata model.
All six workflows for that commit completed successfully, including
[CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/35485037777).

The recommended follow-up was to test a content-supported challenge to the pinned
policy leader. Inspection confirmed two independent constraints: the shortlist
skips learning at two/three candidates, and the live contract rejects moving the
first candidate. Downstream fallback and contrastive code also interpret the first
candidate as leader. This is why changing only the sort would not be a safe fix.

## Verified replay cohorts

Two disjoint 300-item cohorts from the previous experiment were re-evaluated using
fresh current policies, cached vectors and five whole-description folds. There
were no missing query metadata cases or source changes within either accepted run.
Metadata refreshed **between** the accepted runs, so these are independently paired
evaluations, not one common frozen 600-item snapshot. Results describe agreement
with existing placement, **not independently verified accuracy**.

| Measure | Cohort A | Cohort B |
| --- | ---: | ---: |
| Sampled items | 300 | 300 |
| Reviewable policy comparisons | 300 | 297 |
| Baseline placement agreements | 238 | 216 |
| Challenge-arm placement agreements | 240 | 220 |
| Applied hypothetical challenges | 2 | 4 |
| Gained / lost agreement | 2 / 0 | 4 / 0 |
| Manual-review vetoes retained | 269 | 262 |
| Content nominations behind vetoes | 32 | 41 |
| Blocked hypothetical gains / losses | 31 / 1 | 36 / 1 |
| Blocked changes matching neither placement | 0 | 4 |

“Applied” refers only to the benchmark arm; nothing was applied to live items.
Three cohort-B cases had non-reviewable actions and were excluded from the paired
leader-agreement denominator, rather than being counted as failures or changes.

All actual reviewable pools had five libraries. Two/three-library behavior is
covered by regression tests, **not claimed as observed in this Compose dataset**.
The replay cohorts contain held-out items in seven of ten library strata; all ten
libraries still contribute eligible training evidence. Therefore the next section
checks coverage of the smaller libraries separately.

The 531 retained vetoes comprise 460 `weak_evidence_primary` and 71
`weak_evidence_overlap` decisions. Content and metadata agree on a different
destination in 73 of these cases, but two would lose existing-placement agreement
and four match neither observed destination. Removing the veto globally is not
supported by these results.

## Verified all-library coverage audit

A separate stratified 300-item sample used seed `classifarr-leader-20260920`, no
prior-cohort exclusions, and five folds. It contains 150 movies and 150 TV items,
with at least 30 observations in every library. One shared-placement query belongs
to two strata, so the per-library counts sum to 301. This sample can overlap earlier
cohorts: **do not call the combined runs 900 distinct items**.

| Measure | All-library audit |
| --- | ---: |
| Reviewable comparisons | 284 / 300 |
| Baseline / challenge placement agreement | 228 / 230 |
| Challenges | 5 |
| Gained / lost / neither | 3 / 1 / 1 |
| Vetoes retained | 249 |
| Content nominations behind vetoes | 28 |
| Blocked hypothetical gained / lost / neither | 19 / 8 / 1 |

Movies gained two matches without a loss. TV gained one, lost one and changed one
item to a destination outside its observed placements. If vetoes were ignored,
five of the eight additional losses would occur in the smallest movie library;
the other three occur in the two smallest TV libraries. The actual TV loss also
occurs in one of those smaller strata. This is evidence against broadly unpinning
leaders or bypassing weak-evidence review gates.

The accepted audit had `sourceVerified: true`, no changed components and the same
source component digests as accepted cohort B. Earlier invalidated/deferred attempts
were discarded. Sample fingerprint:
`87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.

No OOD/unknown-content rejection claim is made. Neither the positive metadata
score nor agreement with three nearby descriptions is calibrated confidence.

## Reproducibility

Run inside local Compose with private logging disabled and read-only database
defaults. This command uses existing cached vectors; it does not invoke generation:

```sh
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false \
  -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr \
  node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-profile-20260912 --size 300 --folds 5 \
  --leader-challenge --max-minutes 30 \
  --exclude-prior-sizes 300,300,100,100,300,300,300
```

Append another `,300` to the exclusion list for cohort B. Sample fingerprints:

- A: `ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`
- B: `bcb5be448f92e2c2d0f10c2e98f897d6df02940ff92d7ed126ae1cb18e422f74`

Each fold admitted 6,587–6,588 canonical descriptions after removing the 60 held-out
descriptions, one retained-decision group, two shared groups and one/two conflicting
metadata groups. No library became sparse. Known decision exclusions do not prove
that legacy source observations were independently placed; provenance remains
incomplete and accuracy remains `null`.

The embedding representation was `mxbai-embed-large:latest`, 1,024 dimensions,
digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Cached vector digest:
`49fe5be63dac7f7a49cc94a46fe046f7f4294f5d4eb62072f8274586778eb5b9`.

## Recovery behavior observed

An earlier run detected changes to metadata/observed traits and was invalidated.
Later attempts deferred with `busy` while background discovery owned the shared
lease. Those attempts are not counted as accepted benchmark results. No freshness
check, lock, memory limit or source backfill was disabled to obtain results.

## Design and trade-offs

The separate [design document](inventory-leader-challenge-design.md) records the
official research, W3C considerations, alternatives and security boundaries. The
main benefit is using existing library understanding without another model. The
main costs are conservative coverage and correlated, imperfect placement labels.

## Verification and delivery

- Full backend coverage: **1,336 suites, 38,935 tests passed**, 461 seconds.
- PostgreSQL integration: three suites, 24 tests passed, including corpus projection,
  live description retrieval and cached vectors.
- New challenge selector/report: 100% line, branch and function coverage. New
  orchestrator/evidence preparation: 100% lines/functions, 97.05%/90% branches.
- Coverage ratchet passed: server 90.27% lines, 83.32% branches, 92.39% functions.
  Client source is unchanged; its existing coverage report was reused, not a new
  frontend suite run (87.67% lines, 77.54% branches).
- ESLint, server/client type checks, copyright/dependency preflight, static ESM
  imports and mock-shape checks passed. Markdown lint covered 1,382 documents.
- The production-naming gate still reports **43 pre-existing references against
  a zero baseline**, unchanged by this work. No waiver or baseline change was made.
- Local Compose remained healthy and read-only, with no restarts, memory-limit hits
  or OOM kills in the final audit container. Its observed peak was 1,190,068,224 bytes.

GitHub's open-PR collection was empty at the start and during implementation. No
random open PR was available to implement; none was merged. The source changes
and documentation are recorded under Unreleased without creating a release.

## Final recommendation stack and next item

Follow-up: [candidate-specific acceptance outcome](inventory-challenge-acceptance-outcome.md)
records the paired calibration audit and the remaining small-library limitation.

1. Keep this challenger evaluation-only. Its benefit on larger-library replay
   cohorts does not erase regressions exposed by balanced small-library coverage.
2. Preserve the existing raw descriptions, organic metadata profiles, provenance
   exclusions and whole-description held-out boundaries. No new model is justified.
3. **Next: candidate-specific acceptance for a leader challenge.** Reuse the
   existing per-library match/neighbor-calibration machinery to assess both the
   proposed challenger and the incumbent against their own held-out distributions.
   Require evidence that distinguishes the two; abstain when it does not. Test the
   observed small-library losses and generic/unknown-content controls explicitly.
   Do not solve this with library names, hardcoded genres, questionnaires or one
   global positive-score threshold.
4. After that rule survives paired evaluation, separate comparison order from
   fallback identity and validate a live advisory integration through the existing
   AI response and routing-safety boundaries. Do not globally remove review vetoes.

This targets better organic decisions with less operator involvement. It is not
another acknowledgement screen, another trained model, or a claim that current
library placement is guaranteed correct.
