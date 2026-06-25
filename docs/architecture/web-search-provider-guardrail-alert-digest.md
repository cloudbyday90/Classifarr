# Web Search Provider Guardrail Alert Digest

## Context

Guardrail analytics shows how often preview guardrails fire. The next useful layer is a digest that turns repeated guardrail activity into a short operator review summary. This should help avoid over-tuning from a single preview while also avoiding noisy alerts.

The digest is intentionally non-paging. It is shown in settings as a review aid, not as an incident notification.

## Research Notes

Official guidance reviewed:

- Google SRE, [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/): alerting should not fire merely because something looks unusual; alerts should be actionable.
- Google SRE Workbook, [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/): alerting strategies should balance precision, recall, detection time, and reset time.
- OpenTelemetry, [Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/): stable names and attributes make operational signals easier to interpret consistently.
- OWASP API Security Top 10, [API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/): API responses should not expose properties users do not need.
- NIST, [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework): AI-adjacent systems should support accountability, transparency, reliability, privacy, and security.

## Options Considered

### Option 1: External Notifications

Pros:

- Operators could be notified without opening settings.
- Useful for severe provider failures.

Cons:

- High risk of alert fatigue.
- Requires notification preferences, delivery retries, suppression, and auditability.
- Overkill before we know whether repeated guardrails are frequent.

### Option 2: Persist Digest Rows

Pros:

- Historical digest snapshots could be compared over time.
- Easier to audit when a digest was generated.

Cons:

- Duplicates information already available in guardrail analytics.
- Adds retention and cleanup concerns before the use case is proven.
- Risks turning a settings summary into another event stream.

### Option 3: Computed Settings Digest

Pros:

- Uses existing sanitized guardrail analytics.
- No new persistence layer.
- Keeps the signal non-paging and review-oriented.
- Supports a clear `clear`, `watch`, or `attention` status.

Cons:

- No long-term digest snapshot history.
- Digest threshold tuning is currently code-owned rather than UI-editable.

## Final Recommendation Stack

Use Option 3.

Implementation stack:

- `webSearchProviderGuardrailDigest.mjs` computes digest findings from aggregate guardrail analytics.
- The digest uses a bounded lookback window and thresholds for critical, warning, and repeated total activity.
- `GET /settings/web-search/provider-guardrail-digest` returns only sanitized summary fields and recommendation text.
- The Web Search Providers settings page shows the digest as a non-paging review panel.

## Security Boundary

The digest does not expose:

- API keys or provider configuration secrets.
- Search queries or provider response payloads.
- Cache keys, request fingerprints, route IDs, trace IDs, correlation IDs, or classification IDs.
- Raw errors or raw guardrail event rows.

Digest findings are derived from aggregate counts by stable guardrail code.

## Outcome

Implemented a computed guardrail alert digest with:

- Stable `clear`, `watch`, and `attention` levels.
- Bounded findings and recommendations by guardrail code.
- Settings API and UI coverage.
- Unit, route, API, and UI tests.

## Follow-Up Targets

1. **Provider-Specific Calibration Overrides**: only add when digest and analytics show repeated provider-specific conflicts that purpose-level policy cannot express.
2. **Preview Diff History**: store sanitized before/after summaries for saved calibration policy changes.
3. **Digest Threshold Controls**: expose bounded digest thresholds if the default code-owned policy proves too noisy or too quiet across installations.
