# Server tooling PR 578 local adoption outcome

Date: 2026-11-02 (America/New_York). Status: implemented and locally verified.
Design: [selection, research and tradeoffs](server-tooling-pr-578-design.md).

## Exact local adoption

Randomly selected [PR 578](https://github.com/cloudbyday90/Classifarr/pull/578) was
reviewed at b59635c071250cf3c7751c53100749f28e158db1. Its eslint-plugin-security
4.2.0 to 4.2.1 and Knip 6.42.1 to 6.44.0 changes are adopted locally on main
with exact direct pins. Newer Knip 6.44.1 and independent client PR 579 remain
separate. The provider PR is not merged.

Scripts-disabled lock review found 24 changed server package records: the root
development declarations, two direct tools, OXC parser/types and nineteen optional
platform bindings moving from 0.154.0 to 0.155.0. No package was added or removed.
All runtime package records are identical. Other override values, including the
Knip smol-toml override, and all installation decisions remain unchanged.

Registry integrity, engines and published scripts were reviewed. All changed
package records lack an installation-script flag; strict npm ci and complete
npm ls --all pass without new allowances or peer bypasses. Native parsing is
exercised on this Windows x64 host; reviewing other platform lock entries is not
a claim of execution on every platform. Pinned Node/npm remain unchanged.

## Real-tool behavior

The old plugin run reproduced two missed call-expression diagnostics: dynamic
RegExp arguments and an unsafe literal passed without new. Six constructor,
regex-literal and safe-pattern controls passed. All eight now pass through the
actual installed ESLint/plugin, with the application's existing warning severity.
Snippet expressions are parsed, never executed.

The isolated real Knip CLI suites pass their normal/production missing-import,
unused dependency/export, entry-boundary, tagged re-export and cold/warm-cache
contracts. A new deep namespace control preserves the used export while reporting
its unused sibling; this control also passed the baseline and is not claimed as
a failing-before regression. The complete focused run passes three suites / 21
tests, with temporary fixtures, native process bounds and cleanup.

Server/client lint and typecheck, normal and production repository Knip gates,
static-import/ESM mock-shape checks, copyright, policy language/naming/delivery/
maintenance and inventory writer ownership gates pass. No rule severity, lint
exclusion, Knip configuration or runtime application source was changed.

The full server audit still reports 29 moderate / three low affected package
nodes, identical to baseline, all developer-only in the lock. Zero high/critical
findings does not clear those remaining advisories. Root and client results are
recorded separately in the [RE2JS outcome](re2js-tooling-fix-outcome.md).

## PR maintenance and recommendation

GitHub MCP recheck found PRs 578 and 579 still open and mergeable at their intake
heads. Both were created November 2. An older base alone does not make PR 578
stale; no applicable stale branch was found to rebase and no provider branch was
rewritten or merged. Later bot activity must not be mistaken for a local merge.

Final stack: exact reviewed PR versions, narrow lock review, strict install,
real ESLint diagnostic regression, real Knip controls, affected coverage and full
audits. Benefits are corrected lint syntax coverage and maintained analysis;
costs are validating native parser/platform artifacts and future tooling behavior.
A new application service or transport abstraction is unnecessary for this batch.

## Coverage and delivery

Fresh full backend coverage passes 1,920 suites and 62,201 tests, with one existing
skip, in 815.87 seconds. Fresh client coverage passes all 7,505 tests across 483
files. The ratchet passes with both fresh reports and no baseline change. The
client's configured HTML report is used, not an assumed JSON-summary path.
Coverage percentages and scoped artifact maintenance are recorded in the
[RE2JS outcome](re2js-tooling-fix-outcome.md).

Design and outcome remain separate, relevant historical follow-ups and Unreleased
are updated, and staged diff/secret checks precede delivery. Work stays on main.
No release, deployment, service restart, schema, UI, job, operator CLI trigger,
routing or learning change is included.
