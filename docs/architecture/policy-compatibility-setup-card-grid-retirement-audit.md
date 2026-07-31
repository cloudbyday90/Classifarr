# Policy Compatibility Setup-Card Grid Retirement Audit

## Status

Implemented on 2026-07-31 as Phase 6R.5 compatibility maintenance work.

## Decision

Delete `PolicyBuilderSetupCards.vue`, its `policyBuilderSetupCards.js` local
projection, and both focused tests. The grid had no production import or mount;
the component was the utility's only client caller, and the tests were the only
other consumers.

Do not reconnect the grid to the active native workflow. The native path already
uses the server-owned operator-workflow response through
`PolicyBuilderWorkflowShell.vue`, `PolicyBuilderDestinationQuestions.vue`, and
`ReadinessNextActionCard.vue`. Keeping a second card grid would duplicate
workflow state, create stale anchors, and give browser-derived status equal
visual weight with authoritative server readiness.

## Scope Proof

| Surface | Finding | Decision |
| --- | --- | --- |
| Compatibility setup-card grid | No production import or mount | Delete the component. |
| Local setup-card projection | Imported only by the deleted grid and its utility test | Delete the utility and its test. |
| Four client-derived card states | Infer progress and routing readiness from browser props | Delete; do not recreate as a client authority. |
| Retired routing anchor | The grid targets `#policy-builder-routing-readiness`, whose card is deleted | Delete with the grid. |
| Native workflow | Uses the server-owned operator-workflow read response | Keep unchanged. |
| Shared server mental model | Has active consumers for vocabulary and workflow contracts | Keep for a separate module-level audit; this change does not alter it. |

## Official Guidance Reviewed

Research was reviewed on 2026-07-31 against official guidance current through
June 2026:

- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) recommends using the current
  WCAG version when updating accessibility policy. It requires UI state to be
  programmatically available to assistive technology.
- [W3C Failure F103](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103)
  identifies application state, action outcomes, progress, and errors as
  dynamic status cases that need programmatic semantics. The live
  server-derived readiness card supplies that status; an unmounted duplicate
  grid does not.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state and rejects UI-only step sequencing.
  The grid's local recommendation and routing state cannot govern automation.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side semantic validation because browser logic is bypassable.
  Browser-derived setup state must not authorize policy writes or routing.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep the dormant grid | No immediate file deletion | Preserves dead navigation, duplicate states, and stale tests. |
| Reconnect the grid to the operator workflow | Retains the old visual layout | Duplicates the native questions and readiness surface without a new user need. |
| Replace the grid with another client projection | Could refresh the card style | Reintroduces browser-derived workflow state and another authority boundary. |
| Delete the grid and retain the native workflow | One active workflow, one readiness result, no dead anchors | Requires the separate server mental-model card contract to be audited next. |

## Final Recommendation Stack

1. Keep the server-owned operator-workflow response as the only normal-path
   source of destination questions, readiness, and next action.
2. Delete the disconnected compatibility grid, local projection, focused tests,
   and direct inventory records.
3. Do not add client workflow-state inference, a compatibility readiness API,
   or navigation anchors for deleted surfaces.
4. Audit the legacy setup-card data inside `policyUserMentalModel.mjs` next;
   retain only server contracts with a current workflow consumer.

## Implementation Outcome

- Deleted the unmounted setup-card component, local utility, and focused tests.
- Removed obsolete presentation, workflow, and client-boundary inventory
  references.
- Preserved the native workflow components, operator-workflow route, server
  validation, persistence, learning, and routing behavior unchanged.
- Updated the roadmap, prior setup-card design records, compatibility audit
  chain, and changelog.

## Security And Accessibility Outcome

- A browser projection no longer presents local progress or routing context as
  current automation state.
- The normal UI has one server-derived readiness status instead of competing
  local and server status surfaces.
- No write, permission, provider, quota, routing, scheduler, or learning
  behavior changed.

## Verification

Focused native workflow tests protect the retained server-owned replacement.
Server inventory tests verify that no deleted compatibility artifact remains
classified as an active authoring surface. Full client coverage, lint, type
checking, build, documentation lint, coverage ratchet, and static ESM checks
are release gates.

## Next Item

The follow-on user-mental-model setup-card audit is complete in [Policy
Compatibility User-Mental-Model Setup-Card Contract Retirement
Audit](policy-compatibility-user-mental-model-setup-card-contract-retirement-audit.md).

Next, start **Phase 6R.6, Task 6R.6.1: Migration Preview Contract**.
