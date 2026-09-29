# Bounded transactional retry maintenance

Decision and official research: September 29, 2026. No release or deployment.

## Root cause

Three retry maintenance operations update every matching row and synchronize
derived item state afterward, outside the update transaction. Large restored
queues can return large ID arrays and hold many locks; a synchronization failure
can leave queue and item state inconsistent. Statistics reads also run these
mutations, making maintenance depend partly on dashboard polling.

## Design

Keep existing retry semantics, but separate fixed SQL policy, a small transaction
executor and one bounded maintenance pass. Each operation selects at most 50
unclaimed retry rows with `FOR UPDATE SKIP LOCKED`, locks their media rows in
stable ID order, rechecks its predicate in a fresh statement and changes only
that locked subset. Item-state synchronization uses the same checked-out client;
any failure rolls back the whole operation. Use local lock, statement, idle and
transaction deadlines and explicit Read Committed isolation; never perform
provider HTTP inside these transactions.

Active processing rows, unknown legacy processing rows and partial/non-null claim
fields are not adopted or reset. Ordinary completion/exhaustion preserves attempt
counts. Existing historical Tavily monthly-quota normalization retains its
documented zero-attempt reset and UTC next-month calculation; canonical rows must
be a fixed point, including malformed legacy zero-attempt limits. Undated monthly
rows are withheld rather than assigned a guessed date or allowed to poison a
whole batch. Exhaustion excludes both existing evidence and recognized monthly
recovery candidates, so later pages cannot be failed ahead of their recovery.
Ordinary exhausted Tavily rows with a null reason are no longer accidentally
excluded by SQL three-valued `NOT` logic.

Run maintenance once per normal dispatch before provider eligibility checks,
including disabled providers, future-due legacy waits and TMDb completion rows.
Direct manual processing retains a bounded maintenance pass. Dispatch avoids
repeating that pass per provider. Statistics become read-only with the same
response shape; no API/client contract or new UI is needed.

A full committed batch may request one five-second continuation through the
existing coalesced timer, after processing. Cancellation epochs suppress stale
wakes. Empty, locked or partial batches rely on the existing minute scheduler.
No drain-until-empty loop, persistent cursor, new daemon or inferred ownership.
Skipped locks mean a pass is not proof of complete cleanup; later passes revisit
the head. This bounds rows returned/changed, not the cost of scanning all possible
matches, which is additionally constrained by database timeouts.

## Research and tradeoffs

URLs were discovered and opened with online tools, not inferred from titles.

- [PostgreSQL 18 UPDATE](https://www.postgresql.org/docs/18/sql-update.html)
  recommends smaller update batches when large updates cause contention/bloat.
  Its one-shot cleanup example needs a final sweep for skipped rows; this ongoing
  worker instead repeatedly revisits skipped work and never declares all done
  merely because a nonblocking batch is empty.
- [PostgreSQL application consistency](https://www.postgresql.org/docs/18/applevel-consistency.html)
  distinguishes read snapshots from current row validity. Keep queue and media
  locks through revalidation, mutation and state synchronization; do not treat
  the initial candidate read as lasting authorization.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  recommends consistent lock order and short transactions. Follow the existing
  queue-then-media order, sort media locks and skip busy media; unrelated legacy
  writers remain outside this cooperative guarantee.
- [HTTP safe methods, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
  motivates removing deliberate retry transitions from statistics GET paths.
  The existing scheduler, not an observer, owns cleanup progress.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports concise accessible status updates without interrupting focus. Retain
  the existing pausable SWR presentation and response shape; do not add noisy
  per-batch announcements or claim a new WCAG audit.

| Option | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Bounded transactions using existing scheduler | Atomic queue/item state, bounded returned IDs, restart recovery | Extra small transactions; transient backlog remains visible | Adopt |
| Add LIMIT but synchronize after commit | Smaller queue write | Partial state persists after synchronization failure | Reject |
| One transaction for the whole backlog | Atomic bulk cleanup | Long locks, memory and rollback costs | Reject |
| Separate queue engine or maintenance daemon | More independent scheduling | New ownership, deployment and recovery mechanisms | Not justified |

Recommended stack: Node ESM policy/executor/pass modules, PostgreSQL row locks
and transaction deadlines, existing scheduler/coalesced wakeups, unchanged
Express response contracts and Vue/SWR observers. No dependency or schema change.

## Verification plan

Use real disposable PostgreSQL databases to test every operation at 51+ rows,
transaction rollback, locked-row fairness, competing maintenance/claims, changed
metadata before media lock, fresh/disabled provider setups, restart, legacy
monthly timing, unknown/partial ownership and read-only statistics. Record
synthetic elapsed-time/memory observations without representing them as a
production capacity estimate. Re-run provider admission and ownership regressions.
