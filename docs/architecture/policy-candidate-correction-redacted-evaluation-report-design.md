# Redacted Policy Candidate-Correction Evaluation Report Design

## Status

Implemented on the unreleased branch. This is a read-only, automatically
refreshed aggregate report over the active redacted review projection. It does
not grant historic-record access or introduce policy, AI, RAG, learning, retry,
or routing authority.

## Problem

The projection gives a fixed representative sample across two completed
28-day windows, but reviewing every row makes it difficult to see whether
confirmed leading candidates vary by score margin or fixed evidence state. The
report must communicate uncertainty without becoming a live history browser or
turning a small sample into an automatic policy decision.

## Selected Design

```text
administrator opens Security Settings
  -> existing administrator-protected non-auditing projection read
  -> active, expiry-bound redacted projection only
  -> pure server aggregation of fixed categorical rows
  -> period / margin / evidence-state summaries plus Wilson intervals
  -> no-store, rate-limited aggregate response
  -> auto-refreshed native tables and browser-only operator hypothesis
```

The `GET` endpoint accepts no body, history row, media identifier, date range,
sample size, filter, export selector, policy command, or routing command. It
delegates to the existing projection service and never queries
`classification_history`, stores a new report, or receives individual rows
from the browser.

The report contains only projection timestamps and fixed window bounds,
period/margin/evidence-state IDs, outcome counts, confirmed-leading-candidate
rates, two-sided 95% Wilson intervals, and a descriptive period difference.
It must not contain item ordinals, source IDs, titles, years,
library/destination IDs, policy values, actor names, metadata, descriptions,
provider/model data, prompts, responses, RAG text, or caller-supplied text.

## Statistical Treatment

For each period, period-and-margin group, and
period-and-evidence-source/state group, the report calculates fixed sample and
outcome counts, the `confirmed_candidate` rate, and a two-sided 95% Wilson
interval. Wilson intervals describe binomial-proportion uncertainty without the
poor edge behavior of a simple Wald interval for small groups. Empty groups
have no rate or interval.

The comparison is explicitly descriptive. It does not perform a hypothesis
test, label a result significant, prove causality, or authorize any threshold,
policy, AI, RAG, learning, retry, or routing change.

## Security and Privacy Boundaries

- Existing parent authentication plus a route-local administrator and positive
  actor-ID check protect the endpoint.
- A fixed server DTO is rebuilt from the projection read model; no object ID
  or selector crosses the route boundary.
- `Cache-Control: no-store` and a dedicated read limiter bound browser refresh
  and response persistence.
- The report uses the projection service's explicit non-auditing read mode and
  stores no new aggregate, audit event, or free-text hypothesis. Existing
  operator projection viewing remains the single minimized audit boundary.
- The browser-only hypothesis has no API call, is discarded on reload, and
  cannot become an unreviewed durable policy input.
- The report inherits the projection service's active configuration and expiry
  checks, so expired or superseded snapshots are not reportable.

## Accessible and Hands-Off Behavior

Security Settings loads the report automatically on page load and after a
snapshot or safeguard change. There is no report-generation or approval action.
The concise dynamic state is a polite status region. The margin table and the
disclosed evidence table use native `table`, `caption`, `th`, and `scope`
semantics. Every rate and interval is conveyed as text, not color. The
browser-only hypothesis has a label, description, character bound, and clear
control.

## Options Considered

### Active redacted-projection aggregate — selected

Pros:

- Reuses an authorized, minimized, expiry-bound boundary.
- Gives a reproducible summary without new durable data.
- Makes uncertainty visible while keeping the UI hands-off.

Cons:

- Cannot answer content-specific questions or compare expired snapshots.
- A bounded sample is not a causal analysis.

### Client-side aggregation

Pros: fewer server modules.

Cons: duplicates trust-critical statistical logic in the browser and makes
non-browser use inconsistent. Rejected.

### Cross-snapshot warehouse

Pros: supports a longer historical trend.

Cons: changes retention and comparability requirements and creates a new
historical store. Rejected for this component.

### Persisted free-text hypothesis or automatic tuning

Pros: preserves reviewer context or reduces work.

Cons: creates a text-retention surface and confuses evidence with authority.
Rejected.

## Research Basis

- NIST documents the Wilson approach for confidence intervals for proportions;
  the report uses a fixed two-sided 95% implementation and does not present it
  as a decision rule: [NIST Engineering Statistics Handbook](https://itl.nist.gov/div898/handbook/prc/section2/prc241.htm).
- OWASP API3 recommends allowing only needed response properties, while API4
  calls for bounded resource consumption and rate limits. The route has a fixed
  DTO, no selectors, no-store response, and dedicated limiter:
  [API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/),
  [API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/).
- The NIST Privacy Framework supports privacy-risk management. This report
  reuses an existing minimized source and adds no durable report or text:
  [NIST Privacy Framework](https://www.nist.gov/privacy-framework).
- W3C WCAG 2.2 calls for programmatic status messages, and the WAI table
  tutorial calls for structural table headers and cells. The UI uses concise
  status text and native tables, not a chart-only display:
  [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages),
  [W3C Tables Tutorial](https://www.w3.org/WAI/tutorials/tables/).

## Recommendation Stack

1. Use the active redacted report to frame a manual review question.
2. Read group counts and Wilson intervals before interpreting rate movement.
3. Use the browser-only hypothesis to direct a reviewed policy workflow, then
   observe a new completed period after any approved change.
4. Keep long-horizon cross-snapshot analysis separate until retention,
   comparability, and privacy design are explicitly reviewed.
