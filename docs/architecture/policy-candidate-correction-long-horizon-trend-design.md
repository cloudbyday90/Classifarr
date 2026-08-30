# Policy Candidate Correction Long-Horizon Trend Design

## Status

Implemented on the unreleased branch. This is an aggregate-only, advisory
monitoring addition. It creates no release and has no policy, AI, RAG,
learning, retry, or routing authority.

## Problem

The short adjacent-window view can show a recurring correction pattern, but a
single short period is noisy. The preceding cohort-composition screen prevents
an obvious confounder for that short comparison; it does not show whether the
same guarded pattern persists over a meaningful, fixed time horizon.

The operator needs a small, understandable signal that says when a
representative review is worth doing, without turning aggregate observations
into an automatic policy-maintenance decision.

## Selected Design

The server builds two adjacent completed UTC periods of exactly 28 days:

```text
previous: [now - 56 complete days, now - 28 complete days)
current:  [now - 28 complete days, now)
```

It reuses the authenticated, parameterized correction-outcome aggregate query
for each period and reuses the established fixed readiness and
cohort-composition derivations. The browser cannot choose a different
lookback, threshold, dimension, provider, model, or cohort.

The new ESM modules are deliberately narrow:

- `policyCandidateCorrectionLongHorizonTrend.mjs` determines a status from two
  validated readiness snapshots and a derived cohort-composition status.
- `policyCandidateCorrectionLongHorizonTrendReport.mjs` composes the two
  existing aggregate reports, calculates the full internal cohort comparison,
  and exposes only its compact status and dimension counts.
- `policyCandidateCorrectionLongHorizonTrendPresentation.js` independently
  validates exact 28-day UTC spans, adjacency, outcome-count identities,
  readiness states, compact cohort result, and derived status before rendering
  client-owned text.

The existing response advances to contract v5. The 7-day operator analytics
remain unchanged; the fixed 28-day projection is an additional property.

### Status Semantics

| Status | Meaning | Operational effect |
| --- | --- | --- |
| Needs two representative 28-day periods | Either period has not met the existing readiness floor. | Continue observing. |
| Long-horizon cohort comparison needs observations | Both periods meet readiness but their aggregate cohort comparison does not. | Do not interpret a long-horizon pattern. |
| Long-horizon signal guarded by cohort mix | The aggregate cohort changed materially. | Review representative decisions before attributing a signal to policy behavior. |
| Sustained 28-day review signal | Both representative, comparable periods met the existing review criterion. | Advisory cue to review a representative cohort; no automatic action. |
| Sustained low signal across 28-day periods | Both representative, comparable periods remained below the review criterion. | Continue observing; do not infer correctness or causality. |
| Mixed 28-day aggregate signal | Neither sustained pattern applies. | Continue observing. |

## User Experience and Accessibility

Statistics adds a read-only **Longer-horizon trend context** card. It states the
fixed time basis and advisory boundary, announces the derived state through the
existing non-focus-stealing status region, and shows current and previous
periods in a semantic table with a caption and scoped headers. It has no
button, polling behavior, or maintenance control.

This follows W3C guidance to retain semantic table relationships and to expose
meaningful dynamic status without moving focus. The fixed prose makes the
card's operating boundary visible rather than relying on color or an implicit
inference.

## Alternatives Considered

### Two fixed adjacent 28-day periods — selected

Pros:

- Makes comparison dates reproducible and prevents query-shape expansion.
- Reduces short-window noise while preserving completed-window boundaries.
- Reuses evaluated aggregate derivations and the existing cohort guard.
- Is explainable to an operator and remains bounded in cost.

Cons:

- Delays the signal by design and may still be underpowered in small
  installations.
- Cannot detect every gradual change or establish causality.

### User-selected arbitrary history range

Pros:

- More flexibility for an experienced analyst.

Cons:

- Invites post-hoc selection, complicates interpretation, and broadens query
  and client-contract surface area.

### Learned drift or change-point model

Pros:

- Could identify more subtle or gradual change in a mature, representative
  series.

Cons:

- Requires a dedicated evaluation corpus, calibration, monitoring, and
  operator explanation before it can be trusted.
- Adds opaque behavior that the current data does not justify.

## Security Boundary

- The service uses only server-built fixed dates and existing static,
  parameterized aggregate reads. Window loads are memoized so the 28-day
  request reuses the short-window query when both happen to use that range.
- The public 28-day projection exposes count-only outcome summaries, fixed
  readiness metadata, compact cohort status/counts, and a derived status. It
  excludes media, library, policy, candidate, destination, actor, provider,
  prompt, response, raw RAG text, and configuration data.
- The client treats its projection as a defense-in-depth display filter, not
  an authorization boundary. The server itself returns an allow-listed,
  aggregate-only shape.
- The trend cannot invoke AI, modify RAG, persist feedback, change a policy,
  schedule work, retry a classification, or route media.

## Research Basis

- NIST's AI RMF Measure guidance calls for monitoring system behavior and
  comparing deployed conditions with a baseline:
  [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/).
  This design treats the result as a monitoring cue, not a causal or automated
  decision.
- W3C explains how captions and headers make tabular relationships available
  to assistive technology:
  [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- W3C's status-message guidance supports exposing updates programmatically
  without a disruptive focus change:
  [WCAG 2.2 Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
- OWASP advises minimizing API response data rather than merely hiding it in a
  user interface:
  [OWASP WSTG — Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure).

## Recommendation Stack

1. Keep the fixed minimum-cohort and Wilson-interval readiness gate.
2. Keep short adjacent completed-window monitoring for timely visibility.
3. Keep the fixed cohort-composition guard before interpreting repeated
   patterns.
4. Add this fixed two-period 28-day trend as a descriptive, advisory cue.
5. Use the bounded representative-review handoff only after a sustained review
   signal, then require human review before considering policy maintenance.
6. Evaluate a learned change model only after a documented, representative
   aggregate evaluation corpus and an explicit operator-review design exist.
