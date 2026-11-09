# Vue PR 583 assessment design

Research: November 9, 2026 Eastern. Baseline main 76599f4de. Status: implemented
and assessed; see the separate outcome for remaining browser debt. No release,
deployment or PR merge.

## Immutable selection and proposed boundary

MCP returned three open PRs: 587, 585 and 583. Uniform node:crypto.randomInt
selection at 2026-11-09T15:05:43.355Z chose
[PR 583](https://github.com/cloudbyday90/Classifarr/pull/583), immutable head
fecda340470aa7224839e421ba9e1b60ab520461 against 44cf88e51. The comparison changes
only client package.json/lock. Conditionally adopt an exact Vue 3.5.45 pin and its
coherent published graph; do not copy a partial compiler/runtime mix.

Ten core packages move together from 3.5.44 to 3.5.45: vue and @vue/compiler-core,
compiler-dom, compiler-sfc, compiler-ssr, runtime-core, runtime-dom, server-renderer,
reactivity and shared. The assessed lock also changes Babel parser 7.29.13,
types 7.29.11 and helper-string-parser 7.29.13. All thirteen integrity values match
registry metadata. No install hooks are introduced; current peers admit the patch.
Review the actual generated graph before any strict install.

Retain vue-tsc/language-core 3.3.13 and TypeScript 6.0.3. Language-core's compatible
compiler-dom/shared range consumes the new core, so unchanged language-tooling
version strings do not replace real compiler testing. Preserve every override,
Vite/Vitest, jsdom, Tailwind, application syntax, type/lint scope and test limit.
The known vue-tsc 3.3.14 deferral remains separate. Vue does not require npm 12.2.2;
verify under the independently agreed toolchain without conflating the batches.

## Actual evidence and relevant application paths

The [November 5 release](https://github.com/vuejs/core/releases/tag/v3.5.45) includes
compiler, effect-scope, directives, Suspense/async, transition and KeepAlive fixes.
It is not a behavior-free version bump. Read-only probes on installed 3.5.44 show:

| Real control | Baseline behavior | Required candidate behavior |
| --- | --- | --- |
| onScopeDispose after active scope was stopped | Callback is lost | Dispose callback executes |
| Compiled static :disabled=0 / :checked=!1 | Attributes remain true; Save cannot fire | False booleans and enabled Save |
| Catch/switch local shadowing of destructured prop | Reads the prop | Reads the lexical local |
| SSR style/attributes/escaped text | Correct | Preserve ordinary result |

These are library/compiled-fixture defects, not demonstrated Classifarr incidents.
The app uses createApp, not SSR/hydration. It does use disposal-based composables,
lazy components, tooltip directives, Teleport and transitions. Add bounded genuine
runtime controls for late async settlement after unmount and latest directive
binding; prioritize existing modal/tooltip/form browser behavior. Do not enable
SSR or introduce application UI changes to test the update.

## Upstream reports and limits

The open [named expression report](https://github.com/vuejs/core/issues/16186)
also reproduces on installed 3.5.44; it is existing debt, not a demonstrated update
regression. Keep that probe private rather than adding a permanent assertion that
requires incorrect behavior to persist. Open
[source-map](https://github.com/vuejs/core/issues/16201) and
[dynamic mouse modifier](https://github.com/vuejs/core/issues/16182) reports are
reports, not evidence of an affected application path. Other examined reactivity
reports explicitly concern 3.6 and identify 3.5.45 as unaffected/working.

Do not claim the patch fixes every compiler issue or that a passing suite proves
absence of regression. Retain 3.5.44 if candidate controls or normal gates fail;
do not change app syntax, expected negative diagnostics or compiler mixtures to
make the candidate pass.

## Verification and delivery

Freeze the demonstrated old failures and retain positive controls. Use actual
compiler/runtime modules, bounded DOM/child fixtures and existing browser runners.
Re-run real vueCompilerRegression, vueTypecheckContract and vueEventTypecheckContract
controls, including precise negative diagnostics, URL/model/event inference,
imported properties and slot defaults.

Review script-disabled lock generation, peers/engines/sources/integrities and all
coupled changes. Strict clean install, complete tree and development-inclusive
audit must preserve policy. Run fresh full client coverage, lint/typecheck, build,
production-browser and shared-control checks, plus affected backend/dependency
gates. The npm batch independently requires fresh backend verification. Do not
reuse the older client coverage against a changed Vue graph.

Apply scoped artifact maintenance and keep current reports, recovery assets,
toolchains, worktrees and other projects. Update separate outcome/Unreleased,
commit/push all agreed changes on main and inspect the exact-source CI receipts.
Leave PRs unmerged; rebase only genuinely stale applicable branches. Add no page,
endpoint, schema, job, operator CLI trigger, routing/learning change or deployment.

## Options and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Assess exact 3.5.45 coherent graph | Fixes reproduced compiler/runtime defects | Thirteen lock entries and async behavior need real proof | Conditional local adoption |
| Keep 3.5.44 | No graph drift | Retains reproduced defects | Fallback if gates fail |
| Mix compilers or alter app syntax to pass | Can hide a local failure | Unsupported graph and weakened attribution | Reject |
| Combine language-tooling/DOM/Tailwind majors | More updates at once | Loses a stable comparison and prior deferrals | Separate batches |

Qualify npm's security remediation first; assess this independent Vue patch with
its own controls; then return to the separate Node runtime and category-neutral
prompt-projection priorities. The UI stays uncluttered and operator workflows
remain automatic/directly available in the existing application.

## Official sources

Retrieved through MCP on November 9:

- [Tagged changelog](https://github.com/vuejs/core/blob/v3.5.45/CHANGELOG.md),
  [disposal fix](https://github.com/vuejs/core/commit/21dd33c61c6e26d15c1893dad899f1187a77dc03),
  [boolean binding fix](https://github.com/vuejs/core/commit/05db7e807be841e6f343d0237669669b18c89d4d)
  and [lexical scope fix](https://github.com/vuejs/core/commit/0f20152855296b7e588cc92c8f078ad35a3b536e)
  explain the concrete before/after controls.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/) supports clear
  instructions/status text. Existing browser controls preserve form semantics;
  this dependency assessment creates no new WCAG conformance claim.
