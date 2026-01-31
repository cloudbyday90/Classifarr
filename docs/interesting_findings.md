# Interesting Findings

Tracking non-blocking observations discovered during implementation and testing.
These are candidates for future releases.

## 2026-01-25

### Backend test noise from database-dependent logging
- Unit and integration tests produce expected console errors/warns when DB mocks are missing
  (`logger.persistToDb`, `ProviderLockService.loadConfig`, and similar code paths).
- Impact: CI output is noisy; it can mask real regressions.
- Follow-up: add targeted test helpers to stub logger DB writes and provider lock config lookups.
- Resolution (2026-01-30): decoupled logger DB persistence from module import and
  use explicit DB injection in tests to keep logs deterministic.

### API key service warnings during integration tests
- Integration tests warn when `API_KEY_ENCRYPTION_KEY` is not set.
- Impact: repeated warning spam during integration runs.
- Follow-up: set a test-only env var in integration setup (random but valid 64-hex) to keep logs clean.
- Resolution (2026-01-30): set a deterministic test key in integration setup so apiKeyService
  initializes without warning noise.

### Node 25 Web Storage warnings in test workers
- Vitest workers on Node 25 emit `--localstorage-file` warnings unless Web Storage is disabled.
- Impact: noisy output for frontend and integration tests.
- Follow-up: centralize a test runner wrapper for Node options across server and client tests,
  or document the required `NODE_OPTIONS` for CI.
- Resolution (2026-01-30): added a Jest wrapper that strips invalid `--localstorage-file` options
  and enforces `--no-experimental-webstorage` to keep test output clean.

### ProviderLockService test initialization race conditions
- `ProviderLockService` initializes immediately on module load, triggering DB queries.
- In Jest, `jest.resetModules()` can cause the real module to reload and execute side effects before mocks are re-applied, leading to "Cannot read properties of undefined (reading 'rows')" errors.
- Impact: Flaky or persistently failing tests in `classification-routes.test.js`.
- Follow-up: Refactor `ProviderLockService` to lazy-load configuration or use dependency injection to avoid side effects on import.
- Resolution (2026-01-30): removed DB access on module import and added an explicit `init()`
  call from server startup to load config deterministically.

## 2026-01-30

### Sonarr specials handling depends on Overseerr payload
- Specials can only be included if the webhook payload contains season 0.
- Impact: even with `include_specials` enabled, specials may still be skipped if Overseerr omits season 0 from the payload.
- Follow-up: verify Overseerr's season payload behavior for TV requests and document expectations.

### Webhook config migration defaults may change behavior
- New `include_specials` flag defaults to false for existing webhook configs.
- Impact: existing users may see specials excluded unless they explicitly enable the toggle.
- Follow-up: consider a data backfill or release note callout to avoid surprises.

### Missing automated coverage for Sonarr season monitoring mapping
- Current tests do not assert the season list mapping for Sonarr add requests.
- Impact: regression risk if `requested_seasons` or `include_specials` handling changes.
- Follow-up: add integration coverage around webhook -> classification -> Sonarr payload composition.

### No coverage report generated in this release cycle
- There are no coverage scripts wired in `package.json` at the root, server, or client.
- Impact: coverage deltas are not visible in CI or local runs.
- Follow-up: decide on a coverage workflow (Jest/Vitest coverage) and document in `release.md`.

### Integration test output is extremely verbose
- Integration runs emit extensive Testcontainers and migration logs even when tests pass.
- Impact: real warnings/errors are harder to spot in CI output.
- Follow-up: evaluate Testcontainers log level controls and suppress or redirect migration output in tests.
- Resolution (2026-01-30): gated setup/migration info logs behind `INTEGRATION_TEST_VERBOSE`,
  but kept warnings/errors and a minimal setup/teardown summary so CI still surfaces issues.

### Integration tests warn about optional migration cleanup
- Integration runs emit warnings about skipping migration `034_cleanup_unused_tables.sql` when `schema_migrations` does not exist.
- Impact: expected warnings may obscure real issues in CI output.
- Follow-up: consider tagging this message as info or gating it behind verbosity if it remains purely expected.
- Resolution (2026-01-30): integration setup now creates `schema_migrations` and records applied
  migrations, eliminating the warning and aligning test behavior with production.

### Integration tests warn about deprecated event detection
- Integration runs emit `detectEventContent is deprecated - event detection now handled by PolicyEngine presets`.
- Impact: warning spam during integration tests even though behavior is expected.
- Follow-up: remove or adjust the deprecated method to avoid warnings in test context once callers are migrated.

### Integration tests log expected LegacyMigration errors
- Legacy migration integration tests emit an error when a rule migration intentionally violates a foreign key constraint
  (`policy_presets_preset_id_fkey`).
- Impact: error logs in CI can obscure genuine failures, even though tests assert on rollback behavior.
- Follow-up: consider downgrading this log to warn/info for expected rollback scenarios, or assert via mocks and suppress log output.

### Integration tests log expected MediaSync errors
- Sync-lock integration tests log `Library 999999 not found` when exercising error paths.
- Impact: error logs in CI output for expected negative tests.
- Follow-up: in tests, mock logger or mark expected error logs to reduce noise without hiding real failures.

## 2026-01-31

### Integration test log noise persists in v0.40.5c-alpha
- Reconfirmed expected log output in integration runs: deprecated `detectEventContent`, legacy migration FK errors, and `Library 999999 not found`.
- Impact: CI output remains noisy even when tests pass.
- Follow-up: see 2026-01-30 items; no new action beyond existing follow-ups.
