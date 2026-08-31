# Policy Change Outcome Observation Design

## Status

Implemented on the unreleased branch. This component records
one bounded, content-free observation after an administrator explicitly starts
it for a recent approved native policy change. It cannot change policy,
routing, AI, RAG, learning, retry, or classification behavior.

The research sources below were verified on 2026-08-31 against their official
publishers and were current for this August 2026 design decision.

## Problem

The redacted offline evaluation report can help an operator identify a
policy-maintenance question, but it cannot preserve a trustworthy before/after
comparison once the active review projection expires. Storing media records,
policy text, a free-form hypothesis, or a broad change history would expand
the privacy and retention boundary.

## Selected Design

```text
approved native policy change receipt
  -> operator explicitly starts one observation
  -> server verifies the actor's recent applied receipt
  -> server generates an opaque hypothesis identifier
  -> server saves only a fixed pre-change aggregate summary and time bounds
  -> first following complete UTC-day 28-day period is observed
  -> server reads the same fixed aggregate query after that period completes
  -> descriptive before/after report for manual review only
```

The control record is a single current observation. It stores an opaque,
server-generated hypothesis identifier, the internal receipt reference,
revision-transition facts, fixed UTC window bounds, aggregate outcome counts,
the initiating actor ID, and expiry. It does not store a policy ID, policy
text, command values, title, path, library, media record, candidate,
destination, evidence content, provider/model data, prompt, response, RAG
text, or caller-provided text. The receipt reference is never returned.

The pre-change period is the 28 fully completed UTC days ending at the start
of the current UTC day. The observation period begins with the next UTC day
and lasts 28 complete days. This leaves the partially completed change day out
of both periods, preventing a partial-day comparison. The record remains
readable for 30 days after the observation period. A daily, lock-coordinated
cleanup then deletes it; before that job runs, the API returns only `expired`.
A later approved change may start a replacement observation. Any configuration
restore clears the observation because it invalidates the comparison baseline.

## Authority and Data Boundaries

- `POST` accepts no body, query parameters, hypothesis text, receipt ID, or
  policy selector. The server finds the initiating actor's most recent applied
  native change receipt within a short fixed window.
- `GET` accepts no selectors and returns only a fixed status, opaque hypothesis
  identifier, fixed period dates, aggregate outcome counts/rates, Wilson
  intervals, and a descriptive difference when the follow-up period is
  complete.
- A single server-side control removes an unbounded observation-history and
  caller-selected-object surface. A start request during an active observation
  returns that current observation instead of creating another.
- Creation is explicit. Automatic refreshes are read-only, use `no-store`, and
  do not write audit rows.
- A new outcome is descriptive evidence. It cannot authorize a threshold,
  policy, AI, RAG, learning, retry, or routing change.

## Accessible, Hands-Off UI

Security Settings refreshes the observation status automatically. It presents
the dynamic state through a concise polite status message, uses native tables
for the period comparison, and exposes exactly one explicit action: **Start
28-day observation**. The action explains that it binds a recent approved
change from the current account and does not apply another policy change.

No focus, selection, or automatic refresh changes context. The result is
available as text and table cells rather than color or a chart alone.

## Options Considered

### One content-free current observation — selected

Pros:

- Preserves a reproducible pre-change baseline across the follow-up period.
- Avoids policy/media identity and free-text retention.
- Keeps the interaction explicit and the automatic path read-only.

Cons:

- Only one observation can be active at a time.
- The operator must start it shortly after an approved native policy change.

### Persist every policy-change outcome

Pros: supports a long historical outcome timeline.

Cons: grows retention, correlation, and lifecycle requirements. Rejected for
this component.

### Client-only marker

Pros: no new database state.

Cons: cannot survive the 28-day observation period or provide a trustworthy
baseline. Rejected.

### Automatic policy or AI/RAG tuning

Pros: less manual follow-up.

Cons: turns descriptive aggregate evidence into unreviewed authority. Rejected.

## Research Basis

- OWASP recommends allow-listing returned properties instead of serializing
  internal objects, and checking authorization around object/function flows.
  The protocol uses a fixed DTO and server-only receipt lookup:
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/),
  [OWASP API1:2023](https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/),
  and [OWASP API5:2023](https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/).
- OWASP also identifies resource-consumption and sensitive business-flow
  controls as API risks. The protocol has no client-controlled ranges, one
  active control, fixed 28-day windows, and route rate limits:
  [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/),
  [OWASP API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/).
- NIST's Privacy Framework calls out disassociated processing and data
  minimization. The protocol substitutes an opaque identifier for free text
  and avoids identity-bearing event storage:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).
- NIST documents Wilson confidence intervals for proportions; the fixed
  before/after summary uses two-sided 95% Wilson intervals as uncertainty
  descriptions, never decision rules:
  [NIST Engineering Statistics Handbook](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm).
- WCAG 2.2 requires predictable interaction; W3C guidance supports concise
  programmatic status messages and structural data tables. The start action is
  explicit and results remain textual:
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/),
  [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages),
  and [Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).

## Recommendation Stack

1. Start an observation only after an approved native policy change.
2. Treat the opaque hypothesis identifier as an external-note reference, not
   an explanation or policy input.
3. Wait for the full post-change period, then compare counts and Wilson
   intervals before making a separate reviewed policy decision.
4. Keep any multi-change history or causal analysis out of this bounded,
   privacy-preserving component.
