# September 30 unknown-ingestion-owner incident

## Report and read-only finding

Report `b4299046-2242-475d-91dd-8165a943b33e`, at
`2026-09-30T12:06:30.678Z`, names Movies (library 5). Inspection during the
provider-recovery resource study found the same durable blockers documented
after the earlier rebuild, not a new failure caused by this study.

| Library | Unfinished markers | Marker date range (database display) | Tracked ownership |
| --- | ---: | --- | --- |
| Movies (5) | 6 | August 19–September 20 | Absent |
| Family (4) | 2 | July 18–August 22 | Absent |

Both libraries have a completed `media_sync` capture, generation 341, from
September 27. That capture does not own the separate unfinished sync records.
Both remain enabled, unarchived and attached to an active configured Plex source.
Eight other tracked library ingestions are complete. No reconciliation audit
receipt exists for either blocked library.

Here, ownership means the importer authorized to continue and complete a scan,
identified by its durable lease/token. It is not filesystem ownership or
ownership of the movies. Backfilling an owner's name alone would not establish
that a previous importer can no longer write.

The current container ID begins `15ac2c99134d`, matching the report. It started
at `2026-09-30T12:04:09.877686928Z`, remains healthy, and has zero restarts.
Process inspection showed one Node application process, its supervisor and
PostgreSQL, not duplicate app workers. At the database observation there were no
active ingestion advisory locks; other sessions were local and idle. PostgreSQL
listens on localhost; only the application port is published.

These are point-in-time observations. They do not establish that an older or
external writer cannot reconnect through an authorized local mechanism. No
stopped-writer attestation was made, no ownership token fabricated, and no
markers or inventory were modified. Diagnostic SQL used read-only transactions
and a three-second statement timeout, with no credential values or raw queries
from other sessions exported.

## Resolution and recommendation

Use the existing [reviewed recovery flow](legacy-ingestion-resume-design.md)
after establishing that older instances/external import scripts are stopped.
Open each affected library, review its current records, and choose **Recover and
resume import** with the truthful confirmation. The short transaction records
the reviewed interruption and full-replay handoff; the watchdog then obtains new
tracked ownership and schedules full ingestion/backfill. Inventory remains
until a complete valid scan. A recorded handoff is not a completed import.

Do not clear records based only on age, stamp them with the current process as
their historical owner, suppress the guard, or expect a no-cache rebuild to
resolve durable state. The newly implemented resource study neither fixes nor
claims to fix this live prerequisite.

If confirmation-free recovery is required, the separate next architecture task
is a database-enforced writer boundary and upgrade cutover that makes old writes
impossible before adopting legacy state. That needs a compatibility/migration
design; cooperative advisory locks alone cannot exclude arbitrary old writers.
Do not silently bundle that privilege change into resource instrumentation.

This boundary follows [PostgreSQL 18 advisory-lock documentation](https://www.postgresql.org/docs/18/explicit-locking.html),
discovered through search and verified on September 30: applications must
cooperate with advisory locks; the database does not enforce their use. The
proposed cutover is an engineering recommendation, not a claim that an absent
lock proves exclusive ownership.

The next component should pass an isolated old-version upgrade rehearsal in
which an old writer attempts a late write and is rejected, a new owner safely
replays incomplete work after a crash, and partial scans never erase existing
inventory. It must cover all libraries without hard-coded IDs and keep fresh
installations idle until their prerequisites exist. These are proposed
acceptance criteria, not capabilities delivered by this instrumentation change.

## Verification and outcome

The disposable PostgreSQL legacy-ingestion-reconciliation suite passed all 35
tests. This verifies the reviewed recovery implementation, not recovery of these
live records. The live warning remains unresolved pending reviewed recovery or
a separately designed and verified writer-fencing cutover. No live deployment,
data cleanup or ownership backfill was performed in this investigation.
