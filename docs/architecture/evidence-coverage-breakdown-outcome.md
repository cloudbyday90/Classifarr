# Evidence coverage by library and method: outcome

## Delivered behavior

Implemented the [source-receipt follow-up](feedback-source-idempotency-outcome.md)
as an additive `evidence_coverage` field on the existing authenticated statistics
overview. Separate ESM query and projection modules serve a dedicated Vue component.
The existing API leaf preserves the response and the dashboard loads it automatically.
No new endpoint, migration, dependency, provider request or operator setting was added.

History is grouped by recorded library and method. Feedback is grouped by selected
library and source method. Counts remain separate when a correction changes its
destination. Imported `source_library` events, original-candidate availability,
retained feedback links and evaluated outcomes are distinct measures. Legacy
unlinked feedback, removed history, inactive/unassigned libraries and deleted
feedback receipts remain explicit.

Evaluation uses the existing canonical view. Missing evidence cannot become a
success label. The response reports all-retained scope, capture time, complete totals
and separate truncation flags for each 200-group table. An empty feedback population
has null evaluated coverage; read failure has null populations, not zero observations.

The query runs inside a read-only transaction with a five-second statement timeout.
It returns aggregate fields only; titles, media/source IDs, metadata, reasons and
fingerprints never enter the response. The overview uses `Cache-Control: no-store`.
Existing policy metrics remain available if the additional coverage read fails.

Native table captions and scoped headers, keyboard-scrollable regions, visible focus
and text explanations make the populations navigable. A Libraries link reuses
existing common-trait profiles. The dashboard now removes its actual visibility
listener on unmount; the previous anonymous removal left the listener active and
could restart polling after navigation away.

## Validation

Local checks on 2026-09-07 UTC:

| Check | Result |
| --- | --- |
| Focused backend units | 30 tests across 2 suites passed. |
| PostgreSQL integration tests | 66 tests across 3 suites passed. |
| New query/service integration coverage | 98.33% statements/lines, 68.96% branches, 100% functions. Input/failure branches also have separate unit coverage. |
| Full frontend suite | 4,569 tests across 333 files passed. |
| Frontend coverage | 85.28% statements, 76.88% branches, 83.93% functions, 87.30% lines. |
| Chromium browser regression | Passed desktop/mobile table semantics, keyboard horizontal scrolling, text contrast of at least 4.5:1 and zero non-GET API requests. |
| Type checks and ESM import/mock-shape checks | Passed. |
| Affected ESLint, changed Markdown lint and whitespace checks | Passed without lint warnings. |
| Docker build and fresh-install schema verification | Passed with `classifarr:evidence-breakdown-local`; schema remained unchanged. |

Database tests cover independent population reconciliation, corrected destinations,
malformed/empty candidate arrays, unsafe candidate IDs, first-candidate semantics,
retained feedback after history removal, inactive libraries, deleted results, empty
data, both group caps and unavailable schema. Global totals still include the
201st group when only 200 groups are returned. Snapshot projection rejects invalid
counts rather than rounding them into plausible evidence.

A controlled 5,000-event imported-history fixture completed its read in 9.194 ms.
This verifies a bounded local workload, not production throughput. The browser
screenshots were inspected at desktop and 390-pixel mobile width. Full backend
coverage and the combined coverage ratchet were not rerun; the backend coverage
above is scoped. No new endpoint was introduced.

## Read-only Compose measurement

The running PostgreSQL 18.6 installation was inspected at
2026-09-07T02:03:05.815Z. The aggregate read took 241.181 ms and returned 16 history
groups, no feedback groups and these totals:

| Observation | Count |
| --- | ---: |
| Retained history events, all states | 6,772 |
| Imported membership observations | 6,699 |
| Recorded original candidates | 5 |
| History events linked to retained feedback | 0 |
| Retained feedback / evaluated outcomes | 0 / 0 |

The five recorded candidates occur across AI analysis (one), policy candidate
adjudication (three) and policy engine (one). The remaining history comprises
35 AI-analysis events, three AI reruns, 13 AI-verified events, three adjudications,
13 policy-engine events and six queued-for-retry events, in addition to imports.
These are retained events, not unique media counts or reviewed classifier outcomes.

The running image predates the receipt/evaluation schema. A measurement-only CTE
adapter first verified that feedback was empty, then represented the missing
relations for this aggregate inspection. It did not fabricate evaluated labels and
is not shipped as a production fallback. Thus this measurement validates real
history coverage; populated feedback semantics were tested on migrated PostgreSQL
fixtures. No production writes, provider calls or individual media records were
returned. No real independently labeled accuracy cohort was produced, and semantic
routing/readiness authority remains unchanged.

## Research, recommendations and next item

The [separate design](evidence-coverage-breakdown-design.md) records official
PostgreSQL and W3C sources discovered through web tools, their August 2026 guidance
baseline and retrieval date. It also compares a separate endpoint, combined
population table and materialized cache. GitHub MCP returned no open PRs during
this task, so there was no random PR to implement locally.

Recommended stack: retained history and receipts → canonical evaluation → bounded
aggregate snapshot → separate accessible tables → existing inventory profiles.
Benefits are automatic visibility and honest population/coverage boundaries. Costs
are another read during overview refresh and explicitly capped detail at large
group counts. Add caching only after representative query measurements justify
its invalidation complexity.

**Next: correct the dashboard's inactive time-range controls.** The existing 7 Days,
30 Days and All Time buttons change a local value but never change the API requests
or filter the displayed populations. Recommend replacing them with explicit scope
descriptions for the existing totals and windowed metrics, preserving automatic
loading without asking operators to choose a reporting period. This new evidence
section already states its all-retained scope. Then add lifecycle counts to separate
completed events from pending/retry history before expanding AI automation.

Update: the scope correction is implemented in the
[policy statistics scope outcome](policy-statistics-scope-outcome.md), including
rolling-period labels in policy details. That document records the next measured
presentation bug to fix before the lifecycle breakdown.

README and the Unreleased changelog describe the change. No release or version bump
is included.
