# Gateway history archive outcome

2026-10-15. Implementation on `main`; no release or live gateway activation.

## Delivered

Small ESM modules provide an offline retention report, consistent native archive
and bounded integrity verification. A PostgreSQL-generated time-based UUIDv7
identifies each archive. No tables or migrations are added. All history, including
uncertain requests and recovery evidence, remains in the source database;
attempts, cooldowns, ownership and the admission cap are not reset.

The [design](ollama-history-archive-design.md) records official research,
alternatives and recommendations. The [runbook](../operations/ollama-history-archive.md)
documents least-privilege access, private files, cancellation and restoration
boundaries. Normal application startup does not run this tool.

## Source validation

Focused backend tests passed 13 suites / 300 tests. Gateway PostgreSQL integration
passed eight suites / 194 tests, including twelve archive cases. These cover busy
owners, dedicated sessions, explicit provider identity, native UUIDv7, read-only
transactions, legacy unknown records, protected lifecycle references, age checks,
counter mismatches and cancellation without mutation. Dump tests additionally
cover size/time limits, child cancellation and sanitized failures.

One repeated run encountered `ECONNRESET` in fixture setup, before the archive
action. The archive suite then passed all twelve tests, and the full focused
integration rerun passed all 194. The reset's underlying infrastructure cause is
not established; no retries or suppression were added to hide it.

The two archive contract/dump suites passed 40 tests with scoped coverage of
100% statements/functions/lines and 94.73% branches. This is not coverage of the
filesystem, SQL or CLI modules. Three existing host pilot tests also passed.
Backend type checks (including the new CLI), test/security lint, dependency
checks, ownership check, static imports/mock shapes, npm CLI flags, copyright,
syntax, Markdown and staged secret scans passed. No quality baseline changed.
The full backend/frontend suites and global coverage ratchet were not rerun;
there are no UI/API changes. The frontend production build passed in Docker.

## Local image and rollback evidence

Clean-source no-cache Compose build passed for source
`456bd2f28aab180ade8cc418b22cc2292d84b24f`, immutable image
`sha256:c8510ad05103ee9db4c36a0978fb2012e151c858a15375817ef0875d861238ed`.
The initial packaged run stopped before archiving because the fixture expected a
string counter but application imports install a numeric PostgreSQL bigint
parser. The fixture now compares its bounded synthetic count as a string; no
runtime parser or archive contract changed. Rehearsals passed after that fix.
A final clean-source build and local replacement will follow the fixture commit.

Before local replacement, created
`data/backups/gateway-archive-before-20261015.dump`, SHA-256
`CBA5AD5A32FE02B74D0351B3048ED929A9B0C4BEBA2AAD11DD416B98B3914445`.
Its `pg_restore --list` completed with 1,933 lines; this application backup has
not been restored. Protected prior local image:
`sha256:3e5ef70ba84d906d2e2e8af4894ec5784749a147009093482667d74a3acd60fc`,
source `2d5141407d606eb6d8d2959b9ca0ef3cacad85b2`.

The first image's corrected-fixture rehearsal passed native SELECT-only archive
creation and exact restoration of all seven tables into a fresh disposable
database. All immutable triggers still refused deletion. Active uncertainty,
attempts, cooldown and references survived; a restored ledger refused new work.
The fixture explicitly seeded recovery/stop/TLS records and a one-hour future
cooldown to exercise every table, not to simulate elapsed time or real stop proof.
Private modes, symlinks, hard links, corruption, oversized/incomplete output,
exclusive creation, invalid exported snapshots and cancellation were rejected.
The archive checks made no provider calls or source database changes after that
synthetic setup. Full application routing/outage/replacement also passed with
two synthetic calls. Both runners removed their owned disposable resources.

## Remaining scope

No purge, counter reset, automatic retries, scheduled archive, production restore,
real provider stop, Unraid change or shared Ollama change is included. Integrity
verification is not authenticity or restoration verification. A future reviewed
retention implementation must preserve recovery references and tombstones before
reclaiming capacity. The 100,000-binding limit remains unchanged.

The GitHub MCP open-PR query returned zero results on 2026-10-15 (checked twice).
No closed or merged PR was substituted for the requested random open PR.
