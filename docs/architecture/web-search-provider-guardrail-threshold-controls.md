# Web Search Provider Guardrail Threshold Controls

## Context

Calibration preview guardrails already warn when an unsaved policy would select no provider, change the selected provider, rely on low sample confidence, or choose a provider with recent health or cooldown signals. Fixed thresholds were safe, but too rigid for different installations and provider volumes.

This change adds bounded operator controls for guardrail sensitivity while keeping the guardrails server-side, ephemeral, and sanitized.

## Official Guidance

- [Google SRE: Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) recommends alerts and warnings be evaluated by precision, recall, detection time, and reset time. Guardrail threshold controls expose those tradeoffs directly: operators can reduce noisy warnings without hiding critical no-provider states by accident.
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/) recommends stable names for telemetry data. Guardrails keep stable codes and severity labels so UI, tests, and future telemetry can consume the same model.
- [OWASP API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/) warns against exposing object properties callers do not need. Threshold APIs expose bounded settings only; they do not expose provider API keys, queries, cache keys, route IDs, trace IDs, classification IDs, raw errors, or raw provider responses.

## Options Considered

### Option A: Keep Fixed Thresholds

Pros:
- Smallest implementation.
- No operator tuning surface.

Cons:
- Too blunt for installations with sparse provider usage.
- Makes warnings feel noisy or missing depending on local volume.

### Option B: Fully Custom Rule Builder

Pros:
- Maximum flexibility.
- Could express provider-specific and purpose-specific warning logic.

Cons:
- Too much UI and validation complexity for this stage.
- Easy to create rules that contradict route diagnostics.
- Higher support burden.

### Option C: Bounded Threshold Controls

Pros:
- Simple mental model.
- Keeps guardrails separate from scoring and routing.
- Values are bounded and normalized server-side.
- Preserves sanitized preview behavior.

Cons:
- Does not support provider-specific guardrail overrides.
- Complex rules still need future design work.

## Recommendation

Use bounded threshold controls:

- `enabled`: global preview guardrail switch.
- `lowSampleMultiplier`: multiplies the selected provider's policy minimum sample count before warning.
- `recentHealthLookbackCount`: caps recent health events considered by preview guardrails.
- Per-guardrail severities: `info`, `warning`, `critical`, or `disabled`.

Store the settings as one JSON value in the existing `settings` table so upgrades are simple and no new relational table is needed until provider-specific or purpose-specific overrides exist.

## Security Boundary

The API returns only normalized threshold values. It does not return provider credentials, provider response bodies, cache keys, route IDs, trace IDs, correlation IDs, classification IDs, raw queries, or raw errors.

Invalid stored values are clamped to safe defaults. Missing storage falls back to defaults, so a failed read cannot break calibration previews.

## Outcome

Implemented:

- `webSearchProviderGuardrailThresholds.mjs` for normalization, storage, and safe fallback.
- Guardrail evaluation accepts threshold policy while preserving existing default behavior.
- Calibration preview loads threshold policy before building guardrails.
- Settings API endpoints for reading and updating thresholds.
- Web Search Providers UI panel for editing guardrail thresholds without raw JSON.
- Seed reconciliation migration for upgrade and fresh-install consistency.

## Next Targets

1. **Preview Diff History**: store sanitized before-save preview summaries when operators need an audit trail for calibration changes.
2. **Provider-Specific Calibration Overrides**: add only if purpose-level policy and guardrail thresholds still cannot handle repeated provider-specific behavior.
3. **Guardrail Analytics**: summarize how often each guardrail fires so defaults can be tuned from evidence instead of anecdotes.
