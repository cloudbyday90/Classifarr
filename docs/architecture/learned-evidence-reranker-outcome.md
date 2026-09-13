# Learned evidence reranker: outcome

Date: 2026-09-13

## Decision

**Do not replace the current matcher with the tested global recipe selector.**
The experiment improved some matches but lost more agreement than it gained,
including cases where descriptions and aggregate metadata already agreed.
Live routing, review requirements, AI prompts, policy scores and settings remain
unchanged. The six original disagreements are not claimed fixed.

The implemented component provides reproducible field attribution and nested
learning/evaluation, not another diagnostics panel or an automatic-routing switch.
The [design document](learned-evidence-reranker-design.md) records the researched
alternatives, security boundaries and recommendation stack.

## Root-cause findings

The existing metadata score averages contrastive genre, studio and audience-rating
fits. A populated metadata field is not necessarily usable evidence: unseen or
universally observed terms are neutral. Different fields favor different libraries
in the six investigated conflicts. There is no single globally bad field.

An initial numeric-only probe of the original 300 cases found 246 placement
agreements using aggregate metadata alone, compared with 200 for genre alone,
217 for studio alone and 146 for rating alone. Field-only numbers include the
deterministic tie-break and are not evidence of confident classification. Removing
studio or rating in that exploratory probe also reduced agreement. These are
ablations, not causal importance estimates or accuracy measurements.

The discrepancy is between a query's retrieved description neighbors and broad
library-wide trait correlations. Re-fetching unchanged metadata, increasing a
displayed confidence number or suppressing the warning would not resolve that
discrepancy. Whether local subgroups explain it is the next testable hypothesis,
not an established root cause of every disagreement.

## Local evaluation

Both evaluations used five outer grouped folds. Each fold selected one recipe
for movies and one for TV using up to 100 separate inner examples, three inner
folds and mean per-library placement agreement. Actual inner samples contained
50 movies and 50 TV shows per outer fold. Held-out description copies were
excluded before fitting profiles or retrieving examples. The five fixed recipes
were not retuned after seeing either outer result.

This comparison measures candidate ranking across active same-media libraries,
not the complete policy/AI/familiarity decision. Its counts are not automatic
review resolutions. All live eligibility and authorization checks remain intact.

| Cohort | Current ranking agrees | Learned recipe agrees | Gains | Losses | Changed choices |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original 300 | 253 | 250 | 7 | 10 | 20 |
| Additional, non-overlapping 300 | 280 | 264 | 2 | 18 | 21 |

The original cohort covered all ten libraries: 150 movies and 150 TV shows.
The additional cohort contained 144 movies and 156 TV shows across nine libraries.
The tenth library's 30 descriptions were already exhausted by the original cohort;
they were not duplicated to inflate coverage. Earlier items remained available
as training evidence when they were outside the applicable held-out group.
There were **600 distinct outer test descriptions**, not 600 independent labels.

Movies accounted for all ranking changes. TV selected the existing baseline in
every fold. Original movie folds selected balanced fusion three times and no-rating
fusion twice; additional movie folds selected no-rating fusion throughout.
This training preference did not generalize to the outer results.

Among 206 original consensus controls, two agreements were gained and two lost.
Among 215 additional consensus controls, four agreements were lost and none gained.
Thus the experiment is not supported even as a blanket change to apparently
unambiguous cases. Placement disagreement does not establish a wrong answer;
placement agreement likewise does not establish correctness.

Both runs completed with unchanged source digests and verified installed embedding
identity (`mxbai-embed-large:latest`, 1,024 dimensions). They used cached vectors,
**zero additional AI generation calls**, no new embeddings, no database writes,
no route receipts and no policy changes. No per-item private data was committed.

## Reproduction

Run against the current local Compose image; later inventory changes can alter
the result. The commands emit aggregate JSON and separate progress output.

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --evidence-reranker --max-minutes 10
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --exclude-prior-size 300 --size 300 --folds 5 --evidence-reranker --max-minutes 10
```

The mode rejects generation, missing fold boundaries and combinations with other
experiments before loading runtime configuration. Source drift invalidates the
report. Private snapshots and feature maps stay in memory. Numeric attribution
was extracted without changing `contrastive_profile_v1` arithmetic or caches.

## Validation and delivery

- Full backend regression: **1,273 suites / 36,772 tests passed**. Coverage was
  90.08% lines/statements, 82.23% branches and 92.16% functions.
- Final focused coverage run: **five suites / 52 tests passed**. The four new
  modules reached 100% lines/statements/functions and 98.76% branches. Coverage
  includes score equivalence, library-balanced selection, missing fields,
  malformed evidence, held-out copies, media isolation, renaming invariance,
  cancellation, sparse pools, source drift and aggregate redaction.
- Copyright, development/production dependency checks, backend typecheck,
  backend test/security lint, Markdown lint, ESM static imports and mock-shape
  checks passed. No dependency lockfile or test threshold was weakened.
- Both actual 300-item evaluations passed on healthy local Linux Compose with a
  read-only root filesystem. Final publication uses the same scorer/recipes;
  subsequent changes tightened input/cancellation checks and added tests/docs.

No client or database contract changed. No new full frontend or PostgreSQL
integration run is claimed; the existing unchanged-client coverage report is
retained for the repository coverage ratchet.

GitHub MCP returned no open Classifarr PRs on both checks; no random open PR was
available to implement. None was merged or substituted from another repository.
The previous commit's CI/CD, CodeQL, Gitleaks, OSV, Trivy and copyright runs were
all successful before this work began.

No release, tag, dependency change, database migration or version bump is included.

## Next high-value component

**Neighborhood-conditioned metadata matching.** A library can contain several
distinct content groups. Compare an incoming item's metadata with its nearest
description neighbors inside each eligible library, rather than treating one
library-wide trait average as equally representative of every item.

Reuse existing embeddings and learned profiles; learn groups from actual content,
not library names. Exclude the item and its copies, discount shared/possibly
misplaced examples, and retain hard identity/media restrictions. Test the six
remaining conflicts alongside unchanged controls and the additional cohort.
Keep the current approach as the fallback where local evidence is sparse.
This is a matching improvement aimed at reducing manual decisions, not more
settings or mandatory library-purpose declarations.
