# Shared form controls: strict checking and native semantics

Research date: 2026-10-03. Scope: Input, Select, Toggle and Slider. No dependency,
backend, database, deployment or release changes.

## Decision

Enroll the four controls in the existing strict component typecheck. Retain ESM
JavaScript and use JSDoc for DOM events, option shapes and emitted values. Replace
unchecked inline event-target access with small local handlers that narrow the
native element and respect disabled state. Preserve Input/Select string emissions,
Slider numeric emissions and Toggle boolean emissions, including parent-side Vue
model modifiers. Do not replace native controls or change the public model contract.

Inspection also found unassociated visible labels on Select, Toggle and Slider,
and native attributes such as Input's min/max landing on wrapper divs. Introduce
one small composable for current attribute routing and stable IDs: class/style
stay on the layout wrapper; native attributes and listeners reach the actual
control. Read attributes during rendering, not through a cached computed value.
Associate labels and Input errors with their control, preserve caller-supplied
descriptions, and retain externally supplied accessible names for label-free use.
Use the browser's keyboard/disabled behavior rather than implementing it again.

Connect the four existing label-free callers found in AI and Confidence settings
to their visible text. Add the focused Chromium tests to the normal CI workflow;
the synthetic fixture is not a production route and never loads the real API.

## Official research

- [Vue event-handler typing](https://vuejs.org/guide/typescript/composition-api)
  explains why DOM event arguments need types and target narrowing. Use runtime
  element checks instead of `any` or unchecked casts.
- [Vue form bindings](https://vuejs.org/guide/essentials/forms) distinguish text,
  selection and numeric bindings. Do not silently change existing emitted types
  or IME behavior by introducing a new internal v-model implementation.
- [Vue fallthrough attributes](https://vuejs.org/guide/components/attrs.html)
  documents explicit routing with `inheritAttrs: false`. `useAttrs()` reflects
  current values but is not reactive, so take a fresh projection each render.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) recommends
  programmatic label associations, including visible labels where practical.
- [W3C switch pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/) requires an
  accessible name and accurate checked state. Keep the existing native button
  with switch semantics and its native keyboard behavior.
- [W3C ARIA21](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA21.html) connects
  validation feedback to controls through invalid state and error descriptions.

These official URLs were discovered through web search and retrieved. Findings
are current on the research date; these changes are not a WCAG conformance audit.

## Alternatives and tradeoffs

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| JSDoc + strict checking + native controls | Small migration, retains browser behavior | Requires accurate prop/event contracts | Recommended |
| Type assertions or relaxed checking | Less immediate editing | Hides null/wrong-target and option-shape errors | Reject |
| Rewrite controls with a new component library | Larger feature set | New dependency and changed model/style contracts | Not needed |
| Forward all attributes to the control | Simple implementation | Moves layout classes/style unexpectedly | Keep layout attributes on wrapper |

The routing correction means custom IDs, native listeners and constraints now
refer to the control rather than its wrapper. Review current callers and test
attribute updates/removal, labels and disabled behavior. Caller-provided IDs must
still be unique. Unlabelled callers must provide an accessible name; the control
cannot invent one from application meaning. Form validation remains a UX aid,
not a replacement for backend validation or authorization.

## Verification

1. Establish the existing typecheck baseline, then enroll the four controls to
   expose their actual errors without weakening compiler settings.
2. Add regression tests for native label/attribute/error associations, typed
   emissions, numeric/trim model modifiers, disabled controls and dynamic updates.
3. Extend real-compiler contracts with valid controls and invalid options/models.
4. Exercise actual components in Chromium for labels, keyboard operation, native
   validity and no unintended form submission. Use synthetic local data only.
5. Run client lint/typechecks, the full client coverage suite, production build,
   documentation and staged-secret checks. No stale combined coverage claim.

### Compiler boundary

The installed Vue checker rejects invalid option shapes, model props and an
incorrect public `$emit` payload in a typed consumer. A separate exploratory
JavaScript-template probe accepted a string-emitting Input connected to a
number-annotated callback, however. Exported declarations retain the string
payload; that does not establish end-to-end JavaScript template callback safety.
Keep browser and runtime model tests, and investigate this consumer-checking gap
before expanding claims of event-type coverage. No compiler setting is relaxed
to accommodate it, and no passing test is presented as proof of that missing check.

Observed callback probe under the same strict component configuration (accepted
with exit code zero):

```vue
<script setup>
import Input from '@/components/common/Input.vue'
/** @param {number} value */
function acceptNumber(value) { return value.toFixed(0) }
</script>
<template><Input @update:model-value="acceptNumber" /></template>
```

The invalid-public-emit fixture uses a TypeScript consumer to test the generated
component contract, not to imply that this JavaScript callback is checked.

## Recommendation stack

1. Typed, correctly labelled native shared controls and executable contracts.
2. Next resolve the JavaScript template event-checking boundary with a minimal
   reproduction and a tested supported configuration; do not bypass diagnostics.
3. Enroll PasswordInput and remaining common controls, including password
   visibility-button naming and consistent hint/error descriptions.
4. Audit label-free call sites and expand strict checking through actual screens
   in small batches, without claiming this control batch checks every caller.
5. Keep the supported Vue/TypeScript versions until upstream API support changes.

See [the separate outcome](shared-form-controls-outcome.md) for observed results.
