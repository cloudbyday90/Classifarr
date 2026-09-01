# AI Provider Capability Metrics Health Trend Outcome

## Delivered Outcome

AI Settings now extends the existing **Capability telemetry** panel with a
compact **Fixed three-day trend**. It loads automatically with the existing
visible-page AI Readiness refresh lifecycle and needs no new save, test, or
manual-refresh action.

It displays two aggregate counts for each of three completed UTC days:

- active capability-metric streams;
- capability-metric persistence warnings.

The display uses fixed labels and server-validated counts only. It does not
show providers, models, media, policies, prompts, responses, error text,
stacks, endpoint data, or log metadata.

## Operator Meaning

| Visible outcome | What to do |
| --- | --- |
| **Persistent** | If successful AI requests continue alongside warnings, inspect the protected Error Logs view. The trend cannot change AI work or routing. |
| **Newly observed** | Observe the next completed UTC day before deciding that this is persistent. |
| **Cleared** | Continue observing; the current clean day is an improvement, not a guarantee. |
| **No data** | Treat as an observation gap, not as an AI or provider health verdict. The next eligible AI result updates the timely signal. |
| **Recurring** | Investigate if the intermittent pattern continues. |
| **No active warning** | No current persistence-warning trend is recorded; provider admission and strict verification remain separate decisions. |

## Technical Outcome

- A modular ESM trend contract produces exactly three server-owned,
  non-overlapping completed UTC-day windows.
- A separate aggregate repository queries only count fields from capability
  metric rows and the allow-listed stable telemetry-write reason code.
- A read-only service, administrator-only no-store route, and dedicated rate
  limit expose the versioned report.
- The browser uses a separate fail-closed presentation boundary and a nested
  component. A malformed contract renders as unavailable rather than showing
  untrusted data.
- Two polite `role="status"` regions now exist in the overall panel: one for
  timely health and one for the trend. Each announces only a meaningful status
  transition; neither announces routine automatic refreshes.

## Verification

- New server unit tests cover window boundaries, status classification,
  malformed rows, SQL parameterization, service wiring, route authorization,
  rate limiting, and no-store behavior.
- The new PostgreSQL integration test writes synthetic reason-coded warnings
  into adjacent completed days and validates the aggregate persistent state.
  Synthetic metric and error-log records are cleaned after each test.
- Client tests cover the API helper, barrel export, fail-closed presentation,
  privacy boundary, nested rendering, and transition-only announcement.
- Complete validation passed: 992 server unit suites / 27,726 tests; 78
  server integration suites / 871 tests (one existing suite/test skipped); and
  297 client files / 4,060 tests. Typecheck, lint, documentation lint,
  migration integrity, static-import checks, and the production client build
  also passed.
- Local Compose rebuilt through `docker compose build --no-cache`, then
  recreated with `--force-recreate --wait`; the service became healthy. The
  protected HTTP endpoint returned `401` without credentials, while the
  in-container read-only service returned a valid aggregate-only trend.

## Pull-Request Outcome

The public Classifarr pull-request listing had no open pull requests on
2026-09-01. There was no unrelated PR implementation to test locally.

## Next High-Value Item

Add one protected, pre-filtered Error Logs handoff for an active capability
telemetry warning trend. The handoff should carry only the fixed stable reason
code, preserve administrator authorization, avoid raw data in AI Settings,
and never trigger a retry, provider test, policy change, or route.
