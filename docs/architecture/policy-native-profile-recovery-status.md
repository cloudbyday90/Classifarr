# Native Policy Profile-Recovery Status

## Decision

Persisted native-policy views must report automatic profile recovery without
asking an operator to refresh a profile or exposing queue internals. The
native-readiness summary now projects one bounded recovery state from cached
profile freshness and the durable profile-refresh outbox:

- `not_required`
- `scheduled`
- `queued`
- `processing`

The browser consumes this display-only projection. It cannot enqueue work,
refresh a profile, retry a worker, or derive state from a local timer.

## Research

W3C identifies application state updates as status messages and recommends a
pre-existing `role="status"` container with polite, atomic announcements. The
recovery component is always present in the native summary, uses that role,
does not move focus, and has no interactive control. [W3C ARIA22: Using
`role=status`](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22) and the
[WAI-ARIA status role](https://www.w3.org/TR/aria-role/roles) support this
choice.

W3C also recommends concise feedback that tells people what happened and what
they need to do. Each recovery state uses fixed, plain-language text and says
explicitly when no action is needed. [W3C user
notifications](https://www.w3.org/WAI/tutorials/forms/notifications/)

## Options Considered

### Keep the Manual Refresh Button

Pros: immediate familiar control.

Cons: contradicts scheduler-owned recovery, creates an unnecessary browser
write path, and makes successful recovery depend on an operator opening this
view. Rejected.

### Poll From the Browser Until the Profile Is Current

Pros: can update the card without reopening the dialog.

Cons: adds timer lifecycle and request-load failure modes, creates inconsistent
state across tabs, and makes recovery visibility dependent on browser activity.
Rejected.

### Read a Bounded Server Recovery Projection

Pros: one source of truth, no browser side effect, no raw outbox data, and
states are accessible through a concise live status message.

Cons: the card updates when the normal readiness read is refreshed rather than
through client polling. Selected.

## Final Recommendation Stack

1. Keep profile generation and retry scheduler-owned through the durable
   outbox.
2. Add only a compact, allowlisted recovery projection to the existing native
   readiness response.
3. Replace the stale-profile display action with an automatic-recovery message
   in that response; retain the underlying readiness engine unchanged.
4. Render the projection in one persistent, polite `role="status"` component
   with no buttons, focus changes, timers, or client writes.
5. Fail closed when the server response does not contain a known recovery
   state, label, and message.

## Implementation Outcome

`policyNativeProfileRecoveryStatus.mjs` derives a fixed state from the
readiness result and any active persisted profile-refresh work for the policy's
library. The service reads the outbox only when profile freshness is stale or
missing. A pending row with a future server-owned `available_at` is shown as
`scheduled`; a claimable pending row is shown as `queued`. It returns no
request identifiers, lease tokens, errors, timestamps, or media data.

The native readiness contract validates the recovery projection and records
whether the stored outbox was read. For a stale profile, the presentation-only
next action becomes `await_automatic_profile_recovery`; it no longer presents
the underlying engine's `refresh_profile` label to the browser.

`PolicyNativeProfileRecoveryStatus.vue` renders the server-derived status in a
polite, atomic live region. It intentionally has no refresh, retry, or reload
control. The existing policy builder keeps its legacy edit refresh control
outside this native persisted-policy surface.

## Security Outcome

- The recovery projection is an allowlist of fixed states and fixed copy.
- The server reads only stored profile/outbox state through parameterized SQL.
- The client rejects unknown recovery states and missing status fields.
- No outbox identifiers, worker errors, raw profile data, provider payloads,
  or scheduler controls reach the browser.
- The status component cannot trigger a write, routing action, provider call,
  or policy mutation.

## Verification

Focused tests cover current, scheduled, queued, and processing projections,
including delayed terminal-recovery successors; the replacement of the manual
stale-profile action; client fail-closed validation; and the rendered live
region's lack of controls.

## Next Step

Add terminal-failure classification and an automatic circuit policy so the
status remains truthful for recurring transient recovery without exposing a
browser retry control for persistent failure.
