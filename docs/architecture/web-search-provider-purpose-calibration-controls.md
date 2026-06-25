# Web Search Provider Purpose Calibration Controls

## Problem

Provider quality calibration was using fixed defaults for every route purpose. That was safe, but too blunt: classification, metadata enrichment, content advisory checks, holiday lookups, and manual tests do not all have the same tolerance for stale outcomes, low sample counts, or provider quality penalties.

The platform needs per-purpose tuning without turning the settings UI into raw scoring JSON or exposing sensitive provider/query data.

## Research Notes

- OpenTelemetry semantic conventions recommend stable metric names and attributes so telemetry remains queryable and comparable over time. This maps to stable `purpose` labels instead of arbitrary user-defined dimensions for route quality controls.
- Google SRE guidance on SLO implementation and monitoring emphasizes measuring user-facing behavior with enough samples, clear windows, and actionable thresholds. That supports explicit lookback windows, minimum samples, and bounded penalties instead of hidden global defaults.
- OWASP API Security API3 warns against broad object property exposure. Calibration settings should expose only safe control fields, not provider secrets, query payloads, cached results, or raw route traces.
- OWASP logging guidance recommends avoiding sensitive data in logs while keeping security-relevant events auditable. Calibration updates log only the purpose key, not provider credentials or search content.

Sources:

- OpenTelemetry Metrics Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/general/metrics/
- OpenTelemetry Semantic Conventions Concepts: https://opentelemetry.io/docs/concepts/semantic-conventions/
- Google SRE Workbook, Implementing SLOs: https://sre.google/workbook/implementing-slos/
- Google SRE Workbook, Monitoring: https://sre.google/workbook/monitoring/
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## Options

### Option A: Keep Global Defaults

Pros:

- Lowest implementation cost.
- No new database surface.
- Predictable current behavior.

Cons:

- Cannot tune classification differently from metadata enrichment.
- Makes route decisions harder to explain when outcome feedback accumulates.
- Encourages code edits for operational tuning.

### Option B: Raw JSON Calibration Policy

Pros:

- Flexible.
- Fast to ship.

Cons:

- Easy to misconfigure.
- Harder to validate and document.
- Pushes internal scoring concepts into the UI.
- Raises avoidable object exposure risk if future fields are added carelessly.

### Option C: Bounded Purpose-Specific Controls

Pros:

- Purpose-aware without exposing raw scoring internals.
- Database constraints and service normalization enforce safe bounds.
- Fresh installs and upgraded installs get the same default classification policy.
- Operators can disable quality calibration for a purpose without disabling providers.

Cons:

- Adds a small table and settings API surface.
- Future purposes need deliberate default policy decisions if they need custom behavior.

## Final Recommendation

Use bounded purpose-specific controls:

- `purpose`: stable lowercase route purpose label.
- `is_enabled`: when false, quality calibration is neutral for that purpose.
- `lookback_days`: 1 to 90 days.
- `minimum_samples`: 1 to 100 samples.
- `maximum_priority_penalty`: 0 to 100 priority points.
- `outcome_weight`: 0 to 50 score points.

Keep the initial default policy aligned to current behavior:

- Purpose: `classification`
- Enabled: `true`
- Lookback: `14` days
- Minimum samples: `3`
- Maximum priority penalty: `25`
- Outcome weight: `15`

## Security Model

- API keys remain managed only through provider configuration endpoints.
- Calibration endpoints accept only bounded numeric fields and an enable flag.
- Purpose labels are constrained to `^[a-z0-9_-]{1,60}$`.
- Route diagnostics continue to expose safe summaries, not raw queries or cached responses.
- Update logs include only the purpose label.

## Outcome

Implemented a dedicated `web_search_provider_calibration_policies` table, a modular calibration policy service, settings API endpoints, and a settings UI panel. The route quality calibration service now loads purpose-specific controls before scoring provider quality. If a purpose policy is disabled, providers keep neutral quality calibration for that purpose.

## Follow-Up Candidates

1. Purpose coverage report: show which route purposes have explicit policies and which are using defaults.
2. Calibration preview mode: estimate route order changes before saving a policy.
3. Provider-specific calibration overrides: only if purpose-level tuning proves insufficient in real usage.
