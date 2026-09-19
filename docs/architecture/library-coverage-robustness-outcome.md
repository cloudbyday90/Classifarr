# Library coverage robustness: outcome

Date: 2026-09-19. Status: implemented and locally validated; no routing promotion.

## Delivered

Implemented the [coverage stress-test design](library-coverage-robustness-design.md)
as an exclusive `--coverage-robustness` mode in the existing description benchmark.
Three small ESM services separate orchestration, missingness masks and metrics.
The existing candidate comparator now exposes a private ranking result through
the same validation and abstention logic; its existing runtime return contract
and behavior are unchanged. No API, schema, settings or UI controls were added.

The runner uses cached vectors and one bounded production profile worker at a
time. Held-out descriptions and every copy are removed before fitting or choosing
masks. Missing vectors never erase memberships or candidate libraries. There are
no generation calls, routing writes, source-metadata repairs or runtime-cache
publications. Raw reports remain in ignored `.tmp/`; only aggregates appear here.

## Local Compose evaluation

Evaluated the original 300-case cohort and its disjoint additional 300-case
cohort, each with five folds and six fixed arms. Their fingerprints match the
earlier representative-profile controls. Both final runs completed with
`sourceVerified: true`, identical source digests, no shortfall and no cohort
overlap. The source contained 6,655 identities, 6,652 distinct cached descriptions,
6,657 metadata entries and 10 libraries. The evaluation included 294 movies and
306 TV entries. Repeated description text explains why identity and vector
counts differ; it is not missing cache coverage.

An initial run was invalidated after source drift and excluded from these
results. Comparing its starting digests to the successful rerun isolated the
change to candidate metadata. Source checks were retained, not bypassed; no
background jobs were disabled to obtain a result.

Each row below evaluates the same 600 descriptions. Agreement refers to existing
library placements, **not verified correctness**. Abstention is not counted as a
wrong placement or silently removed from the denominator.

| Arm | Compared | Placement agreements | Placement disagreements | Abstained |
| --- | ---: | ---: | ---: | ---: |
| Complete | 469 | 410 | 59 | 131 |
| Random 10% loss | 479 | 420 | 59 | 121 |
| Concentrated 10% loss | 466 | 412 | 54 | 134 |
| Random 20% loss | 0 | 0 | 0 | 600 |
| Concentrated 20% loss | 0 | 0 | 0 | 600 |
| Smallest learned group removed | 79 | 62 | 17 | 521 |

The complete arm's 131 abstentions were initialization-sensitive comparisons:
the fitted views did not agree on one destination. This is a profile-only
diagnostic, not the earlier hybrid reranker's accuracy metric or an end-to-end
live-routing measurement.

Paired changes against the complete arm:

| Arm | Both compared | Changed destination | Gained / lost placement agreement | New abstentions | Newly comparable |
| --- | ---: | ---: | ---: | ---: | ---: |
| Random 10% loss | 434 | 2 | 0 / 0 | 35 | 45 |
| Concentrated 10% loss | 429 | 4 | 1 / 3 | 40 | 37 |
| Smallest group removed | 66 | 0 | 0 / 0 | 403 | 13 |

Higher raw agreement in an incomplete arm does not establish an improvement:
some formerly ambiguous cases become comparable while other cases abstain.
The two random-loss destination changes remained disagreements in both arms.
Concentrated loss produced three lost agreements and one gain among cases both
arms could compare; the historical placement labels may themselves be wrong.

Actual per-library/per-fold coverage was 90.00%-93.10% for the 10% arms and
80.00%-83.33% for the 20% arms because removal counts are rounded down. The
20% arms correctly exercised the under-coverage gate. Whole-group removal ranged
from 0% to 99.43% retained coverage: a minority neighborhood can disappear without
crossing the global 90% threshold. That arm still permitted 79 TV comparisons,
while 506 cases were blocked by incomplete profiles and 15 were unstable.

| Scope | Cases | Complete compared / agreed | Random 10% compared / agreed | Concentrated 10% compared / agreed |
| --- | ---: | ---: | ---: | ---: |
| Movies | 294 | 227 / 208 | 233 / 210 | 228 / 211 |
| TV | 306 | 242 / 202 | 246 / 210 | 238 / 201 |

## Recommendations, tradeoffs and next component

Keep the current percentage gate as an availability safeguard for shadow
diagnostics. It is neither a semantic-confidence score nor evidence supporting
automatic routing. Do not lower it to make more comparisons appear successful.

- A 100% requirement is simple, but one deferred description can unnecessarily
  block a healthy library. This benchmark does not establish that 100% resolves
  ambiguity: 131 fully covered cases still abstained.
- A 90% requirement preserves useful partial comparisons, but can miss the loss
  of an entire minority neighborhood and can alter apparent stability.
- Neighborhood-aware coverage can target the actual missing content and improve
  automatic recovery. Its cost is a source-bound reference and support accounting;
  a stale or unavailable reference must remain explicitly unknown.

Final recommendation stack: validated cached descriptions -> complete membership
scope -> per-library availability gate -> stable all-candidate comparison ->
paired missingness evaluation -> source revalidation. Preserve existing automatic
backfill, accessible SWR pause controls and compact diagnostics. The official
research and W3C rationale are recorded in the design, not new user-facing panels.

**Next component: neighborhood-aware profile readiness and recovery priority.**
Use a validated last-complete profile to measure which learned content groups
lose support, prioritize their missing descriptions for bounded backfill, and
refresh the assessment automatically after recovery. Use no library-name or genre
rules. On first discovery or stale source bindings, report unknown support and
continue ordinary discovery/backfill rather than inventing confidence. Keep this
initially diagnostic and test the proposal against fresh held-out samples before
using it to alter routing. This addresses missing content, not every instance of
initialization sensitivity, which remains a separate measured limitation.

These two reused control cohorts, one inventory/model snapshot and one seeded
mask family per fold do not establish generalization. No threshold was tuned and
no model was promoted based on these controls. Independently checked difficult
cases are still needed to measure actual semantic correctness.

## Reproduction

Run against the locally built Compose service; the second command excludes the
first cohort from evaluation selection, not from other folds' training data.

```sh
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --coverage-robustness --max-minutes 15
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --exclude-prior-size 300 --folds 5 --coverage-robustness --max-minutes 15
```

## Verification and delivery

- Focused profile/benchmark regression run: 14 suites, 185 tests passed.
- Full backend: 1,294 suites, 37,581 tests passed. Coverage: 90.16% statements,
  82.63% branches, 92.24% functions, 90.16% lines.
- Full client: 368 suites, 5,120 tests passed. Coverage: 85.61% statements,
  77.56% branches, 85.08% functions, 87.66% lines.
- PostgreSQL description-cache and refresh integration: 2 suites, 12 tests passed.
- Coverage ratchet passed. All three new services and the shared comparator have
  100% line/function coverage; mask branch coverage is 96.15%, the others 100%.
- Full/production dependency scans, server/client type checks, lint, Markdown,
  static-import and ESM mock guards passed; `git diff --check` passed.
- Local Compose rebuilt successfully and passed health checks with its read-only
  root filesystem retained. No data volumes were removed.
- Randomly selected [PR #534 was applied locally](pr-534-local-tooling-validation.md)
  and tested, not merged. The preceding commit's six push workflows were green.
- Unreleased changelog updated. No release, tag or product-version bump.

Rollback is code-only: remove the benchmark mode/services and revert the
development-tooling update in a new commit. No database or media restoration is
required because the benchmark did not write to either.
