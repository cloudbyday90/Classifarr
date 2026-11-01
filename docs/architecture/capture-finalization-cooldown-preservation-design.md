# Capture finalization cooldown preservation design

Date: 2026-11-01 (America/New_York). Status: agreed first batch; implemented and verified.
Predecessor: [failure finalization stop outcome](capture-failure-finalization-stop-outcome.md).
Outcome: [validation and limits](capture-finalization-cooldown-preservation-outcome.md).

## Observed problem

The capture budget repository's finish method assigns a five-minute deadline for
captured, waiting_for_replay, budget_exhausted and deferred outcomes, or sixty
minutes for unavailable. A later same-revision five-minute finish can replace a
still-valid longer cooldown. Both worker admission reads honor the saved cooldown;
the process-local failure fallback is separate and remains five minutes.

The reader deliberately recognizes only deadlines after its statement time and
at most sixty minutes ahead. The schema rejects null and infinite deadlines, but
permits finite far-future timestamps. An unconditional GREATEST would preserve
values the reader ignores and remove the current finalizer's ability to replace
them. Preservation must therefore use the existing reader's validity boundary.

## Proposed first batch

Within the existing finish transaction, await a revision-bound SELECT FOR UPDATE
of the singleton before issuing the UPDATE. Recheck the provided cooperative stop
signal after the lock query. Dispatch the UPDATE as a separate command and use
its statement_timestamp as the common validity and requested-deadline anchor.

Set next_check_at to the later of the requested five-/sixty-minute deadline and
the existing deadline only when the latter is strictly future and no more than
sixty minutes ahead of that UPDATE's statement time. Due, past and finite
far-future values receive the ordinary requested deadline. An exact upper-bound
value remains eligible. A backward clock step can put a formerly valid deadline
outside the horizon; it is deliberately replaceable under this existing policy.
This is preservation of recognized cooldowns, not unconditional monotonic time.

The separate command is necessary for a clear concurrency contract. A single
UPDATE's statement_timestamp predates its row-lock wait. A concurrent transaction
can save a legitimate sixty-minute deadline during that wait, beyond the waiting
statement's old horizon. Acquiring the row lock first gives the later UPDATE a
fresh command-time anchor while preventing another transaction from changing the
matching row. The requested interval now begins at this post-lock command time.

Keep lock and finalization SQL in the existing adjudicationBudgetSql module and
the awaited sequence in adjudicationBudgetRepository. Do not add a framework or
grow the worker. Match both queries by singleton and configuration revision;
return the actual UPDATE result, including the existing normal zero-row result
for a stale revision. Keep status assignment and publication fingerprint COALESCE.

## Authority, lifecycle and bounds

Preserve existing singleton bootstrap, inherited isolation, transaction ownership
checks, single callback attempt, fifteen-second statement timeout and one-second
lock timeout. These remain per-statement bounds, not a whole-finalizer deadline.
The added query is awaited on the same client, holds at most the one matching row
through transaction settlement, and introduces no queue, retry or detached work.
Ordinary lock/serialization failures follow existing failure handling.

Keep permanent worker-stop propagation and checks before callback work, after
the new prelock, and after callback work. A stop while the prelock waits prevents
the later UPDATE once the query settles. Already-dispatched SQL may execute before
rollback. An already-dispatched COMMIT may succeed; stopped remains a lifecycle
result, with uncertain acknowledgement handled by existing discard/no-replay
rules. Do not use the explicitly read-only cancellation runner for this write.

Do not change reservations, counters, quota day, progress, rotation, cached
responses, checkpoint/publication authority, local cooldown timing or inference
admission. Configure/disable/resume preserve the stored deadline. Existing
configuration restore retains this operational table, which is excluded from
portable backups. Fresh installs remain disabled. No application data is cleaned.

