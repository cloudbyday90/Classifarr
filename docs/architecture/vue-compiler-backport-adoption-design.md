# Vue compiler backport adoption design

November 13, 2026 (America/New_York). Agreed conditional assessment. Baseline: main
`2a626e5b0bf6d9311a52b7425955b33097ab4271`.
Observed result: [adoption outcome](vue-compiler-backport-adoption-outcome.md).

## Goal and current facts

Provide a concrete adoption route for open
[PR 589](https://github.com/cloudbyday90/Classifarr/pull/589), rather than repeating
the unchanged compiler deferral. Its immutable head is
`c6137f1467319a048e2d6babfe27dc6bb9859ffa`. Earlier random selection and the
complete original differential execution are documented in the
[compiler outcome](client-compiler-pr-581-outcome.md).

The eleven-artifact 3.3.14 graph is coherent and installs successfully. Its
generated TypeScript failed five of twelve exact controls; 3.3.13 passed all
twelve. Ordinary project typechecks passed both versions. Current upstream
findings and their limits are in the separate
[backport investigation](vue-compiler-backport-investigation.md).

## Candidate and patch content

Assess exact vue-tsc/language-core 3.3.14 with its coherent published compiler
graph, retaining TypeScript 6.0.3, Vue 3.5.45 and all unrelated dependencies,
overrides, script decisions and type scopes. Do not combine old compiler pieces
with new ones or modify application syntax to hide failures.

Backport the merged slot fix from upstream commit
`31e5f342f9b505056e807b97c478c366df9d2eee`. For the URL issue, first assess
unmerged PR 6241 at exact head
`4d3309d61b1c8b62f9a44d2261862f82e4383cbc`. Add real-CLI nested-template and
regex-literal controls: a memory-only parser probe found that its regex still
corrupts those valid forms. If confirmed, assess the agreed small parser-aware
replacement that identifies actual line comments using the existing TypeScript
API. Mark that portion explicitly as a local fix, with upstream ancestry and
preserved MIT notices. Keep the one-line inference-only diagnostic behavior.

The reviewed original 3.3.14 tarball has these SHA256 file hashes:

- `lib/codegen/template/element.js`:
  `a566368ba51ee193dfe9ce947635be05bb85bf6216463be85a1b974f0c78037f`
- `lib/codegen/template/vSlot.js`:
  `07b0722f75f46852591c22e93611cd4944aaa6c77769982414cf504ed079b7c8`

## Automatic installation and retirement

Use pinned npm 12.2.2's native `patchedDependencies` support in the independent
client project, with a checked-in unified diff and lockfile patch hash. It applies
during installation, including with scripts disabled, so no custom postinstall,
additional patch package, fork or operator action is needed. This requires
client lockfile format 4; root/server locks remain unchanged. Copy patch files
into the frontend Docker builder before its existing `npm ci` step.

Keep strict dependency-script restrictions and patch failures fatal. Never use
unused-patch or ignore-failure relaxations. Verify manifest/lock/artifact/patch
agreement and exact installed patched hashes, including automatic reinstallation.
The registry integrity authenticates the original artifact; the separately
reviewed patch and its lock hash describe the derivative. Do not represent that
derivative as an unmodified published upstream package.

Remove the patch, its manifest/lock metadata and Docker copy dependency when a
coherent fixed published release passes the same regression and quality gates.
An upstream issue closure alone does not establish that retirement condition.
[npm patch](https://docs.npmjs.com/cli/v12/commands/npm-patch/).

## Conditional acceptance

Run baseline, unpatched and patched real-CLI comparisons with the same fixtures
and exact source-mapped diagnostics. Preserve the twelve existing controls,
semantic-error sentinel, no-shell execution and resource/output deadlines. Add
upstream slot fallback variants, real comments containing quotes or block-comment
terminators, strings/block comments, nested templates/interpolations, regex
literals and valid inference plus deliberately invalid prop/event operations.
Syntax errors, implicit-any degradation and missing semantic diagnostics fail.

Exercise real npm strict installs, the valid complete dependency tree, repeated
patch application and fatal missing/hash-mismatch/inapplicable/unused patch
controls in owned disposable fixtures. Check actual Docker frontend installation
and build behavior, without publication or deployment. Review all compiler graph
changes, engines, peers, lifecycle hooks and lockfile-format consumers.

Adopt only if these controls, full audits, installer policy tests, fresh client
coverage, lint/typechecks, production build/browser and affected backend/quality
gates pass. Otherwise restore the complete 3.3.13 tree and document the precise
remaining failure and next fix, rather than claiming implementation succeeded.
Do not suppress diagnostics, weaken assertions, expand script permissions or
change application type scopes. Update the separate outcome and Unreleased,
perform scoped maintenance, commit/push on main and inspect CI. Leave PRs
unmerged; rebase only genuinely stale applicable branches. No release/deployment.

## Options and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Wait for a fixed published release | Lowest local maintenance | No current published fixed candidate; adoption remains delayed |
| Adopt unpatched 3.3.14 | Simple dependency change | Demonstrated loss of diagnostic correctness |
| Native patch with merged slot fix and tested comment handling | Concrete reproducible adoption route using existing npm | Temporary local compiler responsibility; unmerged/local code needs full review |
| Fork or custom installer | Flexible delivery | Additional publication/installer maintenance without an established need |

Recommend the bounded native-patch assessment. The stack is immutable upstream
sources, exact coherent graph, small attributable patch, fatal native install
checks, real semantic regression controls, full client/build evidence and an
explicit retirement condition. The patch is development tooling; it grants no
application routing or learning authority.
