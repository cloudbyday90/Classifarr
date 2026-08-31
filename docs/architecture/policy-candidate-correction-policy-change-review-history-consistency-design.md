# Policy-Change Review-Process Consistency Indicator Design

## Status

Implemented on the unreleased branch. This is an aggregate-only, descriptive
addition to the existing Policy-change review activity card. It has no
policy-edit, routing, classification, provider, AI, RAG, learning, retry, or
automatic-action capability.

The sources below were checked at their official publishers on 2026-08-31 for
this August 2026 design decision.

## Problem

The completed-period activity tables show whether reviewed conclusions were
recorded or revised, but an administrator must mentally compare three tables
to tell whether the manual review process is stable enough to interpret. A
live or per-record trend would be easier to read, but would blur partial
periods, add personal/media linkage, and invite an unsafe automated response.

## Selected Design

```text
existing three completed, coarse activity aggregates
  -> pure server-owned consistency contract
  -> one fixed descriptive status in the existing no-store admin response
  -> automatically refreshed Security Settings explanation
  -> administrator inspects the same aggregate tables when a shift is observed
```

No new table, event, raw history, selector, query, retention path, telemetry,
or external call is created. The contract receives only the already-redacted
three conclusion-count vectors and returns one of four allow-listed states:

| State | Condition | Meaning |
| --- | --- | --- |
| `collecting` | Fewer than three whole periods are available. | Wait for complete periods. |
| `insufficient_activity` | Any of the three periods has fewer than 10 aggregate activities. | More activity is needed before comparison. |
| `consistent` | Both adjacent-period comparisons remain within both fixed bands. | The review process was similar; it is not evidence that a policy is correct. |
| `shifted` | Either adjacent comparison exceeds a fixed band. | Inspect the existing aggregate tables; no action was taken. |

The server calculates the two adjacent-period comparisons from:

- total-variation distance of the three conclusion proportions (at most 25%);
- absolute revision-rate difference (at most 20 percentage points); and
- the fixed minimum of 10 aggregate activities in every period.

Only the status and fixed `comparisonAvailable` boolean are returned. The
calculated distances, rates, period dates, counts, and identity-bearing input
are not added to the response. The thresholds are explicit stability bands,
not statistical confidence, a policy-quality score, or a recommendation to
change a policy.

## Privacy and Security Boundary

- The calculation is pure, deterministic, and receives the existing
  short-lived aggregate period data only. It cannot read a policy, library,
  title, media item, actor, outcome, rationale, provider, prompt, response,
  embedding, or RAG context.
- The existing administrator-only, selector-free, no-store, rate-limited
  summary route remains the sole transport. No browser-controlled comparison
  dimension, date range, result size, or threshold is accepted.
- A malformed period or conclusion dimension fails closed to `collecting`.
  The client also allow-lists the four status/availability pairs and rejects
  authority-bearing fields before rendering.
- The indicator inherits the summary card's visible-page automatic refresh;
  it does not make a provider request or persist a refresh receipt. A shift
  remains an invitation to read the existing tables, never a trigger.
- This maintains disassociability: processing is performed without retaining
  or exposing an association to an individual, device, media record, or policy
  beyond the limited aggregate operational need.

## Accessible, Hands-Off UI

The card states what is available, what is still collecting, and what the
operator should do next in plain language. The existing completed-period
tables retain native table/caption/header semantics; the new indicator is a
short labelled section with a polite programmatic status update. It neither
moves focus nor provides a manual refresh control. This gives an automatic
update a clear, predictable explanation without creating an overly chatty
alert stream.

## Options Considered

### Fixed aggregate consistency indicator — selected

Pros:

- Makes a process shift legible without new data collection.
- Avoids interpreting incomplete periods and demands a minimum cohort.
- Is inexpensive, bounded, explainable, and easy to test.

Cons:

- It cannot explain *why* the aggregate process changed.
- The fixed thresholds need future review only after enough real completed
  periods exist; they are deliberately not self-tuning.

### AI/RAG evaluates titles, descriptions, or current-library context

Pros: could produce a richer explanation of individual policy choices.

Cons: would mix probabilistic content interpretation with a deterministic
workflow signal, require more data handling, and risk becoming hidden policy
authority. Rejected for this component.

### Store individual review history and infer a trend

Pros: permits detailed audit and root-cause analysis.

Cons: adds policy/media/actor/outcome linkage, retention, authorization, and
deletion obligations. Rejected.

### Automatically adjust a policy when a shift is observed

Pros: superficially reduces manual work.

Cons: turns a descriptive aggregate into routing authority and could amplify a
temporary operational change. Rejected.

## Research Basis

- W3C advises native data tables with captions and programmatic row/column
  header relationships, which the existing activity tables retain:
  [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- W3C WCAG 2.2 expects status updates to be programmatically determinable
  without taking focus; it also warns that live feedback should not become
  unnecessarily chatty. The compact polite state follows that guidance:
  [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- W3C's accessibility principles emphasize predictable interface behavior and
  clear descriptions. A fixed state machine and no surprise action are more
  predictable than an opaque AI conclusion:
  [W3C Accessibility Principles](https://www.w3.org/WAI/fundamentals/accessibility-principles/).
- OWASP recommends explicit authorization for administrative functions and
  bounded request work. Reusing the existing admin authorization, selector
  rejection, fixed response, and endpoint rate limit keeps this read model
  constrained:
  [API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/)
  and [API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- NIST frames privacy management around risks created throughout the data
  lifecycle; its disassociability material supports processing without
  association beyond operational need. This design derives a status from
  existing aggregates rather than retaining an individual history:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework) and
  [Using Privacy Framework 1.1](https://www.nist.gov/privacy-framework/using-privacy-framework-11).

## Recommendation Stack

1. Keep deterministic policy evidence and operator confirmation as the sole
   routing authority.
2. Use the aggregate consistency state only after three full periods and the
   minimum activity cohort are available.
3. When the state is `shifted`, inspect the displayed aggregate tables and
   existing policy-maintenance evidence; do not infer a cause from the status.
4. Collect real periods before reconsidering thresholds. Do not use this
   indicator as an AI/RAG input, learning signal, automation trigger, or
   substitute for a reviewed policy change.