Status overwrites, interpretation of zero-row finishes, singleton recreation and
exact deletion/recreation races remain separate. A preserved longer deadline can
coexist with a later status; do not claim this batch establishes attempt ownership
or durable status ordering. No schema, API, UI, setting, job, operator CLI trigger,
provider call, routing, learning, release, deployment or restart is added.

## Official research and tradeoffs

Research targets practices available through October 2026. Official sources were
discovered through search MCP and read on 2026-11-01. No post-October capability is
required; the design uses established PostgreSQL behavior.

- [PostgreSQL date/time functions](https://www.postgresql.org/docs/17/functions-datetime.html)
  distinguish command receipt time from transaction time and the changing wall
  clock. Inference: a separately dispatched post-lock UPDATE has a fresher anchor
  than a waiting UPDATE or the transaction's original timestamp.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html)
  documents waiting for a concurrent writer, returning the updated row, and
  retaining row locks through transaction end. Stronger isolation can instead
  reject a changed row; retain that failure rather than adding retries.
- [PostgreSQL conditional expressions](https://www.postgresql.org/docs/current/functions-conditional.html)
  provides CASE and GREATEST for a typed database-side comparison. Existing
  non-null finite constraints remain authoritative; no JavaScript date round-trip
  or application clock is needed for the saved deadline.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/), a May 2025
  Statement, supports minimizing diagnostic data. This internal change adds no
  retained payload, raw error text or disclosure surface. No new web interaction
  is introduced, so no new accessibility contract is needed.

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Revision-bound row lock, then bounded CASE/GREATEST | Explicit serialization and command-time anchor; preserves valid cooldowns and existing far-future repair | One additional query; same row held until settlement | First batch |
| Unconditional GREATEST | Small expression; keeps later values | Retains ignored far-future timestamps | Reject |
| One UPDATE with statement-time validity | One query | A lock wait can make a newly saved cooldown appear outside the old horizon | Reject |
| One UPDATE with volatile clock expressions | Potentially avoids extra round-trip | Requires executor ordering and consistent-anchor proof beyond the simple documented contract | Defer |
| Attempt tokens and full status ordering | Could fence stale outcomes and status ownership | Requires a larger lifecycle and restore contract | Separate follow-up |

Recommended stack: existing automatic worker and admission, existing revision-bound
write transaction, explicit prelock, cooperative stop check, post-lock database-time
comparison, unchanged settlement/uncertainty handling, and existing status surfaces.

## Verification and delivery

Reproduce the sequential sixty-then-five-minute shortening before implementation.
Verify all five permitted statuses, preservation versus extension, due/past values,
finite far-future replacement, exact horizon boundaries and schema infinity refusal.
Use isolated PostgreSQL with the production database factory for concurrent
finalizers in both orders, including a sixty-minute write made after the competing
prelock command begins waiting. Prove the later UPDATE uses a fresh anchor.

Verify stale revision, unchanged counters/progress/caches, fingerprint COALESCE,
disable/resume and restore preservation, inherited isolation and existing lock
timeout. Adapt the stop fixture to block the prelock and retain separate proof of
stop after real UPDATE execution, plus delayed/lost acknowledgement after COMMIT.
No test may depend on a production database or live provider.

Run focused regressions and applicable quality/ownership checks before broader
backend coverage. Review exact SQL and cancellation changes before updating any
ownership pin; keep the gate's unresolved classification and baseline. Reuse
unchanged client coverage only with explicit disclosure. Keep a separate outcome
document and Unreleased note. Work on main, inspect the full diff, then commit and
push after agreed implementation and validation; create no release.

Recheck open PRs through GitHub MCP. If none exist, report that random-PR work and
stale Dependabot rebasing are inapplicable. Maintain local artifacts through the
repository skill, preserving recovery assets and other projects.

Next after this batch: assess attempt/status ownership and distinguish stale
zero-row finalization from an acknowledged update before considering new retry
authority. Keep singleton recreation and broader write cancellation explicit.
