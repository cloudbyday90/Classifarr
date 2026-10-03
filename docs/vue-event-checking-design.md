# JavaScript Vue event checking: design

Research date: 2026-10-03. Scope: the eight shared components already enrolled in
strict checking, their event contracts and the existing lint/typecheck workflows.
No dependency upgrade, backend, database, image or release change is proposed.

## Finding and decision

The installed Vue 3.5.43 / vue-tsc 3.3.12 / TypeScript 6.0.3 stack accepts a
number-only handler attached with `@update:model-value` to a string-emitting
Input in a JavaScript SFC. Strict TypeScript and Vue template checking are already
enabled. Explicit camelCase names, a call through `$event`, and object-form v-on
do not close the gap. An ordinary custom `change` event also reproduces it, so
this is not limited to hyphenated model names.

Vue's generated JavaScript attaches a JSDoc type to each v-on handler property.
For the model event, the generated type even contains a quoted member after a
dot (`typeof generatedEmits.'update:modelValue'`). That generated type is invalid;
the mapped CLI diagnostics do not expose it. Do not patch node_modules or claim
that the otherwise-correct exported event declaration proves consumer safety.

Use Vue listener-prop bindings for explicit listeners in the strict-checked
JavaScript component group, for example `:onInput="handleInput"` and
`:on-update:model-value.camel="handleText"`. Local compiler probes reject mismatched
payloads and infer inline callback parameters through this path. Keep handlers,
declared emits, native elements and model semantics intact. This is an application
mitigation, not a fix to upstream v-on code generation. Runtime listener keys
must retain camelCase (`onInput`, `onClick`, `onUpdate:modelValue`). A hyphenated
component listener prop needs `.camel`; without it, the checker accepts the
binding but the runtime does not deliver the event. Chromium delivery assertions
caught that mismatch. Native bindings use exact camelCase directly; the checker
rejects `:on-input` on a native input.

Add the existing Vue ESLint restricted-syntax rule only to the component paths
in `tsconfig.components.json`. Read that list from the configuration rather than
maintaining a duplicate allowlist. Reject v-on shorthand, longhand, object form,
dynamic arguments and modifiers in that bounded scope. Require `.camel` on
hyphenated listener-prop bindings to avoid silent runtime loss. No automatic rewrite:
modifiers and inline statements need deliberate equivalent handlers, not a blind
substitution that could invoke a handler during rendering. Native/browser tests
remain necessary, especially for disabled controls and event ordering.

## Tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Checked listener props in enrolled JS components | Existing Vue API; no package or language migration | Less familiar syntax; scope must be enforced | Use now |
| Migrate consumers to TypeScript | Native typed SFC path | Wider source/linter migration; JS callers still need review | Separate future decision |
| Carry a compiler patch/plugin | Could retain current syntax | Depends on internal code generation; maintenance burden | Reject for this batch |
| Rely on strictTemplates or a passing build | No refactor | Reproduced false-negative checks remain | Reject |

JSDoc `@satisfies` on listener objects also rejects the mismatch. It is useful
when an object is genuinely needed, but is extra indirection for the simple
static listeners in this batch. Type assertions, wildcard Vue modules and
diagnostic suppression are not acceptable substitutes.

## Verification and security

Extend the existing bounded real-compiler runner; keep its shell-free child
process, environment allowlist, timeout, heap/output limits and owned temporary
directory cleanup. Factor test support rather than duplicate that machinery.
Require clean positive cases and exact source-mapped errors for invalid models,
callbacks and native events. Exercise every string/boolean/number control type.
Use real ESLint tests to prove the restriction follows the enrolled paths and
does not pretend to cover unreviewed screens.

Run client lint/typechecks, full client coverage, build and the existing Chromium
control suite. Keep event payload checks distinct from runtime validation:
TypeScript/JSDoc are erased, and Vue emit validators are not authorization gates.
Component event declarations describe the value before Vue's parent model
modifiers; `.number` and `.trim` can transform delivery. Do not claim a general
modifier-aware event type system from these tests. Retain the existing runtime
modifier contracts alongside the new binding checks.
No user content, credentials, live services or API writes belong in these tests.

## Recommendation stack

1. Keep supported Vue tooling, checked explicit listener bindings and regression
   tests in the enrolled component scope.
2. Next modernize PasswordInput and enroll it with the same constraints, including
   visibility-button naming and hint/error associations.
3. Expand strict checking in small groups; review modifiers and model bindings
   before enrolling whole screens.
4. Revisit normal v-on syntax after a supported upstream release passes the
   same negative compiler probes. Do not change dependencies just for a newer number.

## Official sources

- [Vue typing component emits and event handlers](https://vuejs.org/guide/typescript/composition-api)
  supports explicit event contracts and narrowing DOM targets. Our JavaScript
  handlers retain JSDoc and runtime element checks.
- [Vue render functions and listener props](https://vuejs.org/guide/extras/render-function)
  documents `onXxx` listener props and `onUpdate:modelValue`. This mitigation uses
  those same props through [v-bind](https://vuejs.org/api/built-in-directives),
  rather than adding a listener wrapper or replacement event system.
- [The installed language-tools source](https://github.com/vuejs/language-tools/blob/cea069882606d62b31199a75a3013b99d3db7144/packages/language-core/lib/codegen/template/elementEvents.ts)
  generates separate JS/TS paths and the per-property JSDoc. Inspection of its
  emitted virtual code plus the CLI probes supports the diagnosis above; it is
  our finding, not a claimed upstream acknowledgement.
- [Microsoft JSDoc documentation](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
  distinguishes checking annotations from assertions and describes `@satisfies`.
- [Vue ESLint restricted syntax](https://eslint.vuejs.org/rules/no-restricted-syntax.html)
  allows template AST selectors and explanatory messages without a custom plugin.

URLs were discovered through web search and GitHub MCP, then retrieved. Registry
inspection found no newer wanted client dependency. The only latest-major gaps
are TypeScript 7.0.2 (incompatible compiler API for this checker) and Node 26 types
(not the deployed Node 24 target). Keep both existing pins/major lines.

See [the separate outcome](vue-event-checking-outcome.md) for observed results.
