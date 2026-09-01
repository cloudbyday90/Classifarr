# AI Provider Capability Metrics Failure Recency Outcome

## Delivered Outcome

AI Settings now automatically loads a compact completed-window warning-recency
panel only while the existing rolling capability-metrics health aggregate has
an active persistence warning. It distinguishes retained evidence in the
latest completed UTC day, a warning newly clear for one completed day, and a
warning present only in the oldest of three fixed aggregates.

The existing rolling health summary remains the operational status. The new
panel supplies temporal context only; it does not claim incident duration,
diagnose the database, or change AI, policies, RAG, classification, retries, or
routing.

## Design And Security Outcome

- A separate ESM repository, service, and route contain the aggregate query,
  report construction, authorization boundary, and rate limit.
- The endpoint is administrator-only, parameter-free, rate-limited, and sends
  `Cache-Control: no-store`.
- Exactly three server-owned adjacent UTC-midnight completed-day periods are
  validated before the parameterized query runs.
- The report retains only count-only period aggregates and a derived fixed age
  band. It excludes raw timestamps, log text, metadata, SQLSTATE, provider,
  model, media, policy, RAG, and record identity.
- The client ignores server prose, derives the expected band from decimal
  counts, and renders an explicit unavailable state for malformed aggregate
  data instead of silently hiding it.
- The existing health summary remains the single polite live status region;
  the compact child panel has a labelled heading and does not move focus.

## Validation

- Focused ESM-aware server unit and route tests passed: 4 suites and 7 tests.
- Focused client presentation, component, API, and AI Settings tests passed:
  4 files and 53 tests.
- Full workspace tests passed: 1,005 server unit suites / 27,968 tests; 81
  server integration suites / 874 tests, with one existing skipped test; and
  306 client files / 4,138 tests.
- Server/client linting, TypeScript checks, migration integrity, ESM static
  import and test mock-shape checks, documentation linting, and the production
  client build passed.
- Local Compose rebuilt with `--no-cache`, recreated with
  `--force-recreate --wait`, and reached a healthy state. The new endpoint
  returned `401` without authentication, confirming its protected boundary.

## Pull-Request Outcome

The public [Classifarr pull-request listing](https://github.com/cloudbyday90/Classifarr/pulls)
reported zero open pull requests when checked. No unrelated or invented pull
request was transplanted locally.

## Next High-Value Item

Consolidate the three telemetry support panels into a single compact
progressive-disclosure summary that loads its bounded aggregates automatically
but exposes only the one current operator decision: whether to open protected
Error Logs. Preserve each current API contract and keep every historical,
coverage, and recency detail behind a labelled details control.
