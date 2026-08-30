# Policy Candidate Correction Temporal-Stability Design

## Status

Implemented on the unreleased branch. This document defines advisory
monitoring only; it creates no release, tuning control, AI invocation, or
routing authority.

## Problem

One completed UTC-day window can identify a review-worthy aggregate
changed-selection rate, but it cannot distinguish a durable pattern from a
short-lived fluctuation. Administrators need a plain explanation of whether
the same fixed score-margin or evidence-state aggregate recurs in the
immediately preceding completed window before beginning a representative
policy-maintenance review.

## Design

The analytics service constructs two adjacent equal-length UTC-day windows:

```text
previous completed window | current completed window | in-progress UTC day
```

The in-progress day is excluded. Both completed windows use the existing
bounded static aggregate query and the existing fixed score-margin and
evidence-source/state vocabulary. The response contains each period's
aggregate count-derived readiness plus an allow-listed derived stability
status. It contains no event list, title, media, library, policy, candidate,
destination, actor, provider, prompt, response, raw RAG text, configuration,
or routing control.

`policyCandidateCorrectionTemporalStability.mjs` is a pure ESM service that
derives the status from two existing calibration-readiness results.
`policyCandidateCorrectionTemporalStabilityReport.mjs` composes the two
period reports and joins only matching fixed bucket identifiers. The client
separately revalidates every derived status against both locally validated
period reports before it renders local explanatory copy.

## Status Semantics

| Status | Meaning | Operational effect |
| --- | --- | --- |
| Needs two representative windows | Either period is below the existing applicable-decision floor. | Continue observing. |
| Persistent review signal | Both periods meet the fixed review criterion. | Review a representative cohort; no automatic change. |
| New review signal | Only the current period meets the criterion. | Observe another period before treating it as durable. |
| Diminishing review signal | Only the prior period meets the criterion. | Continue observing; do not infer causality. |
| Stable low signal | Both periods are below the criterion. | No correctness conclusion or route change. |
| Inconclusive across windows | The two readiness results do not establish persistence. | Continue observing. |

This is intentionally not a statistical change-point or causality test. It
reports repeated satisfaction of the existing conservative Wilson-interval
review gate. That keeps the interpretation understandable and avoids
overstating a two-window sample.

## Alternatives Considered

### Adjacent fixed-window persistence — selected

Pros:

- Uses the existing count-only query, interval gate, and fixed dimensions.
- Is easy for an administrator to reproduce and explain.
- Makes a one-window spike visible without treating it as a maintenance
  command.

Cons:

- Needs two representative completed windows before it can report
  persistence.
- Does not detect subtle gradual drift as early as a dedicated control chart.

### Point-estimate delta threshold

Pros:

- Compact and easy to calculate.

Cons:

- Overstates noisy small cohorts and duplicates the uncertainty problem the
  readiness gate already addresses.
- A percentage-point difference does not establish a meaningful process
  change.

### Control chart or change-point model

Pros:

- Can detect sustained small changes over a longer history.

Cons:

- Requires a sufficiently long, stable, representative time series and clear
  assumptions about sampling independence and cohort composition.
- Adds a statistical model and more operator-training burden before the
  aggregate data volume supports it.

## Security and Accessibility

- The existing authenticated route and parameterized aggregate query remain
  unchanged. The service invokes that same fixed query twice with server-built
  adjacent dates.
- The server builds an allow-listed response instead of passing through query
  objects. The client rejects unknown versions, identifiers, counts, status
  relationships, and server-supplied copy. This follows OWASP guidance not to
  rely on the UI to hide excess API fields.
- The view uses semantic tables with captions, scoped headers, and one concise
  non-focus-stealing status announcement. It does not add automatic polling or
  visual movement. If this view later gains automatic refresh, it must provide
  pause, stop, hide, or frequency control for non-essential updates.

## Research Basis

- NIST describes control monitoring as a way to distinguish persistent changes
  from ordinary variation, while noting that simple Shewhart-style monitoring
  is aimed at larger changes. This implementation takes the smaller first step
  of showing repeated conservative status, not claiming a control-limit event:
  [NIST/SEMATECH, Bias and Variability](https://www.itl.nist.gov/div898/handbook/mpc/section2/mpc22.htm).
- NIST's AI RMF Playbook calls for regular production monitoring and
  documentation of observed metrics and performance indicators:
  [NIST AI RMF Playbook](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf?trk=public_post_comment-text).
- WCAG status messages should be programmatically determinable without moving
  focus: [W3C WCAG 2.2, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
- W3C requires a mechanism to pause, stop, hide, or control the frequency of
  non-essential auto-updating content: [W3C WCAG 2.2, Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide).
- OWASP warns that API responses must contain only fields the client needs;
  client-side filtering is not a security boundary:
  [OWASP WSTG, Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure).

## Recommendation Stack

1. Keep the existing count floor and Wilson-interval readiness gate.
2. Add adjacent fixed-window persistence status before any maintenance review.
3. Use the delivered aggregate cohort-composition screen before interpreting a
   persistent signal as a policy-behavior pattern.
4. Require a representative human cohort review before changing declared
   policy scope, score mechanics, RAG behavior, or AI configuration.
5. Add a longer-horizon process-stability evaluation only when
   enough comparable aggregate windows exist.
