# Policy Candidate Correction Cohort-Composition Design

## Status

Implemented on the unreleased branch. This is an advisory monitoring addition
only: it adds no release, policy tuning, AI invocation, RAG retrieval, or
routing authority.

## Problem

A persistent correction signal in two adjacent completed windows is only useful
when those windows represent sufficiently similar reviewed cohorts. For
example, a current window containing mostly very-close policy choices may have
a different changed-selection pattern than a prior window dominated by clear
choices, even if the policy itself did not change.

The system therefore needs a bounded way to distinguish a changed review mix
from a changed aggregate outcome pattern before an administrator begins a
representative maintenance review.

## Selected Design

`policyCandidateCorrectionCohortComposition.mjs` is a pure ESM comparator for
one fixed distribution. It compares only count-derived shares across adjacent
completed windows and calculates total-variation distance (TVD):

```text
TVD = 1/2 × sum(abs(current share - previous share))
```

The report composes two existing aggregate-only dimensions:

1. All four fixed policy-score margin bands.
2. The five fixed states for each evidence source that has observations in at
   least one period.

The comparator requires at least 20 observations in each side of a dimension.
At or above that floor, a TVD of 20 percentage points or more is a **Material
cohort-mix shift**. Both values are visible fixed screens, not learned
thresholds. Shares are calculated at full precision, then rounded only for
display, so rounding cannot alter a threshold decision.

The existing static aggregate query, authenticated route, retention model, and
completed-window helper remain unchanged. Contract v4 adds an allow-listed
`cohortComposition` object to the existing correction-analytics response.
The client independently recomputes counts, shares, TVD, and every status from
the two already validated period reports. It discards malformed, inconsistent,
unknown, or server-authored presentation data before rendering local copy.

## Status Semantics

| Status | Meaning | Operational effect |
| --- | --- | --- |
| Needs more cohort observations | At least one period is below 20 observations. | Do not infer that the two cohorts are comparable. |
| Cohort mix is comparable | Both periods meet the floor and TVD is below 20 points. | Interpret the existing temporal signal normally; no correctness or causality claim. |
| Material cohort-mix shift | Both periods meet the floor and TVD is at least 20 points. | Interpret any correction signal cautiously and inspect representative decisions. |

An overall status is material if any included dimension is material. It needs
more data if none are material but one or more are below the floor. It is
comparable only when every included dimension is comparable.

## User Experience and Accessibility

The Statistics view adds a read-only **Cohort-composition context** card. It
uses concise status text, three labeled summary values, a semantic score-margin
table, and a semantic evidence-source table. The tables have captions and
scoped headers, retain horizontal overflow inside the card, and the existing
non-focus-stealing status message includes the new state.

This follows W3C's guidance to use table structure for data relationships and
to expose dynamic status without a disruptive focus change. It does not add
polling or another manual action; the analytics response is loaded with the
existing page request.

## Alternatives Considered

### Fixed aggregate TVD screen — selected

Pros:

- Detects an important composition confounder with the data already retained.
- Is reproducible, bounded, and understandable without an opaque model.
- Preserves advisory-only monitoring and the existing deterministic authority
  boundary.

Cons:

- A fixed 20-point screen is deliberately coarse and may miss smaller shifts.
- It does not measure significance, causality, policy correctness, or whether
  each dimension is independently representative.

### Per-item or per-destination comparison

Pros:

- Could offer more detailed diagnostic hypotheses.

Cons:

- Would expand identity retention and response exposure substantially.
- Is unnecessary for this first confounder screen and conflicts with the
  aggregate-only correction analytics boundary.

### Learned drift or change-point model

Pros:

- Could find smaller or gradual changes in a mature time series.

Cons:

- Requires more historical, representative data and explicit drift-model
  evaluation before it can be trusted.
- Adds more assumptions and operator-training burden than the current evidence
  supports.

## Security Boundary

- All data remains fixed aggregate counts from the existing parameterized,
  read-only query. No title, media, library, policy, candidate, destination,
  actor, provider, prompt, response, raw RAG text, or configuration is added.
- The server derives bucket IDs and dates; the browser cannot select a
  dimension, threshold, provider, model, or timeframe beyond the existing
  bounded request.
- The new client projection revalidates the derived object and does not treat
  client filtering as the API boundary. The server response itself remains
  allow-listed and aggregate-only.
- The comparison is not a maintenance command. It cannot invoke AI, change
  RAG, learn, persist configuration, retry work, or route media.

## Research Basis

- NIST AI RMF's Measure function calls for monitoring data and system behavior
  and considering distributional differences relative to a baseline:
  [NIST AI RMF Playbook, Measure](https://airc.nist.gov/airmf-resources/playbook/measure/).
- NIST describes monitoring as distinguishing persistent process changes from
  ordinary variation; this design deliberately uses a descriptive screen
  rather than claiming a control-limit event:
  [NIST/SEMATECH, Bias and Variability](https://www.itl.nist.gov/div898/handbook/mpc/section2/mpc22.htm).
- Semantic captions, headers, and data cells make table relationships
  programmatically determinable:
  [W3C WAI Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- The status remains programmatically determinable without moving focus:
  [W3C WCAG 2.2, Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).
- OWASP recommends minimizing API response data rather than relying on a user
  interface to hide it:
  [OWASP WSTG, Excessive Data Exposure](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/12-API_Testing/03-Testing_for_Excessive_Data_Exposure).

## Recommendation Stack

1. Keep the fixed 20-decision Wilson-interval readiness gate.
2. Keep adjacent completed-window persistence monitoring.
3. Add this fixed TVD cohort-composition guard before interpreting a persistent
   review signal as a policy-behavior pattern.
4. Require a representative human review before any policy maintenance.
5. Only after enough comparable windows exist, evaluate a longer-horizon,
   aggregate-only trend monitor with the composition screen as a guardrail.
