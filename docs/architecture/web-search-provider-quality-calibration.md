# Web Search Provider Quality Calibration

## Status

Implemented for provider-router purpose-aware routing.

## Problem

Provider routing previously considered configuration, priority, cooldown, and
quota. That is deterministic, but it treats all providers as equally useful for
every purpose. In practice, providers can differ by task:

- One provider may return better metadata enrichment evidence.
- Another may work better as a retry fallback.
- A provider can be configured and under quota but repeatedly return empty
  result sets for a specific purpose.

The router needed a small feedback signal that improves provider selection
without making routing opaque or overriding explicit operator priority too
aggressively.

## Current Best-Practice Inputs

- Google SRE guidance recommends service level indicators and error budgets
  rather than expecting perfect reliability. Provider quality should therefore
  be measured over windows and samples, not from one failure.
- OpenTelemetry semantic conventions emphasize consistent attributes for
  metrics and telemetry. Provider quality uses stable dimensions:
  `provider_key`, `purpose`, `operation`, `status`, result count, and duration.
- NIST AI RMF emphasizes measuring and managing risk for AI-adjacent systems.
  Provider routing affects classification evidence, so quality needs to be
  observable and bounded rather than hidden in prompt behavior.
- OWASP logging guidance requires useful operational records while excluding
  sensitive data. Calibration uses aggregate usage metadata only; it does not
  read or persist search queries, API keys, raw provider responses, cache keys,
  or provider configs.

Sources:

- <https://sre.google/sre-book/service-level-objectives/>
- <https://sre.google/workbook/implementing-slos/>
- <https://opentelemetry.io/docs/concepts/semantic-conventions/>
- <https://opentelemetry.io/docs/specs/semconv/general/metrics/>
- <https://www.nist.gov/itl/ai-risk-management-framework>
- <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>

## Options Considered

### Option A: Keep static priority only

Pros:

- Simple and predictable.
- No additional scoring logic.

Cons:

- Cannot adapt when a provider performs poorly for one purpose.
- Operators need to manually reorder providers based on symptoms.

### Option B: Global provider score

Pros:

- Easy to compute.
- Gives some feedback beyond priority.

Cons:

- Blends unrelated use cases together.
- A provider that is weak for enrichment but good for fallback could be unfairly
  penalized everywhere.

### Option C: Purpose-aware quality score with capped priority penalty

Pros:

- Uses the same purpose dimension already present in provider requests.
- Requires minimum sample counts before it affects routing.
- Keeps explicit priority visible and intact.
- Caps routing influence so quality cannot create surprising large reorders.
- Fits the existing usage table and route diagnostics model.

Cons:

- Adds another routing dimension operators need to understand.
- Cold providers stay neutral until they collect enough samples.
- Result-count quality is a proxy; deeper relevance scoring remains future work.

## Final Recommendation Stack

Use Option C:

- Compute quality from recent `web_search_provider_usage` rows by
  `provider_key` and `purpose`.
- Ignore cache hits for quality so cached results do not inflate live provider
  health.
- Require at least three live-search samples before applying any penalty.
- Score providers with:
  - 70% success rate.
  - 20% non-empty successful result rate.
  - 10% latency score.
- Convert quality loss into a capped priority penalty.
- Route by `effectivePriority = priority + qualityPenalty`.
- Surface score, sample count, and penalty in Route Diagnostics.

## Security Model

Calibration only reads aggregate usage fields:

- provider key
- purpose
- operation
- status
- result count
- duration
- searched timestamp

It does not read or expose:

- Search query text.
- API keys.
- Provider configuration.
- Cache keys or request fingerprints.
- Raw provider responses.
- Result snippets.

## Outcome

The router now adapts within bounded limits when a provider has enough
purpose-specific evidence that it is lower quality for that task. Operators can
still control provider order with priority, and diagnostics explain whether a
provider is neutral due to insufficient samples or penalized by recent quality.

## Follow-Up Items

1. Add route-decision retention for bounded growth of route history.
2. Add provider health and cooldown history for longer-term outage visibility.
3. Add explicit operator controls for calibration sensitivity if real-world
   deployments need stricter or looser routing adjustment.
