# Gateway frozen-snapshot capture design

## Agreed scope

On 18 October 2026 the user selected a versioned catalog format, keeping inference
uninterrupted. Fix the two-snapshot `source_changed` race found by the
[inference/archive soak](gateway-inference-archive-soak-outcome.md). Work locally
on main; no release, Unraid provisioning, shared-provider changes or live recovery.
Existing optional installations remain explicitly provisioned. No new tables or
database identities are needed; existing native UUIDv7 identities remain required.

## Evidence and official research

Official URLs were discovered using MCP search and opened on 18 October 2026.
[PostgreSQL snapshot synchronization](https://www.postgresql.org/docs/18/functions-admin.html)
explains that independent transactions can observe different commits and that an
exported snapshot remains usable while its transaction stays open. New writes
remain invisible to transactions using that earlier view.
[SET TRANSACTION](https://www.postgresql.org/docs/18/sql-set-transaction.html?trk=article-ssr-frontend-pulse_little-text-block)
requires importing a snapshot before the first data query.
[pg_dump](https://www.postgresql.org/docs/18/app-pgdump.html)
supports synchronized snapshots during concurrent use; restoring SQL remains a
code-execution trust boundary, so verification must stay isolated.

The existing catalog v2 dump must contain its own newly inserted exporting job.
A planning snapshot established before that insertion cannot contain it. Moving
BEGIN alone, dropping revision checks, or rebinding an immutable job is unsafe.

| Approach | Pros | Cons |
| --- | --- | --- |
| Keep two independent snapshots | No format change | Busy sources can repeatedly fail capture |
| Fence inference admission briefly | Can retain old representation | Changes foreground admission and adds delay |
| Frozen source view plus explicit admission record | No inference fence; complete historical rows and new job preserved | Versioned format, migration and compatibility verification |

The third option is selected. Hashes bind content; they are not signatures or
independent proof of operator trust.

## Capture and format contract

1. Keep one bounded `REPEATABLE READ READ ONLY` source transaction open from
   planning through canonical hashing and `pg_dump --snapshot`. Issue an
   in-process context tied to that exact live session; stale/cross-session
   contexts must be refused. Inference admission/completion remains independent.
2. The separate maintenance session retains coordinator/maintenance exclusions.
   It admits a UUIDv7 job using the frozen report/revision, original compatible
   revisions and unchanged shared three-attempt/cooldown rules. Pending or
   interrupted jobs still block new admission.
3. Produce manifest v7/catalog v3. `catalog.tables` describes the exact frozen
   dump, including every earlier catalog job. A bounded `catalog.admission`
   envelope contains version 1, the PostgreSQL-canonical JSON text of the new
   exporting job and its SHA-256. Its exact fields, UUIDv7 IDs, aliases, timestamps,
   attempt and empty publication fields are validated and bound to the manifest.
   Canonical text preserves PostgreSQL microseconds; do not round through JS Date.
4. Require the current job to be absent from the frozen source view, no other
   pending job there, and all existing relationship checks. Independently read
   the actual job on the lock-owning maintenance session before and after dump;
   require the same admitted record. Include that record in size/count accounting.
   Reconstruct its original attempt ordinal and cooldown from frozen history,
   using admission time rather than the verifier's current clock.
5. Keep dependency selection, complete historical-row guards, file checks before
   and after dump, private publication and retention pins unchanged. Source reads
   remain SELECT-only; no inference lock, source mutation, new provider call or
   foreground pause is introduced.
6. Close the source transaction before durable publication acknowledgment. A
   failed/ambiguous write or lost process remains fenced/uncertain, not refunded.
   Cancelled/failed admitted work retains its attempt and persisted retry delay.

Inference-only archive v4 needs no format change: its dump excludes maintenance
jobs, so it can directly use its still-open planning view. Legacy explicit catalog
v5/v6 captures and verification remain supported; newly scheduled catalogs use v7.

## Isolated restore

Restore only in the existing networkless, resource-limited verifier without a
source socket, provider credentials or Docker socket. Restore the staged dump
with its original restricted login. For v7, compare every frozen catalog table's
canonical hash and validate its pre-admission relationships **before** inserting
anything. Then insert exactly the validated admission record using parameterized
SQL and the restricted restore login; require exact canonical round-trip equality
and absence of an existing row. Re-enable guards/revoke insert privileges, verify
the completed logical relationships and unchanged admission record, then finish
normal content, dependency and file-integrity verification. A supplement cannot
replace a row, invent successful work, authorize purge or enable runtime recovery.

## Migration and failure boundaries

Add an immutable timestamped migration to the optional catalog migration chain
and its fresh `current.sql`, not the normal application's automatic migrations.
Keep old manifest publication/registration accepted. V7 SQL publication must bind
the supplement to the actual immutable exporting row and its hash. Add a format
capability function and require explicit maintenance-role EXECUTE permission.
Check capability before admission; an unupgraded/misprovisioned optional source
fails closed without creating new jobs. Upgrade only with maintenance stopped,
both maintenance locks available and no unfinished jobs. Do not rewrite history.
Older archives remain readable, but older binaries cannot consume v7 archives.
Do not downgrade a populated optional store or rewrite/rekey its artifacts to make
them appear compatible. Upgrade the optional schema and role grant explicitly.

Keep existing 120-second operation, statement/lock/idle transaction, 256 MiB dump,
64 KiB manifest, 1 GiB store, row/count and service resource limits. Bound the
canonical admission record to 16 KiB. A longer-lived snapshot retains old tuples
temporarily; cancellation, deadlines and session cleanup are essential. No
unbounded retry loop or schema auto-upgrade is added.

## Verification and recommendation stack

Test fresh/explicit-upgrade parity, older manifests, unsupported format refusal
before admission, malformed/duplicate/rebound supplements, exact microseconds,
wrong-session/stale contexts, cancellation, lost ownership, persistent budgets,
and real concurrent ledger changes. Run exact-image restore/retention and
interruption rehearsals, including the unchanged eight-minute soak. Require real
inference overlap with export and restore, matching request counts and cleanup;
do not reduce the failed soak's acceptance conditions.

Final stack: frozen source view → independently fenced immutable admission →
bounded dump plus explicit job record → isolated full restore verification →
verified retention. Next work depends on measured results; longer-duration/load
studies follow only after the concurrency regression passes.
