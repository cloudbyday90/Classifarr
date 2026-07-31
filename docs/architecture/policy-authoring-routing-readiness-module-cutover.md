# Policy Authoring Routing Readiness Module Cutover

Status: superseded historical cutover. The client projection and modal
integration described here are removed.

## Scope

This document records the prior phase-name cutover for a client-side
routing-readiness projection. The [Policy Compatibility Save-Footer Admission
Audit](policy-compatibility-save-footer-admission-audit.md) removed that
projection and its modal integration because browser routing conclusions are
not policy-write authority. The unmounted routing card remains pending its own
retirement audit.

## Official Guidance Reviewed

- W3C WCAG 2.2, Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html
- W3C WCAG 2.2 Technique ARIA22:
  https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22
- GOV.UK Design System, Summary List:
  https://design-system.service.gov.uk/components/summary-list/
- GOV.UK Design System, Warning Text:
  https://design-system.service.gov.uk/components/warning-text/
- U.S. Web Design System, Alert:
  https://designsystem.digital.gov/components/alert/
- U.S. Web Design System, Summary Box:
  https://designsystem.digital.gov/components/summary-box/

## Recommendations

1. Do not restore client-derived routing readiness to a save or create flow.
2. Keep server validation and returned write outcomes authoritative.
3. Retire the unmounted routing card unless a server-owned read contract and a
   concrete product caller require a replacement surface.

## Pros And Cons

Pros:

- Preserves the historical rationale for the prior cutover.
- Makes the removed projection and pending card retirement explicit.

Cons:

- This document no longer describes active behavior.
- The unmounted card needs its own contract/caller audit before deletion.

## Final Recommendation Stack

- Historical cutover record: this document.
- Deleted local projection:
  `client/src/utils/policyBuilderRoutingReadiness.js`.
- Pending retirement artifacts:
  `client/src/components/policies/PolicyBuilderRoutingReadinessCard.vue` and
  `client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js`.

## Outcome

The historical cutover renamed the routing-readiness architecture document and
updated the workflow completion audit slice. Later Phase 6R.5 work removed the
client projection, its focused test, and modal integration; no save footer now
uses a browser routing conclusion.

## Next Step

Perform the **compatibility routing-readiness card retirement audit**. Confirm
that the unmounted card has no server-owned read contract or production caller,
then remove it rather than preserve a dormant client readiness surface.
