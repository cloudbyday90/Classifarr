# Persisted Native Policy Authority Mode

## Decision

A saved policy no longer enters the compatibility editor simply because it has
an ID. The modal now chooses its presentation mode from the full policy read
model: only `policy_intent_contract.source: "native_intent"`, produced by the
server's native-authority read path, selects the read-only native view. A
persisted policy with any other, absent, or malformed source remains in the
compatibility editor.

The browser uses this distinction only to decide what it renders. It does not
authorize writes, transitions, routing, or automation. Those actions remain
validated by their server routes and transaction boundaries.

## Official Guidance Reviewed

Research reviewed in July 2026 against sources current through June 2026:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  requires authorization to be enforced server-side on every request. Browser
  mode selection cannot become a policy-write authorization signal.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-controlled transaction authorization and treating client
  data as insufficient for the final decision. The policy read contract is a
  display input; the server retains the final control gate.
- [W3C WAI-ARIA `status` role](https://www.w3.org/TR/aria-role/roles#status)
  defines a polite advisory status. The native view announces its mode through
  an atomic live status without taking focus or adding a blocking alert.

## Options Considered

### Use A Persisted Policy ID To Select Compatibility Editing

Pros: no additional mode data is needed.

Cons: routes saved native policies into a legacy editor, obscures native
authority, and presents controls that do not match the current policy model.
Rejected.

### Trust A Browser-Supplied Native Flag

Pros: easy to add to the modal props.

Cons: client-derived data is not an authority source and can drift from the
server's active intent. Rejected.

### Select The View From The Full Server Intent Contract

Pros: the existing policy-detail read already attaches active native intent
only after the server's authority check, supports a fail-closed fallback to the
compatibility editor, and keeps the browser display-only. Selected.

Cons: editing a policy requires the existing detail read before opening the
modal. This request already occurs in `PolicyList.vue` and is necessary to
avoid making a mode decision from list-summary data.

## Implementation

- `policyNativePolicyAuthority.js` recognizes the exact canonical native
  contract source and documents that it is display-only.
- `policyBuilderExperienceMode.js` now distinguishes `native_create`,
  `native_view`, and `legacy_edit`.
- `PolicyList.vue` continues to fetch `GET /api/policies/:id` before opening an
  editor. The route attaches an active native intent and projects the contract
  before returning it.
- `PolicyBuilderModal.vue` renders the compact native-policy summary for a
  persisted native policy, but excludes the setup workflow, compatibility
  settings, legacy intent controls, and the save footer.
- `PolicyNativePolicySummary.vue` uses a short polite, atomic live status to
  explain the read-only state without changing focus.

## Security And Accessibility Outcome

- A tampered browser mode cannot unlock a server mutation.
- Unknown or missing contract sources never assert native authority.
- Existing compatibility policies continue to be editable through their
  established path.
- Persisted native policies do not display misleading compatibility controls.
- Assistive technology receives a concise advisory mode announcement.

## Verification

- Unit tests prove native view requires the exact server contract source and
  that unknown sources remain compatibility editing.
- Modal tests prove a persisted native policy omits legacy editor controls,
  advanced settings, save footer, preset data, and settings reads.
- Existing route coverage proves `GET /api/policies/:id` returns the native
  contract only after the server-native read service accepts active authority.

## Final Recommendation Stack

1. Fetch the full policy detail before choosing a persisted policy surface.
2. Use the exact server contract source only for browser display dispatch.
3. Keep all native and compatibility mutations server-authorized.
4. Fail closed to the existing compatibility path for unknown source values.
5. Replace the persisted native setup workflow with a compact status summary in
   the next Phase 6R.5 component.
