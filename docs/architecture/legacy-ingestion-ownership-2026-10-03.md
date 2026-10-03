# Legacy Ingestion Ownership: Local Diagnosis

Inspected read-only on 2026-10-03. This is installation-specific evidence, not a
rule to special-case a library in code.

## Finding

The reported `legacy_owner_unknown` warning is explained by persistent legacy
state: the Movies library has six sync records still marked `running`, with
stored start dates from August 19 through September 20. It has no matching
`library_ingestion_state` record, no active collecting capture and no entry in
`ingestion_recovery_progress`. Both the movie library and its Plex source are
enabled.

`mediaSyncOwnershipRepository.claim()` checks for pending/running syncs that do
not belong to the recorded ingestion owner. These six rows satisfy that check.
The warning therefore reflects unknown ownership, not evidence of media damage,
CPU pressure or memory exhaustion. The rows look stale, but age is not proof that
a writer has stopped.

The running container reports image revision
`db329d57e1128ac53c9049ade6f9beddc086fda8` and Node `v24.18.1`, older than the
current source baseline. It is healthy and is the only Classifarr application
container found in this Docker context. PostgreSQL listens on `localhost`, no
database port is published, and the observed application sessions are loopback.
Those are useful local checks, not proof about every external script or writer.

## Recommended recovery

After confirming older instances and external import scripts are stopped, open
the affected library, refresh/review the blocked import records, and use the
existing **Recover and resume import** flow. It preserves inventory and schedules
full import/backfill. For disabled libraries, use the maintenance-only review
and explicitly re-enable when ready. This flow is library-agnostic.

Do not fabricate ownership IDs, directly mark all old rows complete, delete
inventory, or remove the foreign-owner guard to silence the warning. Updating
the image alone does not retire persistent legacy records or prove ownership.

## Inspection outcome and limits

Only explicit read-only SQL, container identity/process and published-port
inspection were used. No recovery confirmation, data update, service restart,
image rebuild or deployment change was performed. Socket access used the existing
application identity; no permissions or database authentication were changed.
The operator was asked to confirm external-writer status before recovery.

The current ownership drift check also reports unresolved shared-writer debt.
Until all relevant writers participate in an enforceable ownership boundary,
automatic legacy takeover would weaken the protection rather than fix it.
