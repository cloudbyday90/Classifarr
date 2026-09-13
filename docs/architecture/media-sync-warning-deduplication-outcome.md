# Media sync warning deduplication outcome

Follow-up: the [actionable-report design](media-sync-actionable-report-design.md)
supersedes the forum pointer in current detail/report reads with affected titles,
repair steps and automatically retried Plex item links. The historical behavior
and measurements below describe the original deduplication delivery.

## Implemented — 13 September 2026

The [design](media-sync-warning-deduplication-design.md) records the verified
startup-sync amplification and alternatives. The separate
[recovery outcome](source-identity-self-healing-outcome.md) addresses skipped
inventory, not just logging noise.

The new ESM reporter runs only after a successful library sync. Its PostgreSQL
state survives process and reporter recreation, separates full/incremental
scans, ignores older completions, and warns on first occurrence, changed counts,
recurrence after a clean scan, or a daily reminder. Identical concurrent scans
claim one notification. State is removed with its library.

The warning preserves its existing aggregate counters and adds a fixed recovery
explanation. Plex conflicts also include a title and URL for the documented
Plex metadata issue. No user-supplied link, source title, provider ID, private
host or credential is added to the shared error report. Other media-server
types are not mislabeled as Plex. Existing historical warnings are retained.

Unit tests cover fixed projection, invalid inputs, no private-field forwarding,
non-Plex behavior and logging/storage fallback. PostgreSQL tests cover reporter
recreation, competing transactions, daily expiry, count changes, clean-state
recurrence, mode separation, older completions and cascade cleanup.

## Recommendation and limits

Keep durable aggregate suppression with first/change/daily visibility. It costs
one small state write per completed sync and avoids a new user workflow. Counts
can remain identical while individual affected items change, so this is not
item-level audit evidence. A database outage falls back to process-local logger
deduplication; a crash after claiming a notification can defer it until the next
daily window. Successful import never depends on the logger being available.

The public Plex reference documents a relevant class of issue; it does not assert
that a particular upstream ticket is still open or that Plex has fixed every
local record. Fresh deployed warning/backfill measurements are recorded in the
companion recovery outcome.
