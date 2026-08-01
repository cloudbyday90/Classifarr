# Policy Authoring Avoid Control

Status: implemented as the advisory destination-boundary component for native
policy creation.

## Scope

`AvoidControl.vue` renders one rating-to-avoid selector from the existing
server-owned constraint decision model and eligibility projection. It requires a
canonical rating selection and explicit confirmation before it emits the
existing `policy.intent_constraint_command_plan.v1` `add_avoid_value` plan.

The control rebuilds the approved display surface from its inputs rather than
accepting a parent-supplied rendering object. Invalid decision or eligibility
projections therefore render no avoid input. Its only valid effect is the
server-defined advisory `reduce_confidence` behavior; it cannot present or emit
a hard-limit blocker.

`PolicyIntentConstraintControlSurface.vue` continues to own the single
unavailable message, local staged-command count, draft clearing, and the
remaining review-warning control. The component does not mutate props, persist
policy data, derive constraint meaning, route media, make runtime automation
decisions, learn from a choice, call a provider, query quota data, or expose raw
server payloads.

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
- [WCAG 2.2 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  requires visible labels to be present in accessible names. The stage button
  preserves its visible label and appends only the actionable disabled reason.

## Recommendations

1. Rebuild the avoid control from the approved decision and eligibility
   projections in the child. Do not pass raw constraints or browser-made rating
   choices into the rendering boundary.
2. Keep explicit confirmation as a local UI requirement and keep authoritative
   validation in `buildPolicyIntentConstraintCommandPlan`.
3. Preserve the existing command-plan version, component id, and local-draft
   boundary. Component extraction is not a storage or API migration.
4. Keep the advisory message specific: avoid values lower confidence or lead to
   review according to the server model; they do not become hard blocks.

## Pros And Cons

### Dedicated Avoid Control

Pros:

- Makes the advisory outcome visibly distinct from a hard-limit blocker.
- Makes confirmation, disabled reasons, and staged-value display independently
  testable.
- Fails closed if either server projection is invalid.

Cons:

- Recomputes the bounded display projection already used by the composite.
- Adds a small props/events boundary that must retain the existing DTO contract.

### Shared Local-Draft Composable

Pros:

- Removes duplicate projection, confirmation, reset, and plan-building code
  from the hard-limit and avoid controls.
- Keeps all user-visible blocking/advisory language in the specialized
  components.

Cons:

- The composable must remain limited to local UI mechanics and cannot become a
  browser policy-decision service.

## Final Recommendation Stack

1. `AvoidControl.vue` derives an approved advisory control, renders native
   labelled inputs, requires confirmation, and emits only one typed local plan.
2. `usePolicyIntentConstraintControl` owns bounded local selection mechanics;
   specialized components own their distinct decision language.
3. `PolicyIntentConstraintControlSurface.vue` coordinates availability, status,
   staged-command count, clearing, and the remaining review-warning control.
4. `policyIntentConstraintDraft` remains the validation and local-draft
   boundary; native policy creation remains the server persistence boundary.
5. Extract `ReviewTriggerControl` next without moving review semantics into the
   browser.

## Outcome

`AvoidControl` is now an independently tested native authoring primitive. The
operator-visible advisory behavior and stable IDs are preserved, while the
child rejects invalid projections and cannot turn an unconfirmed or unapproved
value into either a draft command or a hard-limit assertion.

## Next Task

Extract `ReviewTriggerControl` from `PolicyIntentConstraintControlSurface.vue`.
Keep review conditions separate from constraint values and preserve the existing
typed local-draft boundary.
