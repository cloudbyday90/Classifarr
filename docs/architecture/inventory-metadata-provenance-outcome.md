# Inventory metadata provenance outcome

## Delivered behavior

The existing background enrichment queue now captures a compact, versioned TMDb
observation for the resolved movie/TV identity. It stores provider keywords and
original language with acquisition provenance. Source tags remain in their own
field. Sync, refill, completed-item reprocessing, and classification fallback
paths no longer fabricate English when language is absent.
Previously queued enrichment payloads also re-read these traits from current
source observations, removing legacy guessed language and tag-derived keywords.

The existing gap-analysis scheduler discovers missing observations for identified
items in active libraries when TMDb has an active configuration with a key.
Observation-only backfill skips OMDb, web search, identity searches, and history
insertion. Normal enrichment captures observations after the existing typed
identity resolver. Cached successes, including empty results, are reused for
30 days; failed attempts cool down for six hours. Requests retain the existing
rate limiter and a 10-second transport timeout.

Two typed database timestamps track attempts and successful acquisition
independently. Typed identity changes reset both clocks so the new identity can
be observed immediately. A failed refresh preserves the last successful observation and
does not extend its acquisition time. Source identity/type/library guards block
stale writes. Profiles ignore keyword/language records without matching typed
provenance, including legacy flat language defaults and unattributed TMDb fields.
Acquisition and retry timestamps do not trigger profile regeneration. Actual
observed changes feed the existing revision/outbox worker automatically.

Provider failures complete background tasks with an unavailable observation
result and remain eligible for later automatic retry. This avoids both an
operator-driven retry workflow and a false successful-enrichment claim. Cached
or skipped tasks report unchanged. Source placements remain observations.

## Local Compose assessment

On September 5, 2026, the current ESM services fetched TMDb observations for a
real 32-item sample from the configured local Compose inventory. Selection used
distinct typed TMDb identities, a fixed hash seed, and 16 items per media type.
Only minimal source fields were read. No live inventory, classification history,
policy, or profile was written, and no provider payload or source identifier was
saved into the repository.

| Measurement | Result |
| --- | --- |
| Movie / TV items | 16 / 16 |
| Libraries represented | 7 |
| Successful validated provider observations | 32 / 32 |
| Keyword observations before / after | 0 / 30 |
| Original-language observations before / after | 0 / 32 |
| Items with no provider keywords | 2 |
| Distinct keyword values / original languages | 238 / 3 |
| Provider requests on first / immediate cached pass | 32 / 0 |
| Rejected or unavailable responses | 0 |
| Local elapsed time, including both passes | 1,996 ms |
| Live source writes | 0 |

These are acquisition and coverage measurements, not classification accuracy or
proof that every source identity is correct. The cohort was not independently
human-labeled and cannot satisfy the readiness or frozen-study gates. Its
balanced media-type sampling is also not an estimate of the full inventory's
language distribution. The two empty keyword responses correctly remain unknown
coverage rather than becoming negative evidence.

## Validation

Focused tests cover typed movie/TV envelopes, bounded Unicode labels, source-tag
separation, missing/invalid language, malformed provider records, mismatched IDs,
cache reuse, independent expiry/retry clocks, and redacted failure logging.
Real PostgreSQL tests cover automatic selection, existing queue exclusion,
active/configured prerequisites, empty successes, outage recovery, identity
drift during requests, unchanged bookkeeping, and aggregate trait propagation.

| Check | Result |
| --- | --- |
| Full backend coverage run | 1,050 suites / 29,457 tests passed |
| Final queue, enrichment, and profile regressions | 34 suites / 633 tests passed |
| PostgreSQL observation, refresh, and identity integration | 6 suites / 42 tests passed |
| Backend line / branch / function coverage | 90.05% / 80.33% / 92.66% |
| Coverage ratchet | Passed; unchanged client uses its existing report |
| Server/client lint and types | Passed |
| ESM imports and strict mock shapes | Passed |
| Knip code and production-dependency checks | Passed |
| Markdown and migration checks | Passed |
| Local Docker image build | Passed |
| Migrated database and fresh-install snapshot | Passed |

The final targeted run also verifies that malformed pending task IDs cannot
break refill. Frontend source and API contracts did not change; the Docker build
and client lint/type checks validate the existing UI integration. The live
Compose service remained on its existing image during the read-only assessment.

The final migration was applied to the prior committed schema in a disposable
container before regenerating the fresh-install snapshot. Both the clock-reset
trigger and the provider projection were inspected in the result. This avoids
a snapshot round trip silently skipping an edited unpublished migration whose
filename is already marked applied; the lesson is recorded in
[migration maintenance](../MIGRATION_SYSTEM.md#verify-an-edited-unpublished-migration).

## Recommendations and tradeoffs

| Layer | Pros | Cons / limits | Recommendation |
| --- | --- | --- | --- |
| Typed, attributable provider observations | Clear origin and reliable separation from local organization | Existing IDs and upstream descriptions may still be wrong | Keep as the metadata foundation |
| Existing queue, limiter, persisted observation cache | Low operator effort; no new scheduler or dependency | Cached per inventory row; duplicate placements can make separate requests | Keep; measure duplication before adding a shared cache |
| Coverage-aware profile aggregation | Common traits become measurable without assuming missing values | Coverage does not establish precision; stale successful metadata survives outages | Keep denominators and provenance explicit |
| Identity retention across source resync | Keeps resolved items and their observations useful without repeated review | Retention must verify source continuity; blindly retaining IDs is unsafe | Next fix |
| Cross-library overlap summaries | Answers what exists, where, and what is common | Needs bounded comparisons and visible sparse-data limits | Follow identity retention |
| Semantic counter-evidence | May help identify ambiguous items for review | Requires independently measured errors and the existing study gates | Remain gated |

The recommendation stack is synchronized inventory → typed provider observations
→ automatically refreshed profiles with known/missing counts → bounded,
read-only library comparisons → independently evaluated classification support.

**Next item:** preserve resolved typed identities across a source resync when
the source merely omits its TMDb ID. Static inspection of
[mediaSyncUpsert.mjs](../../server/src/services/mediaSyncUpsert.mjs) shows that
`tmdb_id = EXCLUDED.tmdb_id` currently replaces a resolved ID with null in that
case. This can discard the identity needed to reuse observations and can create
repeated exception work. This is a code-path finding, not a measured incidence
rate in the live inventory.

Record resolution ownership and verify source continuity before retaining an
ID. Test omission separately from a changed type, conflicting provider IDs, or
a reused source item. Avoid a blanket `COALESCE` that could retain the wrong
identity. After that fix, add a bounded, coverage-aware cross-library overlap
summary using shared typed identities and common traits. Reuse stored
observations and expose insufficient evidence when coverage is sparse.

## Scope and delivery

GitHub's open-PR listing was empty on both checks for this task, so no random open
PR could be selected or implemented. Closed dependency PRs were not substituted.
The [design](inventory-metadata-provenance-design.md) records official sources,
alternatives, and the requested August 2026 research-date qualification.
Changes stay under Unreleased with package versions unchanged and no release.
