# Web Search Provider Calibration Guardrails

## Problem

Calibration preview mode shows how route order changes before saving a purpose-specific policy. The next gap is operator interpretation: a route can look valid while still depending on weak evidence, recent provider failures, or a no-provider outcome.

Guardrails turn those preview conditions into explicit warnings so operators can distinguish "this changes the route" from "this changes the route to a risky provider."

## Research Notes

- Google SRE guidance recommends actionable alerts and indicators tied to user-visible reliability instead of noisy symptoms. Guardrails are non-paging, operator-facing warnings that explain whether a preview-selected provider has low confidence or recent degraded/cooldown signals.
- Google SRE monitoring guidance separates symptoms from causes in distributed systems. Guardrails intentionally label cause-like signals, such as low samples or recent provider health issues, rather than treating every route-order change as a problem.
- OpenTelemetry semantic conventions recommend stable attribute names. Guardrails therefore use stable `code`, `severity`, `providerKey`, and `details` fields so the UI and future telemetry can consume them consistently.
- OWASP API3:2023 warns against exposing object properties callers do not need. Guardrails expose sanitized warning summaries only; they do not return provider API keys, queries, cache keys, route IDs, trace IDs, classification IDs, correlation IDs, raw provider responses, or raw error bodies.

Sources:

- Google SRE Workbook, Alerting on SLOs: https://sre.google/workbook/alerting-on-slos/
- Google SRE Book, Monitoring Distributed Systems: https://sre.google/sre-book/monitoring-distributed-systems/
- OpenTelemetry Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/
- OpenTelemetry Semantic Conventions Concepts: https://opentelemetry.io/docs/concepts/semantic-conventions/
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/

## Options

### Option A: UI-Only Guardrails

Pros:

- Fast to build.
- No backend changes.

Cons:

- Duplicates interpretation logic in the browser.
- Cannot safely evaluate recent provider health without expanding the UI model.
- Risks diverging from server preview semantics.

### Option B: Persisted Guardrail Events

Pros:

- Auditable.
- Useful for long-term operator behavior analysis.

Cons:

- Adds storage and retention concerns before proving value.
- Preview is intentionally side-effect free; persisting preview warnings would weaken that property.

### Option C: Server-Side Ephemeral Guardrails

Pros:

- Keeps preview side-effect free.
- Reuses sanitized route diagnostics and health history.
- Centralizes warning semantics next to preview generation.
- Browser receives only bounded warning objects.

Cons:

- Adds a small service and test surface.

## Final Recommendation

Use server-side ephemeral guardrails:

- `no_preview_provider`: critical when the preview policy leaves no eligible provider.
- `selected_provider_changed`: info when the selected provider changes.
- `selected_provider_low_samples`: warning when the preview-selected provider has insufficient samples.
- `selected_provider_recent_health_issue`: warning or critical when recent sanitized health events show degraded/cooldown behavior for the preview-selected provider.

## Outcome

Implemented `webSearchProviderCalibrationGuardrails.mjs`, wired guardrails into calibration preview mode, and surfaced warnings in the Web Search Providers settings page. Guardrails are computed from the sanitized preview model and recent sanitized health events, preserving the preview endpoint's no-provider-call, no-persistence, no-route-history behavior.

## Follow-Up Candidates

1. Guardrail thresholds in settings: expose bounded controls only if fixed thresholds prove too rigid.
2. Preview diff history: store sanitized preview-before-save decisions if operators need auditability.
3. Provider-specific calibration overrides: consider only after guardrails show repeated provider-specific conflicts that purpose-level policy cannot express.
