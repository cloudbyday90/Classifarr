# Policy Authoring Intent-Signal Chip List

Status: implemented as the declared-signal display and removal component for
native policy creation.

## Scope

`IntentSignalChipList.vue` renders only accepted, normalized destination-signal
candidates. It gives each candidate a visible `Remove` action whose accessible
name identifies the exact declared signal. On removal it emits the established
`policy.intent_signal_command_plan.v1` `remove_signal_value` plan.

The component does not select options, add signals, mutate its props, persist a
policy, derive evidence, evaluate readiness, route media, learn from decisions,
call a provider, or read quota data. `IntentSignalPicker.vue` remains the owner
of evidence-backed option selection and add-plan construction; its parent keeps
the only draft-state mutation path.

## Official Guidance Reviewed

- [Vue props](https://vuejs.org/guide/components/props) defines one-way
  parent-to-child data flow and recommends events instead of child mutation.
- [Vue component events](https://vuejs.org/guide/components/events) documents
  explicit child-to-parent events. The list therefore emits a plan rather than
  editing the accepted-signal array.
- [WCAG 2.2 Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  requires the accessible name to contain a visible control label. Each removal
  button retains visible `Remove` text and an accessible name beginning with
  `Remove` plus the signal label.
- [WCAG 2.2 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports communicating state changes without unexpected focus movement. The
  existing picker-owned status region continues to announce resulting declared
  signal state after the parent applies a command.
- [WAI-ARIA keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  requires interactive controls to be keyboard operable with visible focus.
  Native buttons supply activation semantics while the existing focus ring keeps
  removal actions visible.

## Recommendations

1. Normalize candidates in the chip list before rendering or emitting a plan.
   Malformed, auto-declared, or unsupported values remain invisible and cannot
   generate a removal command.
2. Preserve the established command-plan version, component id, and boundary.
   A UI extraction must not become a draft-protocol migration.
3. Keep add and remove responsibilities separate: the picker owns selectable
   options and add plans; the list owns only declared-signal rendering and
   remove plans.
4. Use native buttons with exact per-signal accessible names. Do not make an
   entire chip a custom clickable widget.

## Pros And Cons

### Dedicated Chip List

Pros:

- Removes declared-signal display and removal logic from the larger picker.
- Gives chip removal focused accessibility and typed-command coverage.
- Makes the component inventory accurately reflect an implemented target
  primitive.

Cons:

- Introduces one small props/events boundary that must remain aligned with the
  existing normalized candidate contract.
- Does not yet split the larger constraint-control surface.

### Preserved Command Protocol

Pros:

- Avoids a persistence or draft-state migration for a presentational refactor.
- Preserves existing server validation and local-draft tests.

Cons:

- The stable `intent_signal_picker` command component id remains broader than
  the child component that emits a remove plan.

## Final Recommendation Stack

1. `IntentSignalChipList.vue` accepts declared candidate data through props,
   normalizes it, and emits only typed `remove_signal_value` plans.
2. `IntentSignalPicker.vue` owns source grouping, multi-select state, and typed
   add plans, then forwards chip-list events unchanged.
3. `usePolicyIntentSignalDraft` remains the only local-draft application path;
   native creation remains the server persistence boundary.
4. The next extraction is `HardLimitControl` from the combined constraint
   surface, retaining the server-owned decision and eligibility projections.

## Outcome

The target `IntentSignalChipList` component is now implemented. It preserves
the operator-visible behavior and command protocol from the former inline
markup, while preventing malformed data and direct prop mutation from becoming
policy changes.

## Next Task

Extract `HardLimitControl` from `PolicyIntentConstraintControlSurface.vue`.
Keep explicit confirmation, server-projected eligibility, and local typed draft
commands intact; do not move constraint authority into the browser.
