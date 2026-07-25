# Policy Destination Empty-State Action Resolution

Status: implemented as durable destination-first policy-authoring behavior.

## Scope

Destination empty states present a single bounded recovery action when the
current library cannot yet establish enough context for a policy. This work
keeps progress feedback attached to the action that actually started it.

It does not infer policy intent, add actions, route media, expand the browser's
authority, expose diagnostics, change database schema, or alter provider and
quota behavior.

## Official Sources Reviewed

Official sources reviewed as of June 2026:

- W3C WCAG 2.2, [Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  - Waiting and action-result messages must be programmatically available
    without an unnecessary focus change.
- W3C WAI-ARIA Authoring Practices, [Providing Accessible Names and Descriptions](https://www.w3.org/WAI/ARIA/apg/practices/names-and-descriptions/)
  - Interactive controls require concise names and can reference visible
    explanatory text with `aria-describedby`.
- W3C WAI-ARIA Authoring Practices, [Button Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/button/)
  - Button labels should identify their operation, and a button can reference
    text that describes its function.
- W3C WCAG 2.2, [Labels or Instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html)
  - Visible instructions help every operator understand the required action.

## Recommendations

1. Keep the normal label, busy label, and concise busy message in the audited
   server-owned empty-state projection.
2. Pass the active action identifier through the modal, workflow shell, and
   destination-question components. Do not send a shared boolean that makes
   unrelated actions appear in progress.
3. Render the active action's busy label and one workflow-level polite status
   message. Disable competing empty-state actions until the active operation
   resolves.
4. Associate each actionable button with its visible empty-state explanation.
5. Show the static `Next` text only for guidance-only states, where no button
   exists. An actionable card's button already expresses the next step.
6. Keep navigation failure sanitized and leave the modal open so the operator
   can retry or choose another path.

## Pros And Cons

### Pros

- Prevents an open-mapping action from being mislabeled as a library sync.
- Preserves a single bounded recovery action for each destination state.
- Provides visible and programmatic progress without moving focus.
- Protects against concurrent empty-state actions and leaves retry available
  after a navigation failure.
- Keeps the browser presentation-only; server audit rules retain control of
  available action identity and copy.

### Cons

- The workflow projection adds two small presentation fields for actionable
  states.
- The modal maintains one transient action identifier while an operation runs.
- Existing clients that receive an older projection retain the normal action
  label as a safe fallback instead of presenting specialized busy copy.

## Final Recommendation Stack

- Server projection and audit:
  `server/src/services/policyOperatorWorkflowEmptyState.mjs`
- Modal action orchestration:
  `client/src/components/policies/PolicyBuilderModal.vue`
- Workflow forwarding:
  `client/src/components/policies/PolicyBuilderWorkflowShell.vue`
- Question placement:
  `client/src/components/policies/PolicyBuilderDestinationQuestions.vue`
- Presentation and accessibility semantics:
  `client/src/components/policies/PolicyDestinationEmptyStateNotice.vue`
- Server verification:
  `server/src/__tests__/services/policyOperatorWorkflowReadService.test.mjs`
- Client verification:
  `client/src/__tests__/PolicyDestinationEmptyStateNotice.test.js`
  `client/src/__tests__/PolicyBuilderDestinationQuestions.test.js`
  `client/src/__tests__/PolicyBuilderWorkflowShell.test.js`

## Implemented Outcome

| Action | Normal label | Busy label | Polite status |
| --- | --- | --- | --- |
| Library sync | Sync library now | Syncing library... | Classifarr is syncing this library and refreshing its profile. |
| Open mapping | Open library mapping | Opening library mapping... | Classifarr is opening the library mapping page. |

Only the action whose identifier matches the modal's active action ID receives
the busy label. One workflow-level status names the active operation and is
referenced by every temporarily disabled empty-state action. Guidance-only
sparse-library states remain text-only and do not acquire a non-functional
button.
