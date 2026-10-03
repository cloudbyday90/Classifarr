# Vue TypeScript compatibility design

Research date: 2026-10-03. Scope: frontend compiler compatibility and executable
typechecking contracts. No runtime behavior, database, image or release changes.

## Decision

Keep the client on TypeScript **6.0.3**, pin that reviewed version explicitly, and
retain vue-tsc **3.3.12**. Root/server TypeScript **7.0.2** stays unchanged. Remove
the client's blanket `ignoreDeprecations` setting only if its existing check
passes without it. Test the installed compiler against positive and negative Vue
fixtures instead of treating a successful Vite build as proof of type safety.

The original `client/tsconfig.json` deliberately included API JavaScript and
configuration files, but no application `.vue` files. In response to the requested
modernization, separate shared settings into `tsconfig.base.json`, retaining the
existing API/configuration entry point and its non-strict scope. Add
`tsconfig.components.json` with strict TypeScript and Vue-template checks for
Badge, Button, Card and Spinner. `npm run typecheck` runs both projects, including
in the existing CI step. Do not expand to the entire UI in one unreviewed change.

Keep the new component scope free of the legacy wildcard `.vue` declaration and
Node ambient types. Shared settings default to strict; the legacy API project
explicitly retains its previous non-strict setting. Document Badge's existing
open-string style lookup with JSDoc rather than silencing its implicit-any error
or restricting accepted values. Preserve the default fallback and runtime props.

## Official sources

- [Microsoft's TypeScript 7 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
  states that 7.0 does not ship a compiler API. Vue/Volar still needs TypeScript 6.
  Microsoft offers the `@typescript/typescript6` compatibility package and an npm
  alias for tools needing the old API. A broad peer range alone does not prove
  native-compiler compatibility.
- [Vue's TypeScript guide](https://vuejs.org/guide/typescript/overview) separates
  Vite transpilation from `vue-tsc` checks and recommends the latter for Vue SFCs.
- [Vue 3.5.43](https://github.com/vuejs/core/releases/tag/v3.5.43) is the current
  stable runtime already installed here. Vue 3.6.0-rc.10 is a prerelease, not a
  solution to the missing compiler API. The latest stable
  [language tools 3.3.12](https://github.com/vuejs/language-tools/releases/tag/v3.3.12)
  are also already installed; a newer stable Vue package cannot solve this now.
- [vue-tsc's exact source](https://github.com/vuejs/language-tools/blob/cea069882606d62b31199a75a3013b99d3db7144/packages/tsc/index.ts)
  resolves `typescript/lib/tsc`, with explicit support for Microsoft's compatibility
  alias. Its [README](https://github.com/vuejs/language-tools/blob/cea069882606d62b31199a75a3013b99d3db7144/packages/tsc/README.md)
  describes Vue virtual-file checking and the command-line interface.

URLs were discovered through web search, registry repository metadata and GitHub
MCP file responses, then retrieved. Registry inspection found TypeScript 7.0.2,
vue-tsc 3.3.12 and `@typescript/typescript6` 6.0.2. The compatibility package adds
`@typescript/old`, an alias for `typescript@^6`, not a separately published package.
Keeping direct TypeScript 6.0.3 avoids an unnecessary wrapper and preserves the
existing API and CLI. Reassess when the upstream API and Vue support are available.

## Tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Pin TS 6 and test Vue diagnostics | Supported API, minimal dependency change | Client does not gain native TS 7 performance | Recommended now |
| Official TS 6 compatibility alias | Supported bridge when two compiler generations are needed | Extra wrapper/alias without a current client use case | Reserve for a demonstrated need |
| Replace client TS 6 with TS 7 | New native compiler | Missing API breaks the current Vue checker | Reject for this batch |
| Rely on Vite or skip failing checks | Faster apparent migration | Can silently lose type-error detection | Reject |

## Implementation and security

Add one ESM contract suite to the existing client Vitest discovery path. Run the
installed `vue-tsc` CLI using the current Node executable, not npx or a shell.
Fixtures extend the strict component compiler settings and exercise JavaScript/JSDoc
SFC scripts, template expressions, imports and cross-component props. Require a
clean positive result and file-specific TypeScript diagnostics for negative cases;
compiler startup failures must not count as successful rejection tests.

Run cases sequentially with bounded time/output and a sanitized environment.
Use unique ignored scratch directories under the client so dependency resolution
matches the application. Clean up only the directory owned by each test. No
network access, install scripts, live data, external providers or new dependency
are required by the tests. Keep lifecycle policy, Node 24 typings, security
overrides and normal diagnostic checks intact.

## Verification

1. Establish the current typecheck baseline and current open-PR availability.
2. Generate the reviewed pin-only lockfile with scripts disabled; verify that no
   resolved package, integrity, lifecycle or override changes slipped in.
3. Run the new positive/negative compiler suite and prove it detects disabled
   checking using a temporary, restored configuration mutation.
4. Clean install under strict policy; run dependency-tree validation, npm audit
   including development dependencies, client lint/typecheck/coverage/build and
   repository dependency-policy tests. Run OSV independently on all lockfiles.
5. Document actual results, including scope limits. Do not combine old backend
   coverage with fresh client coverage to claim a new combined coverage ratchet.

## Recommendation stack

1. Keep a supported compiler and executable diagnostic contracts in CI.
2. Expand real UI component typechecking in small, reviewed groups; fix their
   types rather than suppressing errors or claiming fixtures cover the UI.
3. Reassess TS 7 only after a released API and compatible Vue tooling exist.
4. Continue separate dependency batches with exact metadata and lockfile review.

See [the outcome](vue-typescript-compatibility-outcome.md) for observed results.
