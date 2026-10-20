# Server ESLint 10.13 — outcome

Implemented the [reviewed design](server-eslint-10-13-design.md) locally on main
on 2026-10-20. PR #568 was open/unmerged when selected and reviewed; no PR merge,
branch, release or version bump was performed. Adopted exact ESLint 10.13.0 rather
than its proposed caret range. The lockfile changes only that package's version,
registry URL/integrity and root requirement; no transitive additions/removals.

Using repository-pinned Node 24.21.0/npm 12.2.0:

- Lock generation with scripts disabled and subsequent strict `npm ci`: passed.
- `npm ls --all`: passed; full development-inclusive `npm audit --json`: zero
  advisories on 2026-10-20. This is not a supply-chain safety guarantee.
- Server test lint, security lint, typecheck, ordinary/production knip: passed.
- Dependency/toolchain contracts: 43/43 passed, including installer-policy tests.
- No lint rules, lifecycle approvals or security overrides changed.

The final preflight initially refused `parser_review_changed`: the offline SQL
inventory intentionally pins `Linter.version`. Reviewed its collector (only its
custom literal/template/query rule is enabled, inline suppression disabled) and
compared the complete current inventory against the existing review. With only
the parser-version field substituted in memory, all 869 entries retained their
source/analysis digests and classifications; candidate/gap counts remained
151/348 and source fingerprint remained
`c66d23aefca15ec698e24e60d38a5ac84ab53f367b08b3e46e0a1483cfc787f5`.
Updated only the reviewed parser version to 10.13.0, not the review baseline,
entries, classifications, scanner or acceptance rules. The focused ownership and
writer-inventory suites passed 57/57 tests; the complete final preflight passed
after this review. The initial failure is retained in the local verification log.

Full application tests were not rerun for this lint-only update. Native gateway
and archive image regressions are tracked in the separate quiet-window outcome;
they are not a replacement for new application integration coverage. Other
outdated packages reported by npm remain outside this bounded batch.
