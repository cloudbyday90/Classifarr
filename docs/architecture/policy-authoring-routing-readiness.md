# Policy Authoring Routing Readiness

Status: implemented as the durable policy-authoring routing-readiness surface.

## Scope

This document defines the setup-card question **Can this destination route?** as a
dedicated read-only surface in the policy builder. It shows whether the selected
media-server library has enough routing context for approved matches to route
later, and it gives exactly one next action when setup is incomplete.

This slice does not call Radarr, Sonarr, TMDB, provider APIs, queue services, or
classification services. It does not save policy intent, trigger routing, or
change server routes or database schema. It projects only the selected library
data already loaded into the modal.

## Research Inputs

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Status Messages:
  <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
  - Status updates should be programmatically determinable without forcing focus
    changes. The routing surface uses `role="status"` and `aria-live="polite"`.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - The surface needs visible labels and direct helper text so operators know
    what action resolves the status.
- GOV.UK Design System, Summary List:
  <https://design-system.service.gov.uk/components/summary-list/>
  - Read-only facts should be shown as label/value pairs instead of editable
    controls.
- GOV.UK Design System, Warning Text:
  <https://design-system.service.gov.uk/components/warning-text/>
  - Warnings should be short, action-oriented, and not buried in dense detail.
- U.S. Web Design System, Alert:
  <https://designsystem.digital.gov/components/alert/>
  - Status messaging should use clear severity and plain-language guidance.
- U.S. Web Design System, Summary Box:
  <https://designsystem.digital.gov/components/summary-box/>
  - A compact summary area is appropriate for telling users the current state
    and next step.

## Recommendations

1. Add a dedicated routing readiness card instead of sending the setup card to
   generic advanced settings.
2. Keep routing readiness read-only until the server-owned
   readiness engine.
3. Use a small visible state model:
   - choose a destination library,
   - connect a routing target,
   - choose a root folder,
   - routing target ready.
4. Infer visible service labels from the selected library only for guidance; do
   not treat inference as routing authority.
5. Show one next action per incomplete state.
6. Avoid internal diagnostics such as table names, resolver names, config IDs,
   SQL, provider readiness, replay, scoring, TMDB, or Arr payload details.

## Pros And Cons

### Pros

- Gives the `Can this destination route?` setup step a concrete destination.
- Keeps routing setup separate from policy intent editing.
- Reduces diagnostic noise by showing one status and one action.
- Preserves the current save and routing behavior.
- Keeps the runtime readiness work free to replace the client projection with a server-owned
  readiness result later.

### Cons

- The client can only project from the currently loaded library shape.
- It cannot verify live Radarr or Sonarr health.
- Mapping freshness and inactive Arr config checks still require the future
  server-owned readiness engine.
- The advanced-settings link remains the resolver path until a dedicated
  routing settings route is available inside the builder.

## Final Stack

- Readiness projection:
  `client/src/utils/policyBuilderRoutingReadiness.js`
- Read-only status card:
  `client/src/components/policies/PolicyBuilderRoutingReadinessCard.vue`
- Modal integration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Setup-card target update:
  `client/src/utils/policyBuilderSetupCards.js`
- Unit coverage:
  `client/src/__tests__/utils/policyBuilderRoutingReadiness.test.js`
  `client/src/__tests__/PolicyBuilderRoutingReadinessCard.test.js`
  `client/src/__tests__/PolicyBuilderSetupCards.test.js`
  `client/src/__tests__/PolicyBuilderModal.test.js`

## Implemented Outcome

The policy builder now renders a **Routing Readiness** surface directly after
the setup cards. The surface answers one question:

```text
Can approved matches for this destination route later?
```

The setup-card action now jumps to `#policy-builder-routing-readiness` instead
of advanced settings. If routing context is incomplete, the card shows a single
next action that links to the settings area that can resolve it. If routing is
ready, the card shows the selected service and root folder.

## Follow-Up

The next high-value item is **Policy Authoring Setup Card State Binding**. Setup
cards are now correctly targeted, but they still render as static guidance. The
next slice should derive card completion/needs-attention state from existing
visible projections without adding new persistence, API calls, or automation.
