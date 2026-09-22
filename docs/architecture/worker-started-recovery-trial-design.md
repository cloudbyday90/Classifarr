# Worker-started provider recovery trial design

Date: 2026-09-22. Scope: the queue-delay follow-up from the
[previous Compose outcome](provider-fault-recovery-compose-outcome.md).

## Root cause and decision

Commit `641ca6f0` started the half-open circuit's 60-second admission window in
`grantTrial`, inside the retry-enqueue transaction. Commit `83eab385` proved
transport recovery and a fresh queue instance, but not a delayed worker or
replacement-history persistence. Repeated queue/metadata delays longer than the
window could prevent every worker from using an otherwise valid trial.

Start that window at **first provider admission**, not at enqueue time. Reuse
the existing ESM circuit repository, admission service, PostgreSQL state and
retry coordinator. No new broker, timer daemon, API, setting or library-specific
rule is required.

The distinction is deliberate: probe freshness limits authorization to enqueue
a bounded trial; the worker window limits admission of trial requests. Neither
is evidence that a destination is correct or permission to route media.

## State and concurrency contract

| State | Admission behavior | Persistence |
| --- | --- | --- |
| Open | Defer without an AI request | Existing cooldown and item identity/budgets |
| Half-open, deadline NULL | First worker atomically starts 60 seconds and claims one of five slots | Same provider key and epoch |
| Half-open, active deadline | Claim a remaining slot without extending the deadline | At most five claims across workers |
| Half-open, expired or exhausted | Persist another pending decision and await the next due probe | No item/recovery budget renewal |
| Closed | Ordinary classification continues | Existing route checks remain authoritative |

`COALESCE` sets the deadline only on the first atomic UPDATE. PostgreSQL row
locking serializes concurrent claims. A repeated probe token cannot replenish
slots. A new valid probe starts a new epoch; older in-flight results cannot
overwrite it. Provider/configuration identity checks and failure cooldowns stay
unchanged. A new provider failure reopens the circuit through existing handling.

An unstarted trial may outlive its probe in a busy queue. This is a bounded
permission to try the provider, not a perpetual health assertion: only five
requests can enter, each retains existing request/lock timeouts, and a transient
failure reopens the circuit. Once started, the window cannot be kept alive by
traffic. No schema migration is needed because the deadline is already nullable.
Older non-null deadlines retain their meaning until the next successful probe.

## Retry deadline correction

Real persistence testing also reproduced offset loss in the legacy
`classification_history.retry_after TIMESTAMP` column. Node serializes a Date
with an offset, but direct assignment to a timestamp without timezone discards
that offset. With an Eastern-time Node host and a UTC database, a five-minute
retry became immediately due.

Explicitly cast the bound parameter to `timestamptz` before PostgreSQL assigns
the legacy column. This preserves the instant in the database session's time
convention, matching existing SQL due-time comparisons. Null remains null.
Positive/negative-offset tests use explicit strings so UTC CI also catches the
old defect. No historical rows are rewritten using a guessed original timezone.

This is a scoped writer fix, not a platform-wide timestamp migration. Changing
the database session timezone between writing and reading a naive timestamp,
legacy API rendering and historical offset loss still warrant a separate audit.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Increase the enqueue-time timeout | Small change | Still starves if queue delay exceeds it; reject |
| Remove all trial limits | More immediate attempts | Can overload a recovering provider; reject |
| Start the bounded trial at worker admission | Removes queue-age starvation, keeps shared limits | First trial may occur long after probe; selected |
| Replace the queue or introduce a workflow platform | Broader orchestration features | Migration and operational cost without evidence it fixes this more safely; defer |

Final stack: existing durable retry queue → fresh generation probe → atomic
worker-started circuit trial → durable identity-preserving history → existing
content/identity/freshness and routing safeguards. Use PostgreSQL for concurrent
state, focused ESM services for orchestration and disposable fault tests for
evidence. Preserve ordinary deterministic classification throughout the outage.

## Official research and UI boundary

Sources were located/opened through research tools on 22 September 2026:

- [Microsoft circuit-breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker):
  half-open requests should be limited and recovery failures should reopen the
  circuit. Separating our queue delay from trial timing is our implementation
  decision, not a prescribed timeout from Microsoft.
- [AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_limit_retries.html):
  bound retry work and verify idempotency. Retain shared cooldown/jitter and
  transactional duplicate suppression rather than add retries at every layer.
- [PostgreSQL clocks](https://www.postgresql.org/docs/current/functions-datetime.html)
  distinguish actual time from transaction-start time; use the database's
  `clock_timestamp()` for admission expiration.
- [PostgreSQL timestamp types](https://www.postgresql.org/docs/current/datatype-datetime.html)
  document discarded offsets for timestamp-without-timezone input and session
  timezone conversion. This explains the reproduced persistence failure.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports presenting changing status without taking focus. Keep recovery
  automatic, retain existing History status/keyboard actions, and add no dense
  panel or acknowledgement. Browser regressions verify existing surfaces; this
  is not a claim of a complete WCAG audit.

## Acceptance and safety

Reproduce the old queue-delay failure before the fix. Deterministically age only
deadlines in a disposable database, rather than sleep or change production
clocks. Verify movie/TV expired-trial persistence, unchanged budgets, canonical
identity, single replacement task, next-probe recovery and stale/concurrent
admission controls. Run the existing isolated Compose HTTP stub through failure,
expiry, a fresh queue instance and final durable abstention. Successful transport
must never manufacture a destination.

All fault injection stays outside the normal Compose stack. SQL remains
parameterized, no new external input or secret-bearing log is introduced, and
policy/confirmation controls remain unchanged. Actual process-crash recovery
and content accuracy are separate claims requiring separate evidence.
