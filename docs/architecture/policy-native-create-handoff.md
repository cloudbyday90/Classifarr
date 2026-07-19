# Policy Native Create Handoff

## Status

Implemented for native new-policy creation.

## Outcome

After a native policy is created, Classifarr keeps the modal open long enough
to confirm the persisted outcome. The handoff shows the policy and library,
the count of declared destination rules, the authority model, and whether a
routing target is configured. It does not reopen the compatibility editor or
reconstruct the result from the unsaved browser draft.

## Problem

The native create transaction already established the policy, native intent,
audit state, routing record, and rollback snapshot. The former client path
immediately refreshed the list and closed the modal, discarding the successful
server response. Operators could not distinguish a successful saved policy
from an interrupted or incomplete workflow without reopening the list.

The handoff needs to confirm completion without introducing a second editing
surface or making client state authoritative.

## Authoritative Data Boundary

The handoff begins with the successful `201 Created` response. It then performs
the existing authorized `GET /api/policies/:id` read to obtain the persisted
native-intent contract. The UI derives only display counts from that read.

The create route now also returns `Location: /api/policies/:id`. This follows
the HTTP `201 Created` resource-location semantics in
[RFC 9110](https://datatracker.ietf.org/doc/html/rfc9110).

Observed library suggestions are intentionally not reported as durable policy
provenance. They are setup evidence that an operator may accept; current native
storage records the resulting `operator_declared_intent` authority instead. A
future provenance feature must add a server-owned, versioned evidence snapshot
and retention rules. The handoff must not imply that such a record exists.

## Official Guidance Reviewed

- [W3C form notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)
  calls for clear feedback after both successful and unsuccessful form
  submission. The handoff explicitly confirms that the policy was created.
- [WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)
  requires programmatically determinable status messages. The result includes a
  polite live status and moves focus to its outcome heading after the operator
  creates the policy.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends endpoint-level authorization, appropriate HTTP status codes, and
  generic errors. The handoff uses existing authorized reads and never displays
  transport or server internals after a successful write.

## Options Considered

| Option | Advantages | Costs |
| --- | --- | --- |
| Close immediately after POST | Fewest UI changes | Discards completion evidence and makes success unclear. |
| Build a receipt from the local draft | Fast and avoids a read | The browser can misstate what the server persisted. |
| Selected: receipt plus persisted read | Confirms the transaction and server-owned native contract | Adds one bounded authorized read after a successful create. |

## Design

`usePolicyNativeCreateHandoff.js` accepts only a successful native-create
receipt. It validates the policy ID and establishment status, reads the
persisted policy through the existing client API module, and delegates display
normalization to `policyNativeCreateHandoff.js`.

`PolicyNativeCreateHandoff.vue` renders a short result with one `Done` action.
It uses a polite status announcement and focuses its outcome heading after the
save operation. A failed reread does not turn a successful create into an
error: the screen says the policy is saved and directs the operator to review
it from the list once the connection is available.

`PolicyList.vue` returns the create response to the modal and does not close a
native create automatically. Legacy edits retain their existing close-on-save
behavior. The normal policy list still refreshes after both operations.

## Final Recommendation Stack

1. Treat the `201` response as the completion receipt and provide a resource
   `Location` header.
2. Read the persisted policy once before showing detailed intent counts.
3. Render only server-recorded declared authority and routing status.
4. Keep the successful receipt visible if the follow-up read fails; never retry
   the create operation automatically.
5. Keep observed-profile provenance out of the handoff until it has an explicit
   server-owned storage contract.

## Verification

- `client/src/__tests__/utils/policyNativeCreateHandoff.test.js`
- `client/src/__tests__/composables/usePolicyNativeCreateHandoff.test.js`
- `client/src/__tests__/PolicyNativeCreateHandoff.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`
- `server/src/__tests__/policies-routes.coverage.test.mjs`

## Follow-Up

The next Phase 6R.5 decision is whether observed library evidence needs durable
provenance after policy creation. If learning, reconciliation, or operator
audit needs it, define a bounded server-owned snapshot schema, retention window,
and redaction policy. Otherwise, formally retain observed suggestions as
transient setup evidence and keep native authority limited to declared intent.
