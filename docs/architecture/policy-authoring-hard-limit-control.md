# Policy Authoring Hard-Limit Control

Status: implemented as the explicit blocking-boundary component for native
policy creation.

## Scope

`HardLimitControl.vue` renders one maximum-rating constraint from the existing
server-owned constraint decision model and eligibility projection. It requires a
canonical rating selection and explicit confirmation before it emits the
existing `policy.intent_constraint_command_plan.v1` `set_hard_limit` plan.

The control rebuilds the approved display surface from its inputs rather than
accepting a parent-supplied rendering object. Invalid decision or eligibility
projections therefore render no hard-limit input.
`PolicyIntentConstraintControlSurface.vue` continues to own the single
unavailable message, local staged-command
count, draft clearing, and the still-combined avoid and review-warning controls.

The component does not mutate props, persist policy data, derive constraint
meaning, route media, make runtime automation decisions, learn from a choice,
call a provider, query quota data, or expose raw server payloads.

## Official Guidance Reviewed

- [Vue props](https://vuejs.org/guide/components/props) specifies one-way
  parent-to-child data flow and advises child components to emit events rather
  than mutate parent state. The control emits a typed command plan only.
- [Vue component events](https://vuejs.org/guide/components/events) supports
  explicit child-to-parent event contracts. The composite surface forwards the
  established draft-plan event unchanged.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) requires
  labels to be associated with form controls. The rating select and confirmation
  checkbox have explicit visible labels and their existing stable IDs.
- [WAI-ARIA checkbox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/)
  defines keyboard operation for checkboxes. A native checkbox retains those
  semantics without recreating a custom widget.
- [WCAG 2.2 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  requires visible labels to be present in accessible names. The stage button
  preserves its visible label and appends only the actionable disabled reason.

## Recommendations

1. Rebuild the hard-limit control from the approved decision and eligibility
   projections in the child. Do not pass raw constraint objects or browser-made
   rating choices into the rendering boundary.
2. Keep explicit confirmation as a local UI requirement and keep authoritative
   validation in `buildPolicyIntentConstraintCommandPlan`.
3. Preserve the existing command-plan version, component id, and local-draft
   boundary. Component extraction is not a storage or API migration.
4. Keep the composite as the single owner of availability and status messaging
   until `AvoidControl` and `ReviewTriggerControl` are extracted.

## Pros And Cons

### Dedicated Hard-Limit Control

Pros:

- Isolates the only blocking constraint from advisory controls.
- Makes confirmation, disabled reasons, and staged-value display independently
  testable.
- Fails closed if either server projection is invalid.

Cons:

- Recomputes the bounded display projection already used by the composite.
- Adds a small props/events boundary that must retain the existing DTO contract.

### Preserved Typed Draft Plan

Pros:

- Retains existing allowlist validation and explicit-operator checks.
- Avoids policy writes, routing effects, and browser authority changes.

Cons:

- The stable adapter component id describes the command protocol rather than
  the individual visual child that originated the event.

## Final Recommendation Stack

1. `HardLimitControl.vue` derives an approved blocking control, renders native
   labelled inputs, requires confirmation, and emits only one typed local plan.
2. `PolicyIntentConstraintControlSurface.vue` coordinates availability, status,
   staged-command count, clearing, and the remaining advisory controls.
3. `policyIntentConstraintDraft` remains the validation and local-draft
   boundary; native policy creation remains the server persistence boundary.
4. Extract `AvoidControl` next, then `ReviewTriggerControl`, without moving
   decision semantics into the browser.

## Outcome

`HardLimitControl` is now an independently tested native authoring primitive.
The operator-visible hard-limit behavior and stable IDs are preserved, while
the child rejects invalid projections and cannot turn an unconfirmed or
unapproved value into a draft command.

## Next Task

Extract `AvoidControl` from `PolicyIntentConstraintControlSurface.vue`. Keep its
advisory, non-blocking server projection distinct from this hard-limit control,
while preserving explicit confirmation and typed local draft commands.
