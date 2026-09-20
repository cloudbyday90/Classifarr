# Exhausted classification retry recovery

## Problem and scope

The scheduler moves exhausted `pending_retry` classifications to `failed` and
instructs the operator to use Retry Classification. The retry service currently
rejects that status, and History has no corresponding recovery action. The
previous live-routing diagnostics change explains policy holds; it does not fix
this separate queue lifecycle mismatch.

Restore recovery for this specific classification failure, without admitting
generic failed routes, changing routing thresholds, or automatically renewing an
exhausted retry budget. No database migration, new queue infrastructure, release,
or policy/learning mutation is required.

## Design

Use a small, pure ES-module retry eligibility service shared by History responses
and the transactional retry service. A recoverable exhausted record must have all
of these persisted properties:

- `failed` status and `queued_for_retry` method (the pre-route AI failure path).
- No destination (`library_id` is null) and no scheduled retry time.
- Valid integer counters with a positive maximum and `retry_count >= max_retries`.

This composite state supports existing dead letters without parsing human error
messages or trusting provider metadata as an authorization flag. Missing or
malformed fields fail closed. Other failures stay outside this recovery path.

Only the existing server-selected `manual_retry` source may recover these records.
The scheduler source is limited to `pending_retry` with budget remaining, checked
again after acquiring the history row lock. Other maintenance sources cannot
redrive exhausted records. Existing pending/review manual retry behavior remains.

The existing transaction locks the history row, checks for an active replacement
task, preserves request/webhook lineage, cleans retry artifacts, queues work, marks
the old record reclassified, and records the outcome. A manual recovery starts a
fresh bounded budget; scheduler retries carry their count forward. Concurrent
requests for the same history record cannot both enqueue a replacement. No old
routing authorization is copied into the new classification payload.

History exposes an additive `retry_recovery` field derived by the same predicate.
A focused child component shows the issue, the step to restore the AI provider,
and Retry Classification. It uses the existing named client API function, handles
per-item results rather than treating HTTP 200 as queue success, prevents duplicate
clicks, and announces progress/outcome without requiring another acknowledgement.
The POST endpoint remains the authority; stale History data cannot grant a retry.

## Research and tradeoffs — reviewed 2026-09-20

Sources were discovered with online search and opened before use.

| Approach | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Admit every failed classification | Small code change | Could replay unrelated or partly completed routing | Reject |
| Automatically reset exhausted budgets | Less operator work | Persistent failures can loop indefinitely | Defer until health-transition and replay-safety evidence exists |
| Narrow recovery through the existing transaction | Repairs the broken promise; preserves bounded retries and audit linkage | One operator retry after fixing the dependency | Implement |
| Add a new queue product | Rich recovery tooling | Migration and operational complexity for an existing PostgreSQL queue | Not needed |

AWS describes dead letters as isolated failures to diagnose and redrive after
resolving the cause; its retry-count guidance supports a bounded cycle, not an
endless reset. This is architectural guidance, not an AWS dependency:
[Amazon SQS dead-letter queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html).

PostgreSQL documents that `FOR UPDATE` serializes changes to the selected row until
transaction end. Keep state admission, enqueue, and lifecycle update in that
transaction: [PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html).

W3C guidance supports announcing action results without taking focus. Use a native
button, visible text, and a polite status region rather than a new modal or
acknowledgement: [WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages).

For the follow-up, Microsoft's circuit-breaker guidance supports limited recovery
probes rather than flooding a dependency when it returns. It also cautions that
queue isolation can already be sufficient. Reuse the platform's existing health
and queue mechanisms first; do not add a second resilience framework by default:
[Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker).

## Recommendation stack

1. Shared deterministic eligibility, enforced under the existing PostgreSQL lock.
2. Existing queue, bounded retry budgets, lineage, and outcome audit.
3. Small Vue recovery component using the centralized API layer and inline status.
4. Unit, route, real-database concurrency/rollback, and browser regression tests.
5. Next: dependency-health-triggered recovery with a durable replay limit and
   cooldown, demonstrated against outage/restart/repeated-failure scenarios before
   enabling automatic dead-letter recovery. That reduces operator work without
   turning a prolonged outage into an infinite retry loop.
