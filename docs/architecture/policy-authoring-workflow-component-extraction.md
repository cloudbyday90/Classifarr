# Policy Authoring Workflow Component Extraction

Status: superseded in part by the Phase 3R.6.2 readiness-action audit.

## Scope

This change replaces generic context, observed-profile, and readiness markup in
the policy-authoring workflow shell with three product-domain presentation
components:

- `DestinationContextCard`
- `ObservedProfileSummary`
- `PolicyDestinationEmptyStateNotice`

The change is deliberately client-presentational. It does not alter the
policy-authoring read payload, draft-command contract, policy persistence,
routing, media-server calls, provider calls, quota usage, learning, or runtime
automation authority.

## Official Guidance Reviewed

Official sources reviewed in June 2026:

- [W3C WCAG 2.2, Understanding Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html)
  - Preserve the visible relationships between destination setup, observed
    evidence, and readiness with semantic headings, grouped content, and lists.
- [WAI-ARIA Landmark Regions Practice](https://www.w3.org/WAI/ARIA/apg/practices/landmark-regions/)
  - Name only meaningful sections so assistive technology can navigate the
    observed-profile region without creating anonymous structural containers.
- [W3C WCAG 2.2, Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  - Use a polite live status for a readiness result that changes in place;
    do not move focus or treat static explanatory content as an alert.
- [WAI-ARIA Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  - Use the visible heading text as the accessible name rather than duplicating
    an independent label.

## Recommendations

1. Keep the workflow shell responsible only for conditional composition,
   loading, bounded recovery, and event forwarding.
2. Give each extracted component display-only props. Presentation components
   must not fetch, persist, infer policy meaning, route media, or execute
   readiness actions.
3. Keep observed library values visibly read-only. They remain suggestions until
   an explicit future intent-control action emits a typed draft command.
4. Render a server-owned readiness action only in the destination question
   that owns a real bounded recovery; retain non-interactive guidance when no
   resolver is available.
5. Keep existing ids, labels, question ordering, and recovery routes intact so
   the extraction remains contract-preserving and does not create an alternate
   authoring surface.

## Options Considered

### Keep All Markup In The Workflow Shell

Pros:

- No new imports or component tests.

Cons:

- The shell would continue mixing context, evidence display, readiness display,
  recovery, and question orchestration.
- Later intent-control work would have no stable presentation boundary.

### Extract Presentation Components Only

Pros:

- Establishes the target product vocabulary with small, independently tested
  Vue components.
- Keeps server-owned policy and readiness authority unchanged.
- Preserves the existing event boundary and avoids extra client state.

Cons:

- Adds three component contracts that must remain covered by the inventory.

### Move Readiness Or Evidence Logic Into The Client

Pros:

- Could superficially reduce server display payload fields.

Cons:

- Would duplicate server-owned readiness and evidence decisions in the client.
- Risks inconsistent behavior across UI, future Discord workflows, and API
  consumers.

## Final Recommendation Stack

- `client/src/components/policies/DestinationContextCard.vue`
  - renders the setup heading and destination explanation.
- `client/src/components/policies/ObservedProfileSummary.vue`
  - renders a named, read-only observed-profile region and library suggestions.
- `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
  - presents one bounded recovery action or truthful guidance without exposing
    diagnostics.
- `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
  - composes the cards with existing recovery and destination-question flows.
- `server/src/services/policyAuthoringWorkflowInventory.mjs`
  - classifies the cards as normal-path destination context or readiness.
- `server/src/services/policyBuilderBoundaryInventory.mjs`
  - classifies all three cards as presentation only with no client-engine
    authority.

## Outcome

The workflow shell no longer owns generic context, observed-profile rendering,
or readiness notice markup. The generic readiness card was later retired
because native creation could never mount it. The client continues to display
only server-owned question-scoped recovery and emits no new actions. Focused component
and inventory tests verify the accessible labels, read-only evidence handling,
conditional readiness status, and ownership boundaries.

## Next Step

Extend the server-owned option projection behind `IntentSignalPicker` to supply
the supported source groups through the normalized option-selection contract.
The picker already separates read-only observed evidence, selectable options,
and disabled options while emitting typed draft commands only.
