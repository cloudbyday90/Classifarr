# Policy Compatibility Intent Readiness Boundary Audit

## Status

Implemented for Phase 6R.5. Compatibility maintenance no longer derives or
displays a browser-owned aggregate readiness state.

## Decision

Remove `PolicyIntentReadinessSummary.vue` and
`buildPolicyIntentReadinessSummary` from compatibility maintenance. Do not add
a compatibility readiness endpoint.

The deleted summary inferred `Ready`, `Ready with notes`, or `Needs review`
from unsaved browser draft signals. It was advisory, but its labels and warning
counts looked like an automation decision even though it did not read the
authoritative readiness inputs: persisted native intent, bounded evidence,
learning, routing, or profile freshness.

The existing `GET /api/policies/:id/native-intent/readiness-summary` endpoint
is the single server-owned readiness projection. When native intent authority
is available, it returns one bounded next action. Compatibility maintenance
must not call it: the endpoint correctly reports native intent as unavailable
until cutover, and it cannot represent unsaved compatibility draft changes.

## Scope Classification

| Surface | Decision | Reason |
| --- | --- | --- |
| Top-level warning and note counts | Delete | They aggregate local draft hints into a non-authoritative policy state. |
| `Ready` / `Needs review` labels | Delete | Compatibility cannot safely claim automation readiness. |
| Issue-row focus navigation | Delete | It existed only to support the deleted aggregate. |
| Per-section warnings, completion badges, and next-edit copy | Keep | They describe the currently edited section, do not authorize automation, block writes, or claim runtime readiness. |
| Native readiness summary | Keep server-owned | It reads bounded persisted state and exposes one validated next action. |
| Compatibility readiness API | Do not add | A persisted-only read would become stale after a draft edit; a draft POST would create a new client-input workflow without improving write authority. |

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  requires server-side validation because client validation is bypassable. The
  compatibility draft therefore cannot determine automation readiness or write
  validity.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant values and workflow state on the
  server. Native readiness remains a server projection over bounded persisted
  inputs; the legacy editor has no parallel state machine.
- [W3C WAI: Grouping Controls](https://www.w3.org/WAI/tutorials/forms/grouping/)
  recommends keeping related controls in smaller, understandable groups. The
  retained per-section guidance appears beside its related control instead of
  duplicating every issue in a separate global status region.
- [WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)
  supports programmatically determinable status messages. The native
  server-owned next-action card retains its polite atomic status; compatibility
  no longer announces a derived aggregate that has no authoritative meaning.

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Retain client aggregate | Reflects draft edits immediately | Presents non-authoritative readiness and duplicates section guidance. |
| Add a server read over persisted compatibility values | Server-owned data source | Immediately stale after draft changes and cannot evaluate native readiness before cutover. |
| Add a draft-evaluation endpoint | Could mirror unsaved edits | Adds a new untrusted-input workflow, validation surface, and request churn without changing write authority. |
| Remove aggregate, retain section guidance | Removes false readiness while preserving direct editing help | Compatibility view has no global status, by design. |

## Final Recommendation Stack

1. Delete compatibility aggregate readiness and its focus-navigation path.
2. Keep narrow per-section edit guidance local to the section being changed.
3. Preserve server validation at the compatibility write boundary.
4. Use the existing native readiness projection only after native intent is
   authoritative.
5. Do not create a compatibility-specific readiness API or draft-evaluation
   endpoint.

## Security And Accessibility Outcome

- No browser-derived status can claim that policy automation is ready.
- No new API accepts or persists draft state, and no compatibility read exposes
  provider, routing, profile, or diagnostic details.
- Compatibility writes remain server-validated.
- The editor removes duplicate issue narration and the associated focus jump;
  each retained edit control keeps its nearby label, warning, and next action.
- Native readiness remains the only polite status message for automation state.

## Implementation Outcome

- Deleted `PolicyIntentReadinessSummary.vue` and its component test.
- Deleted the client aggregate helper and its aggregate-specific tests.
- Removed aggregate status rendering and focus-only section references from
  `PolicyIntentEditor.vue`.
- Retained typed draft commands while retiring all client-derived section
  advisory state.
- Updated policy-engine inventories and presentation-test records to represent
  the deleted compatibility surface.

## Verification

Focused client tests cover the absence of aggregate and section-level browser
advisory state. Server inventory tests verify deleted artifacts are not
classified as active workflow artifacts. Full client tests, build, lint,
typecheck, coverage, and affected server checks provide the release gate.

## Next Item

The compatibility save-footer admission audit is implemented in [Policy
Compatibility Save-Footer Admission Audit](policy-compatibility-save-footer-admission-audit.md).
Next, perform a **compatibility routing-readiness card retirement audit** for
`PolicyBuilderRoutingReadinessCard.vue`. It is unmounted; confirm it has no
server-owned read contract or production caller, then remove it rather than
preserve a dormant client readiness surface.
