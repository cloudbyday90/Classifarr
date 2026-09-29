# Queue claim ownership and stale acknowledgements

## Decision — September 2026

Keep the PostgreSQL queue and existing scheduler. Add a fresh UUID claim token to
each atomic dequeue and require that token plus `status = 'processing'` on worker
completion, retry, failure and requeue. Extract acknowledgements into a small ESM
service. Missing tokens fail closed; task ID alone is never worker authority.

The previous crash drill proves dead-worker recovery, not live-worker overlap.
Current acknowledgement SQL updates by ID alone. A worker can outlive its lease,
another worker can reclaim the same task, and the first worker can then overwrite
the replacement's payload/status/retry count. Shutdown also currently requeues
other instances' work, and visibility recovery decrements local processing counts
before the original JavaScript execution settles.

## Ownership contract

1. Dequeue assigns `claim_token = gen_random_uuid()` in the existing atomic
   `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING` statement.
2. Pass the returned token explicitly through every processor acknowledgement.
   Never look up a newer token on behalf of an older worker.
3. A conditional single-statement update either accepts the current processing
   claim or changes nothing. Return an explicit boolean. Only accepted updates
   produce success logs and terminal intake receipts. Stale rejection uses bounded
   reason codes without tokens, payloads or upstream error text.
4. Clear the token when releasing/completing a claim. A new claim always receives
   a different token, including direct processing-to-processing reclamation.
5. Shutdown releases only this loop's tracked claims through the same predicate.
   Visibility recovery does not free local execution capacity: only the actual
   worker promise settling releases its processing count and resource permit.
6. A lease makes a task eligible for reclamation; it does not itself erase the
   current claim. An acknowledgement after expiry is accepted only if no recovery,
   cancellation or new claim has displaced it. This avoids unnecessary redelivery
   while the atomic token/status check rejects replaced claims.

The migration is additive and leaves historical/legacy rows unowned. Existing
expiry/startup recovery makes abandoned processing rows eligible; their next
dequeue assigns a token. It does not invent ownership for active legacy work.
Do not run pre-fencing and fencing workers against one database simultaneously:
old code does not enforce the predicate. Stop older instances before upgrade.

## Scope and limitations

Follow-up: [enrichment write fencing](queue-enrichment-write-fencing-design.md)
adds short claim-locked transactions for metadata-enrichment effects and atomic
final completion. That path rejects an expired lease even before reclamation;
the generic acknowledgement behavior above is otherwise unchanged.

This fences queue acknowledgement, not every downstream effect. Provider calls,
classification/routing, enrichment writes and index work may occur before the
acknowledgement. A rejected acknowledgement cannot undo those effects. Do not
claim exactly-once execution or remote side-effect fencing. Classification
follow-up writes are skipped when acknowledgement is explicitly rejected.

Existing administrative cancellation/retry remains a separate authorized action;
status changes invalidate old acknowledgements. No new API/UI, provider call,
worker lease duration, live resource cap or automatic legacy-library takeover is
introduced. A hung live execution retains its local slot; forcibly freeing a
counter cannot cancel its work. Cooperative cancellation is a distinct follow-up.

## Official-source research and trade-offs

Sources were discovered through online search and read in September 2026.

- [AWS receipt handles](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-queue-message-identifiers.html)
  distinguish a delivery's authority from message identity. The local design
  applies that distinction with per-claim tokens; it does not introduce SQS.
- [PostgreSQL conditional UPDATE and RETURNING](https://www.postgresql.org/docs/18/sql-update.html)
  support atomically changing only matching rows and observing accepted updates.
  Avoid a separate read-then-write ownership check.
- [Microsoft's idempotent consumer pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/idempotent-consumer)
  separates duplicate delivery handling from atomic side-effect persistence.
  Queue fencing alone is not a transactional inbox/outbox implementation.
- [W3C table captions and summaries](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
  inform descriptive test-result headings and explicit outcome columns. No UI
  changes or full accessibility-conformance claim are part of this backend work.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Task ID only | Simple | Cannot distinguish successive workers | Replace |
| Status only | Rejects writes to terminal rows | Still accepts an old worker during a new claim | Insufficient |
| Timestamp comparison | No new field | Precision/serialization coupling | Reject |
| Per-claim UUID and conditional update | Small, atomic, library/task-type agnostic | Migration and token propagation; not remote-effect protection | Adopt |
| Hold a database transaction for the whole task | Serializes local updates | Long locks/connections across external I/O | Reject |
| New broker/orchestrator | Broader workflow features | Migration risk without removing side-effect obligations | Defer |

Recommended stack: existing PostgreSQL queue → per-claim token → modular ESM
acknowledgement service → bounded local claim tracking → real-database overlap
tests plus unit/installation regressions. See the separate validation document
for observed failures, results and the next independently testable boundary.
