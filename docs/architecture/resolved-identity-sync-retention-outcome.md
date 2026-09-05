# Resolved identity sync retention outcome

## Delivered behavior

Classifarr now records a typed TMDb identity and compact source anchor when its
queue resolver or administrator confirmation establishes an ID. A later source
response that omits that ID retains it only while the source key, media type,
title and corroborating year/external identifiers remain consistent. Repeated
omissions preserve known anchors instead of forgetting evidence of a conflict.
Moving an unchanged item between libraries keeps its identity and refreshes both
library observations through the existing database lifecycle.

Explicit source IDs remain authoritative. Changed identities discard stale
resolution and enrichment metadata, reset observation clocks and rating
normalization, and become eligible for existing background recovery. Legacy IDs
without recorded provenance require fresh resolution after omission. This avoids
manufacturing historical evidence or adding routine operator review.

Small ESM services separate normalization and continuity decisions, sync SQL,
bounded persistence retries, and guarded resolver writes. Conditional upserts
retry a concurrent insert or update at most three times, re-reading the current
row before each decision. Contention exhaustion leaves the concurrent writer
intact. Incoming source metadata cannot forge the server-owned origin, resolution
receipt, or TMDb observation. Whole-value provider ID validation rejects numeric
suffixes and conflicting Plex GUIDs without overwriting the stored item.

Queued titles, years and external IDs are refreshed from the current source.
Queued TMDb IDs cannot resurrect an identity that the current row lost. The
resolver writes its ID and provenance atomically only if captured source fields
still match. Administrator confirmation retains its existing authorization,
preview expiry, transaction locks, and audit receipt.

## Local Compose assessment

On September 5, 2026, a fixed hash sample selected 32 distinct typed identities
from real active-library inventory: 16 movies and 16 TV items across seven
libraries. The current ESM persistence and queue services operated on private
connection-local temporary tables. Provider responses were controlled regression
fixtures using each sampled source ID, not new identity-verification results.
All fixture writes rolled back; live source rows were only read.

| Measurement | Result |
| --- | --- |
| Source items / libraries | 32 / 7 |
| Queue resolutions with attributable origins | 32 |
| Retained IDs across three omission passes | 96 / 96 |
| Changed-title replacements invalidated | 32 / 32 |
| Malformed-ID updates rejected without row changes | 32 / 32 |
| Provider network requests / live source writes | 0 / 0 |
| Fixture elapsed time | 544 ms |
| Temporary-table rollback verified | Yes |

This measures regression behavior on real source shapes. It does not measure
classification precision, prove sampled IDs correct, or supply independent human
labels. Existing semantic readiness and frozen-study gates remain unchanged.
No semantic counter-evidence, classification, routing or learning was enabled.

## Validation

Focused unit tests cover repeated omissions, source agreement, library moves,
weak/missing anchors, newly added and later omitted identifiers, contradictory
provenance, caller mutation, invalid provider structures and bounded retries.
PostgreSQL tests exercise actual constraints, concurrent inserts and resolutions,
late provider results, preserved cache clocks and profile revisions, changed
types, invalidation, and administrator confirmation with its audit receipt.

| Check | Result |
| --- | --- |
| Final full backend regression run | 1,052 suites / 29,575 tests passed |
| Focused identity, sync and enrichment regressions | 13 suites / 342 tests passed |
| PostgreSQL retention, review, provider and observation integration | 6 suites / 58 tests passed |
| Backend line / branch / function coverage | 90.07% / 80.39% / 92.68% |
| Coverage ratchet | Passed; unchanged client uses its existing report |
| Server/client lint and types | Passed |
| ESM imports and strict mock shapes | Passed |
| Knip code and production-dependency checks | Passed |
| Markdown and migration/snapshot integrity checks | Passed |
| Local Docker image build | Passed |

The instrumented coverage run identified three outdated fixture assertions: queue fixtures
needed the newly selected source fields, and two resolver assertions needed to
account for the atomic provenance write. Those fixtures were corrected before
the final full passing run. Production behavior was not relaxed to satisfy them.

The Docker image builds locally; the running Compose service remains on its
existing image. No schema, dependency, API or frontend contract changed. Package
versions remain unchanged, and the changelog entry is under Unreleased.

## Recommendations and next item

| Recommendation | Pros | Cons / limits |
| --- | --- | --- |
| Retain only attributable identities with source continuity | Removes repeat resolution and preserves useful observations automatically | Legitimate title/year corrections can require re-resolution; indistinguishable replacements cannot be detected |
| Reuse PostgreSQL conditional upserts and existing queues | No new infrastructure or operator setup; concurrent work stays protected | One extra source read per sync item and bounded retry work under contention |
| Keep typed observations and coverage counts | Supports understanding existing libraries and common traits | Source placement and provider metadata can still be wrong |
| Complete source guards on remaining enrichment writes | Prevents late data from contaminating library observations | Requires regression coverage across rating and metadata paths |
| Add bounded cross-library overlap after those guards | Answers what exists, where, and what is shared using existing inventory | Sparse coverage needs explicit limits; semantic interpretation still requires evaluation |

**Follow-up delivered:** captured-source checks now cover OMDb rating backfills,
final metadata, and history insertion. See the separate
[write-guard design](enrichment-source-write-guards-design.md) and
[write-guard outcome](enrichment-source-write-guards-outcome.md).
The original inspection found that
`queueOmdbEnrichmentService.mjs` guarded ratings by item ID and media type,
while `queueTaskProcessorEnrichment.mjs` guarded final metadata by ID, type,
library, and TMDb ID. A changed title or external identifier can leave those
fields equal, especially while TMDb remains null. Reuse the captured snapshot to
reject late writes after such source changes, allow unrelated bookkeeping, and
verify that stale work cannot insert history. A separate rollback-only Compose
reproduction confirmed both late writes after a title change with unchanged type,
library and null TMDb identity. The normal task also reached its history-persistence
callback and reported enrichment success. It made zero provider requests or live
source writes. This establishes the failure path, not its incidence in live
inventory. The linked follow-up records the fix and validation. Follow with
coverage-aware cross-library overlap.

The final recommendation stack is validated synchronized inventory → attributable
typed identities → source-guarded provider observations → automatically refreshed
profiles with known/missing counts → bounded library comparisons → independently
evaluated classification support. Manual effort stays on exceptional ambiguity
and limited validation samples.

The separate [design](resolved-identity-sync-retention-design.md) documents
alternatives and discovered official PostgreSQL, W3C PROV-DM, OWASP and TMDb
sources, including the requested August 2026 research-date qualification.

## PR selection and delivery

GitHub reported no open PRs on both selection checks. No closed PR was substituted
and no PR was merged. Delivery targets `origin/main` under the existing commit,
push and integration authorization, without creating a release.
