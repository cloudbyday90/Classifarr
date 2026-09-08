# Held-out Semantic Study Readiness Visible Refresh Design

Status: implemented on 2026-09-08. Research checked against the linked primary
sources on 2026-09-08.

## Problem

The existing readiness report safely explains whether the private eligibility
audit has its two aggregate prerequisites. The reconciliation page originally
loaded that report only during the initial page request or a whole-page manual
refresh. A normal lifecycle change could therefore be available in the
platform while its passive status remained stale in an already open page.

The remedy must remain library- and configuration-agnostic. It must not
schedule an audit, invent provenance, scan media, call a provider, create a
cohort, collect labels, choose semantic evidence, alter policy, or route media.

## Decision

Extract `useBoundedVisiblePageRefresh` from the existing AI readiness refresh
composable. It owns interval cleanup, visible-document checks, a small
automatic-refresh deduplication window, and last-success metadata. Existing AI
readiness retains its two-minute behavior through the shared module.

Add `useHeldOutSemanticStudyReadinessAutoRefresh` as a small consumer-specific
wrapper. It refreshes only `GET /api/policies/native-intent-reconciliation/
held-out-study-readiness` every five minutes while the reconciliation page is
visible and once when the page returns to visible. Its initial read remains
owned by the reconciliation view, so mounting does not issue a duplicate
request. It deliberately does not attach the more frequent window-focus path.

The existing readiness loader now assigns a request sequence to every fetch. A
late response from an earlier request is discarded instead of replacing the
newer aggregate state.

```text
ordinary authoring changes durable evidence
                 │
                 ├─> existing receipt-triggered private audit gate
                 │
visible reconciliation page ─> five-minute aggregate read ─> status message
                                                        │
                                     no cohort, labels, AI, or routing
```

## Research basis

The W3C Page Visibility Recommendation defines `visibilityState` so sites can
build power- and CPU-efficient applications. The refresh performs no background
read while the document is hidden. [W3C Page Visibility](https://www.w3.org/TR/page-visibility/)

WCAG 2.2 requires status messages to be programmatically determinable without
moving focus. The pre-existing atomic status region announces a changed
readiness state without interrupting current work. [W3C WCAG 2.2 Status
Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

RFC 9111 defines `Cache-Control: no-store` for responses that must not be
stored. The existing endpoint retains it for each current-state refresh.
[RFC 9111 HTTP Caching](https://datatracker.ietf.org/doc/html/rfc9111/)

OWASP recommends access control and resource limits for management APIs. This
change preserves the existing administrator authorization and bounded endpoint
rate limit; it sends fewer automatic reads than the server allowance permits.
[OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)

NIST AI RMF Measure supports documented, repeatable monitoring. This refresh
monitors only prerequisite availability and cannot represent a study,
measurement, or error profile. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep whole-page manual refreshes | No new client lifecycle. | Leaves passive status stale and requires operator input. | Reject |
| Poll continuously in hidden tabs | Faster apparent updates. | Wastes resources and needlessly consumes the endpoint allowance. | Reject |
| Use a visible-page bounded aggregate refresh | Updates an open status without new authority or source data. | State can be up to five minutes old while a page stays visible. | Adopt |
| Add a new scheduler or mutable readiness job | Could push updates. | Adds execution and failure state to a status-only concern. | Reject |

## Recommendation stack

1. Preserve normal native authoring as the only way to create lifecycle and
   declared-purpose evidence.
2. Let the existing audit gate respond to evidence changes automatically.
3. Refresh only the count-only browser status while its page is visible.
4. Advance only after a balanced real 24–32-case cohort, independent labels,
   adjudication, readiness, and frozen-study preflight.
5. Add semantic counter-evidence only after a good measured error profile and
   send ambiguous items to review rather than automatic routing.

## Non-goals

This change adds no server route, database query, persistence, scheduler,
provider call, library lookup, configuration read, media read, cohort, label,
semantic selection, policy write, or routing behavior.
