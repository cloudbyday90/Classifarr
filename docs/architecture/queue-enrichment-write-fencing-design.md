# Queue enrichment write fencing

## Decision and scope

Date: 2026-09-28. Ownership means the current background worker's permission to
write a queued task's results, not ownership of a movie, show or library.

Completion fencing alone is insufficient: an old worker can save ratings,
resolved IDs, provider recovery state, metadata or history before its completion
is rejected. Add task-claim checks at those database boundaries for
`metadata_enrichment`, across supported movie/TV libraries and media servers.
Keep existing source-identity, provider-lease and conflict checks intact.

Use short transactions on one checked-out PostgreSQL client. Lock the queue row,
check the received token, processing status, task type and database-clock lease
deadline after acquiring the lock, perform database-only work, then recheck the
deadline before committing. Never recover a missing token from the database.
Never hold the lock over provider requests. Missing transaction support fails
closed; there is no pool-query fallback or automatic uncertain-commit replay.
The scope uses a 2-second lock wait, 10-second statement/idle limits and a
15-second total transaction limit on the existing PostgreSQL 18 runtime.

Save final metadata, source-library history, task completion and derived item
state atomically. A rejected source/history guard rolls back the result batch.
Publish recovery/completion messages only after commit. An obsolete claim exits
quietly without failing, completing or updating the replacement worker's task.
Fallback retries are persisted under the same authority check; the existing
retry scheduler is notified only after commit.

Earlier writes that committed while the claim was valid remain durable. If a
worker loses its task claim after acquiring a provider-recovery lease, that
provider lease is not stolen or cleared on its behalf. Its normal expiry makes
the observation eligible for the existing refill/backfill flow. This can delay
recovery, but preserves the separate provider-lease and source-identity checks.

## Research and tradeoffs

Official sources were discovered through search/MCP and read in September 2026.

| Option | Benefits | Costs / decision |
| --- | --- | --- |
| Token check only at completion | Simple, already protects task status | Does not protect earlier item/history writes; insufficient |
| One transaction around provider calls | Easy apparent atomicity | Unbounded network waits hold locks and clients; reject |
| Short row-locked write transactions | Protects concurrent reclaim and groups final writes | Extra database round trips; selected |
| Replace the queue/workflow engine | Broader orchestration possibilities | Migration and operating cost without fixing every write boundary; defer |

The same-client requirement follows [node-postgres transactions](https://node-postgres.com/features/transactions).
Locking and checking current data follow [PostgreSQL application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html).
Those locks protect a transaction, not an entire network request or all future
writes. The queue remains at-least-once: shared provider caches/accounting and
provider calls are not made exactly-once by this change. See Microsoft's
[competing consumers guidance](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers).

No new UI is required. Keep the existing status surface; a discarded stale result
must not announce successful completion. Future UI changes must provide concise,
programmatically determinable status messages without forcing focus, following
[W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/), including 4.1.3.
This backend change is not a claim of whole-product WCAG compliance.

## Recommended stack and verification

Retain Node ESM services, PostgreSQL transactions and row locks, the existing
bounded queue/retry schedulers, source snapshots and provider recovery leases.
Add deterministic unit tests and real-database overlap/rollback tests. No new
daemon, broker, dependency, schema migration or automatic media reassignment.

Prove an expired worker cannot overwrite its successor's metadata/history, that
expiry while waiting or writing rolls back, and that cancelled/missing claims
cannot write. Verify normal movie/TV paths and source-change rejection remain
functional. Preserve current concurrency, retention and backfill policy.

## Limits and next boundary

This increment protects task-queue metadata enrichment. Other classification,
rating and independent retry-worker write paths need their own claim-aware
boundaries; do not advertise platform-wide exactly-once execution. The next
follow-up is to apply the same pattern to independent enrichment retry workers,
including their expiry/reclaim races, before enabling more automatic work.
This is cooperative application fencing, not a database permission boundary:
stop older unfenced workers before deploying it against a shared database.

GitHub's open-PR search returned no open pull requests for this repository during
planning. There is no eligible random PR to implement; no closed PR is substituted
and no PR is merged. No release or live deployment is part of this increment.
