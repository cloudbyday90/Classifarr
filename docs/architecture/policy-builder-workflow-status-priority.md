# Policy Builder Workflow Status Priority

Status: implemented as durable policy-authoring accessibility and decision-load
behavior.

## Scope

The policy builder has several legitimate state changes: loading the read-only
workflow, refreshing profile evidence, recovering missing or stale evidence,
resolving empty-state setup, and reporting a bounded failure. This design
selects one announcement for the highest-priority current state while keeping
the corresponding visual recovery card visible and actionable.

It does not change policy intent, persistence, routing, classification,
provider calls, media-server writes, database schema, or the authority of the
browser. It also does not introduce raw server diagnostics into the status
surface.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, [Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  - Waiting, progress, result, and error messages added without a context
    change must be programmatically determinable.
- W3C WAI-ARIA Authoring Practices, [Alert Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
  - Alerts should be reserved for important, time-sensitive content and must
    remain available long enough to be perceived.
- W3C WCAG 2.2, [Understanding Error Identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html)
  - Errors must identify the problem in text so operators can understand the
    condition and recover.
- W3C WAI-ARIA Authoring Practices, [Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  - Interactive controls need concise names and can reference visible context
    with `aria-describedby` instead of duplicating labels.

## Recommendations

1. Resolve one workflow-level status from ordered state, rather than allowing
   cards to independently create live regions.
2. Use `role="alert"` only for a workflow error or a completed refresh
   failure. Use polite status messages for loading, progress, recoverable
   evidence conditions, and successful outcomes.
3. Prioritize in this order:
   1. workflow error;
   2. workflow loading;
   3. active empty-state action;
   4. active profile refresh;
   5. native evidence recovery;
   6. completed profile refresh result.
4. Keep recovery cards visible with their action and description, but suppress
   their local live-region behavior when the workflow shell owns the
   announcement.
5. Keep static library freshness and result text readable without making each
   card an additional live region.
6. Preserve the status element's stable identifier so disabled empty-state
   actions can describe why they are temporarily unavailable.

## Pros And Cons

### Pros

- Prevents screen-reader announcement storms when a refresh also causes a
  workflow reread and an evidence-recovery card to appear.
- Makes one operator-relevant condition clear without hiding the local action
  or explanation needed to resolve it.
- Retains assertive delivery for bounded failure states and polite delivery for
  progress, successful outcomes, and non-urgent guidance.
- Keeps the priority logic deterministic, unit-testable, and isolated from
  policy or routing behavior.

### Cons

- Adds a small resolver and presentation component to the client workflow.
- A lower-priority completed success result waits until the more important
  recovery condition is resolved before it is announced.
- Standalone recovery-card consumers must retain the default local announcement
  behavior; only the workflow shell suppresses it.

## Final Recommendation Stack

- Priority resolver:
  `client/src/utils/policyBuilderWorkflowStatusPriority.js`
- Workflow-level status presentation:
  `client/src/components/policies/PolicyBuilderWorkflowStatusNotice.vue`
- Workflow orchestration:
  `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
- Empty-state action descriptions:
  `client/src/components/policies/PolicyBuilderDestinationQuestions.vue`
  and `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
- Embedded recovery presentation:
  `client/src/components/policies/PolicyNativeEvidenceRecovery.vue`
- Static source-of-truth context:
  `client/src/components/policies/PolicyBuilderLibraryContext.vue`
- Boundary classifications:
  `server/src/services/policyBuilderBoundaryInventory.mjs`
  and `server/src/services/policyAuthoringWorkflowInventory.mjs`
- Verification:
  `client/src/__tests__/utils/policyBuilderWorkflowStatusPriority.test.js`
  and `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`

## Implemented Outcome

`PolicyBuilderWorkflowShell` owns the single current announcement. It shows a
polite status while it loads, refreshes, performs an empty-state recovery, or
needs a non-urgent evidence action. It shows one alert for a bounded workflow
or refresh failure. Embedded cards no longer create competing live regions,
but continue to show the same recovery action and its visible explanation.

The priority resolver uses only existing, display-safe client projections. It
does not create new actions, persist data, route media, or render server stack
traces.
