# Recurring AI evaluation capture: design

Status: Unreleased, September 25, 2026.

## Decision

Extend the existing automatic source-pair schedule with a separate, opt-in capture
worker. Default both daily budgets to zero. Keep evaluation, inference permission
and routing permission distinct: this worker may fill the private response cache,
never classify or route media. Only the configured, installed local Ollama model is
eligible. Music remains excluded by the existing movie/TV cohort.

Use PostgreSQL for durable quotas, progress and cooldowns, and reuse the existing
database-scoped heavy-work admission. No new queue, external service or dependency.
Charge one call and a conservative 8,448-token allowance before each generation
request. Failed, cancelled and ambiguous attempts remain charged; never refund an
unknown provider outcome. Reserve at most five calls per tick and enforce both
daily ceilings atomically. UTC rollover may replenish a budget, process restart or
configuration edits may not. These are admission allowances, not billing metrics.

Checkpoint validated responses by exact request/configuration/model identity after
each successful call. Do not persist prompts. Resume retained work after a restart;
invalidate mismatched plans and preserve the seven-day retention anchor. Publish
only after the existing evidence/model drift checks. Retrying an interrupted call
may repeat inference, but cannot evade the quota: exactly-once provider execution
is not promised.

Rotate a stable, label-independent movie/TV window only after capture has completed
and the automatic evaluator has consumed the matching published cache. Retain at
most 25 pairs / 50 responses at a time, rather than accumulating an unbounded
corpus. Aggregate results describe the current window, not cumulative accuracy.
Disabling the budget stops subsequent admission; an already dispatched request may
finish. Cancellation and lost resource admission must settle before releasing locks.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| PostgreSQL quota + response checkpoints + existing scheduler | Restart-safe, bounded, no new infrastructure | Conservative charges can leave capacity unused; selected |
| In-memory counters | Small implementation | Restarts and replicas bypass daily limits; reject |
| Generate on every cache miss | Immediate apparent coverage | No durable spending or recovery boundary; reject |
| Dedicated workflow platform | Rich distributed orchestration | Adds deployment and operational complexity; defer |

Recommended stack: explicit daily budget → shared admission → atomic reservation
→ installed local model → exact response checkpoint → evidence-checked publication
→ automatic replay → coverage rotation. Reuse the current classifier's prompts and
reducers. Do not tune routing thresholds from synthetic tests or unlabeled data.

## Official sources

Discovered through connected search and read on September 25, 2026:

- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  explains row and advisory locking. Short atomic quota updates avoid holding a
  database transaction across model inference.
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md?plain=1)
  documents context/output controls and returned token counts. Returned usage
  cannot reserve capacity before a request or account for a lost response.
- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  informs repeatable testing, documented limitations and ongoing evaluation.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  informs provenance, versioning and coverage descriptions. No UI is changed and
  this is not a WCAG conformance claim.

See the separate outcome document for implemented limits, commands and evidence.
No release or live-container update is included.
