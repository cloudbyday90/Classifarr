# Selective inventory recheck outcome

## Delivered component

Implemented the [predeclared design](selective-inventory-recheck-design.md): a pure,
library-name-independent conflict detector and an automatic one-call recheck in the
existing local benchmark. Description evidence validation is shared with policy
scoring; the stronger scoring thresholds and live classification paths are unchanged.
All new code is ESM. No UI setting, declaration, acknowledgement or release was added.

The benchmark now fits numeric conflict evidence outside each held-out fold, uses
that evidence to decide whether another comparison is worthwhile, and retains the
baseline unless the anonymous answer agrees with the preselected alternative.
Actual model calls and failures are reported separately from effective selections.

## Fresh local Compose result

Run September 12, 2026 against the rebuilt, healthy local Compose service. All 300
new description groups were evaluated: 171 movie and 129 TV items. The preceding
100, 200 and 300 cohorts were excluded from test selection (600 exclusions, zero
overlap). This reads existing inventory; it does not add media or train model weights.

| Measurement | Result |
| --- | ---: |
| Named baseline agreement with existing placement | 244/300 (81.33%) |
| Selective strategy agreement | 246/300 (82.00%) |
| Additional agreements / lost agreements | 2 / 0 |
| Triggered anonymous comparisons | 5/300 (1.67%) |
| Accepted replacements / retained baselines after recheck | 2 / 3 |
| Actual model calls | 305 (300 baseline + 5 rechecks) |
| Baseline proposals / abstentions | 299 / 1 |
| Recheck proposals / abstentions | 5 / 0 |
| Invalid, failed, limited or missing-evidence model outcomes | 0 |
| Incomplete evidence / unavailable proposal / no joint conflict | 0 / 1 / 294 |
| Verified labels / user questions / live routing changes | 0 / 0 / 0 |

The five rechecks all returned a valid candidate. Only two agreed with the
detector's alternative; the other three retained baseline. No thresholds were
changed after observing this cohort. The effective strategy has 300 valid paired
outcomes; that does **not** mean 300 anonymous model calls occurred.

Movie agreement changed from 138/171 to 139/171; TV from 106/129 to 107/129.
There were no shared-membership duplicates in this cohort's per-library totals.

| Anonymous library stratum | Media | New samples | Baseline agreement | Selected agreement | Gains | Losses |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 1 | Movie | 0 | 0 | 0 | 0 | 0 |
| 2 | Movie | 43 | 35 | 35 | 0 | 0 |
| 3 | Movie | 43 | 41 | 41 | 0 | 0 |
| 4 | Movie | 43 | 22 | 23 | 1 | 0 |
| 5 | Movie | 42 | 40 | 40 | 0 | 0 |
| 6 | TV | 0 | 0 | 0 | 0 | 0 |
| 7 | TV | 2 | 0 | 0 | 0 | 0 |
| 8 | TV | 42 | 25 | 26 | 1 | 0 |
| 9 | TV | 42 | 38 | 38 | 0 | 0 |
| 10 | TV | 43 | 43 | 43 | 0 | 0 |

All ten libraries remain represented in training. Strata 1 and 6 have exhausted
their unused descriptions; stratum 7 has only two left. This fresh cohort therefore
cannot establish performance across every small library. Each of five folds holds
60 descriptions out and fits 6,582 metadata-bearing training descriptions.

Mean reported generation latency was 718.12 ms for baseline and 815.80 ms for the
five rechecks; mean input token counts were 800.58 and 873.20. These are different
case populations, with tests running concurrently, not a controlled latency study.
Input truncation remains unknown; no context-limit signal was reported.

## What the result does and does not justify

Selective rechecking avoided universal double inference and produced a small gain
on this cohort. Five triggered cases and two changed answers are insufficient to
establish general safety or accuracy. Existing placements are weak labels and may
be wrong; `accuracy` remains null. The production adjudication prompt also includes
evidence beyond this nine-synopsis experiment, so this is not a full live-path replay.

Keep the component available for evaluation, but do not enable automatic live
replacement on this evidence alone. Existing policy constraints, authentication,
candidate eligibility and routing authorization remain authoritative.

## Higher-value finding and next component

Learned metadata changed 165 shortlists. It recovered two existing destinations
missed by description-only ranking, but removed four that description-only ranking
had included. The resulting shortlist contains an observed destination for 296/300
items, versus 298/300 with description-only ranking. These are recall against weak
placement labels, not verified mistakes, but they identify a measurable bottleneck.

