# Ollama verification runtime mismatch operational panel outcome

## Delivered behavior

Classifarr now provides an administrator-only runtime-mismatch panel in
**Settings → AI**. It reports exactly these two aggregate values:

1. `modelDigestMismatchCount` — the exact non-negative count of strict Ollama
   verification digest mismatches across model revisions.
2. `lastObservedAt` — the most recent mismatch timestamp, or `null` when none
   has been observed.

The server exposes this through
`GET /api/stats/ollama-verification-runtime-mismatch-summary`. The endpoint has
no query parameters, requires the existing administrator middleware, is
read-only, applies a 30-request-per-15-minute limiter after authorization, and
cannot invoke a provider or alter classification, policy, or routing state.

The summary is computed from fixed `ollama` and `verification` dimensions. Its
repository returns neither model identity nor individual observations, and its
service caches only the sanitized two-field aggregate for 30 seconds while
coalescing concurrent reads. Failed reads are not cached.

## Operator outcome

Use the panel to decide whether repeated model retags deserve maintenance. If
the current capability card reports that the model changed, confirm the desired
local model and run **Test Ollama Verification**. The panel is historical
aggregate context; it never automatically enables strict verification.

## Security outcome

- Server-side administrator authorization gates the route before the summary
  service executes, and a dedicated post-authorization limiter bounds repeated
  reads.
- The response is allow-listed to a version, an exact count string, and a
  normalized timestamp. It excludes model names, digests, hosts, ports,
  endpoints, raw provider errors, prompts, media, and event history.
- The database query is parameterized and has fixed dimensions. Callers cannot
  select a model, field, time range, or unbounded result size.
- The UI normalizes malformed values to a safe empty state and never renders
  extra response properties.

## Verification coverage

- Unit tests cover response projection, timestamp/count normalization,
  parameterized query shape, 30-second cache expiry, concurrent-read
  coalescing, and failed-read recovery.
- Route tests verify that non-administrators cannot execute the aggregate
  service.
- Integration coverage verifies the production stats router returns exactly the
  three public fields and no seeded library or item identity.
- Client coverage verifies API wiring, panel rendering, safe malformed-value
  handling, refresh signaling, and settings-page non-disclosure.
- The complete server suite passed: 864 unit suites / 25,092 tests and 71
  integration suites / 861 tests; one existing integration suite and test were
  skipped.
- The complete client suite passed: 242 files / 3,565 tests.
- Lint, server and client type checks, the production client build, migration
  integrity, static-ESM checks, documentation lint, and coverage ratchets all
  passed.
- No live Ollama instance was needed for this panel; the provider-free route,
  response contract, cache, and authorization boundaries are covered locally.

## Open PR check

GitHub MCP was queried on 2026-08-29 for open pull requests in
`cloudbyday90/Classifarr`. It returned none, so no unrelated PR was applied
locally or merged.

## Release status

No release, tag, or version change is created by this work.

## Next recommendation

Evaluate a bounded remediation-readiness shortcut that appears only when the
current capability is `model_changed`: it should link to the existing test
action and show the same identity-free aggregate, without adding automatic
retries or exposing provider configuration.
