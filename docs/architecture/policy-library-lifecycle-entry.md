# Policy Library Lifecycle Entry

## Status

Implemented by Phase 4R.4a. This document records the normal `/policies`
entry component that consumes the completed 5R.2a lifecycle read. It does not
prepare a proposal, admit a policy, refresh a profile, or edit an existing
policy. Phase 4R.4 owns the revision-bound destination proposal card.

## Goal

Replace the local-policy-list and hidden create-modal path with one
server-confirmed lifecycle outcome for every connected library. An operator
does not have to infer whether existing contents form a destination, choose the
same observed values again, or discover after submission that a policy exists.

## Research

- [W3C WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires programmatically determinable non-focus-changing status feedback.
  The entry uses polite, atomic status regions for load and stale-selection
  feedback, rather than browser dialogs or raw transport failures.
- [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  requires focus order to preserve meaning and operability. Selecting a library
  focuses the selected lifecycle panel; returning to the list restores focus to
  the originating proposal-review control.
- [Vue Router Programmatic Navigation](https://router.vuejs.org/guide/essentials/navigation.html)
  supports named route navigation with durable query state. The selected library
  is stored as positive-integer `library` query data on `/policies`, so reload
  and browser navigation retain context without local modal state.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side authorization, strict validation, and generic error
  responses. The browser validates the narrow lifecycle read and fails closed;
  it never translates a client-side list or error into create authority.

The sources were checked on 2026-08-03 against guidance current through June
2026. They support accessible status feedback, meaningful focus behavior,
durable navigation state, and server-owned authorization rather than a
browser-derived policy decision.

## Options Considered

### Reuse the local policy list and create modal

Pros: smallest visual change and familiar legacy controls.

Cons: libraries without policies are invisible; local state infers grouping
and eligibility; hidden modal state, browser alerts, reset, and direct
configuration create competing authoring paths.

Rejected.

### Build a generic observed-value selector first

Pros: immediate manual correction for every library and no lifecycle reads.

Cons: it reintroduces the redundant `Belongs Here` decision; stale, existing,
and recovery handling become browser-owned; it increases operator effort and
creates a second source of policy meaning.

Rejected.

### Server lifecycle list with durable selected-library route state

Pros: every library has one authoritative create, existing-policy, recovery,
unavailable, or safe-load-failure outcome; existing/recovery states cannot
activate create; selection survives reload and back navigation; strict
validation removes unexpected action authority.

Cons: one bounded lifecycle read per library and a small adapter, composable,
and entry component.

Selected.

## Design

### Data boundary

`GET /api/policies/operator-workflow/libraries/:libraryId/authoring-lifecycle`
is the only lifecycle authority. The client accepts only
`policy.authoring_proposal.v1` and known shapes for eligible, existing native,
existing compatibility, profile recovery, and proposal-unavailable states.

The presentation adapter requires an exact top-level shape, matching library
identifier, expected action availability, expected proposal reason, and bounded
policy identity. Unknown fields, version mismatch, a mismatched library, or an
inconsistent action/proposal fail to a non-actionable `unavailable` state. It
does not pass server actions, proposal reasons, profile data, or raw errors into
the component.

`usePolicyAuthoringLifecycleList` starts at most four reads at once. This
avoids an unbounded request burst for installations with many libraries while
preserving server library ordering. A superseded page load cannot replace newer
entries.

### Interaction boundary

`PolicyList.vue` now renders only `PolicyAuthoringLifecycleEntry` cards. It no
longer fetches policies, mounts `PolicyBuilderModal`, exposes reset or
reconciliation controls, or uses browser dialogs. The sole primary control,
`Review destination proposal`, renders only for the eligible server-confirmed
state.

The control writes `/policies?library=<positive-id>`. The selected lifecycle
panel is a durable, non-mutating hand-off for Phase 4R.4 and explicitly states
that no policy has been created. A manually restored route for an existing,
recovery, or unavailable state remains non-creating and reports the server
outcome rather than treating it as an eligible proposal.

### Accessibility and recovery

- Load and unavailable-selection changes use polite, atomic status messages.
- Explicit navigation focuses the selected panel; returning focuses the
  original review control when it still exists.
- A library-catalog failure provides one generic retry action. Individual
  unavailable lifecycle reads can be reloaded through one bounded list action.
- Profile recovery is informational. No refresh, quota, reset, or
  reconciliation action appears in this entry.

## Recommendation Stack

1. Keep lifecycle, proposal preparation, and proposal admission server-owned
   and separately authorized.
2. Treat lifecycle responses as an untrusted versioned boundary in Vue; map an
   allow-listed immutable presentation and fail closed.
3. Use one normal lifecycle list with bounded request concurrency.
4. Use durable route state and focus restoration instead of modal state.
5. Render the proposal card only in Phase 4R.4 after selection; do not restore
   observed-value selectors or compatibility create paths.

## Outcome

Phase 4R.4a is complete. Every loaded connected library has one visible
authoritative lifecycle card, only eligible cards can select the proposal
hand-off, existing policies cannot issue another create, and loading/failure
feedback is safe and accessible. Focused tests cover the API leaf, strict
response adapter, concurrency and stale-request behavior, lifecycle controls,
and `/policies` route/focus behavior.

The next task is **Phase 4R.4, Destination Proposal Card**. It will call the
separate authorized prepare endpoint, render the server-provided display-safe
proposal, and leave native creation to its subsequent admitted action.
