# Web Search Provider Purpose Coverage Report

## Problem

Purpose-specific calibration controls let operators tune quality penalties by search purpose, but the settings screen still needed a clear answer to a simple operational question: which purposes have an explicit policy, and which are still relying on the default fallback?

Without that report, operators would need to infer coverage from raw rows or wait for surprising route behavior.

## Research Notes

- OpenTelemetry semantic conventions recommend stable, consistently named attributes so observability data remains understandable and queryable across signals. The report therefore uses the canonical web-search `purpose` list as the primary coverage dimension.
- Google SRE guidance emphasizes dashboards and reports that put actionable service indicators close to the operator workflow. The report summarizes explicit versus default fallback coverage directly in the provider settings page where calibration is managed.
- OWASP API3:2023 warns against exposing object properties that the caller does not need. The report exposes only purpose keys, coverage status, and safe policy summaries; it does not include provider API keys, queries, cache keys, route traces, result payloads, or raw provider responses.
- OWASP logging guidance recommends retaining useful operational events without logging sensitive data. This feature is read-only and does not add new sensitive log output.

Sources:

- OpenTelemetry Semantic Conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- OpenTelemetry Metrics Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/general/metrics/
- Google SRE Workbook, Monitoring: https://sre.google/workbook/monitoring/
- Google SRE Book, Monitoring Distributed Systems: https://sre.google/sre-book/monitoring-distributed-systems/
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html

## Options

### Option A: Infer Coverage Client-Side

Pros:

- No new endpoint.
- Fast to build.

Cons:

- Duplicates the canonical purpose list in the client.
- Cannot safely include future server-only purpose metadata.
- Makes fallback behavior less testable.

### Option B: Add Coverage Fields to Policy List

Pros:

- One request.
- Minimal UI change.

Cons:

- Blurs editable policy rows with read-only coverage state.
- Makes it harder to include known purposes that do not yet have rows.

### Option C: Dedicated Coverage Report

Pros:

- Server remains the source of truth for known purposes and fallback behavior.
- Clear separation between read-only coverage and editable policy rows.
- Easy to test without exposing sensitive route or provider data.

Cons:

- Adds one small settings endpoint.

## Final Recommendation

Use a dedicated read-only coverage report:

- Build coverage from `WEB_SEARCH_PURPOSES` plus persisted calibration policies.
- Mark every purpose as `covered` when an explicit policy exists.
- Mark every purpose as `fallback` when it uses the default policy.
- Include custom persisted purposes as explicit but `knownPurpose: false`.
- Keep the browser-facing model limited to purpose labels, counts, status, and safe policy summaries.

## Outcome

Implemented `listPolicyCoverage()` in the calibration policy service, exposed it through `/settings/web-search/provider-calibration-policies/coverage`, and added a Purpose Coverage Report to the Web Search Providers settings page. The report shows explicit versus default fallback counts and per-purpose status before operators edit any calibration settings.

## Follow-Up Candidates

1. Calibration preview mode: show route-order impact before saving policy changes.
2. Provider-specific calibration overrides: add only if purpose-level tuning proves insufficient.
3. Purpose lifecycle audit: record when new route purposes are introduced so operators know why a new fallback appears.
