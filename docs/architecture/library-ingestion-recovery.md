# Library ingestion ownership and restart recovery

Populated legacy libraries are also covered by the
[library adoption and recovery policy](library-adoption-recovery-design.md).
Existing inventory alone no longer excludes a library from first owned backfill.

## Decision (September 2026)

Use PostgreSQL session ownership plus a durable per-library checkpoint. Preserve
imported items after interruption, replay from page zero when due, and publish
completion only after capture finalization and pruning commit together. Keep
learning deferred while an owned import is running or waiting for recovery.

This is ingestion recovery, not permission to route media, invent provider IDs,
enable AI, change credentials, or modify retention settings. Only movie and TV
libraries are eligible. No additional worker framework or runtime dependency is
introduced.

## Cause

The previous watchdog only retried empty libraries without a `running` sync
record. A process interruption could leave a running record, a collecting source
capture, and some imported items. That combination was neither eligible for the
watchdog nor ready for background learning. Concurrent imports could also replace
each other's capture generation. A timestamp cannot establish whether an owner
is dead, particularly during a slow provider call.

## Design

| Layer | Responsibility |
| --- | --- |
| Ownership | Nonblocking, per-library PostgreSQL session lock; two global ingestion slots |
| Database scope | Pin ingestion writes and short nested transactions to the owning connection; reject late writes after disconnect/return |
| Ownership repository | Durable run, latest progress, retry time and restart count; no credentials in the record |
| Sync runner | Validate source, collect supported items, retain unresolved identities, replay idempotently and finalize atomically |
| Watchdog | Bounded selection of due, unowned incomplete imports, including partially populated libraries |
| Readiness/UI | Keep learning deferred; distinguish active imports, interrupted imports and retry waits |

The session lock is authoritative, not checkpoint age. Source configuration is
rechecked after provider reads and locked during finalization. Configuration may
change between page writes, but such a change cannot authorize final pruning or
completion under the old source. There is no transaction across provider calls.

On database connection loss, that connection cannot write again. A replacement
owner waits for the database lock to be released, observes the durable cooldown,
then starts a new capture generation. Old in-flight callbacks cannot obtain a
replacement database connection for ingestion writes. A failed import keeps its
items; failed finalization rolls back deletion and completion together.

Checkpoints are progress, **not resumable provider offsets**. Libraries can change
order while offline, so replay begins at zero and uses existing idempotent writes.
This does not manufacture a provider-side point-in-time snapshot. Non-array pages
or collections, and supported items without stable source keys, are errors, never
evidence that the library is empty.

Retries use a persisted capped exponential delay (up to one hour plus jitter),
with at least one minute after failure. Existing periodic/watchdog scheduling
decides the actual retry time. Two active imports reserve at most two ownership
connections; other callers defer without replacing an owner. Readiness waiting is
an expected state, not a successful evaluation or a generic scheduler failure.
The library view uses non-persistent SWR for read-only status, slower polling while
waiting, hidden-tab suspension and disposal on unmount. Polls update only status
and counts, never unsaved settings. Progress counts are outside the live region;
only meaningful state labels are announced.

The browser rehearsal also exposed an existing shared-input defect: visible
labels were not associated with their controls. `Input.vue` now uses Vue's stable
per-instance ID helper to connect label `for` and input `id`, without changing its
value/event API. A regression test covers distinct IDs and normal editing.

## Existing installations

New ownership records are created only when work is actually admitted. No setup
means no owned import; disabled sources do not start. As of the October 5
[compatibility recovery change](ingestion-compatibility-recovery-design.md),
pre-upgrade import markers recover automatically once database triggers reject
unmodified older writers. Batches preserve inventory and reuse full import plus
metadata backfill. Existing Compose and Unraid templates need no changes.

Unknown work created by current software still requires reviewed recovery;
missing/disabled fence checks also fail closed. The compatibility signal is not
protection against a database superuser deliberately bypassing it. Scheduled/manual
log retention is unchanged; ownership is independent of sync-status retention.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Retry by timestamp alone | Small implementation | Can steal a slow live import and prune its data | Reject |
| Resume the last offset | Less provider traffic | Changing ordering can skip items and cause unsafe deletion | Reject without snapshot cursors |
| Session ownership + durable full replay | Database-proven exclusion, restart safety, existing infrastructure | Re-reads earlier pages; reserves a connection per active import | Implement |
| New external workflow engine | Rich workflow history and orchestration | New deployment dependency and migration burden | Revisit only if measured scale requires it |

Recommended stack: existing PostgreSQL locks/transactions → modular ESM ingestion
services → durable bounded retries → existing scheduler/readiness → concise,
accessible library status. The subsequent
[legacy-ingestion reconciliation workflow](legacy-ingestion-reconciliation-design.md)
adds an explicit preview and administrator-attested shutdown. This cannot prove
that a noncooperating historical writer stopped; it deliberately leaves that
operational boundary visible rather than treating an absent lock as proof.

## Official research

Sources discovered and read on 2026-09-27 (no future-version claims):

- [PostgreSQL 18 administrative functions](https://www.postgresql.org/docs/18/functions-admin.html):
  session advisory locks, nonblocking acquisition, two-key namespaces and release
  on session termination support ownership independent of elapsed wall time.
- [Microsoft competing consumers pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers):
  idempotency, durable completion and failure handling support replay, not an
  assumption of exactly-once remote processing.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  expose significant state changes without moving focus; avoid announcing every
  rapidly changing progress count. Text must explain waiting without relying on
  color, animation or an invented percentage.
- [W3C form labels](https://www.w3.org/WAI/tutorials/forms/labels/) and
  [Vue composition helpers](https://vuejs.org/api/composition-api-helpers): use an
  explicit label association and stable, unique instance IDs for shared inputs.

## Verification and outcome

The implemented path preserves partial movie/TV imports, rejects a late
disconnected owner, replays from zero after the durable retry delay, and releases
the existing learning readiness gate only after successful completion. The
failure rehearsal terminates only an identified synthetic PostgreSQL backend;
provider responses and credentials are fixtures.

Verified locally:

- Full backend rerun: 1,490 suites and 44,523 tests passed. The earlier coverage
  run found one ESM database mock missing its named `pool` export; correcting the
  mock restored the suite without changing production behavior or test limits.
- PostgreSQL integration: 181 suites and 2,039 tests passed; one existing skip.
  A subsequent focused run of ingestion recovery and library API tests passed all
  36 tests, including the final legacy-owner visibility and watchdog-selection
  regression.
- Frontend coverage: 394 files and 5,537 tests passed. The final focused UI/API
  run passed 30 tests.
- Browser rehearsal: active progress → retry wait → completed import, preserving
  unsaved settings with no API writes; mobile layout and screenshot inspected.
- Disposable application image build and authoritative schema round trip passed.
- Backend/frontend type checks, lint, dependency/ESM checks, migration checks,
  Markdown checks and copyright checks passed. Server security lint retains one
  pre-existing non-literal filesystem-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no thresholds were weakened.

The full coverage reports passed the unchanged ratchet: backend statements/lines
90.31%, branches 84.58%, functions 92.27%; frontend statements 85.83%, branches
78.30%, functions 85.28%, lines 87.80%. Backend coverage is from the full run before
the mock-only correction; the corrected full backend rerun used no coverage.

No live database mutation, deployment, release or PR merge is part of this
change. Two GitHub MCP open-PR queries returned no open PRs, so there was no
eligible random PR to implement; a closed PR was not substituted.
