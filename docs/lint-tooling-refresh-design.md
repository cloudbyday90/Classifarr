# Lint tooling and Node typings refresh

Research date: 2026-10-03. Follow-up to the backend runtime refresh. This batch
changes development tooling, not the running Node version, database, deployment
templates or application behavior. Work stays on `main`; no release is authorized.

## Decision

| Package | Current | Selected | Scope |
| --- | --- | --- | --- |
| ESLint | 10.11.0 | 10.12.0 | Client and server |
| globals | 17.12.0 | 17.13.0 | Client and server |
| eslint-plugin-n | 18.3.0 | 18.4.1 | Server |
| eslint-plugin-security | 4.0.1 | 4.2.0 | Server |
| @types/node | 26.6.2 | 24.19.1 | Client and server |

Keep the existing caret-range convention and exact lockfile resolutions. Node
24.21.0 remains the runtime. The latest published Node 24 declarations are
24.19.1; declarations can lag runtime releases and their patch numbers are
independent. Do not select Node 26 declarations solely because npm calls them
latest. Keep `@eslint/js` 10.0.1 and `eslint-plugin-vue` 10.11.1, already current
and compatible with ESLint 10. Keep TypeScript, Knip, Supertest and Testcontainers
out of this batch.

## Options and tradeoffs

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Update compatible linters and align Node types | Current analysis fixes, fewer unsupported-API assumptions | Rules and type errors need review | Do now |
| Keep Node 26 declarations | No declaration changes | Can suggest APIs beyond the deployed runtime | Reject |
| Update all tools and enable every recommended rule | Broad coverage | Unrelated migrations and noisy findings obscure regressions | Split into later batches |
| Enable the new invisible-character rule in existing server security scope | Detects two hidden source characters alongside existing bidi protection | Intentional literal placeholders must be made explicit | Do now with regressions |

## Official sources and application

URLs below were discovered with GitHub MCP and web search; candidate metadata,
engines, peers and lifecycle scripts were checked in the npm registry.

- [ESLint 10.12.0](https://github.com/eslint/eslint/releases/tag/v10.12.0)
  contains rule-correctness fixes and config-global caching. Retain flat ESM
  configs and verify actual configured behavior, not only successful imports.
- [Node plugin 18.4.0](https://github.com/eslint-community/eslint-plugin-n/releases/tag/v18.4.0)
  adds pnpm workspace support; [18.4.1](https://github.com/eslint-community/eslint-plugin-n/releases/tag/v18.4.1)
  fixes rule handling and improves resolver reuse. This repository uses npm;
  verify its existing import and Node compatibility rules without adopting pnpm.
- [Node plugin guidance](https://github.com/eslint-community/eslint-plugin-n)
  recommends declaring runtime support through package engines. Keep the existing
  Node 24 engine bounds and unsupported-feature checks.
- [Security plugin 4.1.0](https://github.com/eslint-community/eslint-plugin-security/releases/tag/eslint-plugin-security-v4.1.0)
  adds invisible-character detection and fixes line-terminator handling;
  [4.2.0](https://github.com/eslint-community/eslint-plugin-security/releases/tag/eslint-plugin-security-v4.2.0)
  adds TypeScript declarations.
- [Invisible-character rule](https://github.com/eslint-community/eslint-plugin-security/blob/d1ba1cd7365925dd01606a22e4d9bcdcf7f1d8fd/docs/rules/detect-invisible-characters.md)
  detects literal U+3164 and U+FFA0, not all Unicode confusables. Visible escape
  sequences remain allowed. Do not strip international text or rewrite media
  metadata; this is a source-review check, not input sanitization.
- [globals 17.13.0](https://github.com/sindresorhus/globals/releases/tag/v17.13.0)
  refreshes environment definitions. Preserve the browser, Node and test scopes.
- [DefinitelyTyped version policy](https://github.com/DefinitelyTyped/DefinitelyTyped)
  explains declaration version alignment and independent patch releases. Add
  a lockfile/manifest check so Node typings cannot silently jump runtime majors.

All selected versions support the pinned runtime. None adds an install hook;
upstream development `prepare` scripts are not permission to enable lifecycle
scripts. Inspect the generated lockfiles and retain strict install decisions and
security overrides. Any unexpected transitive change requires review.

## W3C applicability

[W3C's conformance guidance](https://www.w3.org/WAI/WCAG22/Understanding/conformance)
requires both automated and human evaluation. ESLint/Vue rule success cannot
prove WCAG conformance. [ARIA authoring guidance](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)
also explains that adding a role does not supply keyboard behavior.

Preserve native HTML and existing Vue component/directive checks in this batch;
exercise a native-button template and rejection of undefined components. Do not
add ARIA, change focus behavior or introduce an accessibility plugin solely to
expand this dependency update. A separate UI review should test keyboard access,
visible focus, control names, live status announcements and contrast across full
workflows, using automated checks plus manual assistive-technology testing.

## Validation and rollback

Use regression tests against the actual ESM lint configurations. Cover Node
imports, unsafe dynamic evaluation, invisible/bidi characters, readable Unicode
escapes, test-only focus guards and client component resolution. Extend the
existing toolchain-policy tests instead of adding another updater service.

The Node 24 declarations require query entries to be two-element tuples. Add an
explicit JSDoc tuple type to the existing HTTP helper, retaining its serialization
behavior and testing nullish omission, false/zero/empty values and URL encoding.
Do not use `any`, suppress the error or widen the typecheck exclusions.

ESLint also powers the offline ingestion-writer inventory. Before updating its
reviewed parser version, compare every existing source and analysis digest and
run the scanner regressions. Change only the parser version if all reviewed
entries still match; do not regenerate reviews, reclassify unresolved writers or
change the gate's `productionCompatible: false` result.

Generate lockfiles with scripts disabled, inspect each diff, then perform clean
strict-policy installs. Run dependency trees, npm audits including development
packages, OSV, full lint/typecheck, Knip and tooling regressions. Run the client
test suite and build to check tooling integration. The HTTP change only makes
the existing tuple shape explicit; no database driver, request behavior or
deployment change warrants a production-image rollout in this batch. Record
any unperformed checks and existing CI failures separately.

Rollback is a reviewed revert of manifests, lockfiles, the new rule and associated
tests together. Never lower security rules, coverage floors or install policy to
make an update pass. See [the outcome](lint-tooling-refresh-outcome.md).

## Recommended next stack

1. Inspect this batch's CI and reproduce the starting commit's interrupted-restore
   installation failure in isolation before proceeding with more updates.
2. Review Testcontainers, Supertest and Knip in a separate tooling batch.
3. Migrate the Vue client to TypeScript 7 separately.
4. Perform a bounded keyboard/screen-reader review of the primary user workflows;
   make only evidence-backed UI changes, without claiming an automated WCAG pass.
