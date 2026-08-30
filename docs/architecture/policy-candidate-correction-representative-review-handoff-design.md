# Policy Candidate Correction Representative Review Handoff Design

## Status

Implemented on the unreleased branch. This component is a read-only navigation
handoff. It does not add a server endpoint, analytics field, action, or
authority to change policy, AI, RAG, learning, retry, or routing.

## Problem

The long-horizon monitor correctly reports a sustained aggregate review signal,
but an operator still has to infer where to begin the existing manual review
workflow. A broad or data-carrying deep link would be unsafe: aggregate
analytics must not select or disclose individual media, policy, destination,
or actor records.

## Selected Design

A narrow ESM presentation module maps exactly one already-normalized status,
`sustained_review_signal`, to one static navigation target:

```text
{ name: 'CommandCenter', hash: '#needs-attention' }
```

All other long-horizon statuses return no handoff. The Statistics view renders
the card only when this mapping returns a result. Its Vue `RouterLink` renders
a native navigation link to the existing **Needs Attention** section; it does
not submit a form, invoke an API, add a query parameter, preselect a decision,
or move the user automatically.

The card states both the reason for the handoff and its boundary: an operator
must choose representative current decisions and must not infer that the
aggregate is a correctness or causal conclusion. The existing polite status
region adds a concise availability announcement without moving focus.

## Accessibility

- Navigation is represented as a link, not a button. The target is another
  location in the application, so the semantic role matches the result.
- The existing `role="status" aria-atomic="true"` region announces the newly
  available review handoff without stealing focus.
- The visible heading, descriptive text, and `aria-describedby` relationship
  explain that following the link has no automatic side effect.
- The handoff is conditional on the already-visible, text-based sustained
  status; color is not the sole signal.

## Alternatives Considered

### Static link to existing Needs Attention — selected

Pros:

- Makes the next manual step discoverable without adding a new workflow.
- Preserves the current route's authorization and item-loading boundaries.
- Carries no analytics identity, filter, or history in the browser URL.
- Uses native navigation semantics and standard keyboard behavior.

Cons:

- The current pending decisions may be empty or may not be a perfect proxy for
  the historical aggregate cohort.
- It intentionally does not choose a supposedly representative record.

### Server-selected representative records

Pros:

- Could make historical inspection faster.

Cons:

- Requires a separate sampling, authorization, retention, and disclosure
  design. Selecting an item from aggregate analytics would materially expand
  the privacy and behavioral surface.

### Automatic route, retry, or policy adjustment

Pros:

- Reduces clicks.

Cons:

- Confuses an advisory aggregate with operational authority and bypasses the
  necessary human review.

## Security Boundary

- The handoff has no request, persistence, telemetry, or background refresh.
- It accepts only the allow-listed `sustained_review_signal` status from the
  pre-existing strict client projection.
- The static route contains no media, library, policy, candidate, destination,
  actor, provider, model, prompt, response, RAG text, configuration, or
  analytics filter.
- Existing authorization still governs the Command Center and its pending
  decisions. This client presentation is not an authorization decision.

## Research Basis

- NIST's Measure guidance calls for metrics that fit their purpose and users,
  and for documented limits and human course-correction rather than treating a
  measurement as a decision:
  [NIST AI RMF Playbook — Measure](https://airc.nist.gov/airmf-resources/playbook/measure/).
- W3C recommends a native HTML link for navigation to a local or external
  resource, preserving standard link behavior:
  [W3C ARIA APG Link Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/link/).
- W3C's `role="status"` technique describes polite, atomic announcements for
  important UI status changes that do not take focus:
  [W3C WCAG 2.2 ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html).
- OWASP advises an allow-listed server response rather than relying on a
  client to hide sensitive fields. This design adds no response field at all:
  [OWASP API3: Excessive Data Exposure](https://owasp.org/API-Security/editions/2019/en/0xa3-excessive-data-exposure/).

## Recommendation Stack

1. Retain the fixed readiness, adjacent-window, cohort-composition, and
   long-horizon aggregate guards.
2. Expose the manual handoff only for a sustained, comparable review signal.
3. Use a fixed native navigation link to the established pending-review route.
4. Keep case selection and all policy, AI, RAG, learning, retry, and routing
   decisions with the operator and their existing workflow.
5. Consider historical representative sampling only after an explicit privacy,
   authorization, evaluation, and audit design.
