# Web Search Provider Guardrail Analytics

## Context

Calibration preview guardrails warn when an unsaved provider policy would produce risky behavior: no selected provider, a changed selected provider, low sample confidence, or recent provider health/cooldown concerns. Before this change, operators could see guardrails only inside a single preview response. That made threshold tuning anecdotal.

Guardrail analytics adds aggregate evidence for those warnings without turning preview mode into a raw event log.

## Research Notes

Official guidance reviewed:

- Google SRE, [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/): dashboards should answer operational questions and monitoring should keep signal high and noise low.
- OpenTelemetry, [Metrics Data Model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/): aggregate metric-style data is appropriate when the platform needs timeseries-like evidence rather than raw request replay.
- OWASP API Security Top 10, [API3:2023 Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/): API responses should not expose object properties clients do not need.
- NIST, [AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework): AI-adjacent decision systems should emphasize accountability, transparency, reliability, privacy, and security.

## Options Considered

### Option 1: Keep Preview-Only Guardrails

Pros:

- No schema change.
- Preview remains strictly side-effect free.

Cons:

- Threshold tuning remains based on isolated examples.
- Operators cannot tell whether a guardrail is common, rare, or provider-specific.

### Option 2: Store Full Preview Payloads

Pros:

- Maximum forensic detail.
- Easy to replay historical previews.

Cons:

- Stores much more data than the settings UI needs.
- Higher privacy and security risk because preview payloads can contain provider diagnostics, rank details, and messages.
- Encourages treating preview analytics as an audit log, which is not the intent.

### Option 3: Store Sanitized Guardrail Events

Pros:

- Gives operators aggregate evidence by purpose, guardrail code, severity, and provider.
- Keeps raw queries, provider payloads, cache keys, route IDs, trace IDs, correlation IDs, classification IDs, raw errors, and preview messages out of storage.
- Failure to record analytics can be safely contained without breaking preview mode.

Cons:

- Does not support replaying the exact preview.
- Requires a small schema addition.

## Final Recommendation Stack

Use Option 3.

Implementation stack:

- `web_search_provider_guardrail_events` stores sanitized event facts only.
- `webSearchProviderGuardrailAnalytics.mjs` owns normalization, persistence, pruning, and aggregate summaries.
- Calibration preview calls `recordPreviewGuardrailsSafely()`, so analytics failures do not break preview.
- Settings exposes only an aggregate endpoint: `GET /settings/web-search/provider-guardrail-analytics`.
- The Web Search Providers settings page shows counts by severity and guardrail code.

## Security Boundary

Guardrail analytics intentionally excludes:

- API keys and provider configuration secrets.
- Search queries and provider response payloads.
- Cache keys and request fingerprints.
- Route IDs, trace IDs, correlation IDs, and classification IDs.
- Raw error messages and preview warning messages.

The stored metadata is bounded to small numeric/status fields that help explain aggregate guardrails without revealing user data.

## Outcome

Implemented sanitized preview guardrail analytics with:

- A forward-only migration for `web_search_provider_guardrail_events`.
- Server-side aggregation by guardrail code, severity, purpose, and provider count.
- A read-only settings panel that shows recent guardrail activity over a bounded lookback window.
- Tests for service sanitization, route/API contracts, preview integration, UI rendering, and schema coverage.

## Follow-Up Targets

1. **Provider-Specific Calibration Overrides**: only add this if guardrail analytics shows repeated provider-specific issues that purpose-level policies cannot express.
2. **Preview Diff History**: store sanitized before/after summaries for saved policy changes, separate from preview analytics.
3. **Digest Threshold Controls**: expose bounded digest thresholds if the default code-owned policy proves too noisy or too quiet across installations.
