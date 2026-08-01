# Policy Operator Workflow Live Readiness Presentation Audit

Status: implemented as Phase 3R.6.3.

## Scope

Audit the live `GET /policies/operator-workflow/libraries/:libraryId` display
projection against all six automation-readiness states. The goal is to prove
that each state leads to an existing owner action or to clear non-interactive
guidance when Classifarr, rather than the browser, performs recovery.

This work does not add a generic readiness card, trigger profile refreshes from
the browser, execute routing, persist a policy, contact a provider, read quota,
or expose raw evidence or diagnostic payloads.

## Findings

The readiness engine correctly owns six state IDs, but the live workflow read
previously had no bounded presentation record proving where each state was
resolved. That left two risks:

- a stale profile still supplied selectable intent inputs even though its engine
  next action was profile refresh; and
- a future engine state could be returned without an actual control or truthful
  automatic guidance in the normal workflow.

The new server-owned `policy.operator_workflow_readiness_presentation.v1`
projection maps all live readiness issues to their existing owner. The read
contract is now `policy.operator_workflow_read.v4` so clients reject an older,
incomplete response shape.

## State Ownership

| Readiness state | Owner surface | Resolution |
| --- | --- | --- |
| `ready` | `PolicyBuilderFooterActions` | The existing create or defer action. |
| `needs_more_examples` | `IntentSignalPicker` | Accept a current observed suggestion or enter declared intent through the existing bounded command flow. |
| `needs_operator_review` | `ReviewTriggerControl` | Review the declared condition that makes Classifarr ask. |
| `needs_routing` | `PolicyDestinationEmptyStateNotice` | The existing `Open library mapping` handoff, only when the server projects the unmapped-library action. |
| `blocked_by_hard_limit` | `HardLimitControl` | Review the explicit hard limit that blocks automatic application. |
| `stale_profile` | `ObservedProfileSummary` | Non-interactive automatic-recovery guidance; the browser offers no refresh action. |

When the observed profile is unavailable or stale, the intent picker is not
rendered. This prevents an obsolete profile from being accepted as current
evidence. A current profile with safe selectable values retains the existing
picker; a new or sparse current library can still use its bounded declared
intent path. The profile summary announces automatic guidance with a polite
status message.

## Security Boundary

- The server derives readiness and the owner map from trusted profile, routing,
  and intent contracts. Client state is not used to authorize policy creation,
  automation, routing, or profile recovery.
- The operator-workflow read audit rejects a missing owner, a routing action
  without the server-projected mapping handoff, a selection action while the
  profile is not current, an action-shaped automatic message, and raw payload
  exposure.
- Browser behavior remains display-only except for existing typed draft commands
  and the existing bounded library-mapping navigation action. Profile lifecycle
  remains server-owned and automatic.
- The browser accepts only the v4 projection with a matching primary state,
  approved owner/action shape, and explicit `rawPayloadExposed: false` value.

## Official Guidance Reviewed

Official sources were reviewed on 2026-08-01 against guidance current through
June 2026:

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state and server-side enforcement rather
  than UI-gated transitions. The resolver therefore derives state and action
  ownership on the server.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic server validation in addition to client UX validation.
  The read audit treats a stale profile as invalid selection context.
- [Vue props](https://vuejs.org/guide/components/props) defines one-way data
  flow. The Vue components receive the projection and do not mutate it.
- [Vue component events](https://vuejs.org/guide/components/events) recommends
  explicitly declared component events. Existing draft and mapping events remain
  bounded and parent-owned.
- [W3C labeling controls guidance](https://www.w3.org/WAI/tutorials/forms/labels/)
  requires controls to identify their purpose. The existing named controls stay
  with the question they resolve.
- [WCAG 2.2 status-message failure F103](https://www.w3.org/WAI/WCAG22/Techniques/failures/F103)
  requires dynamic status information to be programmatically determinable. The
  automatic-recovery explanation uses a polite status message rather than a
  deceptive button or focus jump.

## Options Considered

### Restore A Generic Readiness Panel

Pros:

- Provides a single central list of all states.

Cons:

- Reintroduces the duplicate surface removed in Phase 3R.6.2.
- Separates a condition from the control that can resolve it.
- Encourages another layer of browser-owned navigation behavior.

### Leave Stale Inputs Selectable

Pros:

- Lets an operator continue setup before profile recovery completes.

Cons:

- Contradicts the server-owned `stale_profile` next action.
- Lets stale observations appear safe enough to accept.
- Makes the screen promise both automatic recovery and manual stale-evidence
  selection.

### Map States To Existing Owners And Gate Stale Evidence

Pros:

- Keeps one condition in its resolving location.
- Preserves the hands-off profile lifecycle and requires no browser refresh.
- Makes unsupported future routing or selection states fail the server audit.
- Avoids raw diagnostic, provider, quota, replay, and scoring details.

Cons:

- State ownership is distributed across the existing workflow rather than shown
  in a dedicated summary card.
- A stale profile temporarily withholds intent selection until the automatic
  lifecycle has current evidence.

## Final Recommendation Stack

1. Keep readiness state, priority, and owner resolution server-owned.
2. Render a state only in the existing component that can truthfully resolve it.
3. For automatic profile recovery, present a short non-interactive status in
   `ObservedProfileSummary` and no browser refresh or focus action.
4. Gate intent selection on a current profile, while preserving the bounded
   declared-intent path when the profile is current.
5. Fail the read audit on an unowned state, an unavailable mapping action, or
   an action implied by automatic guidance.
6. Keep all persistence, automation, routing, provider, and quota authority on
   the server.

## Implemented Outcome

- Added `policyOperatorWorkflowReadinessPresentation.mjs`, a focused service
  that maps all six state IDs and every live issue to an existing owner action
  or automatic guidance.
- Added a presentation audit to the operator-workflow read service and bumped
  the response contract to v4.
- Updated the static authoring readiness contract so stale profiles await
  automatic recovery in `ObservedProfileSummary` instead of suggesting declared
  intent from stale observations.
- Passed the observed-profile state to destination questions and withheld the
  intent picker while that profile is stale or unavailable.
- Added polite automatic-recovery feedback to the existing profile summary.
- Added server and Vue tests for all six owner mappings, stale selection
  suppression, automatic guidance, and fail-closed routing ownership.

## Next Task

Phase 3R.7: Starter Template Role Reset. Audit the live starter-template
candidate projection so template values remain optional, source-labelled
accelerators after destination context and cannot become normal policy
authority.
