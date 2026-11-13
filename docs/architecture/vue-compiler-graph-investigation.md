# Vue compiler graph investigation

November 13, 2026 Eastern. This answers the follow-up about the compiler graph
in open PR 589 during the adopted saved-review work.

## Findings

The candidate's package graph resolves coherently. Exact vue-tsc 3.3.14 requires
the matching Vue language core and Volar TypeScript integration. The earlier
strict candidate installation produced a valid dependency tree. Its failures
occur when the compiler generates virtual TypeScript from valid Vue templates.

The previous differential assessment ran identical real-CLI controls against
both complete installed graphs. Version 3.3.13 passed all twelve controls.
Version 3.3.14 passed seven and failed five. The two ordinary application
typechecks passed both versions. The permanent controls are in
[vueCompilerRegression.test.js](../../client/src/__tests__/vueCompilerRegression.test.js).
The complete original assessment is recorded in the
[compiler outcome](client-compiler-pr-581-outcome.md).

Both defects concern generated template code in `@vue/language-core`.

### URL literals disrupt inference

The published 3.3.14 component generator copies generated props and flattens
them. Its regular expression treats `//` through the end of a line as a comment,
including when those characters occur inside a quoted URL. Replacing that text
with a block comment can produce malformed virtual TypeScript.

The 3.3.14 control-flow change places template code in a separate function.
Upstream report 6322 traces how malformed code inside that function prevents the
assertion narrowing used for template bindings. The source confirms both the
string-unaware replacement and the new template-function boundary. The causal
interaction is supported by the local URL/non-URL differential controls and
the upstream analysis. [Published component generator](https://github.com/vuejs/language-tools/blob/v3.3.14/packages/language-core/lib/codegen/template/element.ts),
[control-flow change](https://github.com/vuejs/language-tools/commit/d31557b1fc551d4fe4c765ec69de63bfa68499a3),
[upstream report 6322](https://github.com/vuejs/language-tools/issues/6322).

Our candidate run reported false TS2339 for a valid reactive model and TS7006
for a valid numeric event parameter. An invalid string operation on that event
also lost its expected numeric-property diagnostic. Companion fixtures with a
literal lacking double slashes passed. These are synthetic compiler-contract
reproductions.

### Slot defaults leave malformed virtual syntax

The slot generator temporarily wraps a slot parameter expression in an arrow
function, generates its interpolation, and removes the wrapper through source
range replacement. Version 3.3.14 adds parameter-default scope processing for
binding reassertion. An imported-property read causes that processing to split
the generated source into segments.

Upstream report 6328 traces a wrapper-removal range spanning multiple segments.
The failed removal leaves arrow-function syntax inside generated array
destructuring. The published slot generator and parameter-default change
corroborate the relevant operations. [Published slot generator](https://github.com/vuejs/language-tools/blob/v3.3.14/packages/language-core/lib/codegen/template/vSlot.ts),
[parameter-default change](https://github.com/vuejs/language-tools/commit/f9c908fbe7996db6150edfcbdace98b476a4ab04),
[upstream report 6328](https://github.com/vuejs/language-tools/issues/6328).

Our candidate run produced TS1005 and TS1181 for a valid whole-slot default
combined with an imported-property read. With an unrelated included TypeScript
assignment error added, those generated syntax errors appeared and the expected
TS2322 disappeared. Inner-destructuring defaults and a whole-slot default
without the property read passed their controls.

## Current upstream and local status

Fresh MCP retrieval on November 13 finds report 6322 open. Report 6328 closed as
completed on November 12. Its retrieved timeline contains the closure event
without a linked fixing commit. The latest published upstream release remains
3.3.14, dated October 29. Closing an issue supplies useful triage state, while
the actual published compiler must pass the regression controls before adoption.
[Report 6322](https://github.com/vuejs/language-tools/issues/6322),
[report 6328 timeline](https://github.com/vuejs/language-tools/issues/6328),
[latest published release](https://github.com/vuejs/language-tools/releases/tag/v3.3.14).

PR 589's eleven reviewed version/integrity pairs match the previously tested
candidate graph. Its head is `c6137f1467319a048e2d6babfe27dc6bb9859ffa`.
The retained current tree has vue-tsc/language-core 3.3.13, Volar TypeScript
2.4.28 and TypeScript 6.0.3. A fresh November 13 execution passes all twelve
permanent real-CLI regression controls on this retained tree. The five candidate
failures above describe the earlier differential execution.
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589).

## Recommendation stack

| Recommendation | Benefit | Cost or limitation |
| --- | --- | --- |
| Retain the complete verified 3.3.13 compiler graph | Preserves the demonstrated diagnostic behavior | Defers improvements in the newer release |
| Keep the twelve exact regression controls | Detects inference loss and missing semantic diagnostics | Adds bounded compiler processes to test execution |
| Assess a coherent fixed published graph | Tests the actual artifact proposed for adoption | Requires another differential run and normal quality gates |

Keep the existing application syntax, type scopes and diagnostic assertions as
the assessment baseline. A future candidate should pass these controls, strict
installation and the normal client gates. Current evidence establishes a
tooling compatibility regression in the synthetic controls. Application impact
requires tracing the affected patterns in enrolled and shipped components.
