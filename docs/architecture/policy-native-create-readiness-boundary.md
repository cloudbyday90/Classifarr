# Policy Native Create Readiness Boundary

## Decision

Phase 6R.4 separates native policy-creation feedback from compatibility-policy
save feedback. The native footer can report only client-owned draft facts: a
library is selected and the operator explicitly accepted destination purpose.
It cannot derive routing readiness, provider status, replay state, TMDB
coverage, scoring, or automation authorization from browser state.

The server remains the authority that validates and establishes native intent.
The post-create handoff reports the server-derived routing state. Existing
compatibility-policy editing uses the same action-only footer: direct
prerequisites may disable the control for usability, but no browser routing or
save-readiness conclusion is presented.

## Official Guidance Reviewed

Research reviewed in July 2026 against the sources current through June 2026:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires authorization checks on every request and server-side enforcement.
  A browser footer therefore cannot authorize policy creation or routing.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-generated verification data and server-controlled allowed
  state transitions. Native establishment keeps that validation in the
  transaction-owning server path.
- [W3C WAI: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  distinguishes dynamic outcome, progress, and error notifications. The footer
  now announces a changing unmet prerequisite or returned error, rather than a
  permanent browser-generated success conclusion.

## Options Considered

### Keep Local Routing Inference For Native Creation

Pros: gives an immediate routing warning before save.

Cons: duplicates server routing semantics, can become stale during an open
modal, and makes an advisory browser calculation look like an authorization or
automation decision. Rejected.

### Show the Full Server Readiness Panel in the Native Footer

Pros: reuses the server-owned readiness projection.

Cons: accepted purpose is intentionally a local, unsaved draft, so the stored
policy readiness projection cannot yet be the final creation result. Duplicates
the five-question workflow and increases decision load. Rejected.

### Keep a Small Native Draft Boundary and Show Server Outcome After Save

Pros: the footer stays simple, creation cannot be enabled by local routing
data, and the authoritative post-create handoff explains routing from the
server response.

Cons: routing configuration is confirmed after creation rather than inferred
by the footer. Selected.

## Implementation

- `policyNativeCreateActionBoundary.js` owns only selected-library and
  explicit-purpose checks for a new native policy.
- `policyCompatibilitySaveActionBoundary.js` owns only the direct selected-
  library prerequisite for compatibility saves.
- `policyBuilderActionBoundary.js` dispatches by mode and contains no local
  routing-readiness input.
- `PolicyBuilderModal.vue` does not calculate local routing readiness for its
  footer.
- The footer shows a polite direct prerequisite only while its action is
  disabled, and exposes returned save failures as alerts. The atomic server
  establishment route and the server-response handoff remain the authority for
  policy creation and routing state.

## Security And Accessibility Outcome

- Browser state cannot authorize a native policy or automatic routing.
- The native creation request is still subject to server-side actor,
  transaction, idempotency, policy, and declared-intent validation.
- A stale local Arr mapping cannot affect footer state.
- The footer is screen-reader-friendly without a permanent success status,
  compatibility routing warning, or duplicated readiness panel.

## Verification

- Direct unit tests cover native draft gating and compatibility-save isolation.
- The existing action-boundary test proves a native call ignores a supplied
  compatibility routing value.
- The modal test proves native creation does not display the legacy routing
  warning or advanced settings.

## Final Recommendation Stack

1. Use the native action boundary only for local draft completeness.
2. Treat the server transaction and response handoff as the authority for
   native creation and routing state.
3. Keep compatibility save admission to direct prerequisites only.
4. Keep diagnostic, provider, replay, TMDB, and scoring state out of normal
   native authoring.
5. Delete the compatibility boundary only through the Phase 6R.6/8R migration
   and deletion gates.

## Follow-On Outcome

The persisted-policy modal boundary now treats a policy as native only when the
full server read model reports `policy_intent_contract.source` as
`native_intent`. A database ID alone no longer selects compatibility editing.
Persisted native policies show the server-owned workflow and a read-only native
status without compatibility controls or a save footer. Existing and malformed
contracts fail closed to the compatibility editor; server routes still enforce
the authority decision for every mutation.

The Phase 6R.5 compact persisted-native view is implemented in [Persisted
Native Policy Summary](policy-persisted-native-summary.md). It keeps the
five-section setup workflow for native creation only. Compatibility edits use a
dedicated maintenance surface, while an established native policy shows stored
purpose, current policy readiness, and one server-provided next action.

The native summary now uses a policy-specific server read that evaluates active
native intent, cached profile freshness, and stored routing state. It no longer
labels that result as generic library readiness.
