# Neighborhood-conditioned metadata matching: outcome

Date: 2026-09-13

## Decision

**Keep this matcher offline; do not replace live scoring.** Local metadata helps
explain four of the original six conflicts, but the broader experiment loses
more placement agreement than it gains. It does not establish safer automation.
There are no new settings, acknowledgements, UI panels or changes to SWR.

The [design](neighborhood-metadata-matching-design.md) records the fixed algorithm,
official research, pros/cons and recommendation stack. Two small ESM modules
implement deduplicated neighborhood indexing/scoring and conditional rank fusion.
The existing benchmark CLI now supports `--evidence-reranker --neighborhood-profiles`.
The previous recipe experiment remains reproducible with its original flag.

## Measured local results

Both runs completed on healthy local Linux Compose, with a read-only root and
read-only database sessions. Source and model checks passed. The snapshot held
6,655 documents, 6,652 cached description vectors and ten libraries. Neither run
generated embeddings, called AI generation, changed policies, routed media or
created labels. Parameters were not retuned after either result.

| Cohort | Current ranking agrees | Local-profile ranking agrees | Gains | Losses | Changed choices |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original 300 | 253 | 250 | 7 | 10 | 20 |
| Additional, non-overlapping 300 | 280 | 267 | 2 | 15 | 17 |

These measure agreement with existing placement, **not verified accuracy**.
The same 600 distinct descriptions were used in previous experiments; they are
regression cohorts, not a newly untouched test set. Each run used five grouped
folds with all held-out description copies excluded before profile fitting.

The original cohort covered all ten libraries (150 movies, 150 TV shows).
The additional cohort covered nine (144 movies, 156 TV shows); the tenth library's
30 descriptions were exhausted by the original cohort. All ten libraries remained
eligible candidate destinations and contributed training inventory. One shared
description belongs to two original library strata, so those per-library counts
sum to 301 while the actual original sample remains 300 distinct descriptions.

Local scoring ran on 94 original and 85 additional disagreements. Every evaluated
candidate had the maximum 20 distinct, usable, exclusive neighbors; these losses
were not sparse-data fallbacks. The 206 original and 215 additional consensus
controls retained exactly the same ranking. Original movies changed agreement
121 to 118 and TV 132 to 132. Additional movies changed 134 to 133 and TV 146 to
134: the largest regression was in additional TV, spread across all five TV
library strata.

## Original six conflicts

A separate zero-generation probe revisited the six original description/global
metadata disagreements using their unchanged original sample fingerprint and
held-out fold assignments. Source/model verification passed again. This compared
numeric evidence for the previously investigated description leader; it did not
re-run the AI or claim six fresh policy resolutions.

| Media | Investigated conflicts | Local metadata now uniquely supports description leader | Still conflicting |
| --- | ---: | ---: | ---: |
| Movie | 2 | 1 | 1 |
| TV | 4 | 3 | 1 |

All six local fused rankings selected the description leader and agreed with
placement, but **ranking agreement is not independent corroboration**. Two still
lacked leading local metadata support. None is claimed fixed in live routing.
This illustrates why improving a handful of known cases cannot alone justify
changing the matcher for all libraries.

## Interpretation and next component

The evidence does not support either global field reweighting or fixed-size local
metadata profiles as a general replacement. A possible explanation is that taking
20 neighbors from every library can give weakly related alternative libraries
equal representation; the experiment did not establish that as the cause of each
regression. More neighbor count or a higher displayed confidence is not a proven fix.

**Next: item-to-item semantic reranking for disagreement cases.** Compare the
incoming description directly with a small retrieved set, including the strongest
competing-library examples, before aggregating library evidence. This addresses
the relevance of the actual retrieved items instead of adjusting genre/studio/
rating averages again. It must remain library-name agnostic.

[Elastic's official semantic-reranking guidance](https://www.elastic.co/docs/solutions/search/ranking/semantic-reranking)
describes second-stage models that jointly consider query and document text on
bounded top-k results. The benefit is more detailed relevance comparison; costs
include inference latency, model availability and input-length limits. This is
an architectural recommendation, not a recommendation to add Elasticsearch or a
paid provider. Inspect existing local reranker/provider capability first.

Inspection found existing shortlist rank fusion and a local benchmark client for
two/three-candidate generation, not a dedicated cross-encoder adapter in those
services. Reuse appropriate transport and validation boundaries, but do not label
ordinary candidate generation as a cross-encoder score or download a model blindly.

Use the known 600 cases as regression controls and a separate untouched sample
for the next assessment. Retain the existing matcher on missing/unavailable
evidence, protect consensus cases, and measure both gains and losses before live
integration. No extra user declarations are needed to run that evaluation.

Follow-up: [semantic pair-reranking design](semantic-pair-reranking-design.md) and
[measured outcome](semantic-pair-reranking-outcome.md) implement the next bounded
description-comparison experiment using the installed local model.

## Reproduction

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --evidence-reranker --neighborhood-profiles --max-minutes 10
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --exclude-prior-size 300 --size 300 --folds 5 --evidence-reranker --neighborhood-profiles --max-minutes 10
```

The mode rejects incompatible experiments, generation and missing fold boundaries
before loading runtime configuration. It preserves the source-drift invalidation
and model-identity checks. Reports contain aggregates and whole-snapshot hashes,
not item titles, IDs, descriptions, metadata terms or per-item hashes.

## Validation and delivery

- Focused tests: four suites / 58 tests passed; both new modules reached 100%
  statements, branches, functions and lines. Tests cover hold-outs, duplicates,
  conflicting/missing metadata, shared membership, complete pools, media isolation,
  renaming/order invariance, bounds, sparse fallback, consensus preservation,
  CLI guards, redaction and source invalidation.
- Copyright, development/production dependency checks, backend typecheck,
  backend test/security lint, Markdown lint and ESM checks passed.
- Full backend regression: **1,274 suites / 36,810 tests passed** in 794 seconds.
  Coverage reached 90.10% statements/lines, 82.27% branches and 92.17% functions.
  The repository coverage ratchet passed using fresh backend coverage and the
  existing unchanged-client coverage report. Final Markdown and whitespace
  checks passed; no test threshold was weakened.

No client/API/database contract, dependency, lockfile, test threshold or live
classification service changed. No new full frontend or PostgreSQL integration
run is claimed. No release, tag, migration or version bump is included.

GitHub MCP found no open Classifarr PR available for random selection. No PR was
merged or substituted from another repository. The preceding commit's CI/CD,
CodeQL, copyright, OSV, Gitleaks and Trivy runs all passed before implementation.
