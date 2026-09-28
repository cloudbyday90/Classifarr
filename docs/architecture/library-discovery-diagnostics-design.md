# Library discovery diagnostics design

Research date: 2026-09-27. Providers: Plex, Emby and Jellyfin. Status: Unreleased.

## Problem and scope

Discovery safely rejects incomplete catalogs, but its generic error discards the
cause. Operators cannot distinguish access denial, a timeout and malformed data,
or see the last successful discovery after restarting the application. Jellyfin
needs the same diagnostics as Emby without inheriting Emby's pagination/fallback.

Record discovery outcomes for both manual and scheduled reconciliation. A successful
scan means the complete catalog was validated and its additive local merge committed;
it does not mean content ingestion, backfill, classification or AI evaluation finished.
Archive review still requires a fresh provider read and cannot use these diagnostics
as permission to change data.

## Alternatives

| Option | Pros | Cons / decision |
| --- | --- | --- |
| More raw error logs | Easy implementation | Sensitive data and repeated noise; no reliable current state. Reject. |
| Process-only counters | No schema change | Lost on restart; misleading across instances. Reject. |
| Full event history | Detailed forensics | Retention, privacy and storage cost beyond this task. Defer. |
| One durable bounded row per source | Restart-safe, small and actionable | Requires configuration revision and concurrency checks. Recommended. |

## Design and safety

Use small ESM modules for allowlisted failure classification, persistence, discovery
observation and presentation. Keep existing provider contracts and request budgets.
The status row contains only an attempt UUID, configuration revision, timestamps,
bounded library count, fixed reason/API-contract labels and a valid HTTP status.
Do not store URLs, credentials, response bodies, arbitrary exception messages,
library names or source media identities.

A database-owned revision increments when source type, URL, token or activation
changes. New attempts replace the current attempt atomically. Completion requires
the same attempt and current configuration revision; an older completion cannot
overwrite newer evidence. Configuration changes hide prior evidence until another
discovery completes, including change-away/change-back cases. Last-success evidence
is preserved through failures only within the same configuration revision.

Crash/timeout observation is honest: an unfinished old attempt means its outcome
was not recorded, not proof that its worker stopped. It never authorizes takeover.
Status persistence is best-effort with fixed sanitized warnings; observability
failure must not prevent normal discovery. Success is recorded only after commit.

The administrator-only GET is no-store, bounded and database-only. It does not
contact providers, enqueue work, retry scans or alter routing. Vue uses non-persistent
SWR with explicit refresh and refresh after the existing save/sync actions. Cached
or unavailable reads must not present a green current-success claim. The compact
card uses a text status, last-success time and one recovery suggestion; color is
supplemental, not the sole signal. No invented percentage or accuracy score.
The sync action keeps the existing content-sync and queue-refill behavior and labels
those side effects; status refresh has neither side effect.

No diagnostics are fabricated from old `last_sync` timestamps on upgrade. Existing
sources become observed on their next normal/manual discovery. Storage is bounded
to one row per source with deletion cascading from source removal; no history or
retention worker is introduced. All provider music exclusions remain unchanged.

## Verification

Test error/status allowlists, redaction, empty and malformed catalogs, Jellyfin's
independent array API, Emby's query/legacy contract, Plex, outage then recovery,
credential changes, overlapping attempts, interrupted observations, database write
failure, authorization/no-store, and read-only GET behavior. Exercise migrations
and the fresh schema on disposable PostgreSQL. Verify UI loading/error/stale states,
keyboard controls and accessible textual updates. No live provider or production
database is needed.

## Official sources and recommendation stack

- [Jellyfin LibraryStructureApi](https://typescript-sdk.jellyfin.org/classes/generated-client.LibraryStructureApi.html)
  documents the array-returning virtual-folder contract; it stays independent.
- [Jellyfin reverse-proxy guidance](https://jellyfin.org/docs/general/post-install/networking/reverse-proxy/)
  warns that API keys in request URLs can leak into logs. Discovery diagnostics
  therefore retain neither request URLs nor raw provider errors.
- [HTTP semantics](https://www.rfc-editor.org/rfc/rfc9110.html) distinguish missing
  authentication, forbidden access and service errors. These inform conservative
  reason categories, not assumptions about the exact upstream root cause.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports excluding secrets, constraining recorded fields and testing logging
  failure without disabling application functionality.
- [PostgreSQL INSERT](https://www.postgresql.org/docs/current/sql-insert.html)
  documents atomic conflict handling used with additional attempt/revision checks.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  and [use of color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color) inform
  textual status updates and non-color-only presentation.

Retain ESM/Express, native bounded HTTP, PostgreSQL and Vue/SWR. Add a bounded status
projection rather than a new SDK, analytics store or workflow engine. Benefit:
clear recovery guidance without new background work. Cost: latest-state diagnostics
cannot reconstruct a full incident timeline and do not automatically repair access.
