# Reclassification recovery visibility design

Date: 2026-09-24. Scope: unreleased code only; no deployment or media changes.

## Finding and decision

Review of `f6f29234` found that the durable move journal can recover a move,
while its batch item remains failed. Increment-only batch counters drift after
recovery, retries and repeated skips. The modal stops polling when execution
ends, even though recovery can still be pending. History exposes no move state.

Persist an exact operation reference in the batch item's existing JSONB result
before file work. Reserve a new move and bind the batch attempt in one database
transaction. Complete the matching item in the same transaction as the journal,
history and correction evidence. Never infer completion from current placement,
an error-message UUID, or another operation for the same classification.

Batch reads derive counts from item states. Pause/cancel controls batch admission;
reconciling previously started file work must not resume remaining items. Explicit
skips remain skipped. Retrying preserves the operation reference until execution
binds it again. Completed receipts survive the journal's 30-day retention.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Infer success from library assignment | Little code | Wrong attempt and unverified file placement can appear successful | Reject |
| New event bus and separate projection database | Independently scalable | More failure modes and operational complexity for a local application | Defer |
| Transactional receipt plus same-database reads | Exact attribution, durable recovery, no new infrastructure | Item aggregation costs reads; journal detail expires | Adopt |

Recommended stack: existing PostgreSQL transactions and journal; focused ESM
binding/read helpers; named client API methods; existing Vue SWR with memory-only
state and visibility-aware polling; shared textual recovery presentation.

## Research basis

Official guidance retrieved on 2026-09-24:

- [Microsoft CQRS](https://learn.microsoft.com/th-th/Azure/architecture/patterns/cqrs)
  describes separate read/write logic with one database. This is the chosen
  design, not an adoption of distributed event sourcing.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  supports concise, programmatically identified updates without moving focus.
  Use a compact status summary rather than announcing every row on every poll.
- [SWR error handling](https://swr.vercel.app/docs/error-handling) describes
  bounded retry/backoff concerns. Reuse the project's Vue equivalent, not the
  React package; retain visible failure feedback and no overlapping reads.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  informs the minimal allowlisted recovery payload: identifiers, state, reason
  code and timestamps, never the journal plan, credentials or filesystem paths.

## Verification boundaries

Test outage/restart recovery, exact-attempt matching, rollback, repeated reads,
pause/cancel/skip preservation, receipt retention, safe history output, SWR
refresh after terminal batch execution, stale reads, and accessible status text.
Use synthetic data in isolated tests. No live library calls, release, version
bump, container update, or new confirmation gate is part of this change.
