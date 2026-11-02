# Client tooling PR 579 partial local adoption design

Date: 2026-11-02 (America/New_York). Status: assessed subset implemented and verified.
Observed result: [partial adoption outcome](client-tooling-pr-579-outcome.md).

## Selection and bounded recommendation

GitHub MCP found two open PRs, 579 and 580. A uniform PowerShell Get-Random
selection chose [PR 579](https://github.com/cloudbyday90/Classifarr/pull/579),
reviewed at immutable head 5ac143c539229f51ef0fe4f15de2d2519e796620 against base
e30310479f98a984bd446269d6f5ba01226bca23. Current main is
988807e2d915e03ea1cba74cd62bfa6db1d4d058. Both PRs are fresh and mergeable.
Recheck at delivery; an older base alone does not make a branch stale.

Recommend locally adopting the applicable three-package subset with exact pins:

- ESLint 10.13.0 to 10.14.0.
- eslint-plugin-vue 10.11.1 to 10.12.0, replacing its existing caret with an exact pin.
- PostCSS 8.5.31 to 8.5.32.

Retain vue-tsc 3.3.13, TypeScript 6.0.3 and the existing coupled compiler graph.
The selected PR's fourth update, vue-tsc 3.3.14, also changes Vue language-core,
Volar and language-server dependencies. Treat that as a separate compiler batch,
not a transitive requirement of the other three tools. Report partial adoption
explicitly; do not claim the entire provider diff was applied or merge the PR.
Server PR 580 remains independent.

## Compiler evidence and deferral

Official reports #6322 and #6328 describe 3.3.14 regressions involving literal
double-slash template attributes/dot-value narrowing and whole-slot defaults
with imported properties. Both were open/pending triage at review and use the
repository's Vue 3.5.44 / TypeScript 6.0.3 pair. They are upstream reports, not
locally reproduced application failures or verified security vulnerabilities.

Static inspection parsed 270 source SFCs without errors. Twenty literal
double-slash attributes occur across eleven files, including Spinner's SVG
namespace. None of those scripts calls reactive(); that does not prove all
non-Ref bindings are unaffected. All 22 named slot bindings lack parameter
expressions, so the exact reported whole-slot-default pattern was not found.
The reason to defer is preserving typechecking authority while compatibility is
unassessed, not claiming that the current application is broken by the candidate.

Before a future coupled compiler update, extend the existing bounded real-CLI
fixtures for URL/non-URL model bindings, whole-slot defaults/imported properties
and an unrelated deliberate semantic-error sentinel. Invalid generated syntax
must not hide that sentinel. Keep exact source-mapped negative diagnostics and
both enrolled typecheck scopes; do not weaken flags, exclusions or Vue syntax to
make an upgrade pass. No compiler fixture expansion is required in this batch.

## Compatible tools and verification

The ESLint release fixes rule edge cases and dependency minimums. The Vue plugin
release fixes missed/incorrect diagnostics and adds optional rules/options.
PostCSS fixes source-origin/warning formatting and LazyResult.finally Promise
semantics. Keep existing lint rules/severities, browser/Node globals and CSS
configuration. Do not enable new optional rules merely because they exist.

Pinned Node 24.22.1/npm 12.2.1 satisfy the candidate engines; installed TypeScript
stays 6.0.3. Review peers and their optional metadata as well as engines and
published lifecycle scripts. Generate the client lock with scripts disabled,
review every direct/transitive addition/removal/change, preserve existing
overrides and strict script policy, then run npm ci and npm ls --all. Do not
accept unrelated Volar/LSP graph changes or relax peers/install permissions.

Use existing actual ESLint/Vue/TypeScript tooling tests and focused controls for
the installed lint/PostCSS fixes, including legitimate inputs and failures.
Run client lint, both typecheck scopes, fresh coverage, production build and the
production-browser asset/navigation suite. The primary checkpoint change also
requires fresh backend validation; run the ratchet only with both current reports.
Client coverage is read from client/coverage/index.html by the existing ratchet.

The full intake client audit reports eleven moderate affected nodes, zero high
or critical. Include development dependencies and compare advisory identities
after installation; these tooling updates do not automatically discharge the
existing glob/minimatch chains. Preserve scanners and the existing release hold.
The [November 2 npm recheck](dependency-readiness-2026-10-outcome.md#november-2-npm-bundled-parser-recheck)
identifies a pending 12.2.2 release with bundled ip-address 10.7.5; it is not yet
published. Keep the pinned toolchain unchanged in this batch.

## Alternatives and recommendation stack

| Choice | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Exact three-package subset | Adopts assessed lint/CSS improvements while retaining compiler authority | Provider PR is only partially implemented | Recommend |
| Apply all four PR updates now | Full provider diff | Mixes known unassessed compiler regressions and a wider graph | Defer compiler portion |
| Retain every current package | No dependency change | Leaves applicable selected updates unimplemented | Not preferred |
| Relax diagnostics or compiler settings | Makes compatibility failures less visible | Weakens quality protection | Reject |

Final stack: immutable PR review, exact applicable subset, preserved compiler
chain, reviewed lock/strict install, real tooling controls, fresh coverage/build/
browser checks and full audit. Keep the independent
[checkpoint fence](capture-checkpoint-fence-design.md) separately attributable.

## Sources and delivery

Primary sources discovered/read through MCP on November 2, 2026:

- [Selected PR 579](https://github.com/cloudbyday90/Classifarr/pull/579).
- [ESLint 10.14.0 release](https://eslint.org/blog/2026/10/eslint-v10.14.0-released/).
- [Vue lint-plugin maintainer releases](https://github.com/vuejs/eslint-plugin-vue/releases).
- [PostCSS maintainer releases](https://github.com/postcss/postcss/releases).
- [Vue language-tools releases](https://github.com/vuejs/language-tools/releases)
  and upstream reports [6322](https://github.com/vuejs/language-tools/issues/6322)
  / [6328](https://github.com/vuejs/language-tools/issues/6328).

Keep a separate observed outcome and Unreleased notes. Recheck PR freshness,
perform scoped artifact maintenance and staged secret/diff checks, then commit/
push all changes on main. No provider PR merge, release, deployment, schema,
new UI, operator CLI trigger, job, routing or learning change is included.
