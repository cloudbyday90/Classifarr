# Capture reservation fence outcome

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Design: [scope, tradeoffs and research](capture-reservation-fence-design.md).

## Result

Automatic reservation now requires the existing acknowledged revision/UUID.
The per-flight helper binds it privately; downstream capture/provider code sees
only the existing fixed reservation callback. There is no unfenced reservation
fallback and no new attempt table or schema change.

The transaction locks the exact owner row before the reservation-specific UTC
reset. Both reset and charge retain the UUID predicate. Stop is checked after
the lock; existing entry/exit checks, statement/lock limits and inherited
isolation remain. An exact zero-row owner result throws inside the transaction,
rolling back reset and default-singleton bootstrap. Quota/window refusal remains
budget_exhausted. Invalid counts and ordinary query/COMMIT failures remain
failures and cannot authorize generation.

A small leaf module marks only repository-minted refusal objects in a private
WeakSet. The helper recognizes identity after the repository attempt settles;
provider messages, SQLSTATE-like values and hostile properties cannot mint that
evidence. Proven ownership loss latches the existing deferred/five-minute local
fallback and suppresses stale cleanup, even if admission replaces the error.
Permanent stop retains precedence. No reservation is refunded or replayed.

Finish and reservation reuse the same owner-lock SQL, now named for their shared
purpose. The duplicate export alias caught by Knip was removed. No linter rule
or ownership classification was relaxed. The ordinary budget-read day reset,
checkpoint/advance/publication and manual cache writer are unchanged.

## Verification

New regressions first failed against the old reservation implementation: an old
claim could reset yesterday's counters and charge after replacement. The
private-helper regression also failed before its binding existed.

The focused backend unit run passed six suites / 82 tests. The final PostgreSQL
run passed fifteen suites / 145 tests in 131.156 seconds, using the production
database factory and real owner-session claims. It proves:

- replacement before reservation and replacement while reservation waits;
- an earlier locked charge committing before a later claim, with exact counters;
- UTC rollover and concurrent quota limits, current-owner disabled/closed/future/
  exhausted refusal, and rollback without a committed default row;
- cooperative stop while queued or locked, inherited isolation and existing
  15-second statement / one-second lock limits;
- no generation POST after ownership refusal or a lost reservation COMMIT
  reply, without refunding the committed charge;
- a delayed successful reservation acknowledgement allowing its earlier charge
  to dispatch after replacement, followed by rejection of a second stale charge;
- existing finalization, workload, interruption, cache/publication and replay
  behavior through the adjacent integration suites.

Older quota/control/cancellation fixtures now supply explicit synthetic authority
when ownership itself is not under test. Real ownership tests use actual minted
claims. Some old assertions now correctly expect ownership refusal for obsolete
revisions rather than quota exhaustion. One fixture lacking a seeded claim was
corrected before the final PostgreSQL run; an interrupted preliminary run is not
reported as passing evidence.

Server/client lint and typecheck, normal/production Knip, dependency policy,
static import/mock checks, copyright, four policy gates and reviewed ownership
checks passed. The single affected ownership source pin was reviewed against
the full transaction/SQL/caller path. Baseline and classifications are unchanged;
productionCompatible remains false and grants no production writer authority.
Full backend coverage passed 1,919 suites / 62,186 tests with one existing skip
in 797.87 seconds. Coverage is 89.23% statements/lines, 86.65% branches and
90.79% functions. The coverage ratchet passed with both fresh reports and no
baseline changes. Markdown and whitespace checks passed.

Fresh frontend coverage passed 483 files / 7,505 tests in 250.43 seconds, with
87.90% statements, 82.04% branches, 87.69% functions and 89.58% lines. The
production browser build and all eight asset/navigation checks also passed.

## Limits and recommendation stack

This rejects a new old-owner reservation after a replacement claim commits.
It does not revoke a charge accepted before replacement or make SQL and HTTP
atomic. Provider inspection may have occurred before reservation; an earlier
accepted generation POST can still dispatch later if lease loss is unobserved.
No database transaction is held over HTTP and no remote work is assumed undone.

Legacy writers, ordinary read maintenance, checkpoint writes, same-revision
advance and publication remain separate authority boundaries. No new timeout,
queue, setting, endpoint, UI, operator CLI trigger, job, provider permission,
routing or learning change was introduced. Routine operation remains automatic.

The independent [client Axios outcome](client-axios-1-21-outcome.md) identified
an existing high redirect dependency advisory. The subsequent
[cross-realm fix](redirect-cross-realm-fix-outcome.md) completes the coupled
root/client 1.16.2 patch. Assess the remaining RE2JS/Markdownlint developer-chain
advisory next, then extend attempt fencing to checkpoint/advance/publication while preserving manual
cache authority and retention. Keep whole-worker shutdown/write acquisition
and any durable provider dispatch protocol separately scoped.

Work stays on main with Unreleased notes and no version bump, release,
deployment, application restart or PR merge.

Artifact maintenance reused the recent verified filesystem inventory and existing
changed-directory/unreviewed-file exclusions. Fresh desktop-linux daemon,
all-container and image metadata show three containers, 425 image-tag rows,
no remaining Testcontainers, and unchanged Classifarr identity/image/start time
and healthy state. No files or images were removed. Current validation evidence,
recovery assets, shared resources and other projects remain protected. Receipts
are private under .tmp.
