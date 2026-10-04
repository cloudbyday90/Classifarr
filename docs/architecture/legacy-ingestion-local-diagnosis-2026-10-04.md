# Legacy import ownership: local diagnosis

Date: 2026-10-04. Scope: read-only investigation of the local test installation.
No production recovery or database mutation was performed.

## What ownership means

Ownership identifies the worker allowed to update an import in **one Classifarr
database**. It does not claim exclusive access to a Plex library or media files.
The user confirmed that Unraid is production and local Docker is for testing;
they have separate databases but use the same Plex server. The production
instance therefore cannot hold the local database's import lock merely by
reading that server. Separate instances can still compete for provider capacity
or cause external writes if configured to do so; database isolation alone does
not make all external actions harmless.

The reported warning `db48d2cc-b0ed-40a7-89c6-6aa57a7f981b` names hostname
`c17c2e26033b`. Docker inspection matched that exact prefix to the local
`classifarr` container, started at `2026-10-04T17:04:39.829313218Z`. This report
is local evidence, not an inspection of Unraid.

## Observed local state

| Library | Old running import markers | Matching ownership state | Recorded recovery progress |
| --- | --- | --- | --- |
| Family (4) | 2 | Absent | Absent |
| Movies (5) | 6 | Absent | Absent |

The oldest/newest markers span July through September 2026. Both libraries are
enabled. These are unfinished historical records; their age does not identify
an active worker or prove that every possible writer has stopped.

Local inspection found one Classifarr application container, no second container
sharing its app-data mount, no matching Windows scheduled task, and only local
application database sessions. Embedded PostgreSQL listens on loopback. The
runtime database role still has superuser, create-role and bypass-RLS privileges.
These observations are point-in-time checks, not a permanent writer fence.

## Cause and safe resolution

`mediaSyncOwnershipRepository.claim` refuses pending/running markers that cannot
be associated with its preceding owner record. With no corresponding ownership
state, the eight markers remain unaccounted for. Rebuilding an image preserves
the database, so it cannot resolve these markers. An ownership backfill that
simply assigns them to the current container would fabricate missing evidence.

The existing admin **Recover and resume import** workflow is the immediate
library-agnostic path after stopped-writer review. It uses an actor-bound preview,
an exact record revision, bounded transaction/lock timeouts and an idempotent
audit receipt. It retires only the reviewed incomplete records, preserves
inventory, and schedules a full capture plus metadata backfill. Optional AI and
embedding work do not define recovery completion. Disabled libraries retain the
maintenance-only path and are not automatically enabled.

No stopped-writer attestation was submitted in this investigation. The existence
of the separate Unraid instance is not a local blocker, but it is also not
permission to run production recovery. If Unraid independently reports this
warning, inspect that installation's records and writers separately.

## Recommendation stack and tradeoffs

1. Recover the reviewed local legacy imports using the existing audited action.
   Benefit: inventory-preserving, already implemented. Cost: one operator review
   is still required for unknown historical writers.
2. Complete the existing [database writer-fence design](ingestion-writer-fence-design.md):
   separated runtime/maintenance credentials, retired legacy access, complete
   writer coverage, and fresh/upgrade/restore tests. Benefit: enforceable evidence
   for automatic recovery. Cost: a substantive security migration, not a flag or
   ownership timestamp.
3. Enable bounded automatic legacy reconciliation only after that boundary can
   reject late old writers. Keep unknown cases visible; do not hide warnings,
   delete inventory, reset budgets or weaken admission to make them disappear.

The [PostgreSQL advisory-lock documentation](https://www.postgresql.org/docs/18/explicit-locking.html),
discovered through search and read on 2026-10-04, explains that advisory locks
depend on application cooperation. That supports retaining the reviewed path
until the stronger boundary is complete. This database finding does not establish
the cause of the separate CI container-startup failure.
