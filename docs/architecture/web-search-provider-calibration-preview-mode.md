# Web Search Provider Calibration Preview Mode

## Problem

Purpose-specific calibration controls can change provider route order by altering quality penalties and effective priority. Before this feature, an operator had to save a policy and then inspect diagnostics to understand whether the selected provider changed.

That is too reactive. Calibration should be inspectable before persistence so operators can make bounded changes without surprise route shifts.

## Research Notes

- OpenTelemetry semantic conventions recommend stable, consistently named attributes for observability data. The preview model therefore uses stable fields such as `purpose`, `providerKey`, `selectedProviderKeyBefore`, `selectedProviderKeyAfter`, rank, effective priority, and quality deltas.
- Google SRE monitoring guidance emphasizes actionable operational visibility. The preview is placed directly beside calibration controls so the operator can see the route-order impact before saving.
- OWASP API3:2023 warns against exposing object properties the caller does not need. The preview returns only sanitized route candidate projections and deltas. It excludes API keys, provider configs, queries, cache keys, route IDs, trace IDs, raw provider responses, and raw errors.
- OWASP CSRF guidance treats state-changing requests differently from read-only operations. Preview uses `POST` because it accepts a body, but it is side-effect free: it does not persist policy changes, call provider APIs, write usage/cache rows, or record route decisions.

Sources:

- OpenTelemetry Semantic Conventions: https://opentelemetry.io/docs/concepts/semantic-conventions/
- OpenTelemetry Metrics Semantic Conventions: https://opentelemetry.io/docs/specs/semconv/general/metrics/
- Google SRE Workbook, Monitoring: https://sre.google/workbook/monitoring/
- Google SRE Book, Monitoring Distributed Systems: https://sre.google/sre-book/monitoring-distributed-systems/
- OWASP API3:2023 Broken Object Property Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/
- OWASP Cross-Site Request Forgery Prevention Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html

## Options

### Option A: Client-Side Approximation

Pros:

- No server endpoint.
- Simple UI-only implementation.

Cons:

- Duplicates routing and calibration logic in the browser.
- Cannot accurately account for current usage, cooldown, quota, or outcome-feedback state.
- Higher risk of preview disagreeing with saved behavior.

### Option B: Save Then Refresh Diagnostics

Pros:

- Uses production routing logic.
- Minimal new code.

Cons:

- Persists changes before the operator understands impact.
- Requires manual rollback when a policy moves the wrong provider.
- Does not meet the goal of previewing changes before applying them.

### Option C: Server-Side Read-Only Preview

Pros:

- Reuses the same candidate calculation path as production routing.
- Accepts an unsaved policy override and compares current versus preview order.
- Keeps sensitive provider data out of the browser-facing model.
- Avoids route history, usage, cache, and provider-request side effects.

Cons:

- Adds one settings endpoint and a small comparison service.

## Final Recommendation

Use a dedicated server-side preview service:

- Normalize the submitted policy with the same bounded policy validator used for persistence.
- Calculate current candidates with the persisted policy.
- Calculate preview candidates with an in-memory policy override.
- Serialize both candidate sets through the existing safe route diagnostics projection.
- Return selected-provider changes and per-provider rank, effective-priority, penalty, and quality-score deltas.

## Outcome

Implemented a side-effect-free preview endpoint at `/settings/web-search/provider-calibration-policies/:purpose/preview` and added a **Preview Impact** action to each purpose calibration policy row. The preview explains whether the selected provider changes and how each provider's rank, effective priority, penalty, and quality score would change before the policy is saved.

## Follow-Up Candidates

1. Provider-specific calibration overrides: add only if purpose-level preview shows repeated conflicts that cannot be solved globally.
2. Preview diff history: store sanitized preview-before-save decisions if operators need auditability for calibration changes.
3. Calibration guardrails: warn when an unsaved policy would select a provider with low samples or active recent failures.
