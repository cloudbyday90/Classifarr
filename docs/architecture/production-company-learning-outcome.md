# Production-company learning: outcome

Date: 2026-09-22. Implements the
[design and researched tradeoffs](production-company-learning-design.md).
The separate [PR #539 outcome](codeql-pr-539-outcome.md) covers CI tooling.
No release, version bump, PR merge, schema migration or new UI.

## Root cause and implemented behavior

The previous organization handoff repair preserved company metadata for new
classifications and retries. Inventory enrichment, however, requested TMDB
details and then discarded the production-company list. An existing fresh
keyword/language observation could also suppress another fetch for 30 days.
Consequently, preserving the query field alone could not train an inventory
company model.

The existing observation now retains bounded company names and IDs. Refill and
enrichment recognize older observations that lack the set, retry them after the
existing six-hour cooldown, and cache valid empty sets without repeatedly
fetching them. Provider failures leave prior data intact. Source-identity guards
still prevent enrichment of unresolved or changed identities. No administrator
acknowledgement or per-library purpose declaration is added.

Small ESM services implement company projection, fitting and benchmarking. The
existing estimator accepts a field configuration; its default genre/studio/rating
behavior and score formula remain unchanged. Company IDs take precedence over
localized names. Movie and TV backgrounds remain separate, and library names
are not inputs. Expiry, conflicting copies, or identity mismatch make only the
company channel unavailable. Both models count against the existing cache budget.

The live reader learns the company model and computes a separate diagnostic fit.
The existing routing/prompt projector deliberately excludes that new field.
This change does not raise displayed confidence, lower thresholds, authorize
routes, or claim improved classification accuracy before measuring it.

## Live 300-item check

A one-shot non-root container read the running application's database through
a read-only repeatable snapshot. It used the running immutable image plus a
read-only current-source mount, a read-only filesystem, dropped capabilities,
CPU/memory limits and SQL timeouts. It made no provider calls and did not restart,
rebuild, deploy or mutate the application. No raw library metadata, titles or
credentials are included in the report or committed to the repository.

| Measurement | Movies | TV |
| --- | ---: | ---: |
| Unique sampled items | 150 | 150 |
| Libraries represented | 5 | 5 |
| Usable company observations | 0 | 0 |
| Existing metadata-only model decisions | 150 | 150 |
| Agreement with existing placement | 116 | 127 |
| Company-only decisions | 0 | 0 |
| Paired baseline/company decisions | 0 | 0 |

Seed: `company-study-20260922`; three grouped folds. Snapshot fingerprint:
`1ccd3f06c3ae5ab36cd3e975170279e3725f16df271bb10875050b1b0c55332f`.
Each library contributed 30 selected items; two had 31 membership observations
because selected items can belong to more than one library. Per-fold baseline
training descriptions were 6,554 / 6,553 / 6,553; company training coverage was
zero throughout. Abstention is not counted as a changed destination.

These figures measure **held-out agreement with existing inventory placement**,
not accuracy, the complete production classification pipeline, or an incremental
cohort disjoint from every previous study. No independent outcome labels were
used. The lack of company coverage prevents any claim of live company benefit.
The running application still has its previous code: the new automatic capture
and backfill become active when this change is deployed through the normal
workflow, not merely when this commit is pushed.

Reproduce against a configured database with
`node server/src/scripts/runInventoryCompanyBenchmark.mjs --seed company-study-20260922 --size 300 --folds 3`.
The CLI enforces a read-only transaction and fixed SQL timeouts, closes its pool
on failure, and prints aggregate JSON only. For a Compose installation, use an
isolated read-only helper with the same safeguards as the checked-in
`docker-compose.benchmark.yml`; do not invoke a deployment or recreate the app
just to run a benchmark. The helper used here was removed after completion.

## Verification

Tests cover bounded sets, stable IDs, duplicates, stale/future timestamps,
conflicting copies, missing versus known-empty observations, grouped exclusions,
movie/TV separation, library-name independence, neutral universal/unseen companies,
cache reuse/invalidation/accounting and routing/prompt isolation.

A deterministic synthetic 300-item benchmark covers six arbitrary libraries,
150 movies and 150 TV items. Company-only placement agreement is 300/300 while
the deliberately nondiscriminating baseline abstains. This verifies the mechanics;
it is not evidence of production accuracy or a comparison of AI providers.

Real PostgreSQL integration tests exercise legacy-observation backfill, cooldown,
provider failure and recovery for both media types, and the SQL-to-live-model
path with held-out identities. Existing fixture observations were updated to
include explicit empty company sets when testing other complete-observation
behavior; separate new tests retain the missing-company cases.

The final backend unit rerun passed 1,378 suites / 40,440 tests. The final full
database integration rerun passed 146 suites / 1,702 tests. One pre-existing
opt-in Compose provider-fault test remained skipped; no new skip or waiver was
introduced. The focused SQL recheck passed three suites / 38 tests.

The client coverage run passed 371 files / 5,173 tests. A separate targeted
coverage run for the three new company services and CLI passed 21 tests: the
services had 100% statement/line/function and 98.3% branch coverage. These focused
figures are not a repository-wide coverage claim. The successful CLI entry path
was also exercised in the read-only container; its direct-launch error handler
was not exercised by that live run.

Server type checking, ESLint, both Knip gates, ESM/static-import and mock-shape
checks, copyright, npm-flag checks, documentation lint, Actionlint and whitespace
checks passed. Staged secret scanning found no leaks. No coverage baseline was
changed. The preceding commit's hosted CI passed; this commit requires its own
hosted run after push.

The full backend coverage run also passed all 40,440 tests. Fresh server/client
reports passed the repository coverage ratchet: server statement/line coverage
90.36%, branches 83.74%, functions 92.50%; client statements 85.62%, branches
77.60%, functions 85.12%, lines 87.69%. Differences from the stored historical
baseline are not attributed to this change alone.

## Recommendation and next item

Keep the existing PostgreSQL, typed TMDB adapter, bounded recovery queue and ESM
contrastive estimator. The benefit is automatic acquisition and learning across
arbitrary libraries without another platform or review screen. The tradeoff is
that source coverage and independent calibration are required before this extra
signal can safely influence routing; existing placements can contain mistakes.

Next: **outcome-grounded calibration of description + company ranking**. After
normal deployment/backfill, repeat this exact coverage check, then evaluate the
combined ranker against eligible confirmed/corrected outcomes using held-out
identities and description groups. Compare baseline and combined decisions,
abstentions and regressions per movie/TV library. Promote the feature only where
it demonstrates benefit without weakening eligibility or identity safeguards.
This is a measurable ranking improvement, not more sample-count increases,
manual purpose declarations or cosmetic confidence changes.
