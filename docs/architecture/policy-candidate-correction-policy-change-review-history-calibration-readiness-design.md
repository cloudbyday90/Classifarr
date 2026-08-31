# Policy-Change Review-History Calibration Readiness Design

## Decision

Retain the current aggregate bucket plus six completed fixed 30-day buckets and
add an administrator-only, aggregate-only **calibration readiness** projection.
It tells an operator whether there is enough bounded activity to begin the
separate human review of the fixed consistency thresholds. It cannot calculate
an automatic threshold change, alter policy, route media, call AI/RAG, or learn
from the result.

## Problem

The review-process consistency indicator correctly requires three completed
periods. Its documented follow-up is to evaluate its fixed thresholds after six
real completed periods. Before this change, retention kept only the current
period plus three completed periods, so that review could never be supported
from the purpose-limited aggregate data.

## Architecture

```text
fixed aggregate buckets (current + six completed)
                |
                v
server-owned six-period selection -- static aggregate query --> readiness contract
                                                             |       |
                                                             |       +-- collecting_periods
                                                             |       +-- insufficient_activity
                                                             |       +-- ready_for_human_review
                                                             v
existing administrator-only, selector-free summary endpoint
                |
                v
strict client allow-list --> automatically refreshed status section
```

The browser continues to receive only the existing three displayed periods and
the fixed readiness state. It never receives the internal six-period range,
raw period dates, calculation inputs, scores, recommendations, or a mutable
threshold.

## Fixed Contract

| Condition | State | Operator meaning |
| --- | --- | --- |
| Fewer than six complete server-defined periods | `collecting_periods` | Continue normal review activity. |
| Six periods, but any has fewer than 10 aggregate activities | `insufficient_activity` | Keep collecting; do not interpret a calibration result. |
| Six periods and every period has at least 10 aggregate activities | `ready_for_human_review` | A human may evaluate the fixed bands using aggregate and synthetic fixtures. |

Every state includes fixed `false` values for automatic policy change,
automatic AI/RAG tuning, and routing change. Unknown fields and malformed
period dimensions fail closed to `collecting_periods`.

## Privacy and Security Boundaries

- Retention grows from four to seven aggregate buckets only. It still stores
  no individual decision, policy, media, library, actor, outcome, provider,
  prompt, response, or RAG data.
- The existing administrator guard, selector-free request rule, no-store
  response, and read limiter remain the sole endpoint boundary.
- The aggregate query has a server-built fixed date array; no request can
  select a period, metric, library, or entity.
- The readiness calculation is a pure ES module. It has no database, network,
  provider, queue, policy, learning, AI/RAG, retry, or routing dependency.
- The client admits a fixed response schema and drops unknown fields before
  rendering. The status is descriptive, not an action.

NIST's Privacy Framework treats privacy-risk management and data minimization
as design concerns. Retaining only the minimum aggregate window required for a
human review keeps this change purpose-limited. OWASP API4 recommends bounded
resources, server-side validation, and endpoint-specific rate limiting; this
continues the existing fixed query and limiter approach.

## Accessibility and Automatic Refresh

The new section uses a labelled heading and a concise `role="status"`, with
explicit `aria-live="polite"` and `aria-atomic="true"`. It rides the existing
visible-page five-minute refresh and visibility refresh rather than adding a
new timer, control, focus change, or announcement source. This follows W3C's
WCAG 2.2 status-message requirement and ARIA22 technique: updates should be
programmatically determinable without moving focus or needlessly interrupting
the operator.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Human-gated aggregate readiness (selected) | Explainable, privacy-minimized, uses no model, preserves fixed threshold governance | Requires six real periods and a deliberate human review later |
| Automatically tune thresholds from six periods | Less operator work | Changes policy behavior from a small local sample; opaque and unsafe |
| Send review history to AI/RAG for calibration | Could identify narrative patterns | Adds model variance, broader data handling, and non-reproducible decisions |
| Keep four-period retention | Lowest stored aggregate history | Makes the documented six-period review impossible |

## Recommendation Stack

1. Retain the minimal seven-bucket aggregate window needed for six complete
   periods.
2. Surface only fixed readiness, automatically and accessibly.
3. Require a human, aggregate/synthetic-fixture review before versioning any
   threshold change.
4. Keep AI/RAG outside threshold authority; it may later summarize a
   human-approved report, never determine it.

## Official Research

Research performed on 2026-08-31:

- [W3C WCAG 2.2, Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/)
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C ARIA22: `role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22)
- [OWASP API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
