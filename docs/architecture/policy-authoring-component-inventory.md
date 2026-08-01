# Policy Authoring Component Inventory

Status: implemented as a source-backed ownership inventory.

## Scope

This document records the current Vue policy-component tree against the durable
policy-authoring component vocabulary. It is an implementation inventory, not a
new runtime policy engine and not a browser authority boundary.

The inventory exists to prevent two regressions while the UI is rebuilt:

- a compatibility-only component quietly becoming part of native authoring;
- a roadmap component being declared complete while its UI is still inline or
  merged into an unrelated control.

`server/src/services/policyAuthoringComponentInventory.mjs` classifies every
current `client/src/components/policies/*.vue` file. The focused test scans the
directory, so a new component fails closed until it has an explicit ownership
and replacement decision.

## Official Guidance Reviewed

- [Vue component props](https://vuejs.org/guide/components/props) specifies
  one-way-down props and recommends events for parent-owned mutation. Target
  controls therefore receive display and draft inputs and emit typed commands;
  they do not mutate parent or bridge state.
- [Vue composables](https://vuejs.org/guide/reusability/composables) recommends
  composables for reusable logic and components for shared logic plus visual
  layout. The inventory preserves that split rather than moving command logic
  into presentation components.
- [W3C WAI-ARIA keyboard guidance](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
  requires keyboard-operable interactive controls and visible, predictable
  focus. The inventory identifies components that must carry those requirements
  during extraction.
- [WCAG 2.2 consistent identification](https://www.w3.org/WAI/WCAG22/Understanding/consistent-identification)
  requires repeated functionality to be identified consistently. Target names
  are therefore product concepts, not a mixture of legacy `PolicyIntent*`
  implementation names and new terms.
- [W3C form labels guidance](https://www.w3.org/WAI/tutorials/forms/labels/)
  requires labels for form controls. Each target control remains accountable for
  its own visible label, description, disabled reason, and action name.

## Current Ownership

The 32 current policy Vue components are classified into four groups:

1. Native authoring: the modal, workflow shell, destination context, observed
   evidence, signal picker, question container, constraint surface, readiness,
   status, save admission, and bounded custom-value entry.
2. Native result and recovery: post-create and persisted-policy read-only
   screens. They are intentionally outside the new-policy component vocabulary.
3. Compatibility-only maintenance: the legacy editor, section cards, generic
   selects, legacy chips, and migration notice. These cannot re-enter the native
   authoring path.
4. Policy-list presentation: `PolicyCard.vue` is intentionally outside this
   authoring work and retains an independent redesign decision.

## Target Implementation Map

| Target component | Current state | Current source |
| --- | --- | --- |
| `DestinationContextCard` | Implemented | `DestinationContextCard.vue` |
| `ObservedProfileSummary` | Implemented | `ObservedProfileSummary.vue` |
| `IntentSignalPicker` | Implemented | `IntentSignalPicker.vue` |
| `IntentSignalChipList` | Implemented | `IntentSignalChipList.vue` |
| `HardLimitControl` | Implemented | `HardLimitControl.vue` |
| `AvoidControl` | Split required | `PolicyIntentConstraintControlSurface.vue` |
| `ReviewTriggerControl` | Split required | `PolicyIntentConstraintControlSurface.vue` |
| `ReadinessNextActionCard` | Implemented | `ReadinessNextActionCard.vue` |
| `StarterTemplateSuggestion` | Optional and deferred | Server-projected evidence only |

`PolicyBuilderLibraryContext.vue` remains a temporary destination-context
duplicate. It is explicitly marked for replacement rather than being treated as
a second target component.

## Recommendations

1. Keep `IntentSignalPicker` responsible for option grouping, selection, and
   typed add plans; `IntentSignalChipList` now owns only declared-signal display
   and remove-plan emission through explicit props and events.
2. Keep `HardLimitControl` responsible for its blocking explanation, canonical
   select, explicit confirmation, staged-value display, and typed local-plan
   emission. Extract `AvoidControl` and `ReviewTriggerControl` next while
   retaining the existing server-owned decision and eligibility projections.
3. Do not add a `StarterTemplateSuggestion` component until a server projection
   can improve native setup without presenting templates as the primary mental
   model. Its absence is intentional, not a missing fallback.
4. Delete or contain compatibility-only controls rather than reusing them in
   native work. Their legacy source/provenance and bridge semantics conflict
   with destination-first intent authoring.

## Pros And Cons

### Source-Backed Inventory

Pros:

- New policy components fail the focused audit until their product ownership is
  explicit.
- Replacement decisions are executable and cannot be hidden in roadmap prose.
- The target implementation map distinguishes finished components from inline
  or combined implementations.

Cons:

- The inventory must be updated alongside every policy-component add, move, or
  delete.
- It intentionally adds a small server-side test contract even though it has no
  runtime request path.

### Completed Primitive Extractions

Pros:

- Isolates a single visible behavior with a bounded typed-command interface.
- Reduces `IntentSignalPicker` complexity without changing server projections,
  persistence, routing, learning, provider access, or quotas.
- The hard-limit control now fails closed on invalid server projections and
  keeps explicit confirmation separate from advisory controls.

Cons:

- Avoid and review-warning controls remain composed temporarily.
- Each extracted primitive adds a small explicit props/events interface.

## Final Recommendation Stack

1. Keep the executable component inventory in
   `policyAuthoringComponentInventory.mjs` and scan the actual Vue directory in
   its test.
2. Treat six target components as implemented, two as a later split, and the
   template accelerator as intentionally optional.
3. Treat `IntentSignalChipList` as an implemented primitive. It receives
   declared candidates, exposes complete remove names, and emits only the
   existing typed remove command plan.
4. Treat `HardLimitControl` as an implemented primitive, then extract
   `AvoidControl` followed by `ReviewTriggerControl`, without changing the
   server-owned decision model.
5. Preserve the server-owned option, constraint, readiness, and native-create
   admission boundaries. This inventory adds no routes, policy writes, raw
   payload access, provider calls, media-server calls, quota reads, or secrets.

## Outcome

The component tree now has an executable ownership and replacement map. The
inventory reports `IntentSignalChipList` and `HardLimitControl` as implemented,
records the remaining advisory constraint split, and keeps starter templates
optional and non-primary.

## Next Task

Extract `AvoidControl` from `PolicyIntentConstraintControlSurface` with a
minimal props/events contract. Preserve server-owned value eligibility,
explicit confirmation, advisory semantics, and the current typed
constraint-command boundary.
