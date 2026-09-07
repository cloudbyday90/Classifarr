# Policy statistics scope outcome

Date: 2026-09-07 UTC.

## Delivered behavior

Implemented the [scope design](policy-statistics-scope-design.md), following the
retained evidence breakdown. Policy Statistics now describes the populations
and periods it actually displays. The inactive date buttons, their unused state
and their styles were removed.

The overview identifies retained feedback for current policies, including disabled
policies, the equal weighting of evaluated policy accuracies, and the overlapping
7-day/30-day trend windows. Policy Performance identifies enabled policies and
its separately labeled 7-day accuracy. Live Activity describes its maximum of
20 events and the different date scopes for feedback versus patterns/suggestions.
Each section has a native heading and a visible, programmatically associated
description. The existing evidence tables retain their separate population labels.

Policy details distinguish retained totals from the 30-day decision breakdown.
Comparison columns now say Last 7 Days and Previous 7 Days, matching rolling
windows instead of implying calendar weeks. Dashboard grids can shrink below
their previous 250/350-pixel minimums to fit narrow screens.

Browser inspection also found inherited light text disappearing on the white
detail comparison rows. The modal now sets an explicit dark foreground. Its
evaluation description and positive/negative changes use colors that pass the
4.5:1 text contrast check; the signed changes retain their textual meaning.

Automatic loading, visibility cleanup and existing API calls remain in place.
The change uses the existing ESM Vue components and named API layer. There are
no new endpoints, dependencies, schema changes, provider calls or settings.
Scope descriptions use trusted templates and existing dynamic values remain
escaped. Classification authority, readiness and frozen-study gates are unchanged.

## Validation

| Local check | Result |
| --- | --- |
| Focused client tests | 36 tests across 4 files passed: dashboard loading/lifecycle, evaluation coverage, evidence populations and policy statistics API. |
| Chromium browser regression | Passed automatic GET-only loading with the original four statistics requests; absence of date controls; accessible section descriptions; keyboard opening of policy details; rolling-period labels; desktop, 390-pixel and populated 320-pixel layouts. |
| Browser contrast and visual review | All new scope descriptions, detail evidence text and comparison cells meet 4.5:1 in the tested opaque backgrounds. Desktop, mobile and detail screenshots inspected. |
| Type checks | Server and client passed. |
| ESM checks | Static imports and test mock shapes passed. |
| Affected ESLint | Passed without warnings. |
| Markdown and whitespace checks | Passed. |
| Local Docker build and fresh startup | `classifarr:statistics-scope-local` built successfully; disposable fresh-container startup and schema verification passed with no schema change. |

Browser checks use deterministic API fixtures, not a newly measured real cohort.
No full backend suite or combined coverage ratchet was rerun for this presentation
change. The API contract and database queries are unchanged. This is a scoped
accessibility improvement, not a whole-page WCAG conformance claim.

The container check used the existing schema verification helper and removed its
disposable container/data. The running Compose instance was not upgraded. Test
logs, screenshots and intermediate artifacts remain local and ignored by Git.

## Recommendations and next item

Keep the recommended stack: existing read-only aggregates → named API functions
→ semantic scope descriptions in the existing Vue components → browser regression
checks. The benefits are accurate context and no reporting-period input. The cost
is maintaining these descriptions alongside future query changes. A global date
filter would require a coordinated contract for different populations; defer it
until a specific reporting need justifies that added complexity. Research links
and the alternatives matrix are in the separate design document.

**Next: correct policy comparison units and unavailable values.** The current
`PolicyStatsModal.vue` formatter subtracts fractional accuracy directly and adds
`%`: 50% to 100% becomes `+0.5%` instead of `+50.0 percentage points`. Auto rate is
already on a 0–100 scale, and `null / 100` renders unavailable data as `0.0%`.
Move comparison formatting to a small ESM utility with explicit fraction/percent
inputs, percentage-point output for rates, and preserved N/A states. Test positive,
negative, zero and missing periods before presenting these values as evidence.
After that, add passive lifecycle counts separating completed history from
pending/retry observations before expanding classification automation.

GitHub MCP returned an empty open-PR list during this task. There was no open PR
to select randomly or implement locally; no external PR was merged.

README, this design/outcome pair and the Unreleased changelog document the work.
No release or version bump is included.
