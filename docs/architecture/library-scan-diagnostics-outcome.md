# Automatic library scan diagnostics outcome

## Delivered behavior

The [design](library-scan-diagnostics-design.md) is implemented through two small
ESM backend modules and two Vue presentation components. The existing authenticated
history GET adds `library.scan_diagnostics.v1` under `scanDiagnostics`, using the
same SQL snapshot for retained points, current library activity and catalog counts.
The sampling contract, scheduler, storage and classification behavior are unchanged.

The library view automatically shows retained complete measurements, partial and
discarded visits, recorded restart reasons, observation span, last completion age
and scan baseline/duration. A repeated-reset finding requires at least two recorded
restarts or discarded visits since the last retained completion. A later complete
visit clears that unresolved finding while preserving historical reason counts.
Legacy points cannot establish an incremental completion.

Current active-library totals distinguish complete measurements, no retained
completion and no incremental visits. Only the first 12 unvisited IDs are returned,
with an explicit omitted count. Existing catalog names provide escaped labels.
Current totals do not silently reuse the count from the last background visit.

Active libraries with repeated resets, expirations or no retained completion are
prioritized in the existing local pagination. Static findings do not introduce
per-library live alerts. Keyboard-operable native disclosures expose restart
reasons and visit tables without additional HTTP requests.

## Boundaries and security

Diagnostics read at most 2,016 points and the current library catalog. PostgreSQL
plan inspection confirms no inventory or scan-progress access. A maximum-spread
fixture with 2,016 measured libraries and 2,029 active libraries stays below a
four-megabyte response budget; unvisited examples remain capped at 12. Counts
cost work proportional to catalog size. The 12-library page size also bounds
visible detail rendering.

The response explicitly identifies its inclusive retained window. No completion
in that window does not mean a library has never completed or has failed.
Elapsed unresolved time is measured from a retained visit, not continuous processing.
A completed coverage measurement is not complete metadata or classification truth.

The projection allowlists counters, times, statuses and library IDs. Private
fingerprints, revisions, item cursors, metadata and provider configuration stay
excluded. The route retains authentication, rate limiting, query rejection,
generic failure responses and `Cache-Control: no-store`. This change adds no
mutation endpoint, migration, provider request, manual collection or scheduler.

## Local validation

Focused backend checks passed 25 tests; focused client/API checks passed 43 tests.
PostgreSQL checks passed 59 tests across six suites covering diagnostic catalog
scope, legacy/expired/future evidence, repeated actual sampler restarts, recovery,
retention bounds, fair rotation and earlier history/health contracts. The initial
out-of-window fixture was corrected to move by whole weeks, preserving the
storage slot check constraint rather than disabling it.

Six Chromium checks passed across diagnostic, incremental and retained v2
sampling, observation history, health and overlap. They verify local keyboard
pagination/disclosures, mobile containment and table scrolling. The diagnostics
scenario makes one history GET and zero writes.

Full backend coverage passed 30,098 tests across 1,061 suites in 555.7 seconds;
full client coverage passed 4,488 tests across 326 suites in 238.6 seconds.
The coverage ratchet passed: backend line/branch coverage is 90.10% / 80.57%,
and client line/branch coverage is 87.86% / 77.65%. After visual review aligned
the browser fixture's diagnostic times with its recorded visits, the affected
43 client/API tests and diagnostic browser scenario passed again.

Repository lint, server/client type checks, static ESM imports, strict ESM mock
shapes, both server unused-code checks, migration naming/schema integrity,
Markdown validation (1,006 documents) and the local Docker image build passed.
Desktop and mobile screenshots were inspected. No release artifact was published.

## Compose assessment

The existing local Compose service supplied 32 real typed identities: 16 movies
and 16 TV items across eight libraries. All fixture construction, controlled
metadata, revision changes and sampling took place in temporary tables inside a
rolled-back transaction. Seven controlled empty libraries exercised fairness;
20,000 padding rows made one library contain 20,001 rows. Two further active
libraries were added after sampling to test the unvisited catalog distinction.

| Observation | Result |
| --- | --- |
| Valid / malformed controlled metadata observations | 6 / 26 |
| Recorded visits | 136 |
| Large-library complete scans | 3 |
| Repeated-reset checkpoint | 2 recorded restarts, 1 discarded visit |
| Subsequent complete scan | Cleared unresolved finding and counters |
| Last complete scan elapsed time | 75 minutes in the controlled timeline |
| Active libraries / with complete measurements / without visits | 17 / 15 / 2 |
| Smaller libraries with comparable measurements | 14 |
| Assessment / final read | 7,980 ms / 10 ms |
| Final response | 87,631 bytes |
| Provider requests / live writes / classification writes | 0 / 0 / 0 |
| Temporary-table rollback | Verified |

The running application was not redeployed. These controlled results establish
diagnostic behavior; they do not estimate production churn rates or classification
accuracy. Real identities and controlled fixtures are not independent human labels.
Readiness and frozen-study gates remain unchanged.

## Recommendations, tradeoffs and next item

| Recommendation | Pros | Cons or limit |
| --- | --- | --- |
| Derive diagnostics from existing visits | Automatic, attributable, bounded; no operational setup | Evidence expires and cannot establish root cause |
| Count current active catalog in the same snapshot | Distinguishes unvisited libraries from successful coverage | Query cost scales with library count |
| Separate restarts, discarded pages and completion | Avoids false restart/failure claims | More concepts to explain |
| Prioritize unresolved active libraries | Surfaces useful evidence without manual sorting | Descriptive priority is not an incident severity |

Recommended stack: synchronized inventory → transactional observation revisions
→ automatically maintained profiles → fair incremental measurements → retained
completion/restart diagnostics → measured bounded recovery → independently
evaluated review-only semantic evidence. Official PostgreSQL and W3C research and
the August 2026 date scope are linked in the
[design](library-scan-diagnostics-design.md#official-research-and-august-2026-scope).

Next: benchmark recovery under controlled continuous enrichment. Compare a capped
extra visit budget with a bounded frozen projection, measuring time to completion,
storage cost and delays imposed on other libraries. Select an implementation only
when it preserves consistent scan inputs, strict work bounds and fair turns.
Do not bypass revision checks or introduce semantic routing to hide missing evidence.

Follow-up completed: the [recovery benchmark design](library-scan-recovery-benchmark-design.md)
and [measured outcome](library-scan-recovery-benchmark-outcome.md) compare both
candidates. Neither satisfies the existing work/completion gates across tested
populations; bounded change repair is the next implementation to evaluate.

The GitHub MCP open-PR query returned no open pull requests on 6 September 2026,
so there was no PR available for random selection or local implementation. No
external PR was merged and no release was created.
