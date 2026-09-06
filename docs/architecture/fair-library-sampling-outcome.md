# Fair automatic library sampling outcome

## Delivered behavior

The [design](fair-library-sampling-design.md) replaces the combined hourly sampler
with one automatic visit every five minutes. A durable cursor traverses active
libraries using a fixed upper ID for each pass. New libraries cannot repeatedly
push earlier libraries out of the cycle; inactive or deleted libraries are
skipped, and restarts preserve progress. No manual library schedule is required.

Each visit reads at most 20,001 IDs and measures metadata only when the library
has at most 20,000 rows. An oversized library gets an explicit capacity result,
while subsequent smaller libraries remain measurable. Two-session concurrency
uses an atomic conditional cursor claim and point write. A failed write cannot
advance the cursor. Empty catalogs advance the clock without inventing samples.

The history API adds separate v2 sampling metadata and library points, preserving
legacy hourly frames. Comparisons use actual successive visit times for the same
library. Sampling interruptions, population changes, capacity and configuration
changes withhold deltas. Unchanged sampled counts do not assert continuous
stagnation, causality or classification readiness.

Libraries displays 12 summaries per local page and mounts each semantic history
table when expanded. Current library names are escaped display labels, inactive
history stays identifiable, and earlier hourly coverage has a separate disclosure.
Pagination and expansion make no requests. Authentication, rate limits, generic
errors and `no-store` remain in force; fingerprints and continuity keys stay
private. The implementation uses small ESM query, persistence and projection
services and reuses the strict observation measurement.

## Prior work and open PR inspection

Mainline already contained per-library trends (`8943eb82`), acquisition history,
malformed-observation refill, health and cross-library overlap. The documented
next gap was unfair combined sampling: only the first 12 libraries were eligible,
and crossing the shared 20,000-row limit withheld every selected library.

GitHub MCP returned an empty open-PR list on 5 September 2026. There was no eligible
random open PR to implement or test, and no PR was merged as a substitute.

## Local Compose assessment

Reused the private assessment runner against the existing local Compose database.
The assessment selected 32 real typed inventory identities across eight libraries,
then used transaction-local temporary tables, controlled observations and a
controlled clock. Seven empty fixture libraries and padding in one real library
tested traversal beyond 12 and independent capacity. This is a functional
assessment, not an elapsed-time production study or independent human labeling.

| Measurement | Result |
| --- | --- |
| Real typed inventory identities | 32: 16 movie and 16 TV |
| Real libraries / added empty fixture libraries | 8 / 7 |
| Explicit valid / malformed observation cases | 6 / 26 |
| Controlled padding rows in oversized library | 20,000, bringing it to 20,001 |
| Verified complete passes | 2, each visiting all 15 libraries |
| Total recorded visits | 33 |
| Oversized library isolated | Yes |
| Other libraries with comparable visits | 14 |
| Equal-count identity replacement | Affected comparison withheld |
| Missed sampling slots | Affected comparison withheld |
| Controlled assessment / history read time | 171 ms / 2 ms |
| History response | 14,669 bytes; private keys excluded |
| Provider requests / live writes / classification writes | 0 / 0 / 0 |
| Temporary-table rollback | Verified |

The first private run omitted the legacy trend column from its isolated fixture
setup. Applying the existing prerequisite to those temporary tables resolved the
harness error; the full assessment then passed. The running application was not
redeployed, and its live data was not changed.

## Validation and installation

Targeted backend checks passed 79 tests. PostgreSQL integration passed 59 tests
across six suites, including two concurrent database sessions, a 120,000-item
query-plan fixture, cursor resumption, append fairness, deletion/reactivation,
same-slot and stale writes, rollback, clock regression, seven-day visibility,
fixed-slot reuse, population changes and legacy read compatibility. The indexed
inventory scan stopped at the 20,001-ID sentinel and loaded no over-capacity
metadata. Legacy tests now use an explicit test-only legacy frame writer.

Targeted client checks passed 73 tests. Full client coverage passed 324 suites
and 4,454 tests: 87.82% lines, 85.83% statements, 77.56% branches and 84.83%
functions. The final central API fixture check passed nine tests.

Backend coverage measured 90.10% lines/statements, 80.54% branches and 92.74%
functions. The first full run found one stale test list that omitted the newly
declared seed migration; the other 30,032 tests passed. Updating that expectation
passed all 18 schema-tooling tests. The final full backend rerun passed all 1,059
suites and 30,033 tests. The combined coverage ratchet passed without regressions.

All four Chromium sampling/history/health/overlap checks passed, including mobile
containment, keyboard pagination, disclosures and table scrolling, one automatic
history GET and zero mutation requests. Desktop and mobile screenshots were
visually inspected. Existing tables retain captions and row/column header scope.

Lint, type checking, static ESM imports, strict test mock shapes, both Knip checks,
migration checks and all 1,002 Markdown documents passed. The final local Docker
image build passed.

The schema snapshot was regenerated and checked in an isolated test container.
Review caught a fresh-install issue before delivery: schema-only dumps omit the
singleton runtime row. A separate idempotent seed migration, included among the
21 snapshot seed migrations, now initializes it without resetting a cursor.
PostgreSQL regression checks verify both missing-row initialization and preserved
progress. The two indexes add a one-time migration cost. No release was created.

## Recommendations, tradeoffs and next item

The [design](fair-library-sampling-design.md#official-sources-and-august-2026-scope)
records official PostgreSQL, W3C and OWASP research and its date limitations.

| Recommendation | Pros | Cons or boundary |
| --- | --- | --- |
| Automatic bounded traversal | No routine operator work; smaller libraries remain visible | Each library waits N successful five-minute slots in a stable N-library catalog |
| Atomic cursor and fixed slots | Restart-safe progress, bounded retention and concurrent-worker protection | Seven-day window; more than 2,016 libraries cannot all fit in that window |
| Population-aware visit comparisons | Explicit times, unknowns and change boundaries | No causal attribution or guarantee about intermediate inventory changes |
| Revision-checked incremental large-library snapshots | Could measure libraries above the current cap with bounded work | Requires revision tracking and invalidation before complete counts can be trusted |

Recommended stack: synchronized inventory → attributable observations → automatic
profiles → fair bounded coverage visits → population-aware comparisons →
independently evaluated review-only semantic evidence.

The subsequent [incremental coverage outcome](incremental-library-coverage-outcome.md)
implements the recommended revision-checked pages for libraries above 20,000 rows.
Partial work remains explicit and other libraries retain their turns. This
document describes the preceding v2 capacity contract. Next, measure repeated
scan restarts and completion delays automatically to identify libraries that
remain unmeasured under continuous changes. Immediate health and overlap
endpoints still have their original bounded scope.

Readiness and frozen-study gates remain unchanged. Source placement, controlled
fixtures and model labels do not satisfy independent human review. This work
grants no semantic routing authority.
