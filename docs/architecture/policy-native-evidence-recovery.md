# Policy Native Evidence Recovery

## Status

Implemented for native new-policy creation. When Classifarr cannot provide a
current, usable set of observed destination values, the policy builder offers a
single bounded recovery action instead of exposing templates, raw policy
controls, or an unsafe empty-policy fallback.

## Problem

Native policy creation deliberately begins with observations from the connected
media-server library. A profile can be missing, stale, unavailable, or contain
no reusable destination candidates. The former screen stated that profile
refresh was needed, but left the recovery action disconnected from the blocked
native selection path. It could also expose stale candidates even though they
were not safe evidence for a new declared purpose.

The recovery path must preserve these boundaries:

- A cached operator-workflow read remains display-only.
- Observations never become purpose rules without explicit acceptance.
- A profile refresh is an authenticated server-side operation, not a client
  retry loop.
- A missing or empty profile cannot fall back to legacy templates or free-form
  evidence fields.

## Official Guidance Reviewed

- [WCAG 2.2 Success Criterion 4.1.3](https://www.w3.org/TR/WCAG22/#status-messages)
  requires status changes to be programmatically determinable without moving
  focus. The recovery panel uses a polite status announcement for expected
  recovery states and an assertive alert only when an attempted refresh fails.
- [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html)
  recommends server-side authorization, semantically appropriate HTTP errors,
  and generic failure messages. The client does not display server internals or
  treat its own state as permission to refresh or create a policy.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  warns that resource-consuming actions need feature-specific controls and
  server-side workflow validation. The browser makes at most one explicit
  refresh request per action; it does not retry a write automatically.
- [Google Cloud retry guidance](https://docs.cloud.google.com/iam/docs/retry-strategy)
  recommends bounded retries with backoff and jitter only for operations that
  are safe to retry. Background reconciliation owns bounded automatic recovery;
  this interactive surface uses an explicit action and a follow-up read instead
  of unbounded browser retries.

## Options Considered

### Automatically refresh when the modal opens

Pros:

- Removes one operator click for an incomplete profile.

Cons:

- Performs a resource-consuming write simply by opening a screen.
- Can create repeated work as users reopen the modal or switch libraries.
- Makes an unavailable library look like a client failure instead of an
  observable, recoverable state.

### Fall back to legacy templates or manual signal fields

Pros:

- Lets an operator create a policy even when a profile is empty.

Cons:

- Reintroduces the preset-centric model and bypasses the source-of-truth
  premise of native creation.
- Makes unverified values look like a safe substitute for observed evidence.
- Increases the number of decisions precisely when automation should defer.

### Selected: bounded explicit recovery

Pros:

- Preserves a small native workflow: one recovery action, then one
  side-effect-free workflow reread.
- Blocks stale, missing, and empty observations from being accepted as purpose.
- Keeps profile refresh server-authorized and errors bounded.
- Allows the operator to defer without inventing rules.

Cons:

- A library without usable synced media cannot create a native policy yet.
- The operator must intentionally refresh when they want to recover
  interactively; automatic recovery remains a scheduler responsibility.

## Design

`policyNativeEvidenceRecovery.js` translates the existing bounded workflow read
into one of these display states:

| State | Native behavior |
| --- | --- |
| Workflow unavailable | Offer a side-effect-free evidence reread. |
| Profile unavailable | Offer one profile refresh. |
| Profile needs refresh | Hide candidates and offer one profile refresh. |
| No usable candidates | Keep creation blocked; offer a refresh after source media changes. |
| Refresh failed | Show a generic alert and allow a later explicit retry. |
| Ready | Render the observed-value multi-select. |

`PolicyNativeEvidenceRecovery.vue` is the only native-create recovery control.
`PolicyBuilderWorkflowShell.vue` owns the state mapping and renders candidate
checkboxes only in the ready state. `PolicyBuilderModal.vue` performs the
existing authorized refresh and then reloads the display-only operator-workflow
projection. A workflow reread reloads the profile and projection without
refreshing media or calling providers.

The generic refresh button remains available for the retained compatibility
editor. It is suppressed in native new-policy creation so there is one clear
recovery action and no duplicate button.

## Final Recommendation Stack

1. Treat current observed candidates as the sole native create input.
2. Hide candidates whenever the server read reports unavailable or stale
   evidence, even if stale candidate labels exist in the response.
3. Use one explicit, disabled-while-running profile refresh action, followed by
   a fresh display-only workflow read.
4. Keep browser retries off; allow scheduler-owned recovery to use its own
   bounded, backoff-controlled mechanism.
5. Defer creation when refreshed evidence remains insufficient. Do not reveal a
   legacy or free-form authoring fallback.

## Security Outcome

- The browser cannot create a policy from missing, stale, or empty observed
  evidence.
- Refresh remains an existing `requireReadWrite` server operation; the browser
  does not gain authority from a client-side state.
- The recovery mapper uses only bounded state and candidate availability. It
  neither renders raw server errors nor accepts profile payloads as policy
  input.
- The refresh button prevents duplicate in-flight requests and the client does
  not automatically repeat a resource-consuming write.
- A successful refresh is followed by a versioned display-only read before any
  candidate can be selected.

## Verification

- `client/src/__tests__/utils/policyNativeEvidenceRecovery.test.js`
- `client/src/__tests__/PolicyNativeEvidenceRecovery.test.js`
- `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`
- `client/src/__tests__/PolicyBuilderModal.test.js`
- `client/src/__tests__/utils/policyBuilderProfileRefreshResult.test.js`
