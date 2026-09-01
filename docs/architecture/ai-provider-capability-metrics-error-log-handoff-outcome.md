# AI Provider Capability Metrics Error Log Handoff Outcome

## Delivered Outcome

AI Settings now offers **Review related Error Logs** only when its validated
completed-window capability telemetry trend has an active persistence-warning
state. The link opens Settings > Logs with one fixed reason-code filter.

The Logs page visibly identifies the handoff and provides **Clear handoff
filter** to return to the unfiltered log list. A malformed, incomplete, or
altered URL never pre-applies a filter.

## Security Outcome

- Error Logs are now administrator-only at the router boundary, in addition
  to their existing authentication and rate limiting.
- The handoff carries no user-controlled target, provider/model identifier,
  media data, raw error, stack, or time range.
- The only carried value is the pre-defined capability-metric persistence
  reason code.
- The Error Logs handoff is user-initiated and read-only until an operator
  deliberately chooses an existing Logs action.

## Accessibility Outcome

- The handoff is a descriptive HTML link, not a scripted redirect.
- The destination filter has a named section and a visible clearing action.
- No automatic status announcement is added for normal automatic refreshes.

## Validation

- Focused validation passed: 25 server route tests and 39 client utility,
  component, and Logs-view tests.
- Full validation passed: 992 server unit suites / 27,727 tests; 78 server
  integration suites / 871 tests, with one pre-existing skipped suite/test;
  and 300 client files / 4,085 tests.
- Server and client type checking, linting, documentation lint, migration
  integrity, static-import checks, and the production client build passed.
- Local Compose was rebuilt with `--no-cache`, recreated with
  `--force-recreate --wait`, and reached a healthy database-connected state.
  Unauthenticated requests to both the general Logs endpoint and its fixed
  persistence-reason filter returned `401`.

## Pull-Request Outcome

Classifarr had no open pull requests when this work began, so there was no PR
to apply locally. The [public pull-request listing](https://github.com/cloudbyday90/Classifarr/pulls)
reported zero open pull requests.

## Next High-Value Item

Add a bounded, administrator-only aggregate breakdown of capability-metric
persistence failures by retained error stage or database SQLSTATE category,
only after confirming that those categories are consistently present and do
not expose provider, model, endpoint, media, or raw diagnostic data. This
would speed diagnosis without moving raw Error Logs back into AI Settings.
