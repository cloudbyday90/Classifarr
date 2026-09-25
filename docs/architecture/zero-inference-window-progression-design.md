# Zero-inference evaluation window progression: design

## Problem and decision

September 25, 2026. Review of commit `0e28288f` found that mixed deterministic/AI
replay can now finish a window without inference, but only the capture worker
advances its cursor. That worker returns immediately when its daily AI allowance
is zero. Completed evidence can therefore remain stuck behind a spending control.

Make successful automatic evaluation publication own zero-inference progression.
Reuse the existing durable cursor, shared heavy-job admission, evaluator lock,
five-minute evaluation cooldown and 25-item window within the frozen 300-item
movie/TV cohort. This is scheduling, not training or routing authorization.

## Contract and transaction

1. Evaluate through the existing isolated worker. Only a strict current report
   with complete policy replay and a full current window can propose advancement.
2. Every selected arm must be deterministic or have an exact cached response.
   Missing or unavailable evidence blocks advancement. Invalid cached output is
   measured as invalid, not repeatedly regenerated until it looks successful.
3. Reread the bounded source snapshot within the same admission/deadline. Require
   the evaluated input fingerprint, cursor offset and revision still to match.
4. Save the report, optional bounded history and conditional cursor update in one
   PostgreSQL transaction. Compare both expected revision and offset; increment
   revision on advancement to fence duplicate/late saves, including after wrap.
5. Never discard an interrupted unpublished capture. Clear progress only when
   absent, expired under existing retention, or explicitly published for the exact
   evaluated fingerprint. Preserve unrelated publication markers and checkpoints.

Cursor metadata is private orchestration state, outside the logical evidence
fingerprint and public report. A missing singleton starts at revision/offset zero.
Population shrink normalizes the effective evaluation offset to zero. Empty and
single-window no-op transitions do not repeatedly increment the revision. A CAS
miss leaves the saved evidence usable but does not move the cursor. Database
failure rolls back report, history and cursor together.

No new endpoint, migration, queue, timer, dependency or provider permission is
introduced. Daily allowances, reservations, quota date, capture status and capture
cooldown are untouched. Current capture recovery remains for incomplete windows.
All SQL values are parameterized. No raw titles, prompts, provider responses or
library identifiers are added to logs or public diagnostics.

The freshness reread does not claim permanent serializability of ingestion:
inventory can change afterward. Shared admission prevents concurrent capture;
the transactional cursor comparison fences changed ownership/configuration, and
the next evaluation fingerprints current source evidence again.

## Options and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Move the AI gate later in the capture worker | Small local edit | Still couples evaluation scheduling to capture lifecycle/status | Reject |
| New scheduler, cursor table or external queue | Independent ownership | More migrations, coordination and recovery paths | Defer |
| Publication-owned conditional cursor update | Atomic with saved evidence; restart-safe; no inference permission | Conservative checkpoint guards can hold a window | Implement |

Recommended stack: small ESM eligibility/freshness service → existing isolated
evaluation worker and shared admission → transactional PostgreSQL compare-and-set
→ existing protected aggregate API and nonpersistent Vue SWR summary.

## Research and accessibility

Official sources discovered through online search/link tools and checked September
25, 2026; these are engineering applications, not certification claims:

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  explains transaction-held row locks and application-managed advisory locks. Use
  the existing admission lock consistently and a short conditional UPDATE for
  durable ownership. Do not hold a database transaction during evaluation.
- [AWS: making retries safe with idempotent APIs](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)
  motivates distinguishing repeat intent from a new operation. Pair the expected
  revision with the offset: offset alone becomes ambiguous after a complete cycle.
- [W3C WCAG 2.2: Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  informs the existing pausable automatic summary. Preserve its keyboard pause,
  focus, disclosure and access-loss clearing; no extra live panel is needed.

## Verification plan

Test full/partial/tail windows, malformed/legacy reports, deterministic/mixed/cache
outcomes, source/config/cache drift, cancellation, restart, disabled and exhausted
budgets, duplicate and stale updates, wraparound, unpublished checkpoint retention,
exact publication consumption, transaction rollback and no provider/routing calls.
Use synthetic movie/TV fixtures only; music remains excluded. Run focused and full
regressions before committing. Record actual results separately in the outcome
document. No release or live deployment is part of this change.
