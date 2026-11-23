# Suggestion review acknowledgement design

Reviewed with Astra on November 23, 2026 Eastern.

The dashboard's Apply and Reject requests use the shared transport, which can
repeat a POST after a network error, eligible HTTP error, or session refresh.
The server locks the suggestion and rejects later attempts after the first
commit. A lost response followed by a conflict can therefore hide the actual
outcome from the reviewer.

## Recommended stack

1. Send one POST per dashboard confirmation, with the existing transport opt-out
   and a 60-second client wait. Preserve authorization, CSRF, and all server
   transaction and pending-state checks. A `401` directs the operator to sign in
   again. Existing validation, authorization, and lifecycle refusals keep their
   individual handling. A deadline ends the client's wait while the server may
   still finish. [HTTP retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).
2. Require the canonical successful HTTP acknowledgement to bind the suggestion
   ID and action. The Apply result also identifies the selected policy and
   suggestion type. Connection loss, a timeout, `408`, server failures and an
   unexpected success body leave the submission unconfirmed.
3. Close the submitted form and make one read of the existing no-store proposal
   route with a 10-second client wait and transport replay disabled. Bind the
   returned suggestion, policy and type before projecting the four recognized
   statuses. A pending snapshot can precede commit, and a terminal snapshot
   describes saved state without attributing it to the submitted request.
   Missing, failed, mismatched and unknown reads leave it unconfirmed.
   [PostgreSQL visibility](https://www.postgresql.org/docs/18/transaction-iso.html)
   and [HTTP caching](https://www.rfc-editor.org/rfc/rfc9111.html#section-5.2.2.5).
4. Announce the observation with a persistent status region. Offer a keyboard
   accessible Check status action that only reads. A separate review requires
   reopening and loading a current pending proposal, followed by explicit
   confirmation. Refresh the list after a terminal observation. Keep only the
   current observation in memory and ignore completions after navigation.
   [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## Tradeoffs

| Approach | Benefit | Cost |
| --- | --- | --- |
| Disable replay alone | Small client change | Leaves the reviewer without a current saved status |
| Single POST and status observation | Uses existing permissions and provides bounded, actionable feedback | Cannot establish which request wrote the row, and a new rejection requires entering its reason again |
| Durable command receipt | Can attribute a committed decision to its exact request | Requires a server contract for request identity, transaction binding, authorization, and retention |

Verify real browser request counts for both writes, recorded and pending
observations, malformed acknowledgements, and session refusal. Use isolated
PostgreSQL and the production HTTP routes to verify a commit followed by lost
HTTP acknowledgement and a pending observation while the original write waits.
