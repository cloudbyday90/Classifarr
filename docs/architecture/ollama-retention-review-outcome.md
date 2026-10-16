# Gateway retention review outcome

2026-10-15. Implemented on main; no release or production gateway activation.

## Delivered and scope

Version 2 archive manifests identify up to 100 oldest eligible request bindings
and fingerprint their complete binding/completion/TLS evidence in the same
snapshot as the native dump. The read-only review command requires a separately
trusted manifest hash and compares the source identity, retention setting, ledger,
table counts and exact archived records. New recovery protection or other drift
blocks the plan. Review references use native PostgreSQL time-based UUIDv7.

This completes the exact-evidence prerequisite for reviewed retention, **not**
the deletion executor. No records are deleted, no capacity reclaimed, no tables
added and no retry attempts or cooldowns reset. The existing immutable triggers
and 100,000-binding limit remain. Version 1 archives still verify but cannot
produce review plans. Normal application startup does not invoke these commands.

The [design](ollama-retention-review-design.md) records official October 2026
research, alternatives and the recommended ESM/PostgreSQL/private-manifest stack.
The [runbook](../operations/ollama-history-archive.md) describes invocation and
status interpretation. The recovery-change skill led to explicit bounds,
read-only defaults, separate design/outcome records and isolated restore checks.

## Source checks

- Focused unit tests: 14 suites, 325 tests passed.
- Gateway PostgreSQL integration: nine suites, 215 tests passed, including 21 new
  retention cases and the existing twelve archive cases.
- The new inventory validator's 25 tests cover 100% statements, branches,
  functions and lines. This is scoped coverage, not whole-feature coverage.
- Backend type checks, test/security lint, normal and production dependency
  checks, static imports/mock shapes, inventory ownership, copyright, npm CLI
  flags, Markdown, syntax and whitespace checks passed. No baseline was changed.

The first targeted SQL run found that non-ISO session dates could fail before
fingerprint normalization. UTC/ISO settings now apply before any snapshot reads;
the regression passes. An initial broader run lacked the host OpenSSL path and
failed TLS fixture setup. Re-running with the explicit existing OpenSSL executable
passed all 215 tests; no TLS behavior was weakened or test suppressed.

Tests cover exact terminal outcomes, unknown/recent/active/lifecycle exclusions,
new TLS/recovery evidence, ledger and configuration drift, counter inconsistencies,
legacy missing bindings, absent/changed references, 100-record bounds, cancellation,
SELECT-only access and consistent snapshots during a concurrent evidence append.
The full backend/frontend suites and global coverage ratchet were not rerun; no
client or HTTP API contract changed.

## Local container validation

Pending the clean-source no-cache build and packaged rehearsals. Before replacing
the local container, created
`data/backups/gateway-retention-review-before-20261015.dump`, SHA-256
`2C97E4995346D01A3732D26690FCDE85C85EC2882EC1151233A5E1F3220AD970`.
`pg_restore --list` completed with 1,933 lines; this application backup was not
restored. Baseline image:
`sha256:82447c4ae2a308702fd022f99aca87cad66b6c1c45b676d778745288f5eee2d0`,
source `cd1db6cf4df476b1348647174e20fe4765e79b0f`.

## Next item and external scope

Next is the transactional cleanup executor: explicit administrator consent,
execution-time revalidation, UUIDv7 receipts, retained tombstones and archive
lookup, bounded batches and rollback/crash tests. A review result alone must never
authorize deletion. Neither this work nor a future executor may treat an old
request as proof that remote compute stopped.

The GitHub MCP open-PR query returned zero results on 2026-10-15. No closed PR was
substituted. No Unraid or shared Ollama changes, live cleanup, release, branch or
PR merge were performed.
