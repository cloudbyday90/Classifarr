# Interesting Findings

Tracking non-blocking observations discovered during implementation and testing.
These are candidates for future releases.

## 2026-01-25

### Backend test noise from database-dependent logging
- Unit and integration tests produce expected console errors/warns when DB mocks are missing
  (`logger.persistToDb`, `ProviderLockService.loadConfig`, and similar code paths).
- Impact: CI output is noisy; it can mask real regressions.
- Follow-up: add targeted test helpers to stub logger DB writes and provider lock config lookups.

### API key service warnings during integration tests
- Integration tests warn when `API_KEY_ENCRYPTION_KEY` is not set.
- Impact: repeated warning spam during integration runs.
- Follow-up: set a test-only env var in integration setup (random but valid 64-hex) to keep logs clean.

### Node 25 Web Storage warnings in test workers
- Vitest workers on Node 25 emit `--localstorage-file` warnings unless Web Storage is disabled.
- Impact: noisy output for frontend and integration tests.
- Follow-up: centralize a test runner wrapper for Node options across server and client tests,
  or document the required `NODE_OPTIONS` for CI.

### ProviderLockService test initialization race conditions
- `ProviderLockService` initializes immediately on module load, triggering DB queries.
- In Jest, `jest.resetModules()` can cause the real module to reload and execute side effects before mocks are re-applied, leading to "Cannot read properties of undefined (reading 'rows')" errors.
- Impact: Flaky or persistently failing tests in `classification-routes.test.js`.
- Follow-up: Refactor `ProviderLockService` to lazy-load configuration or use dependency injection to avoid side effects on import.
