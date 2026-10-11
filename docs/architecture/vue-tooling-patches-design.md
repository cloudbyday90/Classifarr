# Vue tooling patch design

Research date: 2026-10-11. Scope: the next tooling batch after reviewed cross-media
mapping support. Main only; no release, runtime-major upgrade or identity approval.

## Decision and evidence

Update the client Vue build plugin from 6.0.9 to **6.0.10** and vue-tsc from 3.3.12
to **3.3.13**, using exact manifest versions and reviewed lockfiles. Keep Vue
3.5.43, Vite 8.3.4, client TypeScript 6.0.3, Node 24.21.0 and npm 12.2.0 unchanged.
The previous development commit's
[CI run](https://github.com/cloudbyday90/Classifarr/actions/runs/38168239018)
and its six reported workflows completed successfully. That is baseline evidence,
not a substitute for testing this update.

Official sources discovered through MCP search, retrieved through MCP, and checked
against exact npm registry metadata:

- [Vue plugin changelog](https://github.com/vitejs/vite-plugin-vue/blob/main/packages/plugin-vue/CHANGELOG.md):
  6.0.10 repairs transformed normal-script compilation and AST reuse checks. Its
  broader Vue prerelease support is not a reason to adopt a prerelease here.
- [Vue language-tools changelog](https://github.com/vuejs/language-tools/blob/master/CHANGELOG.md):
  3.3.13 changes setup-macro generation to avoid static imports. The VS Code hook
  fix is not a claimed application-runtime improvement.
  The [exact upstream change](https://github.com/vuejs/language-tools/commit/85f665e9397b028c48d3ddd6ecd9a46e3fadeb94)
  moves macro declarations before setup code. Extend the existing ESM compiler
  contract with import-free macro acceptance and a source-mapped invalid-prop
  rejection, using the existing bounded fixture runner.
- [Vue TypeScript compatibility design](../vue-typescript-compatibility-design.md):
  retain the existing compiler API boundary and positive/negative diagnostic tests.
  A successful production build does not prove typechecking works.
- [Vue's TypeScript guide](https://vuejs.org/guide/typescript/overview), retrieved
  again for this batch, distinguishes Vite transpilation from the separate
  `vue-tsc` checks required for single-file components.

Registry metadata declares the plugin compatible with Node `^20.19.0 || >=22.12.0`,
Vue `^3.2.25 || ^3.6.0-rc.10` and Vite 5 through 8. Its only direct dependency is
`@rolldown/pluginutils`, already overridden to 1.0.1. vue-tsc requires TypeScript
`>=5.0.0` and exactly language-core 3.3.13 and Volar TypeScript 2.4.28. Broad peer
ranges do not override our tested compiler-API constraints. Neither candidate
declares an install lifecycle script. Review transitive changes before installation.

## Tradeoffs and recommendation stack

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Two compatible Vue-tooling patches | Receives upstream compiler fixes with a small lock diff | Compiler output and diagnostics still require testing | Adopt if gates pass |
| Keep all tooling unchanged | No new compiler regression exposure | Defers verified upstream fixes | Fallback if validation fails |
| Combine Node, TypeScript, router and browser-tool majors/minors | Fewer update sessions | Makes failures difficult to attribute; incompatible compiler APIs remain possible | Defer to separate batches |
| Disable diagnostics or change runtime guards | Makes an incompatible install appear green | Conceals unsupported APIs | Reject |

1. Keep runtime, type declarations and compiler API aligned.
2. Install the two patches under the existing strict lifecycle policy and validate
   real component checking, compiler rejection fixtures and production browser assets.
3. Next assess the Playwright update separately, including its browser binaries.
4. Continue media identity work only with actual episode verification; preserve
   unresolved states, explicit consent, TV/movie separation and memory safeguards.

## Random PR trial

Fresh open enumeration contained #555 and #556. PowerShell `Get-Random` selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. The diff changes server `@types/node`
24.19.2 to 26.6.4 and `undici-types` 7.24.6 to 8.9.0. Apply this exact proposal
locally, independently of the client patches; run install/tree/audit, server
typechecking and the existing runtime/declaration guard. Restore it if the guard
rejects Node 26 declarations for the deployed Node 24 runtime. Do not merge the PR,
upgrade the runtime to accommodate it or silently weaken that guard.

## Verification and safety

Use existing ESM runners rather than adding a parallel test harness. Generate
lockfiles with lifecycle scripts disabled for initial review, then run normal
`npm ci` under strict policy. Check every changed package, integrity, peer,
platform and installer. No API, database schema, recovery scheduler, migration,
provider write or new background work is required.

Run client lint, both typecheck scopes, compiler fixtures, full client coverage,
production build and production-policy browser smoke; run dependency-policy tests
after restoring the PR trial. Do not combine current client coverage with a stale
server report to claim a fresh combined ratchet. Run large suites serially because
the previous local attempt encountered host resource pressure; keep test deadlines
and assertions unchanged and report failures rather than calling them passes.

After validation, commit the implementation to identify its exact source, preserve
a local database backup and rollback image, then perform the requested no-cache
Compose build and local-only replacement. Generate the schema snapshot using that
exact image with the existing isolated fresh-database runner. Verify health,
isolation, image revision, unresolved counts and temporary-resource cleanup.
Unraid, Plex and shared Ollama stay unchanged. Record actual outcomes separately.

## Validation-driven scheduling correction

The first complete run passed 6,880 tests but timed out the unchanged CSRF static
source scan at 8.23 seconds against its 5-second deadline. The previous development
cycle reported the same test timing out before these dependency updates. A private
read-only timing probe traversed the same 584 source files in about 101 ms (74 ms
reads, 7 ms combined regex evaluation). That does not reproduce the full runner's
overhead or identify its OS-level cause; it argues against changing the checks or
raising their deadline based on an intrinsically expensive scan.

Put the CSRF scan in the existing sequential `lint-contracts` project before the
parallel UI/compiler workload. This is a static source contract, not a DOM test.
[Vitest's sequence documentation](https://main.vitest.dev/config/sequence) and
[project scheduling recipe](https://main.vitest.dev/guide/recipes/parallel-sequential.html)
explain that `fileParallelism: false` alone does not separate projects: group order
is needed as well. Keep the established order 1/2 and all existing isolation,
timeouts, source discovery and assertions. Extend the resolved-config regression
to require the scan in the sequential group exactly once; prove it fails before
the configuration edit. Then rerun full coverage. This removes unnecessary
within-run competition, not a claim to eliminate every possible host scheduling
delay. The tradeoff is one additional short serial static check before UI tests.
