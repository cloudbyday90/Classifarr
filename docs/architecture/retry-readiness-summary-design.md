# Retry readiness summary design

Decision and official research: September 29, 2026.

## Problem and scope

Pending enrichment is not proof that a provider can run it. The existing live
statistics subtract some deferrals but do not distinguish cache hits from
provider pacing, intentionally disabled providers or future-due work. The
operator needs a visual explanation, not another retry button.

Start with web-search enrichment (including the legacy Tavily queue), where the
cache-aware dispatcher already provides read-only readiness inspection. Label
that scope explicitly; do not imply coverage of OMDb, ingestion or classification.
The preview is advisory: existing atomic claims, source guards and provider
admission remain authoritative. No new scheduler, automatic repair or provider
enablement is introduced.

## Contract and resource boundaries

- `GET /api/queue/retry-readiness` returns version `1`, scope `web_search`,
  `observedAt`, six-key `counts`, `inspected`, `hasMore`, `limitPerQueue` and
  nullable `earliestRetryAt` through the existing data envelope. Failure is a
  sanitized 503, never an empty-success fallback. No parameters increase scope.
- Authenticated administrator-only, parameter-free GET; HTTP `no-store`.
- Inspect the first 50 pending rows in dispatcher order per web-search queue.
  Fetch one extra row to disclose truncation. Report counts of the inspected
  rows, never pretend these are whole-backlog totals or accuracy percentages.
- Reuse the dispatcher's item eligibility SQL and cache/provider inspector.
  Partition inspected rows into cache-ready, provider-ready, provider-waiting,
  provider-setup-blocked, scheduled-later and held by item safeguards.
- Keep content and credentials server-side. Return only fixed category counts,
  observation time, coverage and an earliest retry estimate, not titles, IDs,
  errors, provider keys, cache keys or generated links.
- Run reads in a read-only transaction with local statement/lock deadlines.
  Coalesce simultaneous requests and reuse a result for at most 30 seconds.
  No backlog-wide count, HTTP provider request, claim, attempt, usage charge,
  cache-hit mutation or retry maintenance is permitted.
- A Vue SWR composable keeps data only in memory. Poll once per visible minute,
  offer pause/resume, and mark old/error/offline observations explicitly.
  Pausing the display does not pause the worker. Unknown never means zero.

## Presentation

Use a compact stacked bar and labeled counts with a single next action. A
descriptive text legend carries all information without color. Separate cached
and provider-ready work; readiness is not completion or routing authorization.
Show empty setup without alarming warnings, limited coverage without extrapolation,
and stale status without presenting an old green count as current authority.
Use fixed application routes for actions, no HTML supplied by the server.

## Official sources and tradeoffs

URLs were discovered through online search and the official source pages.

- [W3C use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color):
  labels and counts must supplement the bar colors.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  use a concise polite status, not an assertive announcement on every poll.
- [W3C pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide):
  provide control of automatic updates without moving keyboard focus.
- [Vue performance guidance](https://vuejs.org/guide/best-practices/performance):
  use existing Vue/CSS rather than another chart dependency for six categories.
- [PostgreSQL session settings](https://www.postgresql.org/docs/18/runtime-config-client.html):
  use transaction-local read-only/deadline controls, not global database changes.

| Option | Advantage | Cost / limit | Decision |
| --- | --- | --- | --- |
| Bounded read-only preview using existing dispatcher rules | Explains actual cached/provider readiness without side effects | Explicitly partial on large queues; transient snapshot, not a promise | Selected |
| Full scan on every dashboard poll | Whole-backlog counts | Repeated cache/config reads and unbounded work | Reject |
| Persist readiness for every retry | Cheap whole-backlog projection | Invalidation and schema/worker synchronization complexity | Measure before considering |
| New chart framework or autonomous retry button | Rich interactions | Bundle/maintenance cost or unintended work authority | Not needed |

Recommended stack: PostgreSQL bounded reads, modular Node ESM services, shared
dispatcher predicates, authenticated Express GET, named client API function,
memory-only SWR, Vue/CSS chart, unit/integration/browser regression tests.

## Verification and follow-up

Test fresh setup, intentional disablement, rejected credentials, repaired config,
cache under quota/pacing, future times, safeguards, truncation, read failures,
stale/pause/unmount behavior, keyboard controls and mobile layout. Verify that
reading leaves queue rows, cache statistics and provider usage unchanged.
Record actual results in a separate outcome document. No release or live rebuild.

The only open PR initially returned by GitHub MCP was #554, already implemented
and tested in `592cf68c`. A later MCP recheck returned no open PRs. No new PR
change was available to select; nothing was merged or redundantly reapplied.

Next: extend this same explanatory contract to OMDb only after mapping its own
quota/config gates; do not equate web-search availability with OMDb readiness.
