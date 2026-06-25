# Web Search Provider Outcome Feedback Loop

## Status

Implemented as a bounded input to provider quality calibration.

## Problem

Provider routing could already react to transport-level behavior: provider
success, zero-result responses, latency, quota, and cooldowns. That does not
answer the more important downstream question: did the provider-backed evidence
help produce a useful classification outcome?

Without outcome feedback, a provider can look healthy while repeatedly
contributing evidence that later needs correction.

## Current Best-Practice Inputs

- Google SRE monitoring guidance recommends measuring symptoms such as latency,
  traffic, errors, and saturation, and breaking metrics down by useful labels.
  Provider routing therefore keeps transport quality and downstream outcome
  quality as separate, labelable signals instead of relying on a single opaque
  score.
- OpenTelemetry semantic conventions emphasize consistent attributes and event
  names across telemetry. The feedback loop uses the existing stable dimensions:
  `provider_key`, `purpose`, `operation`, route outcome, and classification
  outcome.
- NIST AI RMF calls for feedback processes and measurement approaches tied to
  the deployed context. For Classifarr, the deployed context is whether provider
  evidence leads to completed/routed classifications or later corrections.
- OWASP logging guidance requires avoiding sensitive data in operational logs.
  Outcome feedback derives from existing route decisions and classification
  statuses only; it does not persist or expose search queries, API keys, cache
  keys, provider configs, snippets, or raw responses.

Sources:

- <https://sre.google/workbook/monitoring/>
- <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- <https://opentelemetry.io/docs/specs/semconv/general/events/>
- <https://www.nist.gov/itl/ai-risk-management-framework>
- <https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf>
- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Options Considered

### Option A: Continue transport-only quality

Pros:

- No new logic.
- Easy to understand.

Cons:

- Cannot distinguish technically successful searches from searches that lead to
  poor downstream classification decisions.
- Operators must infer provider quality from corrections manually.

### Option B: Persist a new feedback event table

Pros:

- Append-only history can be inspected directly.
- Future analytics can use precomputed feedback rows.

Cons:

- Duplicates state already present in route decisions and classification
  history.
- Requires retention, reconciliation, and migration surface before the feedback
  signal is proven useful.

### Option C: Derive feedback from route decisions joined to classification outcomes

Pros:

- Uses existing sanitized route decision history and final classification state.
- No duplicated outcome truth.
- Automatically reflects later corrections or verification.
- Keeps the feedback loop bounded by the existing route-decision retention
  window.
- Easy to promote to persisted events later if real deployments need longer
  analytics.

Cons:

- Older feedback disappears when route decision history expires.
- Outcome scoring depends on classification statuses being updated accurately.

## Final Recommendation Stack

Use Option C:

- Read only successful provider route decisions tied to a `classification_id`.
- Join to the current `classification_history` row.
- Treat completed, routed, verified, reclassified, and resolved outcomes as
  positive.
- Treat corrections and failed classifications as negative.
- Treat awaiting-decision and pending statuses as pending, not negative, because
  asking for clarification is a safety behavior.
- Require at least the same minimum sample count as provider quality calibration
  before outcome feedback affects routing.
- Apply outcome feedback as a capped penalty against the existing quality score,
  not as a hard override of operator priority.
- Surface outcome fit in settings route diagnostics without exposing
  classification identifiers or provider payloads.

## Security Boundary

The feedback loop reads:

- provider key
- purpose
- operation
- route outcome
- classification status
- linked outcome type
- route decision timestamp

It does not read or expose:

- search query text
- API keys
- provider configuration
- cache keys or request fingerprints
- raw provider responses
- search result snippets
- prompt text

## Outcome

Provider quality calibration now incorporates downstream outcome fit when enough
recent provider-backed classifications have resolved. A provider that succeeds
technically but contributes to corrected or failed classifications receives a
bounded priority penalty for that purpose. Providers with insufficient outcome
signals remain neutral.

## Next High-Value Items

1. **Outcome feedback UI detail**: add an expandable diagnostic row explaining
   positive, negative, pending, and neutral outcome counts per provider.
2. **Purpose-specific calibration controls**: expose safe operator controls for
   sample thresholds and outcome penalty weight if production deployments need
   different sensitivity by purpose.
3. **Provider evidence audit drilldown**: add a sanitized drilldown from route
   decision history to classification lifecycle so operators can inspect why a
   provider was penalized without seeing raw queries or API payloads.
