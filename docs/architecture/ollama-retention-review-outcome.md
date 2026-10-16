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
- Three host application-pilot tests also passed. Staged secret scans passed.

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

The final clean-source no-cache build passed for source
`91559f558293e7f0b5161d4bb5ed47a7bb0b6f4f`, immutable image
`sha256:03118531fcbe967e73d9baee8ffb7e76c3bfc69d8bac0cc5a5881d2578e4f0f5`.
The frontend production build passed inside Docker. The subsequent outcome-only
commit changes no runtime or fixture code.

The first no-cache image,
`sha256:adb324869db569213eb79f3c9a075aa57d19e58580e5d4d29817d244b8fbf793`,
source `e2e85cc16801d6b558cd03f47aa4d48ce34486f6`, passed both packaged rehearsals.
It exposed a deprecation warning in the new test helper's parallel queries on one
PostgreSQL connection. The helper now reads sequentially. No runtime code changed;
the source was committed and rebuilt without cache before final validation.

The final image passed the packaged archive and retention rehearsal without that
warning. The actual CLI used SELECT-only access, private files and the trusted
manifest hash. A terminal candidate matched; a subsequently added recovery
reference blocked it. A separate real `pg_restore` into a new disposable database
preserved the row fingerprints. Legacy v1 verification still passed and v1 review
was refused. Incorrect hashes, malformed arguments, corruption, unsafe files,
oversized/incomplete archives and cancellation were rejected. All seven gateway
tables were restored and compared, immutable triggers retained, and unknown work,
attempts and cooldowns preserved. Source rows did not change during the read-only
commands. The fixtures deliberately seeded old timestamps and a future cooldown;
this is not evidence of an elapsed production retention period or a load benchmark.

The main packaged scenario made 19 synthetic provider calls, separate completion
and TLS scenarios four and two respectively. Archive/review actions made no
provider calls. The runner verified cleanup of its owned container and data.
The final application-network rehearsal also passed authenticated routing,
history isolation, simulated outage and same-image replacement with two synthetic
provider calls total. It verified removal of its owned containers, networks and
data. These are local synthetic rehearsals, not a published-version upgrade or
GPU benchmark.

Before replacing the local container, created
`data/backups/gateway-retention-review-before-20261015.dump`, SHA-256
`2C97E4995346D01A3732D26690FCDE85C85EC2882EC1151233A5E1F3220AD970`.
`pg_restore --list` completed with 1,933 lines; this application backup was not
restored. Baseline image:
`sha256:82447c4ae2a308702fd022f99aca87cad66b6c1c45b676d778745288f5eee2d0`,
source `cd1db6cf4df476b1348647174e20fe4765e79b0f`.
The build protected this prior image under
`classifarr-local-rollback:d180969e8fc6cf0625b7f774fd32d75c654deb5d9135a7848d55a4c213578021`.

Local Compose replaced only `classifarr`, with no build or pull during replacement.
The running immutable image/source match the final candidate above. It is healthy,
with zero restarts and no OOM event. Health and UI returned 200; unauthenticated
gateway history returned 401. UID/GID 1000:1000, read-only root, no-new-privileges,
2-GiB limit and data/media mounts remain. There is no Docker socket, gateway
routing environment or gateway schema in the normal application database.
Evaluation remains `when_idle`, zero daily calls/tokens/reservations, revision 2
and unchanged next-check timestamp. The backup and protected image remain
available. Unrelated local containers were not managed.

A short startup sample measured 752.6 MiB / 2 GiB and 198.11% CPU; a later settled
sample was 359.6 MiB / 2 GiB and 0.60% CPU. These are point-in-time observations,
not a peak-load or capacity guarantee.

## Next item and external scope

Next is the transactional cleanup executor: explicit administrator consent,
execution-time revalidation, UUIDv7 receipts, retained tombstones and archive
lookup, bounded batches and rollback/crash tests. A review result alone must never
authorize deletion. Neither this work nor a future executor may treat an old
request as proof that remote compute stopped.

The GitHub MCP open-PR query returned zero results twice on 2026-10-15. No closed PR was
substituted. No Unraid or shared Ollama changes, live cleanup, release, branch or
PR merge were performed.
