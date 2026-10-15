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
counter mismatches and cancellation without mutation. Mocked dump tests additionally
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

The final clean-source no-cache Compose build passed for source
`cd1db6cf4df476b1348647174e20fe4765e79b0f`, immutable image
`sha256:82447c4ae2a308702fd022f99aca87cad66b6c1c45b676d778745288f5eee2d0`.
The subsequent outcome-document commit changes no runtime or test code.

The first build used source `456bd2f28aab180ade8cc418b22cc2292d84b24f`, image
`sha256:c8510ad05103ee9db4c36a0978fb2012e151c858a15375817ef0875d861238ed`.
Its initial packaged run stopped before archiving because the fixture expected a
string counter but application imports install a numeric PostgreSQL bigint
parser. The fixture now compares its bounded synthetic count as a string; no
runtime parser or archive contract changed. Rehearsals passed after that fix,
then the source was committed and rebuilt without cache as recorded above.

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

Both rehearsals passed again against the final image and corrected clean fixture
revision above. The main packaged scenario made 19 synthetic calls, the separate
completion scenario four, and TLS scenario two. Archive/history/recovery checks
made no additional compute calls. The network/application scenario retained its
two-call total across an outage and same-image container replacement. These are
synthetic checks, not GPU benchmarks or a published-version upgrade rehearsal.
Both final runners verified removal of their exact containers, directories and
networks. File-verification cancellation was exercised natively; the child-kill
deadline tests used mocks, not a real 60-second stalled filesystem experiment.

Local Compose replacement passed without building, pulling or replacing other
services. The running image and source matched the final candidate; health was
good, restart count zero and OOM false. Health/UI returned 200 and unauthenticated
history returned 401. UID/GID 1000:1000, read-only root, no-new-privileges, 2 GiB
limit and data/media mounts were preserved. There is no Docker socket, gateway
routing environment or gateway schema in the normal application database.
Evaluation remained `when_idle`, with zero daily calls/tokens/reservations,
revision 2 and unchanged next-check timestamp. The application backup and
protected rollback image remain available. Unraid and shared Ollama configuration
were not changed; unrelated local containers were not managed.

A short startup sample was 777.3 MiB / 2 GiB and 102.26% CPU; the subsequent
settled sample was 340.8 MiB / 2 GiB and 1.53% CPU. These snapshots are not a
peak-load or production-capacity guarantee.

## Remaining scope

No purge, counter reset, automatic retries, scheduled archive, production restore,
real provider stop, Unraid change or shared Ollama change is included. Integrity
verification is not authenticity or restoration verification. A future reviewed
retention implementation must preserve recovery references and tombstones before
reclaiming capacity. The 100,000-binding limit remains unchanged.

The GitHub MCP open-PR query returned zero results on 2026-10-15 (checked twice).
No closed or merged PR was substituted for the requested random open PR.
