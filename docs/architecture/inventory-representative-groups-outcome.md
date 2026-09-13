# Inventory-derived representative groups: outcome

Date: 2026-09-13

## Decision

The new component learns multiple content groups from actual cached inventory and
retains real examples for each group. Keep its routing comparison offline for now.
Across 800 distinct movie/TV descriptions, placement agreement improved from
719 to 722, but that included 16 gains and 13 losses. The known 700 controls were
neutral overall. The separate 100-item cohort improved by three. This is modest
evidence of potential value, not established classification accuracy.

The [design](inventory-representative-groups-design.md) was fixed before evaluation.
Two small ESM services implement bounded geometry and scoped group learning/scoring.
The existing comparison runner and CLI were extended, preserving shared rank
fusion, source verification and read-only execution. No provider, dependency,
schema, UI control or model download was added.

## Measured results

All four final reports passed source and embedding verification and used identical
snapshot components: 6,655 normalized documents, 6,652 cached description vectors,
6,657 metadata entries and ten libraries. Five-fold exclusions removed every copy
of each held-out description before learning. Shared memberships were not counted
as independent training examples. Every eligible training description was used;
there was no hidden per-library sample.

| Cohort | Evaluated | Before | After | Gains | Losses | Changed rankings |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original regression cohort | 300 | 253 | 257 | 8 | 4 | 12 |
| Additional regression cohort | 300 | 280 | 278 | 4 | 6 | 10 |
| Prior pair-pilot cohort | 100 | 95 | 93 | 1 | 3 | 4 |
| New cohort, excluding all prior 700 | 100 | 91 | 94 | 3 | 0 | 4 |
| Total | 800 | 719 | 722 | 16 | 13 | 30 |

Before/after means agreement with observed library membership, not verified labels.
One changed ranking moved between two destinations that both disagreed with the
observed placement. No model-generated or historical placement was promoted to
ground truth. No routing confidence was inflated.

The 579 consensus cases were unchanged. Only the 221 unique description/metadata
disagreements used group scoring. No partial-pool fallback was needed in this
snapshot. The new cohort contained 58 movies and 42 TV descriptions: movies stayed
at 54/58 agreement and TV moved from 37/42 to 40/42. Three small libraries had no
remaining unseen queries after prior samples, but all ten remained in candidate
and training scope. Query overlap with prior cohorts was zero.

Source metadata changed during the first attempt at the prior 100-item cohort.
The run invalidated itself and was excluded. That cohort and the earlier 300-item
controls were rerun against the refreshed snapshot; the final four reports share
the same source hashes. Background updates and freshness checks were not disabled.
These repetitions are not additional distinct samples. Every invocation used
zero model-generation calls and made no routing, policy or label writes.

## What the groups covered, and the important limitation

Each fold learned 58–60 supported groups across ten libraries. Eligible training
coverage ranged from 6,590 to 6,630 distinct media/description groups per fold.
Only 7–12 descriptions per fold fell into unsupported groups. At least 99.81% of
eligible training descriptions belonged to a supported group. This is **coverage**,
not a correctness or confidence percentage.

However, **108 of 200 library/fold fits reached the 12-pass limit without proving
stable assignments**. Their centroids are bounded approximations, not guaranteed
optima. The chosen capacity heuristic and initialization also remain unvalidated
against alternatives. Deterministic output under reordering does not establish
stability under a different initialization or a changing inventory.

Cumulative fitting time across the four final five-fold runs was 40.983 seconds
(10.890, 10.020, 9.663 and 10.410 seconds). Retrieval, snapshot verification and
other work are additional. Backend tests ran concurrently, so these measurements
are observations from this local run, not a throughput guarantee. The component
reused `mxbai-embed-large:latest` vectors with 1,024 dimensions and the existing
`synopsis_only_1000_codepoints.v1` representation. It did not regenerate embeddings
or infer human-readable topic names.

