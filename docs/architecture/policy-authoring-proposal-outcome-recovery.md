# Policy Authoring Proposal Outcome Recovery

## Status

Implemented by Phase 4R.4b. This document defines the recovery behavior after
a server-prepared policy proposal is stale, concurrent, interrupted, or has an
uncertain admission result.

## Goal

The browser must not decide whether an attempted admission created a policy.
After an uncertain or non-successful outcome, it discards the local proposal
reference and revision, reads the server-owned lifecycle again, and renders
only that fresh state.

```text
admit proposal -> bounded non-success or uncertain transport -> discard local state
-> read lifecycle -> show fresh server-confirmed state -> prepare only if eligible
-> explicit create from the new proposal
```

This is recovery, not an admission retry. The browser never resubmits an old
proposal or creates a replacement policy payload.

## Research

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant values on the server and enforcing
  valid state transitions there. The client therefore treats a create outcome
  as untrusted until the lifecycle read confirms the current policy state.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side authorization, allow-listed inputs, and generic error
  responses. Recovery sends no policy meaning, profile data, proposal revision,
  or idempotency key; it reads the existing bounded lifecycle endpoint.
- [WCAG 2.2 Success Criterion 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires status changes to be programmatically available without moving
  focus. Recovery uses one short, polite status message rather than a dialog
  or a focus-stealing alert.
- [Vue Router programmatic navigation](https://router.vuejs.org/guide/essentials/navigation.html)
  keeps the selected library in the existing query state. Recovery retains that
  durable route rather than writing transient attempt state to browser storage.

## Options Considered

### Blindly retry the admission

Pros:

- Fast when a network response was lost.

Cons:

- Can race a concurrent policy creation or resubmit an obsolete proposal.
- Continues to rely on a stale browser-held reference and revision.

Rejected.

### Persist the admission body and resume after reload

Pros:

- Could resume an interrupted request without another lifecycle read.

Cons:

- Retains idempotency and proposal values in browser storage.
- Makes stale browser state part of policy-authoring authority.

Rejected.

### Discard local state and reconcile the lifecycle

Pros:

- The existing server lifecycle identifies whether a policy exists, recovery is
  automatic, or a new proposal can safely be prepared.
- Does not expose raw conflicts or turn a transient failure into a second
  create attempt.
- Works across tabs, refreshes, restarts, and any connected library name.

Cons:

- Adds one lifecycle read after an uncertain or non-successful admission.
- A newly eligible lifecycle state may require the operator to repeat an
  optional narrowing on a new proposal before explicitly creating it.

Selected.

## Design

### Recovery triggers

The admission composable requests recovery only for:

- a strict, bounded non-success admission receipt;
- a malformed success receipt, because the server may have completed the write;
- `404`, `408`, `409`, `429`, `5xx`, or an outcome with no response status.

Authorization and allow-list rejection remain bounded feedback-only states.
They do not trigger a recovery read that could hide an authorization problem.

### Recovery boundary

`usePolicyAuthoringProposalOutcomeRecovery.js` accepts only a library identity
and a fixed recovery reason. It calls the existing lifecycle reader through the
view-owned lifecycle list. It stores neither the proposal reference/revision
nor request body and never calls prepare or admit itself.

The selected route remains `/policies?library=<id>`. Once the lifecycle read
finishes, normal route selection may prepare a fresh proposal only when the
server again reports that the library is eligible. No create admission is
automatic.

### Outcome display

The view clears the prior card before reconciliation and shows one `role=status`
message. The returned lifecycle state owns all subsequent guidance:

- an existing policy blocks new creation and displays its bounded name;
- profile recovery remains automatic and has no browser recovery control;
- an eligible library may present a newly prepared proposal for a later,
  explicit creation action;
- an unavailable lifecycle state retains the existing list reload affordance.

## Recommendation Stack

1. Treat every non-successful or uncertain admission as a lifecycle read, not
   a browser retry.
2. Keep recovery input limited to the selected library and an internal fixed
   reason; never retain proposal references, revisions, request bodies, or
   idempotency keys in browser storage.
3. Validate bounded admission receipts before using their outcome identifiers.
4. Let the server lifecycle own existing-policy, automatic-recovery, and
   availability messaging after reconciliation.
5. Use one polite status message and keep the selected library route stable.

## Outcome

The normal proposal route now discards stale, concurrent, interrupted, and
uncertain admission attempts before reloading authoritative lifecycle state.
No recovery path submits an admission automatically. The current selected
library remains visible, and a server-confirmed existing policy shows its
bounded name without reopening the retired policy editor.

## Next Task

**Phase 5R.3 AI Provider Capability And Authority Modes:** establish bounded
provider authority before runtime clarification, learning, or material policy
exceptions are introduced.
