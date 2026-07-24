# Policy Native Evidence Recovery Action Resolution

Status: implemented as durable native policy-authoring recovery behavior.

## Scope

Native policy creation uses a bounded library-evidence projection before it
offers observed destination values. When that evidence is unavailable, stale,
empty, or failed to refresh, Classifarr presents one recovery action for the
current condition.

This change keeps the action-specific busy label in the recovery projection and
associates the recovery button with its visible explanation. Refreshing a
library profile and checking an unavailable workflow now retain distinct busy
copy.

This does not change evidence admission, profile refresh behavior, workflow
reload behavior, policy creation, routing, learning, provider activity, quota
use, database schema, or API contracts.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, Status Messages:
  <https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html>
  - Waiting and error states should be programmatically determinable without
    unnecessarily interrupting the current task.
- W3C WCAG 2.2, Error Identification:
  <https://www.w3.org/WAI/WCAG22/Understanding/error-identification>
  - Failures need concise text that identifies what went wrong.
- W3C WCAG 2.2, Labels or Instructions:
  <https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html>
  - Controls need visible instructions so users understand the requested
    action.
- WAI-ARIA Authoring Practices Guide, Button Pattern:
  <https://www.w3.org/WAI/ARIA/apg/patterns/button/>
  - A button should have a clear accessible name and may reference the text
    that describes its function.

## Recommendations

1. Keep exactly one recovery action for each bounded evidence state.
2. Let the recovery projection own the action label and busy label so Vue does
   not infer the operation from a generic loading flag.
3. Associate the action with the visible recovery message using
   `aria-describedby`.
4. Use a polite status for expected recovery guidance and an assertive alert
   only for a failed refresh.
5. Do not expose server error detail, raw workflow data, or additional recovery
   choices.

## Pros And Cons

### Pros

- Prevents a workflow reload from being mislabeled as a library-profile refresh.
- Gives keyboard and assistive-technology users the action's explanation at
  the control.
- Keeps recovery behavior bounded to the server-approved action identifiers.
- Avoids duplicate actions and additional decision points.

### Cons

- The recovery projection carries one additional presentation field,
  `busyLabel`.
- A future action identifier must add its own explicit busy label rather than
  reusing an unrelated operation's copy.

## Final Stack

- Recovery projection:
  `client/src/utils/policyNativeEvidenceRecovery.js`
- Recovery action component:
  `client/src/components/policies/PolicyNativeEvidenceRecovery.vue`
- Projection coverage:
  `client/src/__tests__/utils/policyNativeEvidenceRecovery.test.js`
- Component coverage:
  `client/src/__tests__/PolicyNativeEvidenceRecovery.test.js`

## Implemented Outcome

Native evidence recovery now exposes one action with state-owned busy feedback:

| Recovery action | Normal label | Busy label |
| --- | --- | --- |
| Refresh profile | Refresh library profile | Refreshing library profile... |
| Reload workflow | Try evidence check again | Checking library evidence... |

The recovery action references the visible recovery message. A failed refresh
remains an assertive bounded alert; other actionable recovery states remain
polite status messages.
