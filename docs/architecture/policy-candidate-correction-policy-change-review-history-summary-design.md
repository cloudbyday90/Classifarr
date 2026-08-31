# Policy-Change Review History Summary Design

## Status

Implemented on the unreleased branch. This component is a compact, read-only
summary of *review activity*, not a policy history or an outcome-evaluation
history. It cannot create or change a policy, route media, invoke AI or RAG,
learn, retry, or select a provider.

The sources below were checked against their official publishers on
2026-08-31 for this August 2026 design decision.

## Problem

The current reviewed decision record is intentionally one current,
short-lived, correctable conclusion. Once its matching outcome expires, it is
deleted. That preserves a tight privacy boundary, but leaves an administrator
without any compact indication of whether reviewed policy-change follow-ups
are being recorded, revised, or consistently pointing to the same next manual
step over time.

The summary must add that operational signal without reintroducing a raw
history of policies, media, libraries, outcomes, actors, decision records, or
free-text rationale.

## Selected Design

```text
explicit new or materially revised reviewed decision
  -> transaction-owned, fixed-period aggregate increment
  -> no event, actor, outcome, policy, or media record is retained
  -> automatic selector-free read in Security Settings
  -> three completed fixed 30-day UTC periods, rendered as semantic tables
  -> descriptive human review only; existing policy maintenance remains manual
```

The server stores four bounded dimensions only:

- a server-calculated fixed 30-day UTC period start;
- one of the existing three fixed conclusion IDs;
- a count of newly recorded conclusions; and
- a count of materially revised conclusions.

It deliberately does **not** retain a hypothesis ID, policy ID or text,
destination, library, media, actor, rationale, provider/model, prompt,
response, RAG context, exact event time, or an individual decision event.

The response contains the most recent three *fully completed* periods only.
The current partial period is withheld, and a newly installed/reset summary
does not claim a period until all 30 days were observed. This avoids presenting
an incomplete interval as an outcome trend.

## Lifecycle and Integrity

- A row is incremented only in the same transaction that creates a new
  decision or materially changes a saved decision/rationale. A no-op save
  neither revises the decision nor inflates the summary.
- A control row records only when summary collection began. It lets the server
  distinguish an incomplete first period from a genuine zero-activity period.
- Rows are retained for the current period plus three preceding fixed periods
  (at most 120 days of coarse activity data). Scheduled cleanup deletes older
  rows; backup restore clears aggregates and resets collection.
- The read is administrator-only, parameter-free, no-store, rate-limited, and
  uses a static parameterized query. The browser cannot choose a date, period,
  identity, dimension, or result size.
- The DTO exposes fixed labels and counts only. It returns no timestamps,
  database IDs, raw rows, or automatic-action capability.

## Accessible, Hands-Off UI

The Security Settings card loads automatically on entry and while the page is
visible. It provides a short polite status message without moving focus. A
separate native data table is used for each completed period, with a caption,
column headers, and `scope="col"`; cards and CSS supply layout rather than
misusing table semantics. The text explicitly states that activity counts do
not prove a policy result and cannot apply a change.

## Options Considered

### Fixed-period aggregate activity summary — selected

Pros:

- Provides an interpretable review-operation signal while retaining only
  fixed, coarse counts.
- Avoids individual records and keeps query work, response size, and
  retention bounded.
- Lets a user see whether a manual follow-up process is actually being used.

Cons:

- Cannot identify a specific policy or explain why an operator revised a
  decision.
- A period must finish before it appears, so it is intentionally not a live
  operational dashboard.

### Retain a per-decision history

Pros: supports a detailed chronological audit.

Cons: would retain the linkage needed to reconstruct policy-change activity,
expanding identity, privacy, authorization, and deletion obligations. Rejected.

### Aggregate current-period data immediately

Pros: appears more responsive.

Cons: promotes incomplete observations into apparent trends. Rejected in
favor of completed fixed periods.

### Automatically change policy from counts

Pros: reduces manual work.

Cons: treats descriptive workflow activity as policy authority. Rejected.

## Research Basis

- W3C's table guidance requires data-table headers and structural
  relationships so assistive technology can preserve cell context. The card
  uses captioned native tables with scoped headers:
  [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).
- W3C WCAG 2.2 status-message guidance supports programmatically determinable
  updates that do not move focus. The automatic loading state is concise and
  polite:
  [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).
- OWASP identifies unrestricted resource consumption and unrestricted access
  to sensitive business flows as API risks. Fixed periods, no selectors,
  static queries, explicit authorization, and endpoint-specific rate limits
  bound both dimensions and request work:
  [API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
  and [API6:2023](https://owasp.org/API-Security/editions/2023/en/0xa6-unrestricted-access-to-sensitive-business-flows/).
- NIST's Privacy Framework supports managing privacy risk. The design uses
  minimization, short retention, and removal on restore instead of retaining
  event-level history:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).

## Recommendation Stack

1. Keep the current one-record reviewed-decision flow as the only place an
   operator records a conclusion.
2. Treat this component as an aggregate workflow signal over completed
   periods, not proof that a policy caused a result.
3. Use a separate, reviewed policy-maintenance operation if a change is
   warranted.
4. Do not use activity counts as AI/RAG training or tuning input, a routing
   input, or automatic policy authority.
