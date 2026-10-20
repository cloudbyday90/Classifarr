# Server ESLint 10.13 — design

On 2026-10-20, GitHub MCP listed only open PR
[#568](https://github.com/cloudbyday90/Classifarr/pull/568). Random selection from
`[568]` chose it; review subject is head
`adb08ff9c5ca94dd29d9b10c1ee72c983982a790` against base
`9623c73109d91eb5c7e5c653ff1e14c27b258ec6`, open and unmerged at inspection.
Implement its ESLint update locally, using exact `10.13.0` rather than the PR's
caret range. No merge, branch, release, global toolchain change or lint relaxation.

## Evidence and recommendation

MCP opened the official [release notes](https://github.com/eslint/eslint/releases)
on 2026-10-20. Version 10.13 adds checks around immediate function references,
global object calls and delegated yields, plus a combined autofix correction.
This can reveal existing problems; do not disable rules to obtain a pass.

The official registry metadata retrieved with `npm view eslint@10.13.0` identifies
[the candidate tarball](https://registry.npmjs.org/eslint/-/eslint-10.13.0.tgz).
Compared with 10.12.0, engines, dependency ranges, optional jiti peer and script
definitions are unchanged; there are no install lifecycle scripts. Node 24.21.0
satisfies the engine range. `npm outdated --json` confirms installed 10.12.0,
wanted/latest 10.13.0; other outdated tools are outside this batch.

Updating improves current lint coverage and follows the selected PR, but rule
changes may flag existing code and every package upgrade has supply-chain risk.
Deferring avoids immediate churn but leaves the requested PR unimplemented.
Recommend the exact minor update, lockfile integrity review, unchanged strict
script policy/security overrides, then clean installation, full dependency-tree
and audit checks, server lint/typecheck/knip and existing tooling tests. No database
driver or runtime logic changes; do not claim new database-integration coverage.

Generate the lockfile with lifecycle scripts disabled, review additions/removals
before clean installation, and record actual results in a separate outcome.
Keep this dependency commit separate from the host-observation implementation.
