# Library profile overdue recovery — design

## Problem and decision

The existing one-minute profile-refresh automation plans dirty libraries, claims
outbox work, retries transient failures, reclaims expired leases, and waits two
hours after a terminal inventory-refresh failure before probing again. Its
status report said *waiting* or *queued* but did not distinguish expected waits
from work overdue for the scheduler. This is an observability gap, not evidence
that a second retry mechanism is needed.

Add a read-only diagnosis to the existing administrator-only Command Center
reports. An active library with a dirty inventory revision is *overdue* only
when its applicable due clock is at least 15 minutes past due. The bounded
reason is `planner_overdue`, `worker_overdue`, or
`lease_recovery_overdue`. A future retry, unexpired lease, inactive library,
clean revision, or library with no inventory is not overdue. The aggregate
covers every library in one PostgreSQL statement; the existing per-library
status window shows the first 200, prioritizing dirty work. The diagnosis
cannot enqueue, acknowledge, or route anything.

## Options and tradeoffs

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| New rescue scheduler | Could attempt recovery independently | Competes with the durable outbox, bypasses cooldown/attempt policy, and risks duplicate work. Rejected. |
| Reuse durable planner and worker; add overdue diagnosis (selected) | Preserves one retry authority, exposes a bounded signal, no new schema or provider calls | Overdue is a timing symptom, not a proven root cause; high backlog can also cause it. |
| No new diagnosis | No extra query or UI | Operators cannot distinguish expected cooldown from a stalled scheduler. |

Recommended stack: revision state → existing transactional inventory planner →
durable outbox with lease and retry policy → one-statement, read-only overdue
aggregate → compact Command Center summary and native details disclosure. The
15-minute grace is deliberately larger than the one-minute task cadence and
90-second initial delay; it is a diagnostic threshold, not a new retry timer.

## Security and accessibility

The aggregate returns counts and fixed reason IDs, never media titles, raw
provider metadata, tokens, or outbox claim tokens. The endpoint remains
administrator-only, rate-limited, no-store, and rejects query controls. The
bounded per-library read still limits results to 200. Neither report performs
automatic remediation; retries remain exclusively in the existing
transactional planner and worker.

The visible summary uses the existing non-interruptive `role="status"`, while
library details remain behind a native `<details>` disclosure. This follows
[W3C guidance on status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
and the [WAI disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/).
Fixed, redacted reason IDs also follow the [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
on excluding sensitive data. PostgreSQL documents `SKIP LOCKED` as appropriate
for queue-like consumers, not general read views, so the report does not use it:
[PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html).
`statement_timestamp()` anchors all overdue comparisons to a single statement
time: [PostgreSQL date/time functions](https://www.postgresql.org/docs/18/functions-datetime.html).

## Limits and next item

This diagnosis does not assert that the scheduler is healthy or that a profile
will be published. A persistent overdue count should prompt inspection of
worker health and the existing failure codes. The next high-value item is an
operator-safe worker-health summary that correlates last successful scheduler
tick and queue depth with these overdue reasons, without exposing payloads or
adding another retry authority.
