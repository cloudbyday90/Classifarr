# Restart-safe reclassification batch coordinator

## Problem and decision

Reviewed on 2026-09-24 against commit `2fedb44d`. Individual moves have a durable
journal, but the batch loop runs inside an HTTP request. A restart loses that
loop and leaves `executing` items behind. Outcome reconciliation alone does not
admit the remaining items.

Persist execution intent in the existing batch status and let a scheduled,
database-locked coordinator process one item per tick. Execute/resume return HTTP
202 with the existing batch representation. Reads never start work. Paused and
cancelled batches remain stopped. No new routing authority is introduced.

## Research and alternatives

Official sources retrieved on 2026-09-24:

| Option | Advantages | Costs / decision |
| --- | --- | --- |
| Request-owned loop | Simple immediate execution | Loses its owner on restart; replace |
| PostgreSQL coordinator | Reuses state, locks, migrations and scheduler | Serial throughput; careful crash boundaries required; selected |
| External workflow engine | Workflow tooling and scaling | Another runtime, deployment and failure boundary; defer |

[PostgreSQL advisory-lock documentation](https://www.postgresql.org/docs/18/functions-admin.html)
specifies nonblocking session locks and release at session termination. Use the
existing fail-closed database lock scope, plus combined abort signals for external
operations. A timestamp alone must not transfer ownership of a running file copy.

[AWS durable-execution guidance](https://docs.aws.amazon.com/durable-execution/patterns/best-practices/idempotency/)
distinguishes replay-safe operations from non-idempotent side effects. An existing
move reference is reconciled, never replaced with a fresh copy/delete. An
interrupted modern claim without a journal can retry preparation: reservation
and batch binding commit before filesystem work. Legacy claims lack that proof
and stop with an actionable inspection message.

[AWS retry guidance](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
recommends bounded retries and backoff. The coordinator performs one item per
tick; journal recovery retains its retry schedule. Busy ownership is not an item
failure. Database outages leave durable intent intact for a later tick.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
supports identifiable progress without moving focus. Keep the existing progress
bar and restrained status region; use nonpersistent SWR polling, not another
independent polling loop.

## Safety contract

- Promote lazy batch tables into a migration; preserve existing rows.
- Mark newly admitted items with a protocol version; persist a next-check time.
- Use a coordinator session lock and the existing move lock. Pass both abort
  signals through execution; database writes also fail closed after lock loss.
- Serialize controls and admission in short parent-first transactions. Never hold
  a row transaction across filesystem or provider operations.
- Pause/cancel prevents subsequent admission. An admitted move may still finish
  or reconcile; cancellation is not rollback.
- Resolve only the exact journal UUID matching classification and destination.
  Missing, mismatched or legacy unjournaled evidence requires inspection.
- Preserve pause-on-error. Never silently resume paused work.
- Keep movie/TV identity and path safeguards. Music remains unsupported.
- Use bounded operational messages, not arbitrary provider exceptions, secrets,
  filesystem plans or new telemetry payloads.

The worker checks every 30 seconds and admits at most one item per tick. That is
deliberately serial (at most 120 new items/hour before file-operation time), not a
high-throughput transfer queue. A waiting journal is checked no sooner than its
retry time, with a five-minute batch recheck. Explicit item retry can request an
immediate evidence reconciliation; it cannot repeat a journaled file move.

Read-only preflight remains request-based and can be requested again after an
interruption, but cannot revalidate a batch whose execution already started.
Recovery observes evidence; it cannot guarantee cancellation of an in-progress
filesystem copy or undo an admitted move.

## Recommendation stack

1. Existing PostgreSQL ledger and locks for durable intent and ownership.
2. Small ESM repository, coordinator and scheduler modules.
3. Existing move journal for physical safety and recovery.
4. Authenticated APIs and SWR for control and accessible progress.
5. Real PostgreSQL restart/concurrency tests with synthetic media adapters.

No release, deployment, live-media operation or routing-setting change is part of
this commit. This is not an exactly-once guarantee against independent external
filesystem mutations. Test evidence belongs in the separate outcome document.
