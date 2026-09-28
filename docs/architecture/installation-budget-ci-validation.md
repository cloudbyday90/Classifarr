# Installation-budget CI validation

## Scope — September 28, 2026

Implementation follows the
[opt-in Linux CI design](installation-budget-ci-design.md).
It changes workflow selection, evidence upload and summary presentation only;
no production service, schema, routing setting or live resource limit changes.

## Checks

Focused validation passed: 7 suites / 187 tests, including workflow mutation
tests and budget-summary rejection tests. Actionlint, server/client lint and
type checks, Markdown checks, static ESM imports, strict mock-shape checks,
migration naming, copyright, dependency and ownership preflight all passed.

Full-suite and runtime validation are in progress. Final counts and observations
will be recorded here after execution. No hosted-Linux pass is claimed until a
matching workflow run and its receipt have been inspected.

The checks cover fixed dispatch conditions, unchanged release gates,
least-privilege tokens, both fresh/upgrade budget receipts, malformed or missing
counters, readable cgroup v1/v2 summaries and bounded artifact paths.

## PR availability

The GitHub MCP search for open PRs in `cloudbyday90/Classifarr` returned none.
There is no open PR to select randomly or implement locally. No PR was merged.

## Operational boundary

No release, tag, live rebuild or deployment is part of this change. Isolated
test resources retain the existing ownership-checked cleanup. Local generated
evidence stays ignored under `.tmp`; only allowlisted receipts are CI artifacts.
