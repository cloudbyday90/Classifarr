# Source recovery fairness: design

Date: 2026-09-26. Unreleased; no release or deployment.

## Problem and selected design

The preceding admission probe showed that 13 daily syncs repeatedly attempted
only eight of 100 movie items and eight of 100 TV items during a provider outage.
The budget worked, but stable source ordering prevented later items from being
considered. Increasing the budget or sorting each page does not fix that cause.

Keep the existing recovery verifier and durable claim. Add a small streaming
planner and a sync-specific workflow around them:

1. Capture source pages as before. Validate evidence and reuse recent verified
   receipts as before; preflight diagnoses remain available without provider calls.
2. For fresh attempts, read the current observation's persisted attempt time and
   database-clock cooldown eligibility. Keep only the best eight candidates
   across all pages: never attempted first, then oldest attempt, then source key
   in deterministic code-point order. Provider ordering has no priority.
3. Evicted and ineligible items take the ordinary unresolved-item path. The
   selected items remain buffered, so a later successful repair is never counted
   as a skipped item. A repeated source key replaces its earlier buffered copy.
4. After successful page/collection traversal and pruning, drain the shortlist
   once. Recheck eligibility through the existing atomic claim before provider
   requests; retain digest, generation, token, title/year and fresh-source checks
   before persistence. Never hold database locks during network requests.

The planner retains at most eight item snapshots plus the current candidate.
No source candidate arrays, new cursor, or new table are persisted. A restart
discards only the shortlist; durable attempt times and cooldowns survive. Failed
scans do not spend fresh-attempt budget. Existing cached proofs can still be
revalidated while scanning without consuming that budget.

## Safety and limits

- Movie/TV scope and music exclusion are unchanged. No routing authority, AI
  request, new endpoint, configuration flag, or recovery acceptance rule is added.
- The scheduling read is not permission to write. Both scheduling reads and
  claims require an active matching library; claims and persistence are fenced
  by the current capture and evidence digest. Final claims still enforce cooldown.
- Missing, omitted, malformed, changed, or superseded observations fail closed.
  Preflight failures never occupy the shortlist. Diagnostic failures do not
  authorize a repair. Private source keys remain internal and are not logged.
- A claim records an attempt before network IO. Crash-after-claim waits for the
  existing cooldown and loses priority to older work; exactly-once network calls
  are not promised. Concurrent/changed candidates can leave unused slots rather
  than trigger unbounded rescanning or provider calls.
- Fairness is conditional on recurring successful scans of a stable eligible
  population within retained observation limits. Continuous new/changed evidence,
  failed scans, or observation retention limits can delay old items. Do not label
  this a global/provider-wide rate limiter or a completion-time guarantee.
- Scheduling adds one indexed eligibility read per otherwise viable conflict
  during capture, plus final checks for the retained shortlist. It does not sort
  or retain the entire library. Very large conflict populations still incur
  database work; no production latency improvement is claimed.

## Official research and alternatives

Sources discovered through web search and reviewed on 2026-09-26:

- [PostgreSQL bounded-query ordering](https://www.postgresql.org/docs/18/queries-limit.html)
  explains why bounded selection needs a deterministic order. Here the database
  supplies durable eligibility and time; a bounded in-memory selection spans
  source pages whose complete item snapshots are not stored in the database.
- [PostgreSQL concurrency guidance](https://www.postgresql.org/docs/18/mvcc.html)
  describes transaction/locking tools. Existing short current-capture transactions
  and guarded updates remain the authority; a planning read alone is insufficient.
- [AWS retry guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  emphasizes idempotency and retry load. Preserve the existing cooldown and
  per-sync budget; fairness changes admission, not the number of permitted attempts.
- [W3C use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color)
  requires information beyond color. Existing text status, labels and timestamps
  stay unchanged. There is no new visual claim of running, successful, or scheduled
  recovery; eligibility still does not mean a guaranteed retry time.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded cross-page oldest-attempt planner | Reuses durable evidence; bounded memory; no migration | Repairs wait for scan completion; can underfill after races | Adopt |
| Per-page sorting or random order | Small change | No cross-page fairness guarantee | Reject |
| Larger retry allowance | More immediate attempts | Higher provider load; same starvation mechanism | Reject |
| New durable recovery queue/cursor | Independent scheduling | New state machine, leases and lifecycle coordination | Defer |

Recommendation stack: existing observation store and atomic claims → pure bounded
planner → modular sync workflow → deterministic admission tests → PostgreSQL
restart/race/rollback checks and full backend regression coverage. Preserve the
existing Vue/SWR read model rather than adding another dashboard or queue.

See the [implementation outcome](source-recovery-fairness-outcome.md) for measured
coverage, fault checks, and the next end-to-end recovery step.
