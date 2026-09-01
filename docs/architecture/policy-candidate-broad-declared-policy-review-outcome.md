# Broad Declared-Policy Review Recommendation Outcome

## Delivered Behavior

The Correction Analytics screen now turns one already-retained aggregate signal
into a concise maintenance recommendation. It appears only when both adjacent
completed 28-day periods independently report `review_recommended` for the
fixed `declared_policy:contextual` evidence bucket and the longer-horizon
cohort mix is comparable.

The card says exactly what to review: a policy that may be too broad. Its
optional “Why this recommendation is shown”
disclosure shows only each period’s date range, aggregate changed-selection
count, rate, and existing 95% Wilson interval. It never displays a title,
library, candidate, policy term, destination, provider, model, prompt,
retrieval text, or operator.

## Implementation

- `policyCandidateCorrectionLongHorizonTrendPresentation.js` now projects only
  the exact contextual declared-policy aggregate bucket from the pre-existing
  long-horizon payload. The projection validates totals and its fixed readiness
  contract, and does not make that bucket mandatory for the broader analytics
  report.
- `policyCandidateCorrectionBroadDeclaredPolicyRecommendationPresentation.js`
  is a small ES module that rejects missing, non-comparable, non-review-ready,
  or malformed periods before it returns client-owned presentation data.
- `PolicyCandidateBroadDeclaredPolicyRecommendation.vue` provides the compact,
  disclosure-based card and has no mutating controls or live region.
- `PolicyCandidateCorrectionAnalyticsStats.vue` composes the card immediately
  after longer-horizon context, so the recommendation follows the aggregate
  guard that qualifies it.

## Authority and Privacy Outcome

The change reuses an existing authenticated API response and creates no schema,
server route, database query, metric dimension, or background work. The
recommendation has no policy or routing authority. AI and RAG remain advisory
evidence and are neither invoked nor configured by this feature.

Malformed or duplicate matching buckets cause the focused recommendation to be
withheld. The surrounding analytics continue to render from their independently
validated report, avoiding an availability impact while preventing the new
advisory from being based on ambiguous data.

## Follow-up

The offline, synthetic policy-replay harness described as the next item is now
delivered in
[Synthetic Policy-Candidate Replay Outcome](policy-candidate-synthetic-replay-outcome.md).
The next high-value item is a progressive, plain-language pending-review
summary that keeps detailed evidence mechanics optional without reducing
operator control.
