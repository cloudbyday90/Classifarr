# Profile-refresh worker health — design

## Problem and choice

The prior overdue-recovery assessment can say that library work is late but
cannot distinguish a worker that has not checked in from a worker making
progress through a backlog. Shared scheduler receipts aggregate several policy
tasks and cannot prove which worker ran. This is an observability gap, not a
reason to add another retry path.

Use one durable, fixed-vocabulary `profile_refresh_worker_progress` row. The
existing scheduled profile-refresh cycle updates its check-in after execution,
preserves the last fully successful cycle, and advances claim/completion
timestamps only when that cycle reports those events.
An atomic upsert preserves earlier activity timestamps on idle cycles. The
write is best-effort: a telemetry failure is logged with a fixed reason and
cannot mask the worker's result. Replace restore clears the operational row.

The existing administrator-only readiness statement joins this row and counts
claimable outbox work and its oldest due age under the worker's admission
rules (including shared request-type and retry-limit vocabulary, plus lease
deadlines). The server derives one bounded status: no observed check-in,
late check-in, failed cycle, no recent completion, backlog progressing, or
overdue work not presently claimable. The Command Center displays one short
line only when overdue libraries exist. These are clues, not proof of root
cause or a request to override retry policy. A completion of any profile
refresh request type is evidence of worker throughput, not proof that a
particular library profile was published.

## Alternatives, pros and cons

| Option | Pros | Cons |
| --- | --- | --- |
| Shared scheduler receipts | No new table | Coalesced task class cannot attribute a tick to this worker. |
| Dedicated one-row progress and read-only backlog correlation (selected) | Durable across restarts, small and privacy-bounded, no new retry authority | One write per minute and a schema migration; a late check-in does not prove the process stopped. |
| Second rescue scheduler | Potentially shortens some delays | Competes with claim/lease/cooldown policy and risks duplicate work. |

Final stack: existing revision state → existing planner and durable outbox →
single progress upsert → one-statement read-only aggregate → compact accessible
Command Center diagnosis. No provider requests, confidence changes, or new
routing permissions are introduced.

## Safety and research

The row contains only timestamps and a fixed outcome ID. The aggregate exposes
counts and timestamps, never media titles, metadata, credentials, claim tokens,
or raw errors. Its read endpoint retains administrator-only, no-store and
rate-limited behavior. The worker's transaction and advisory lock remain the
only claim authority. PostgreSQL documents the atomic `ON CONFLICT DO UPDATE`
guarantee in [INSERT](https://www.postgresql.org/docs/18/sql-insert.html).
[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
supports fixed, redacted operational signals and monitoring whether logging
itself stops. The existing non-interruptive status and native disclosure follow
[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
and the [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
These official URLs were verified during September 2026 research.

The 5-minute check-in and 15-minute completion thresholds are diagnostic,
not scheduling or retry deadlines. A database outage can suppress the progress
write even while the worker runs; the UI therefore says “no check-in recorded,”
not “worker offline.” Queue age is scoped to claimable jobs and may differ from
all pending jobs, including intentionally paused or cooling-down work.

## Next item

Harden the schema-snapshot gate. A snapshot can mark an in-development
migration applied while still lacking a column added later to that migration;
regenerating from that snapshot alone can falsely pass. Replay new migrations
from the last released schema baseline in a disposable database, compare its
structure with `database/schema/current.sql`, and fail CI on divergence. Then
run a release-gated end-to-end canary on mixed movie/TV libraries to measure
profile quality separately from worker liveness, without changing routing.