## Recommendations, pros and cons

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Enable the current groups live | Small overall agreement gain; no generation cost | Thirteen agreement losses and frequent iteration-limit hits; defer |
| Increase routing confidence or change fusion weights | Easy to display a larger score | Would not establish correctness; reject |
| Add LLM-written topic summaries now | Easier for people to read | Does not solve group stability; adds cost and unsupported interpretations; defer |
| Stabilize representative learning first | Addresses the measured fitting limitation while reusing the new component | Requires additional bounded computation and comparison; recommended next |

**Next component: convergence and initialization stability for representative
learning.** Evaluate bounded continuation and multiple deterministic starts using
training-only fit criteria, then measure held-out ranking agreement between fits.
Report unstable groups and keep existing fallback. Do not select an initialization
using the known hold-out destinations. The official
[KMeans reference](https://scikit-learn.org/dev/modules/generated/sklearn.cluster.KMeans.html)
describes seed sensitivity and repeated initialization; it does not establish
Classifarr-specific routing quality or recommend this implementation's cap.

Once stable groups show repeatable held-out benefits, the next integration can
reuse source-versioned group models in the existing automatic refresh path. That
would avoid fitting per incoming item and would not require users to define every
library's purpose. Do not add that persistence/refresh integration before the
representation is stable. No extra acknowledgement or settings page is needed.

Final recommendation stack: keep the existing live matcher; retain this cached,
library-agnostic group learner and offline comparator; validate convergence and
initialization stability next; then consider automatic cached refresh and live
integration based on measured gains, losses and cost.

## Security, accessibility and reproduction

Source/model checks, duplicate exclusion, exact hold-out matching, media isolation,
complete-pool validation, bounded arithmetic and cancellation are covered by tests.
Tiny or zero-direction groups cannot invent support. Metadata remains untrusted
observational context; clustering does not sanitize poisoned source content.
Private centroids, description hashes and example identities stay in-process.
Public reports contain only counts, aggregate similarities, anonymous library
strata and whole-snapshot fingerprints. Existing PostgreSQL read-only enforcement
was used for every local run.

The design documents the researched OWASP and W3C guidance. No UI changed and
existing SWR behavior remains intact. This avoids adding another dense status
panel; any later display must preserve accessible control over updates.

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --evidence-reranker --representative-groups --max-minutes 10
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --exclude-prior-size 300 --folds 5 --evidence-reranker --representative-groups --max-minutes 10
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 100 --exclude-prior-sizes '300,300' --folds 5 --evidence-reranker --representative-groups --max-minutes 10
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 100 --exclude-prior-sizes '300,300,100' --folds 5 --evidence-reranker --representative-groups --max-minutes 10
```

The CLI rejects missing grouped evaluation, generation or conflicting modes before
loading configuration. If a report is invalidated, retain its status and rerun
against fresh data; do not mix source versions or count repeated queries as new.

## Validation and delivery

Focused validation passed five suites / 69 tests. New services reached 100%
statements, functions and lines, with 98.37% branch coverage. Tests include multiple
content directions, real representative membership, name/order invariance, held-out
copies, shared and wrong-media membership, sparse/degenerate groups, bounded
iterations, invalid vectors, cancellation, redaction and source-drift rejection.
Full backend regression passed **1,277 suites / 36,907 tests** in 908 seconds.
Coverage reached 90.11% statements/lines, 82.36% branches and 92.18% functions.
The repository coverage ratchet passed using fresh backend coverage and the
existing unchanged-client report. No coverage thresholds were weakened.
Backend typecheck, test/security lint, dependency/copyright preflight, Markdown
lint and ESM checks passed. Final focused validation included the iteration-limit
regression fixture; all 69 focused tests passed.

The previous commit's CI/CD, CodeQL, copyright, OSV, Gitleaks and Trivy checks all
passed. GitHub MCP found no open Classifarr PR for random selection; none was merged
or substituted from another repository.

No API/schema/dependency/version change or release is included. No new frontend
or dedicated PostgreSQL integration suite is claimed; real read-only benchmark
execution used the local Compose runtime. Private reports remain outside Git.

## Follow-up

The next implementation is documented separately in the
[stability design](inventory-representative-stability-design.md) and
[stability outcome](inventory-representative-stability-outcome.md). The results
above remain the original 12-pass experiment, not a retrospective claim about
multi-start fitting.
