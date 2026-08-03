# Policy Destination Proposal Card

## Status

Implemented by Phase 4R.4. This document records the normal policy-authoring
card reached from the server-confirmed library lifecycle entry. It deliberately
does not introduce the later exceptional-adjustment editor or stale/outcome
recovery work; those are Phase 4R.5 and 4R.4b respectively.

## Goal

When a library profile already supports a safe policy candidate, the operator
should not have to reselect genres, ratings, or other evidence that Classifarr
has already derived. The card should explain the observed context, show the
server-derived proposed intent, distinguish it from a saved policy, and offer
one explicit creation action.

The result is an automation-first path:

```text
select eligible library -> prepare current proposal -> review bounded summary
-> admit opaque server proposal -> synchronize lifecycle
```

Observed values remain evidence. They do not become durable policy values until
the authorized admission action succeeds.

## Research

- [WCAG 2.2 Success Criterion 4.1.3: Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  requires status changes to be programmatically available without moving
  focus. The card uses short `role="status"` messages for preparation and
  creation feedback, rather than a dialog or focus-stealing notification.
- [WCAG 2.2 Success Criterion 2.4.3: Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html)
  requires a meaningful, operable focus order. The existing durable library
  route retains the selected panel and returns focus to its source action;
  the card does not insert a modal focus trap.
- [Vue Router navigation](https://router.vuejs.org/guide/essentials/navigation.html)
  supports programmatic query-state navigation. The selected library remains
  in the existing `?library=<id>` route instead of creating hidden component
  state that cannot be refreshed or linked.
- The [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side authorization, allow-listed input, and generic error
  messages. The browser posts an empty prepare body, then only the opaque
  proposal reference, revision, empty allow-listed adjustments, and a stable
  idempotency key during admission. It never submits observed values or
  reconstructed policy intent.

## Options Considered

### Reopen the full legacy policy builder

Pros:

- Familiar to existing operators.
- Supports arbitrary editing immediately.

Cons:

- Forces the operator to repeat evidence selection that the current library
  profile already provides.
- Reintroduces generic signal controls, diagnostic surfaces, and browser-owned
  intent assembly into the normal path.

Rejected.

### Show lifecycle status only

Pros:

- Minimal client work.
- No additional browser mutation behavior.

Cons:

- Stops before an eligible library can become a policy.
- Does not explain the candidate that the server has already found.

Rejected.

### Prepare, display, then admit a server-owned proposal

Pros:

- Gives one clear default decision for well-profiled libraries.
- Keeps the browser display-safe and prevents it from inventing durable
  meaning.
- Uses the existing server admission transaction, revision recheck, and
  idempotency controls.

Cons:

- Adds a prepare request before the explicit creation action.
- Requires a separate recovery component for stale and interrupted outcomes.

Selected.

## Design

### Preparation boundary

The client automatically prepares a proposal only after a user has selected a
server-confirmed `eligible_to_prepare_proposal` library. It calls:

```text
POST /api/policies/operator-workflow/libraries/:libraryId/proposals
{}
```

At the same time it reads the existing 4R.2 display-only workflow projection.
That projection contributes only the bounded observed-context summary. A failed
or malformed workflow read cannot widen the card or block a valid prepared
proposal; the card falls back to a safe generic explanation.

`policyAuthoringProposalPresentation.js` validates both contracts. It returns:

- a frozen renderable presentation with title, declared purpose, counts, and
  bounded observed context; and
- a separate opaque admission object with `libraryId`, proposal reference, and
  revision.

The card receives only the first object. It cannot display, edit, or derive the
opaque identifiers.

### Admission boundary

`usePolicyAuthoringProposalAdmission.js` holds the opaque object and creates a
secure browser idempotency key per unchanged proposal attempt. It sends exactly:

```json
{
  "proposal_revision": "server proposal revision",
  "adjustment_commands": []
}
```

to the server-owned admission endpoint. The server re-derives the canonical
intent from current evidence before persistence. The client validates the
bounded result and shows a confirmed saved-policy outcome only when the server
returns a created or replayed policy receipt.

### UI states

- **Observed:** concise library-profile context only; no raw item list or
  browser-proposed signal chooser.
- **Proposed:** server-derived purpose and rule counts with an explicit
  `Proposed, not saved` state.
- **Saved:** confirmed policy receipt after admission, followed by a lifecycle
  synchronization read.
- **Unavailable or changed:** lifecycle-owned safe message or generic bounded
  prepare error. The card does not offer profile refresh, arbitrary retry, or
  a fake manual fallback.

## Recommendation Stack

1. Keep the lifecycle entry as the sole normal entry point and prepare only
   after eligible library selection.
2. Treat the prepared proposal response as an untrusted transport object until
   strict client validation produces a display model.
3. Keep opaque reference and revision outside the render component; forward
   them only through the narrow admission composable with an idempotency key.
4. Make the prepared proposal the primary action and defer arbitrary adjustment
   controls to Phase 4R.5.
5. Complete Phase 4R.4b next so stale, concurrent, and interrupted admissions
   discard local state and reload the authoritative lifecycle automatically.

## Outcome

`/policies?library=<id>` now prepares the server-owned destination proposal
for an eligible library, displays a bounded observed/proposed/saved summary,
and creates the policy through the opaque revision-bound admission endpoint.
The normal card has one primary action and no multi-select, profile refresh,
template picker, advanced-setting, raw error, or browser-assembled intent
surface. Existing and recovery lifecycle states remain non-creating.

Focused API, presentation, admission, component, and page tests cover the
strict display split, malformed response rejection, empty adjustment command,
idempotency forwarding, no-picker card, and confirmed creation path.

## Next Task

**Phase 4R.4b, Proposal Outcome Recovery:** stale, expired, concurrent, and
lost admission responses must discard the local proposal and reload the
authoritative lifecycle before any new action is offered.
