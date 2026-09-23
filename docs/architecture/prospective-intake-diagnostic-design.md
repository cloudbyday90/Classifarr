# Prospective intake diagnostic: design

Date: 2026-09-23. Follows the separate
[prospective evidence-state outcome](prospective-evidence-state-outcome.md).

## Observed gap

The healthy local application has no new `classification_history` row after the
September 23 comparison deployment: the latest recorded classification is from
September 22. No classification task is pending or processing, and no webhook
receipt has arrived since August 29. The fixed prospective report correctly has
zero captures, but its capture-only query cannot say whether normal intake was
quiet or classifications occurred without qualifying for a complete comparison.
The previous follow-up therefore required ad hoc database inspection.

This is an **observability gap**, not evidence that the capture or intake code is
broken. Do not queue a fake user request, label historical placements as truth,
relax evidence requirements, or promote a ranking weight to fill the report.

## Decision and contract

In `--prospective` mode only, read a bounded count of newly recorded movie/TV
classification events over the exact same `[since, until)` window and inside the
same repeatable-read, read-only transaction as the frozen comparison query. A
5,001-row sentinel caps the work and makes larger counts explicit lower bounds.
The existing 15-second statement, one-second lock, and 20-second idle transaction
timeouts still apply. Return only aggregate counts and fixed reason codes, never
titles, library identifiers, metadata, webhook payloads, or provider content.

When the count is zero and no comparison was captured, the CLI reports
`awaiting_classification_intake`. If recorded events exist but no comparison was
captured, it retains `awaiting_live_comparisons`. Existing pending-outcome and
diagnostic states are unchanged. The established `status` remains compatible;
`promotionAllowed` remains false. The count is not a classification success rate
or capture-failure rate: strong policy decisions and incomplete inventory evidence
can legitimately bypass this narrowly scoped experiment.

Separate the SQL from the pure aggregate projection in small ESM service files.
No schema, provider, queue, routing, AI, authentication, or browser change is
necessary. A future automatic UI signal should be compact and avoid redundant
live announcements, per [W3C WCAG status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).

## Options, pros and cons

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded same-snapshot classification count | Distinguishes quiet intake from uncaptured events without changing operations | Adds one read over history; count above the sentinel is a lower bound | Implement |
| Automatically submit test requests on the live instance | Immediate test traffic | May route real media, consume AI/provider calls, and contaminate prospective evidence | Reject |
| Reconstruct labels from old placements | Large apparent sample | Post-event leakage and inherited routing mistakes | Reject |
| Add another Command Center panel | Constant visibility | Dense UI and avoidable announcements for ordinary idle periods | Defer |
| Add a history index now | Efficient at very large scale | A migration may block writes during build; current bounded read measured about 3.5 ms on 6,798 rows | Defer until measured growth warrants it |

Recommended stack: existing PostgreSQL history and exact-event feedback receipts;
bounded SQL and pure ESM aggregate projection; read-only fixed-window CLI;
unchanged passive capture, identity validation, route guards, and operator
feedback workflow. If real intake later exists but captures remain zero, inspect
comparison eligibility and source evidence with focused tests, not synthetic
accuracy claims. A later disjoint cohort remains necessary before any reversible
company-assisted ranking proposal.

## Official sources checked September 2026

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  supports using one repeatable-read snapshot for both counts and captures.
- [PostgreSQL LIMIT](https://www.postgresql.org/docs/18/queries-limit.html)
  bounds returned rows. Here only cardinality up to a sentinel is used, so no
  arbitrary subset is presented as a representative sample.
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/18/using-explain.html)
  informed the measured current read cost; the 15-second timeout still bounds
  future scans if history grows.
- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for deployment-context monitoring and documented evaluation limits.
- [scikit-learn common pitfalls](https://scikit-learn.org/1.8/common_pitfalls.html)
  explains why later placements cannot be treated as pre-event features or
  independent labels.

## External PR boundary

The GitHub open-PR endpoint returned an empty list on this date. There is no
eligible random PR to apply locally. Do not substitute a closed or already
implemented PR and do not merge one.
