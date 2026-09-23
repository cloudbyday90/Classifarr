# Revision-Verified Library Profile Publication — Design

## Problem

A profile read and its later write were separate database statements. A media
sync, move, deletion, or upgrade could change the inventory between them. The
outbox acknowledged only its claimed revision, but the stale profile itself
could briefly replace a newer observation. A timestamp guard could order two
profile writers; it could not prove that either read the current inventory.

## Decision

Read the projected inventory and its revision in one PostgreSQL statement.
Store that exact revision with the generated profile. During publication, lock
the corresponding inventory-state row, compare revisions, and conditionally
insert, update, or delete the profile in one transaction. Reject a changed
source with a typed superseded result. The existing inventory worker completes
only its old claim, leaving the newer dirty revision for immediate replanning;
it does not wait on a failure cooldown or clear a native-readiness circuit.

Legacy profiles have a null provenance revision. A new one-time upgrade task
uses the existing durable per-library queue to refresh them; no bulk profile
rebuild runs at startup. A library with no inventory and no existing profile
does not need a stored empty profile.

## Options and trade-offs

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Timestamp-only write guard | Small change | Does not establish source freshness | Reject |
| Long repeatable-read transaction across computation | Consistent snapshot | Holds transaction resources and may retry serialization failures | Reject |
| Source revision plus short publication lock | Exact source check; brief lock; reuses queue | Adds column and one transaction per publication | Adopt |
| Rebuild on every read | Always recent in a quiet system | Repeated full-library scans and still races writes | Reject |

## Safety and operations

- Source revisions use decimal strings end-to-end so `BIGINT` values above the
  JavaScript safe-integer limit remain exact.
- SQL values are bound parameters. The stored observation remains a bounded
  projection; no media title, description, provider payload, or credential is
  added to the profile or superseded log.
- The inventory trigger updates the same state row that publication locks.
  Under PostgreSQL's default Read Committed isolation, a concurrent source
  write either commits before comparison and causes rejection, or waits until
  publication commits and leaves the next revision dirty.
- A repeated same-revision writer can update only if its observed timestamp is
  not older than the stored profile. A superseded write rolls back completely.
- This does not grant routing authority, learn an operator label, create a
  release, or restart the user's local container.
- There is no UI change. A future Command Center progress surface should
  announce asynchronous status without moving keyboard focus.

## Official guidance checked September 2026

- [PostgreSQL 18 transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  explains statement snapshots and the behavior of `SELECT FOR UPDATE` under
  Read Committed.
- [PostgreSQL 18 application-level consistency](https://www.postgresql.org/docs/18/applevel-consistency.html)
  recommends row locks for validity checks concurrent with updates.
- [PostgreSQL 18 `INSERT`](https://www.postgresql.org/docs/18/sql-insert.html)
  documents atomic `ON CONFLICT DO UPDATE`, its conditional `WHERE`, and that
  `RETURNING` excludes rows not updated.
- [W3C WCAG 2.2 status messages](https://www.w3.org/TR/wcag/#status-messages)
  applies to a later UI status presentation, not this server-only change.

## Recommended stack and next boundary

Keep the existing inventory trigger → revision state → bounded planner →
leased outbox worker, and add revision-checked publication at the final write.
Next, expose a read-only per-library progress summary that distinguishes
pending, processing, retry cooldown, and verified profile revision. Validate
it on a disposable old-version snapshot before changing routing behavior.

The [library profile refresh status design](library-profile-refresh-status-design.md)
implements that read-only summary. Its next boundary remains the disposable
old-version snapshot rehearsal.
