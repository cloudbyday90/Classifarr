# Candidate-specific challenge acceptance: outcome

## Outcome on 20 September 2026

Implemented the [candidate-specific design](inventory-challenge-acceptance-design.md)
as a paired, read-only extension of `--leader-challenge`. The protocol is now
`inventory_leader_challenge_v2`: `comparison` retains the original nomination arm;
`acceptanceComparison` reports the stricter arm, including abstention reasons and
anonymous library strata. No live ranking, routing, confidence, database schema,
frontend or provider configuration changed. No generation calls were made.

The rule withheld the observed losses but also most useful nominations. It is not
ready to promote as a broad automation improvement. A sparse incumbent is often
the limiting factor, rather than missing content evidence for the challenger.

## Local Compose audit

Rebuilt and started local Compose without removing volumes. Used its cached
1024-dimensional `mxbai-embed-large:latest` vectors with PostgreSQL enforced
read-only access. The run completed with `sourceVerified: true` and no changed
source components. This is the same 300-item all-library cohort used in the
[previous audit](inventory-leader-challenge-outcome.md), not 300 new labels.

- 150 movie and 150 TV items, all ten library strata represented.
- Five whole-description held-out folds, 60 items each.
- 284 reviewable comparisons; 16 were not reviewable by this policy path.
- 6,587–6,588 admitted training description groups per fold after exclusions.
- One retained-history group, one or two shared groups and two conflicting-metadata
  groups excluded per fold, in addition to the held-out fold.
- One sampled item belongs to two libraries, so per-library sample totals sum to
  301 even though the cohort has only 300 items.
- `evaluation.workComponents` counts nearest-example retrieval work only. The two
  calibration kernels retain their separate two-billion-component work budgets,
  fold/model memory bounds and cancellation checks.

| Unvetoed comparison | Raw nomination | Accepted nomination |
| --- | ---: | ---: |
| Nominations | 5 | 1 |
| Placement agreements gained | 3 | 1 |
| Placement agreements lost | 1 | 0 |
| Changed, neither destination agrees | 1 | 0 |
| Total placement agreements / 284 | 230 | 229 |

The policy-only baseline agrees on 228 of the 284 comparisons. The stricter arm
avoids the single TV loss in stratum 7 but forgoes two raw gains. The one
accepted unvetoed gain is in movie stratum 2. These are agreement counts with
existing placements, **not verified accuracy**.

| Review-veto diagnostics only | Raw nomination | Accepted nomination |
| --- | ---: | ---: |
| Hypothetical nominations | 28 | 2 |
| Hypothetical gains | 19 | 2 |
| Hypothetical losses | 8 | 0 |
| Hypothetical neither | 1 | 0 |
| Actually applied | 0 | 0 |

All 249 policy-review vetoes remain intact. The two accepted hypothetical gains
are in movie stratum 5. The rejected hypothetical losses occurred in strata 1
(five), 6 (two) and 7 (one). No raw or accepted arm routes an item.

Across all 33 raw nominations, including the vetoed ones:

- Three passed candidate acceptance.
- Fifteen abstained because the incumbent was sparse under the existing matching
  baseline: fourteen had a familiar challenger; one had an unusual challenger.
- Fifteen lacked calibrated distinction despite assessable candidates.
- Of the 18 assessable pairs, ten were familiar/familiar and eight were
  unusual/familiar. Rank values are never treated as probabilities or compared to
  invent a new threshold.

### Reproduction and integrity

```text
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false \
  -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr \
  node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-leader-20260920 --size 300 --folds 5 \
  --leader-challenge --max-minutes 30
```

The line continuation above is POSIX shell notation; use a single line in PowerShell.
The private aggregate run log is `.tmp/acceptance-all-libraries.log`, not committed.

| Integrity field | Value |
| --- | --- |
| Sample fingerprint | `87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a` |
| Fold assignment | `de91fbe9cbb1b6270c33ebc44f0d7961a021446a9cb63d60110174020d2776fa` |
| Embedding digest | `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8` |
| Vector digest | `49fe5be63dac7f7a49cc94a46fe046f7f4294f5d4eb62072f8274586778eb5b9` |
| Metadata digest | `0012566f72f69718497ed65c07a91d9edf77b71da620d72905fdba0b8c1dcc3e` |
| Provenance digest | `0a06355a860e2da958b20df5144a986666fbb062c698df9811a4d4ae37e1afeb` |

Metadata differs from the preceding audit snapshot; this run's two arms share one
verified snapshot, and its raw counts reproduce that audit's raw counts. Do not
claim the old and new runs share every source digest.

## Verification and scope

- Full backend coverage run: 1,338 suites and 39,005 tests passed in 434.821 seconds.
- New acceptance and calibration adapter modules: 100% lines, branches and
  functions covered. Coverage ratchet passed: backend 90.28% lines, 83.34% branches,
  92.40% functions. Unchanged client reused its existing report (87.67% lines,
  77.54% branches); no new frontend suite run is claimed.
- Focused tests: seven suites, 136 tests passed, including the reused calibration
  suites, malformed evidence, exclusion propagation, cancellation and review vetoes.
- PostgreSQL integration: three suites, 24 tests passed.
- Lint, client/server type checks, copyright/dependency preflight, ESM static-import
  and mock-shape checks passed.
- Markdown lint passed for 1,384 documents. Compose remained healthy, with no
  restarts, memory-limit hits or OOM kills; audit-container peak was 1,185,218,560 bytes.
- The preceding commit's six GitHub workflows, including CI/CD, finished green.
- GitHub's open-PR collection was empty; no random PR could be selected or merged.
- Existing production-naming gate debt remains: 43 references against baseline zero.
  No new waiver or baseline change was introduced for this work.

## Final recommendation and next item

Keep acceptance evaluation-only: observed loss avoidance is promising, but only
three accepted nominations and weak placement labels cannot establish reliability.
No thresholds were tuned against the results, and unknown-content rejection is
still unmeasured. Library names and predefined genre mappings remain unused.

**Next: cross-fitted familiarity calibration for small libraries.** The current
match baseline requires separate sets of at least 20 references and 20 calibration
descriptions. A 30-description library has only 24 training descriptions in these
folds; the 45-description TV library has 39. They cannot satisfy that split even
though they contain useful information. Evaluate leave-description-out familiarity
using the existing neighbor cross-fitting approach as a pattern, keeping at least
20 references per calibration query and the entire outer fold excluded. This can
make small incumbents assessable without hardcoding their names or lowering the
minimum evidence requirement. It must be tested for stability and loss tradeoffs;
it is not an instruction to auto-accept sparse matches.

Then assess the remaining distinction abstentions. Only after representative
validation should live advisory integration separate fallback identity from
comparison order. Do not globally remove policy vetoes or train on Classifarr's
own unverified decisions to manufacture agreement. No release is created here.
