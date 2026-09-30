# Credential-scoped retry wait outcome

Implemented September 29, 2026 under Unreleased. No release, version bump or
production restart. The [design](credential-scoped-retry-wait-design.md) records
sources, alternatives, safeguards and the recommended stack.

## Delivered

- New transient/authentication waits identify the exact provider configuration
  responsible. Repaired credentials make eligible work reconsiderable without
  resetting attempts or deleting historical deadlines.
- The existing claim/source transaction saves bounded, secret-free context.
  Unknown legacy waits and daily/monthly limits retain their previous behavior.
- Shared effective-due selection keeps claims and read-only summaries aligned.
  Actual outbound admission still enforces provider-specific pacing and quota.
- Verified web-search recovery now transfers valid same-key pacing even when the
  verification response supplies no new Retry-After header.
- Added the migration, fresh-install snapshot and ownership-review coverage.
  Existing static SQL analysis limitations and shared-writer debt remain explicit.
- The linked CI dependency advisories are handled separately in the
  [dependency maintenance report](../security/2026-09-29-ci-dependency-maintenance.md).

## Validation

- Final backend coverage: 1,548 suites / 46,988 tests passed; 90.22% statements
  and lines, 85.00% branches and 92.06% functions. All three new service modules
  have 100% statement/line coverage; request evidence and scoped persistence also
  have 100% branch/function coverage. SQL behavior is covered by the real-database
  tests, not inferred from importing a SQL string.
- Real disposable PostgreSQL: 15 suites / 226 tests passed, including new scoped
  recovery and existing admission, ownership, maintenance and quota regressions.
- Frontend coverage: 411 suites / 5,795 tests passed; 86.11% statements, 78.76%
  branches, 85.56% functions and 88.03% lines. Production container build passed.
- The final migration applied to the prior image's schema; the regenerated
  snapshot loaded and passed a fresh-container round-trip check. Explicit text
  casts keep the new view stable across PostgreSQL dump/reload.
- At fresh-container startup readiness, retry queue, OMDb pacing, web-search
  pacing and current provider-context counts were all zero. No demand or
  configured providers were invented.
- Type checks, lint, documentation lint, dependency/ownership checks, ESM checks,
  migration checks, four policy gates and 32 dependency-tooling tests passed.
- The combined coverage ratchet passed against the final backend and frontend
  reports without changing thresholds or baselines. No validation failure remains.
- Fixed two pre-existing runtime test fixtures that supplied synthetic memory
  to discovery admission but left the cooperative resource guard reading the
  host. Both now use the real admission factory with deterministic telemetry,
  plus explicit pressure-denial tests. Production guards are unchanged.

Tests use isolated databases and mocked provider HTTP; they do not operate on
persistent library data, change routing or spend external API credits. All
temporary schema-check containers and their disposable data were cleaned up;
the running Classifarr container and its persistent data were not touched.

## Operational limits

Legacy waits without provenance expire normally; there is no safe way to infer
which historical credential caused them. New eligibility is not permission to
skip admission. Disabled libraries, music content, exhausted attempts and source
conflicts remain excluded. A fresh setup without configured providers does not
gain demand or start another background process.

The additional due-time expression is bounded by existing retry page sizes and
transaction timeouts, but page size does not bound database scan cost. No large
production-backlog performance claim is made. Provider credits may remain spent
after a crash; uncertain requests are not automatically refunded.

## PR disposition

Initial and repeat GitHub MCP searches returned no open PRs in this repository.
There was no eligible random PR to implement. No closed PR was substituted and
no PR was merged.

## Next component

Completed by the [retry-query benchmark](retry-query-benchmark-outcome.md), which
identifies candidate-page selection as the next performance target. The original
measurement scope follows for traceability.

Measure **retry admission query cost under a large, mixed backlog**. Claims now
combine source eligibility, durable cooldowns and credential-context recovery.
Use disposable PostgreSQL with representative waiting/ready distributions and
`EXPLAIN (ANALYZE, BUFFERS)` to identify repeated scans, index opportunities and
bounded page behavior. Keep HTTP disabled and compare readiness with actual
claims. Change indexes or materialize eligibility only if the measurements
justify it; avoid another scheduling service or speculative rewrite.
