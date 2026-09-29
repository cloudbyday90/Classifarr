# Retry readiness summary outcome

Implemented September 29, 2026. No release, version change or live deployment.

## Delivered behavior

The Command Center now shows a stacked bar, labeled counts, a ready-work total,
the observation time, the next display check and one relevant next action.
Six mutually exclusive categories explain the inspected web-search retry rows:
cached results ready, provider ready, provider waiting, provider setup needed,
scheduled later and held by safeguards. Intentionally disabled providers do not
become enabled, and waiting does not mean failure.

The small ESM repository, summary, service and route modules share the worker's
existing eligibility predicates and optional read-only cache/provider hints.
The administrator-only endpoint never claims work or calls a provider. It
summarizes at most 50 pending rows per queue (fetching one extra to detect
truncation), discloses coverage, coalesces concurrent
requests and caches observations for 30 seconds without changing their timestamp.
A backward wall-clock change expires that cache rather than extending its life.

The Vue component uses the existing memory-only SWR implementation, visible
minute polling and native pause/resume controls. Neither the transport nor SWR
adds rapid retries for this endpoint. Failed reads recover on a later poll;
authorization loss clears the snapshot and stops polling. Old, invalid or
unavailable observations never become a healthy zero or an actionable green
chart. Transport details are not passed to the SWR console logger.

## Evidence

- Backend: 1,539 suites / 46,676 tests passed with coverage (90.20% statements,
  84.94% branches, 92.01% functions, 90.20% lines).
- Frontend: 409 suites / 5,763 tests passed with coverage. The HTML summary used
  by the coverage gate was rendered from that run's Istanbul-format JSON; no
  baseline or coverage values were edited.
- The coverage ratchet passed using both completed reports. Frontend coverage
  was 86.07% statements, 78.66% branches, 85.54% functions and 88.00% lines.
- PostgreSQL: 55 tests across cache-aware dispatch, quota admission and legacy
  recovery passed. These exercise the production SQL and read-only transaction.
  Preview reads preserve queue records, cache statistics and provider usage.
  Scenarios include fresh/disabled/rejected/repaired configuration, quotas,
  pacing, cache hits, truncation, music, disabled libraries, identity conflicts,
  already-enriched items, exhausted attempts and legacy monthly deferrals.
- Chromium: the synthetic browser scenario passed with no mutation requests or
  persistent readiness cache. Desktop and 390/320-pixel layouts were checked;
  screenshots were visually inspected. Native keyboard pause/resume retains
  focus. An unavailable response removes the chart and action.
- Lint, both typechecks, production client build, documentation lint, copyright,
  dependency-boundary checks, static ESM imports and ESM mock-shape checks passed.
- The ownership gate passed after reviewing the two changed shared helper
  fingerprints. Existing unresolved ownership paths were not approved or waived.
- Existing root YAML/Markdown dependency regressions: 32 tests passed.

Initial test runs exposed missing dashboard/auth mock exports and fixture setup
requirements; those were corrected. The mobile screenshot initially caught the
existing navigation mid-transition; the browser check now waits for navigation
to clear and verifies the control is in the viewport. Database constraints and
production safeguards were not loosened to make tests pass.

## PR disposition

GitHub MCP initially returned only [PR #554](https://github.com/cloudbyday90/Classifarr/pull/554),
the Markdown dependency update already present in baseline `592cf68c`. The later
open-PR search returned no results. A direct PR read confirmed that Dependabot
closed #554 without merging after detecting the update already present. There
was no fresh open PR to randomly select and implement. No PR was merged or
closed by this work.

## Recommendation and limits

Keep the selected stack: bounded PostgreSQL reads, modular Node ESM services,
shared worker predicates, authenticated Express GET, named client API method,
memory-only SWR and a dependency-free Vue/CSS chart. The benefit is inexpensive,
side-effect-free explanation. The tradeoff is a partial, transient observation,
not a whole-backlog total, execution guarantee or accuracy score.

The [design document](retry-readiness-summary-design.md) records official W3C,
Vue and PostgreSQL research, alternatives and their pros/cons. The chart's text
legend supplements color, status announcements are concise, and updates can be
paused without affecting background jobs. Browser checks are not a claim of
complete WCAG conformance.

Next: map OMDb's separate configuration, credential and daily-limit gates into
the same bounded explanatory contract. Keep provider-specific admission rules;
do not infer OMDb readiness from web-search availability. Measure real operator
use before adding persisted whole-backlog projections or another scheduler.

Follow-up delivered: [OMDb retry readiness](omdb-retry-readiness-outcome.md)
extends the selected view with its separate quota and credential gates.
