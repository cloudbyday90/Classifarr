# Integration Log Inventory

This document tracks the warning, error, and high-volume info logs emitted by a
**passing** server integration run.

Purpose:
- preserve the signal of negative-path integration tests
- avoid cargo-cult log suppression
- give future regressions a baseline so new noise stands out

Refresh command:

```bash
mkdir -p .tmp
npm --prefix server run test:integration *> .tmp/integration-full.log
```

Useful filters:

```bash
rg "\[WARN\]|\[ERROR\]" .tmp/integration-full.log
rg "\[(INFO|WARN|ERROR)\] \[" .tmp/integration-full.log
```

## 2026-03-20 Baseline

Full passing run:
- `37/37` suites
- `567/567` tests
- runtime about `33.9s`

### Expected WARN/ERROR lines

| Module | Level | Count | Why it appears | Triggering suite(s) |
|--------|-------|-------|----------------|---------------------|
| `mediaSync` | `WARN` | 4 | Negative-path coverage for missing libraries during sync/item lookup. These warnings are the behavior under test, not incidental noise. | `server/src/__tests__/integration/api-keys-routes.test.js`, `server/src/__tests__/integration/sync-error-logging.test.js` |
| `QueueService` | `WARN` | 4 | Visibility-timeout recovery tests intentionally create expired processing rows and assert recovery behavior. The warnings are evidence that the resilience path executed. | `server/src/__tests__/integration/queue-robustness.test.js` |
| `MigrationRoute` | `ERROR` | 2 | Migration route tests intentionally submit invalid/inaccessible presets and assert the route returns the correct error contract. The route logs the failure by design. | `server/src/__tests__/integration/migration-routes.test.js` |

These warning/error buckets are now part of the integration pass contract:
- `mediaSync` warning paths are asserted in integration tests
- `QueueService` recovery warnings are asserted in integration tests
- `MigrationRoute` error logs are asserted in integration tests

### Highest-volume INFO modules

These are not currently treated as bugs. They are the noisiest successful-path
modules from the 2026-03-20 baseline and are worth checking first when output
changes materially.

| Module | Level | Count | Notes |
|--------|-------|-------|-------|
| `FeedbackAnalysis` | `INFO` | 31 | Policy-analysis, suggestion generation, and apply/reject flows are heavily instrumented. |
| `PolicyEngine` | `INFO` | 25 | End-to-end policy evaluation tests intentionally exercise multiple decision paths. |
| `apiKeys` | `INFO` | 15 | CRUD and reveal/update/revoke flows log each successful state change. |
| `QueueService` | `INFO` | 10 | Queue mutation and retry flows log successful operational steps. |
| `LegacyMigration` | `INFO` | 5 | Successful migration-path coverage logs completion details. |
| `PoliciesRoute` | `INFO` | 5 | Preset suggestion tests log the generated match summary. |

## Triage Guidance

Treat these as expected first:
- `mediaSync` missing-library warnings from explicit nonexistent-library tests
- `QueueService` expired-visibility recovery warnings from robustness tests
- `MigrationRoute` preset-validation errors from migration route negative tests

Treat these as suspicious until explained:
- any new `WARN` or `ERROR` module/message pair not listed above
- count increases for the listed `WARN`/`ERROR` buckets without new tests that justify them
- failures that replace expected `WARN`/`ERROR` lines with generic stack traces
- new high-volume `INFO` bursts from modules that previously emitted none

## Harness Quirk

The optimized integration harness now reuses one Docker/Testcontainers Postgres
container plus a migrated template database for the full Jest run, then creates
isolated per-suite clones from that template.

This is correct for normal CI/local usage, where one `npm --prefix server run
test:integration` process is run at a time.

If independent integration runs are launched concurrently by local tooling, the
runtime handoff file should be treated as a potential contention point and
rechecked before assuming a product regression.
