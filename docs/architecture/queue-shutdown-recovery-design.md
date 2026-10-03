# Queue Recovery Across Shutdown

Reviewed: 2026-10-03.

## Decision

Keep the existing claim-token protocol and test it across a real container
restart. Fix the shutdown loop so a failed release does not prevent attempts to
release the remaining tracked claims. Do not reset unrelated work, replace
tokens by looking them up, relax retry budgets or assume a stopped process
completed its work.

A claim token identifies one attempt to handle a task. Reclaiming the task
creates a new token. Completion, failure and release compare that token with
the current row. Metadata writes additionally check the visibility deadline
inside the transaction that holds the queue row lock.

## Scope and invariants

- Snapshot locally tracked claims, release them sequentially, isolate each
  write failure and report partial failure without including raw errors.
- Preserve existing database and process deadlines. This does not extend the
  host stop timeout, retry failed shutdown writes or pretend to cancel work.
  An unreleased claim remains recoverable through its visibility deadline.
- Test both graceful stop and forced host kill with metadata and classification
  claims. A future fixture retry time prevents accidental dispatch before the
  restart assertions. Expire only synthetic rows to avoid waiting ten minutes.
  Allow the unchanged 60-second classification recovery sweep to run naturally;
  the host claim wait is bounded at 90 seconds and fixture work at 120 seconds.
- Require fresh tokens on replay; reject old completion, failure, release and
  metadata persistence before and after the replacement completes.
- Use the real queue loop, resource admission, dequeue, acknowledgement and
  metadata write guard. Mount test-only task handlers and a synthetic AI-ready
  dependency in the disposable app, after normal startup. No external provider
  call, user media, application test flag or production handler change is needed.
- Retain the existing policy that a current-token acknowledgement can succeed
  after expiry but before reclamation. Expiry makes work eligible; it is not
  itself proof that the old process has stopped.

The classification check covers queue acknowledgement, not exactly-once Radarr,
Sonarr, Discord or other external effects. The metadata check uses a synthetic
effect written through the production transactional write session. Neither is
a full classification-quality or provider-integration evaluation.

## Options and recommendation stack

| Option | Advantage | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Reset every processing task at restart | Quick apparent recovery | Can steal another live worker's claim | Reject |
| Retry every failed shutdown write | May recover transient errors | Consumes a short host deadline; ambiguous results | Reject |
| Isolate release failures, preserve tokens and expiry | Other tasks can recover promptly without changing authority | Failed/slow writes can still wait for expiry | Adopt |
| Add real-image restart checks | Exercises process death and persisted state | Additional CI time; synthetic provider boundary | Adopt |

Recommended stack: claim-token fencing → independent shutdown release attempts
→ expiry-based reclaim → transactional metadata effects → stale-write rejection
tests. Keep external-effect idempotency as a separate, explicit follow-up.

## Official research

PostgreSQL documents `SKIP LOCKED` as suitable for queue-like consumers, not as
a general consistent snapshot. Keep the existing atomic dequeue and short row
locks. [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html).

AWS's queue guidance treats duplicate delivery as possible and recommends
idempotent application processing. Applied here as an architectural principle,
not an SQS dependency: a retryable queue must not promise exactly-once external
effects merely because its acknowledgement is fenced.
[AWS at-least-once delivery](https://docs.aws.amazon.com/en_gb/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues-at-least-once-delivery.html).

Use concise outcome-first instructions and explain partial recovery without
calling it completion. No UI or new WCAG-conformance claim is included.
[W3C writing guidance](https://www.w3.org/WAI/tips/writing/).

Sources were located and read through web tools in October 2026. No new schema,
dependencies, privileges, saved-template changes or release are planned.
