# Policy Compatibility Routing-Readiness Card Retirement Audit

## Status

Implemented on 2026-07-31 as Phase 6R.5 compatibility maintenance work.

## Decision

Delete `PolicyBuilderRoutingReadinessCard.vue` and its focused test. The card
was not imported or rendered by any production component, its local projection
utility was already deleted, and it had no dedicated server read contract.

Do not replace it with another compatibility routing card. The active native
creation path renders server-owned, question-owned empty-state actions from the
operator-workflow response. They are the only normal workflow surfaces for
automation readiness and next action.

## Scope Proof

| Surface | Finding | Decision |
| --- | --- | --- |
| Legacy routing card | No production import or mount | Delete component and focused test. |
| Local routing projection | Deleted in the prior footer-admission task | Do not recreate. |
| Dedicated legacy read endpoint | None | Do not add one for a deleted surface. |
| Native workflow readiness | `GET /api/policies/operator-workflow/libraries/:libraryId` returns display-only workflow readiness | Keep the existing server-owned contract and question-owned empty-state action. |
| Compatibility setup-card grid | Unmounted, but still holds the old routing anchor and local setup model | Audit as the next isolated component task. |

## Official Guidance Reviewed

Research was reviewed on 2026-07-31 against official guidance current through
June 2026:

- [W3C WAI: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires an actual dynamic status to be programmatically determinable. A
  deleted, unmounted status surface provides no accessible outcome and should
  not be retained solely for a live-region implementation detail.
- [W3C WCAG Failure F103](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103)
  identifies action outcomes, application state, progress, and errors as the
  cases that need status semantics. The active server-owned workflow continues
  to expose the real readiness state; the legacy card had no current state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server validation for security because browser checks are
  bypassable. A local routing projection cannot authorize routing or policy
  writes.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state and rejects UI-only sequencing. The
  active operator-workflow endpoint, not the deleted card, owns readiness.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep the card dormant | No file deletion | Leaves a misleading local-routing design and stale test/inventory records. |
| Reconnect it to a new endpoint | Could show another readiness panel | Duplicates the active server workflow and adds request and decision load. |
| Delete it and retain the server-owned workflow card | One authoritative normal-path readiness surface | Requires the separate setup-card grid to be audited next. |

## Final Recommendation Stack

1. Keep the server-owned operator-workflow response and question-owned
   empty-state action as the sole normal-path readiness presentation.
2. Delete the unmounted legacy routing card, its test, and all inventory
   references.
3. Do not add a compatibility readiness API, browser routing inference, or
   client-side automation gate.
4. Audit the unmounted `PolicyBuilderSetupCards.vue` grid next because it still
   models local setup/readiness and links to the retired anchor.

## Implementation Outcome

- Deleted `PolicyBuilderRoutingReadinessCard.vue` and its focused test.
- Removed the retired test record and the obsolete workflow/boundary inventory
  classifications.
- Preserved the server-owned native workflow endpoint and its response
  validation; later work retired the unreachable generic readiness card.
- Updated historical routing-readiness records, the roadmap, and the
  compatibility-maintenance audit chain.

## Security And Accessibility Outcome

- No browser component can present local routing context as a current,
  authoritative automation result.
- No permission, write, provider, quota, routing, or scheduler behavior
  changes.
- The active server-derived readiness result retains its accessible dynamic
  status behavior; the deleted unmounted card had no user-visible outcome.

## Verification

Focused modal and workflow-shell tests protect the server-owned readiness
replacement and absence of the legacy card. Server inventory tests verify no
deleted artifact remains classified as an active authoring surface. Full client
tests, coverage, build, lint, type checking, documentation lint, and static
ESM checks are release gates.

## Next Item

The compatibility grid retirement is implemented in [Policy Compatibility
Setup-Card Grid Retirement Audit](policy-compatibility-setup-card-grid-retirement-audit.md).
Next, perform the **Phase 6R.5 policy user-mental-model setup-card contract
audit** for `policyUserMentalModel.mjs` and remove unreachable card-specific
data without disturbing active server workflow contracts.
