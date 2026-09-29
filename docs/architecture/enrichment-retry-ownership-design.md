# Independent enrichment retry ownership

## Decision

Date: 2026-09-29. Extend the queue write-fencing work to the independent OMDb,
web-search and historical Tavily retry workers. Ownership is a worker's temporary
permission to save a result, not ownership of media or a library.

The existing select-then-update claim permits duplicate consumers. Provider
helpers write item metadata before completion, while error and recovery paths
update rows by ID alone. A late worker can therefore overwrite a successor.

Use an atomic, single-row PostgreSQL claim with a fresh UUID and database-clock
deadline. Claim just before each provider call, not an entire batch in advance.
Honor the existing caller's quota/API limit (50 by default), visiting each row
at most once per invocation. Providers return evidence only;
they do not persist item metadata. A short transaction locks the received claim,
checks its deadline after lock acquisition, checks the source identity and active
movie/TV library, and saves metadata, completion/failure/deferral/fallback and
derived item state together. Check the deadline again before commit.

No network calls, sleeps, scheduling or success logs inside this transaction.
No recovery of a missing token from storage, pool-query fallback, or replay of
an uncertain commit. Re-queueing must preserve processing rows. Recovery clears
expired token-bearing claims and consumes the existing bounded attempt budget.
Legacy processing rows without a claim remain withheld; age is not proof that
an older writer stopped. Pending legacy rows acquire real claims normally.
Stop older unfenced binaries before deployment against the shared database.

## Research and alternatives

Official sources discovered through search/MCP and read in September 2026:

- [PostgreSQL SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  `SKIP LOCKED` suits competing queue consumers; it is not a general consistent
  read. Use it for the atomic pending-row selection only.
- [PostgreSQL locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  and [node-postgres transactions](https://node-postgres.com/features/transactions):
  use one transaction client and short row locks for result persistence.
- [Microsoft competing consumers](https://learn.microsoft.com/en-us/azure/architecture/patterns/competing-consumers)
  and [idempotent consumer](https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer):
  duplicate delivery and crash recovery require conditional durable results and
  bounded retries, not an exactly-once claim about provider requests.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  report completion truthfully; future UI status must be programmatically
  identifiable without moving focus. No UI changes or WCAG conformance claim.

| Approach | Benefit | Cost / decision |
| --- | --- | --- |
| Process-local busy flag | Cheap overlap prevention | Cannot coordinate replicas or restarts; insufficient |
| Hold transaction during provider calls | Simple apparent ownership | Consumes connections and holds locks during network stalls; reject |
| Atomic claims + short guarded result transactions | Prevents obsolete writes; restart recovery | Adds claim columns and transaction checks; selected |
| New external workflow engine | Rich orchestration | Additional operation/migration burden; not needed for this boundary |

## Stack and acceptance

Keep Node ES modules, PostgreSQL 18, the existing provider router/quota controls,
Jest and real PostgreSQL integration tests. Do not add a broker or daemon.
Test duplicate consumers, replaced/cancelled/expired claims, lock-wait expiry,
source changes, fallback rollback, lost commit replies and crash recovery.
Preserve music exclusion, monthly deferrals, existing inventory and attempt caps.

GitHub returned no open repository PRs during planning; none can be selected or
merged. No release or live deployment is authorized by this increment.
