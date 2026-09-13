# Media sync repeated-warning design

## Problem and evidence — 13 September 2026

Local read-only diagnostics found 1,136 `Library sync skipped source items`
warnings across ten libraries. Each library repeated the same aggregate counts
and reasons; 1,000 warnings occurred within ten minutes of process startup.
The scheduler runs a library sync two minutes after startup, including rebuilds.
The warning is emitted once per completed library scan, not once per item.
Imported inventory is nonempty, ruling out the empty-library watchdog as the
cause of this reported repetition. Do not change that scheduler speculatively.

`conflicting_provider_ids` means a source item supplies two different identifiers
for the same provider. It does not mean that having both TMDB and IMDb IDs is
invalid. Keep rejecting ambiguous identities and retaining bounded source
observations; silence is not permission to trust conflicting metadata.

## Research and alternatives

Official sources were located through online search and inspected on this date.
OWASP recommends proportionate logging and avoiding excessive alerts that hide
real problems, while retaining validation failures and excluding sensitive data.
See the [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
PostgreSQL supports atomic conflict updates with conditional updates and returned
rows; use this to arbitrate concurrent completions rather than a read-then-write
race. See [PostgreSQL INSERT](https://www.postgresql.org/docs/18/sql-insert.html).

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Demote all warnings | Small patch | Hides new conflicts; rejected |
| Memory-only throttling | No schema change | Rebuild resets it, the main observed trigger; insufficient |
| Durable aggregate warning state | Survives rebuilds, handles concurrent completion | One small state write per successful sync; selected |

## Selected design

- A dedicated ESM reporter owns notification policy; media sync owns import work.
- Store at most two aggregate rows per library, separating full and incremental
  scans. Cascade deletion with the library. Store no titles, provider IDs, source
  keys, URLs, descriptions, or arbitrary source strings.
- Record only successful scan completions. Monotonic sync-record IDs prevent an
  older completion from clearing or replacing a newer aggregate.
- Warn for the first nonempty aggregate, changed aggregate, or an unchanged
  aggregate last warned at least 24 hours ago. A clean scan clears only its own
  scan-mode state; a later recurrence warns immediately.
- Use an atomic upsert to grant one notification for concurrent identical scans.
  Database failure must not fail the completed import: use the existing bounded
  time-window logger fallback. The durable guarantee is unavailable in that case.
- Keep the original aggregate warning payload for compatibility. An unchanged
  count is not proof that the same individual items are affected; item-level
  investigation still belongs to the source-observation workflow.
- Include a fixed recovery explanation and, for Plex provider conflicts only,
  the [documented Plex metadata issue](https://forums.plex.tv/t/double-plex-guids-validation-for-movies-series-and-episodes/882863).
  It is a public contextual reference, not a claim of current upstream bug status
  or a link containing private source keys or credentials. Ignore source-supplied
  URLs and arbitrary reference fields. The existing copied error report includes
  this reference in its additional data.
- No new UI or acknowledgement, no polling, no change to source identity checks,
  RAG admission, routing, scheduling, existing warning history, or log retention.

The companion [self-healing design](source-identity-self-healing-design.md)
implements actual verified repair. This reporter describes only items still
skipped after that attempt; successful recovery does not produce a skip warning.

Warning delivery is best effort, not a transactional outbox: a process crash
between claiming a warning and logging can defer that reminder until the next
daily window. This is operational noise control, not an audit authority record.

## Verification plan

Unit tests cover safe projection, reporter fallback and sync ownership. Real
PostgreSQL integration tests cover duplicate suppression across reporter
instances, changed aggregates, daily reminders, clean-state recurrence,
out-of-order completion, independent libraries/modes, and deletion cleanup.
Retain the source-identity rejection and observation regression suites.