Next: **evidence-preserving candidate selection before the AI comparison**. Compare
the strongest description match, learned metadata fit and policy leader across the
eligible pool before enforcing the three-candidate limit. Test whether a small
positive metadata fit currently crowds out substantially stronger description
evidence. Preserve explicit policy restrictions and library-agnostic behavior;
do not add fixed library-name rules or expose another settings panel.

The live shortlist already preserves the policy leader and reranks alternatives;
the benchmark's description-plus-metadata fusion is not an identical live path.
Reconcile these paths and test actual candidate recall before claiming this fresh
cohort proves four production misroutes. The current recheck cannot recover an
omitted destination, and most of the remaining 54 placement disagreements were
not resolved by this narrow trigger.

This follow-up is now implemented in the
[description-preserving shortlist design](description-preserving-shortlist-design.md)
with separate [measured outcomes](description-preserving-shortlist-outcome.md).
It preserves one description leader; it does not recover all four misses above.

## Recommendations and final stack

| Option | Pro | Con | Recommendation |
| --- | --- | --- | --- |
| Remove library names globally | Simple content-only comparison | Earlier full-cohort test regressed; doubles calls | Reject as default |
| Selective anonymous recheck | Five extra calls, two gains and no losses here | Only five triggers; not proven on live prompts | Keep evaluated, not live-enabled |
| Evidence-preserving candidate selection | Addresses missing choices before any extra AI call | Must reconcile benchmark/live ranking and test small libraries | Next component |
| Lower routing thresholds | Fewer reviews immediately | Does not improve semantic matching or establish accuracy | Do not use as a substitute |

Final stack: organic learned profiles + description retrieval → evidence-preserving
eligible shortlist → named comparison → validated selective recheck where useful →
existing routing gates. The next implementation should improve the shortlist, not
create more user-facing controls or tune this trigger on its test results.

Official-source recommendations, dates and tradeoffs are in the separate design.

## Reproduction and provenance

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200,300 `
  --folds 5 --generate-cases 300 --context 32768 --max-minutes 20 `
  --learned-profiles --selective-recheck
```

Omit `--generate-cases 300` for a no-generation preflight. The mode requires grouped
learned profiles and cannot be combined with the other investigation/comparison modes.
There is no paid provider fallback, model pull, cache write, or per-item report output.

- Generation: `gemma4:e4b`, digest `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
- Embedding: `mxbai-embed-large:latest`, 1,024 dimensions, digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation settings: context 32,768; temperature 0; seed 42; thinking off; output limit 64.
- Sample: `decfd452e67f2c42cacbdbab072d7aeb2bb8b32415b7789c16c078f7e0f99422`.
- Fold assignment: `3cd473d8fed9f9dab1aab00e07020dbeab6cc0b43798e389840d3e1abe9f91c0`.
- Snapshot: `0c3464bb3d50829375773374fc6e6c5032b6020fe9ba65f933a3e50eae95cc2a`.

Preflight and generation snapshots matched exactly, including all canonical component
digests. Counts: 6,647 documents, 10 libraries, 6,644 vectors, 6,649 metadata entries.

| Component | SHA-256 |
| --- | --- |
| Documents | `3fed0b8a6b475c0cfa2748886844d512a6057f68499e85b2d564fdb89471043a` |
| Libraries | `0d42f113861c96c3a55d2316d87a1be7f412e293acd79fbe76143ed760f531dc` |
| Vectors | `ff6ce008357689342e440b306fe57f7bc0b2b1028d95e4aaf041825d94725db4` |
| Metadata | `c96a2aed203771ac47544603e1001e78cf16b478524c75e1cbd8d99d0f427274` |

## Validation and PR availability

- Focused regression tests: 8 suites, 174 tests passed.
- PostgreSQL integration: 1 suite, 7 tests passed, including read-only selective
  evaluation and unchanged cache counts.
- Backend/client types and lint, ESM import/mock checks, documentation lint and
  whitespace checks passed; client implementation was unchanged.
- Full backend coverage run: 1,233 suites, 35,222 tests passed in 951.658 seconds.
  Statements/lines 90.03% (264,707/294,003), branches 81.52% (47,364/58,099),
  functions 92.12% (10,281/11,160). Client unit tests were not rerun because the
  client was unchanged; its existing coverage report is used by the ratchet.
- Coverage ratchet passed with the new backend report and unchanged client report.
- Local Compose rebuilt and healthy; hashes of the resolver, shared validator,
  runner and sampler match workspace source.
- The production naming gate still reports its pre-existing 26 references against
  the zero-debt baseline. This change adds no naming references and does not relax
  the gate; do not describe the entire CI pipeline as green.
- GitHub MCP found no open repository PRs. No PR was selected, applied or merged.
- CHANGELOG updated under Unreleased; no release, tag or version bump.
