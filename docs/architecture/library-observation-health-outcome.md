# Library observation health outcome

Date: 2026-09-05. Implementation and local verification complete.

## Delivered behavior

Libraries automatically loads a read-only summary of TMDb observation coverage,
freshness, missing identities, retry backoff and related queue activity. Separate
ESM query, state, aggregate-service and route modules expose
`GET /api/libraries/observation-health` through the existing authentication layer.
The named client GET helper feeds separate coverage and detail components.

Counts describe inventory rows, including repeated placements, because observation
clocks and queue tasks belong to source rows. Fresh captures do not imply that
keywords or language are present. Unknown, malformed, undated and withheld
observations remain explicit; generic enrichment completion never proves capture.
The endpoint uses fixed input bounds, a rate limit, no-store responses and an
aggregate-only projection. It does not invoke providers, mutate the queue, alter
classification or change semantic readiness/frozen-study gates.

## Local Compose measurements

The current service was exercised inside the existing Compose container. That
running image predates the observation-clock migration. A transaction-local copy
of the current metadata projection allowed the new reader to inspect existing
inventory; unavailable clock columns were represented as null for compatibility.
Consequently the real-inventory check establishes coverage and queue counts,
**not live freshness-state accuracy**. The production endpoint requires the normal
migrated schema and has no fallback that silently fabricates those clocks.

| Real inventory measurement | Result |
| --- | --- |
| Active libraries / rows | 10 / 6,692 |
| Identified movie/TV rows | 6,659 |
| Active TMDb configuration present | Yes; this does not establish provider reachability |
| Attributable captures / known keywords / known language | 0 / 0 / 0 in the older running image |
| Rows linked to processing / pending metadata-enrichment tasks | 0 / 0 |
| Source snapshot queries / measured time / response size | 1 / 2,407 ms / 6,918 bytes |
| Live clock columns available | No; freshness states could not be verified for the running image |

This timing is one local measurement, not a throughput benchmark or latency SLO.
The current application must be deployed with its normal migrations before live
acquisition convergence can be assessed. No application deployment or release
was performed as part of this change.

## Controlled capture convergence

A reproducible 32-row cohort was selected from real source inventory: 16 movie
and 16 TV identities across six libraries. In private temporary tables, the
production observation-only task processor, TMDb observation service and guarded
metadata persistence were exercised with controlled provider responses. General
item-state callbacks were isolated; no running queue worker or paid provider was
used. This validates capture/persistence and measurement transitions, not the
deployed scheduler or real provider availability.

| Controlled phase | Health result |
| --- | --- |
| Initial current-source snapshot | 32 never observed |
| Successful capture | 32 fresh |
| Age successful clocks beyond the cache window | 32 due |
| Simulated unavailable provider | 32 in backoff |
| Expire retry cooldown | 32 due |
| Successful recovery | 32 fresh; all related tasks completed |
| Trait coverage after recovery | 16 known-keyword rows, 16 valid empty-keyword rows, 16 unknown-language rows |

There were 96 controlled provider-function calls, zero provider network requests,
zero live source writes and zero classification/history writes. Temporary changes
were rolled back and relation cleanup verified. These are deterministic regression
checks, not independent human labels or a measured classification error profile.

## Verification

- Focused backend checks passed 111 tests across health, overlap and TMDb
  observation behavior, including exact 30-day/six-hour boundaries, invalid clocks,
  empty captures, typed provenance, queue precedence, privacy, authentication,
  unexpected parameters and the actual rate-limit boundary.
- Eleven PostgreSQL integration tests passed using the actual query/projection:
  read-only execution, pending/processing deduplication, malformed queue payloads
  without unsafe numeric casts, provider configuration redaction, empty/inactive
  libraries, observation byte bounds and 20,000/20,001-row boundaries.
- Focused client checks passed 52 tests. Chromium checks health and overlap
  together, automatic loading, semantic tables, keyboard disclosures and horizontal
  scrolling, mobile page bounds, text contrast of at least 4.5:1, and no mutations.
  This scoped check is not a complete WCAG conformance audit.

The full client coverage run passed **321 suites / 4,365 tests**, with 87.74% line
coverage and 77.29% branch coverage. Both Chromium tests passed together; the final
health screenshot check passed after improving capture of the scrollable page.
Lint, server/client type checks, static ESM imports, strict mock shapes, Knip and
production dependency checks, all 994 Markdown documents and migration/schema
integrity checks passed. The local `classifarr:test` image built successfully,
including the production client build. No schema or dependency changes were needed.

The full backend coverage run passed **1,055 suites / 29,801 tests**, with 90.08%
line coverage, 80.47% branch coverage and 92.72% function coverage. The final root
`npm run coverage:ratchet:check` passed for both packages. The client instructions'
older `client/scripts/check-coverage-ratchet.mjs` path no longer exists; the root
command is the repository's current equivalent.

## Finding and next recommended fix

The controlled assessment reproduced a mismatch between the observation reader
and automatic refill eligibility. With the correct version, TMDb ID and media type,
a recent fetched clock and an attempted clock older than six hours, replacing the
keyword array with an invalid string makes the full reader reject the record.
Health reports one invalid observation due for capture. However,
`INVENTORY_TMDB_REFILL_SQL` checks identity fields and age without validating the
keyword/language record, so it excludes that row from observation-only refill.

**Next item:** align automatic refill eligibility with full attributable observation
validity. Preserve bounded selection, cooldown, active-library/provider conditions
and task deduplication; malformed or mismatched observations should become eligible
for automatic repair after cooldown. Validate agreement across SQL selection and
the existing JS reader, including wrong JSON types, invalid language and valid empty
captures. Do not fix this by retrying on GET requests or requesting routine manual
repair. This mismatch is distinct from the older Compose image lacking new data.

## Recommendations and tradeoffs

The separate [design](library-observation-health-design.md) records official W3C,
PostgreSQL and OWASP sources, August 2026 date qualification and state definitions.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Automatic bounded health summary | Explains evidence quality without per-item input | Current snapshot only; explicit population bounds | Use now |
| Align refill validity with the reader | Automatically repairs known malformed observations | SQL/JS validation parity needs careful regression tests | Next fix |
| Persist health trends | Measures convergence and regressions over time | Adds storage, retention and invalidation work | Defer until acquisition correctness is aligned |
| Infer success from general enrichment status | Simple | Conflates providers and hides missing traits | Reject |

Recommended stack: guarded source sync → attributable metadata with consistent
repair eligibility → automatic profiles → typed overlap → coverage/freshness
health → independently evaluated classification assistance.

## PR selection and delivery

The GitHub MCP open-PR listing was empty at task start and on the delivery recheck.
No closed PR was substituted for the requested random open PR. Delivery targets
`origin/main` under the user's commit, push and integration authorization, without
creating a release. README, Unreleased and the prior outcome chain are updated.
