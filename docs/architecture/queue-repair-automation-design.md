# Scheduled retry of reviewed identity repairs

Date: 14 October 2026. Status: design only; runtime implementation is deferred.
See the [design outcome](queue-repair-automation-outcome.md) for scope and remaining
proof requirements. This is not a release or permission to recover production tasks.

## Problem and completion

Readiness explains whether an already approved identity repair can be retried,
but still requires an immediate administrator command. Add an explicit,
per-receipt choice to schedule **one enqueue**, not repeated classification.
No fresh installation, historical approval or newly approved repair is enrolled
automatically. Existing manual retry and its original attempt budget remain.
Completion means the existing guarded enqueue and its saved receipt committed
together; it does not mean classification or routing succeeded.

## Recommended contract

- An active administrator session, CSRF protection, shared mutation rate limit,
  exact receipt ID and explicit consent are required. API keys cannot enroll.
- Persist consent for one immutable receipt, consenting actor, 24-hour expiry,
  next check, check count and fixed outcome. No credentials or provider bodies.
- Wait at least five minutes before checking, allowing cancellation. At most
  100 active consents, one claim installation-wide per five minutes, six durable
  admission checks per receipt. Cooldowns are 5, 10, 20, 40, 80 and 160 minutes
  plus up to 30 seconds of jitter. These are not extra classification attempts.
- Cancellation is terminal. Repeating enrollment returns existing state, never
  resets timing, consent, counters or terminal outcomes. A new administrator
  cannot take over an existing consent by replaying the request.
- A cancelled or expired consent cannot enqueue. Cancellation after an enqueue
  reports that it was queued; it cannot undo work already admitted.
- Claim and persist the check/cooldown before work. A one-minute token lease
  fences finish. A crash spends the check, not a new queue attempt. Restart
  observes saved timing and budgets. At most 20 expired/exhausted records are
  terminalized per tick; inactive records otherwise require no work.
- Final execution reacquires the existing repair writer locks, revalidates the
  consenting administrator and provider revision, and invokes the same
  eligibility/receipt/retry implementation as explicit backfill. Changed task,
  source, evidence, prior effects or exhausted original budget stop automation.
  An already consumed receipt is observed, never replayed.
- No provider HTTP occurs in enrollment, status, claim or finish. Provider
  availability is not promised. Known ineligibility is terminal; SQL/unknown
  failure rolls back enqueue and leaves a bounded later admission check with a
  fixed diagnostic. Shutdown aborts work without withdrawing administrator
  consent. Lease and consent must still be valid at the final conditional write.
- Preserve the existing 1-second lock, 3-second statement and 5-second transaction
  limits, memory safeguards and ordinary queue ownership. Claim locking uses
  the automation table only; final/cancel lock order is repair tables, actor,
  automation row. No HTTP or unbounded scans under repair locks.

## UI and transport

Extend the existing bounded readiness page with saved automation status. A small
component offers explicit consent, schedule, cancel and read-only status refresh.
No work occurs on render and there is no polling. Unknown write outcomes disable
new writes until a saved outcome resolves them; reads are not permission to
replay an uncertain command. A missing status after an uncertain enrollment is
not proof it failed. Text states that the retry can classify and route.

## Alternatives and recommendation stack

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Keep manual retry only | Smallest operational surface | Requires someone to return at the right time | Retain as fallback |
| Opt-in one-time scheduled enqueue | Durable consent, cancellation, same safety gate | New table, worker and UI; may stop for rereview | Implement |
| Automatically enroll every approved repair | Less clicking | Approval becomes broader routing authority | Reject |
| Repeatedly retry classification or reset budgets | May hide temporary failures | Duplicate effects, overload, concealed faults | Reject |

Recommended order: existing identity proof → explicit bounded consent → durable
claim → current authorization and eligibility → atomic one-time enqueue → saved
status. Defer any expansion of classifications, identity guessing, or automatic
replacement approval. Next assess observed stopped outcomes before broadening
self-healing; do not reduce safeguards to make a dashboard green.

## Research

Official sources discovered and opened through MCP search on 14 October 2026:

- [OWASP Transaction Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html?trk=article-ssr-frontend-pulse_little-text-block):
  enforce server-side transitions and execution-time authorization tied to the
  specific transaction. The per-receipt consent/expiry is our application design.
- [PostgreSQL 18 SELECT](https://www.postgresql.org/docs/18/sql-select.html):
  `SKIP LOCKED` suits queue consumers, not general consistent reporting. Use it
  only for bounded claims/cleanup; retain existing repair writer fencing.
- [AWS retry with backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html)
  and [limiting retries](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html?trk=article-ssr-frontend-pulse_little-text-block):
  retries need idempotency, limits and delay. Our numeric bounds are conservative
  implementation choices, not requirements from those sources.

## Verification requirements

Real isolated PostgreSQL tests must cover fresh state, explicit enrollment,
idempotency, cooldown, competing claims, cancellation, lease expiry, restart,
changed settings/actor/task, original budgets, manual retry races and rollback.
Real HTTP fixtures cover session/CSRF and sanitized contracts. Client tests cover
explicit consent, saved state, cancellation and uncertain responses. Generate
the schema only from an isolated database. Run full fresh coverage and existing
quality gates; rebuild Compose without cache and rehearse the immutable image
with synthetic data before replacing the authorized local container. Never
enroll live local or Unraid tasks as a test.
