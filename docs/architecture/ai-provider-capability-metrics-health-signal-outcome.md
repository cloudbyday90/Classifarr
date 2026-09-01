# AI Provider Capability Metrics Health Signal Outcome

## Delivered Outcome

AI Settings now has a compact **Capability telemetry** panel inside the
existing AI Readiness card. It refreshes automatically while the page is
visible, uses the established pause control, and reports only a 24-hour count
of active metric streams and capability-metric persistence warnings.

The browser presents one of three fixed, status-only outcomes:

- **Capability telemetry is recording** — recent aggregate persistence with no
  recorded persistence warning.
- **Capability telemetry needs attention** — one or more capability-metric
  write warnings were recorded; AI work, policy, and routing remain unchanged.
- **No recent capability telemetry activity** — neither condition appeared in
  the window; this is not an AI availability verdict.

The server endpoint is administrator-only, parameter-free, rate-limited,
no-store, and read-only. It cannot call a provider, save settings, write a
metric, retry work, change strict-verification admission, or influence policy,
RAG, classification, or routing.

## Persistence Reliability

The existing metrics service now includes the stable reason code
`ai_provider_capability_metrics_persistence_failed` when it logs a failed
metric write. The health query aggregates that code and supports the previous
fixed message for existing warning rows. No raw error text or metadata is
returned to the UI.

## Verification

- Server contract, repository, service, route authorization, and existing
  metrics-service tests pass.
- A PostgreSQL integration test creates a synthetic metrics stream and
  reason-coded warning, verifies the aggregate report, and relies on the
  disposable integration database for isolation.
- Client API, presentation boundary, and rendered-component tests pass,
  including the polite announcement of status changes but not routine refresh
  timestamps.
- Local Compose was rebuilt without cache and recreated successfully. The
  running container is healthy; the new HTTP endpoint returned `401` without
  credentials, and its in-container service returned a valid aggregate-only
  report. The local report currently identifies retained recent persistence
  warnings; it does not alter AI admission or routing.

## Pull-Request Outcome

GitHub reported zero open Classifarr pull requests during this work. There was
no open PR to implement locally, so this change contains no substituted closed
or unrelated pull-request code.

## Next High-Value Item

After production observations accumulate, add a fixed three-window trend to
this same aggregate: persistent, newly observed, cleared, or no-data. Keep it
administrator-only and descriptive, retain no raw logs or provider dimensions,
and do not grant it any AI, policy, RAG, classification, or routing authority.
