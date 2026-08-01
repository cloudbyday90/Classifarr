# Policy Authoring Review-Trigger Control

Status: implemented as the non-blocking review-condition component for native
policy creation.

## Scope

`ReviewTriggerControl.vue` renders one review-condition select from the existing
server-owned constraint decision model and eligibility projection. A canonical
selection enables the existing `policy.intent_constraint_command_plan.v1`
`add_review_warning` plan. The control deliberately has no confirmation
checkbox: the approved model declares that review warnings are non-blocking and
do not require a second explicit-action acknowledgement.

The component rebuilds the approved display surface from its inputs rather than
receiving a parent-supplied rendering object. Invalid decision or eligibility
projections render no review control. Its only valid effect is the
server-defined `request_review` behavior; it cannot become a hard-limit blocker
or an advisory rating value.

`PolicyIntentConstraintControlSurface.vue` owns the shared unavailable message,
local staged-command count, status region, and draft clearing. The child does
not mutate props, persist policy data, derive constraint meaning, route media,
make runtime automation decisions, learn from a choice, call a provider, query
quota data, or expose raw server payloads.

## Official Guidance Reviewed

- [Vue props](https://vuejs.org/guide/components/props) specifies one-way
  parent-to-child data flow and advises child components to emit events rather
  than mutate parent state. The control emits a typed command plan only.
- [Vue component events](https://vuejs.org/guide/components/events) supports
  explicit child-to-parent event contracts. The composite forwards the
  established draft-plan event unchanged.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) requires
  form controls to have associated labels. The review-condition select keeps its
  existing visible label and stable ID.
- [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires meaningful status updates to be programmatically available. The
  select describes the parent-owned polite status region alongside its local
  helper text.

## Recommendations

1. Derive the review control from the approved decision and eligibility
   projections in the child. Do not pass raw constraint objects or
   browser-inferred review semantics across the component boundary.
2. Keep the native select, its visible label, local-only helper text, and
   disabled reason. A selected value and the stage action are the deliberate
   operator input; the non-blocking model does not need a duplicate checkbox.
3. Preserve the current command-plan version, component ID, and local-draft
   boundary. This extraction is neither a policy-write nor API migration.
4. Keep the composite responsible for shared availability, status, staged-count,
   and clear-draft UI rather than duplicating those concerns in each child.

## Pros And Cons

### Dedicated Review-Trigger Control

Pros:

- Keeps review-only behavior visibly distinct from blocking and advisory rating
  constraints.
- Makes the absent-confirmation rule independently testable against the
  server-owned model.
- Fails closed for invalid projections and keeps the stable control ID,
  description, and status relationship.

Cons:

- Recomputes the bounded display projection already used by the composite.
- Adds a small props/events interface that must retain the typed DTO contract.

### No Duplicate Confirmation

Pros:

- Matches the server-defined non-blocking semantics and removes an unnecessary
  decision point.
- Preserves an explicit selection and stage action before a local draft exists.

Cons:

- The review explanation must stay clear so the absence of a checkbox is not
  mistaken for a blocker bypass.

## Final Recommendation Stack

1. `ReviewTriggerControl.vue` derives an approved non-blocking review control,
   renders native labelled inputs, and emits only one typed local plan.
2. `usePolicyIntentConstraintControl` owns bounded local selection, reset, and
   plan-building mechanics; specialized components own their decision language.
3. `PolicyIntentConstraintControlSurface.vue` coordinates availability, status,
   staged-command count, and clearing without a constraint-specific editor.
4. `policyIntentConstraintDraft` remains the validation and local-draft
   boundary; native policy creation remains the server persistence boundary.

## Outcome

`ReviewTriggerControl` is now an independently tested native authoring
primitive. It preserves the approved non-blocking review behavior and typed
local-draft command protocol while the combined constraint surface becomes a
shared coordinator only.

## Next Task

Phase 3R.6.2 retired the unreachable generic readiness card. Next, audit the
live operator-workflow projection across all six readiness states.
