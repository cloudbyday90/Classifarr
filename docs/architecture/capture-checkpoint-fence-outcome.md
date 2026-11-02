# Automatic capture checkpoint fence outcome

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Design: [agreed checkpoint boundary](capture-checkpoint-fence-design.md).
Base: 988807e2d915e03ea1cba74cd62bfa6db1d4d058 on main.

## Result and evidence

Automatic checkpoint open, record and the existing atomic progress/cache publish
now require the flight's acknowledged revision/UUID. The worker passes private
callbacks from its existing claim helper. A modular checkpoint repository and
SQL leaf retain the current transaction/bootstrap helper and payload contract.
No provider input, public result or log receives the UUID.

Each transaction locks the owned budget row first, rechecks cooperative stop,
then dispatches retention checks and UUID-guarded commands with fresh statement
anchors. The row stays locked through commit. Open verifies ownership before a
retained-result early return. Publish keeps its progress replacement and cache
INSERT/SELECT in one transaction. Local record state changes only after the
transaction is acknowledged. Existing seven-day retention and cache reuse do
not gain a new lease or payload version.

Only exact numeric zero from the owner prelock creates private refusal evidence.
After transaction settlement the flight latches that evidence, returns existing
deferral/five-minute fallback and suppresses stale cleanup, including admission
error replacement. Permanent stop still takes precedence. Ordinary key/lease/
eligibility zero remains budget-changed; malformed results, forged error text,
serialization/query failures and lost COMMIT acknowledgement cannot prove loss
of ownership. No write or provider attempt is replayed or refunded.

The pre-change production-factory PostgreSQL regression failed all three
operations: a replaced claim could still open, record and publish. The updated
focused unit checks pass seven suites / 102 tests. The expanded isolated
PostgreSQL checks pass ten suites / 80 tests, covering real owner-session
claims, both lock orders, missing-singleton rollback, queued/locked/updated stop,
fresh lease time after waiting, inherited repeatable-read isolation and the
existing 15-second statement / one-second lock limits. A lease expiring between
progress update and publication source selection rolls the entire transaction
back, without minting ownership evidence.

For each operation, delayed or lost acknowledgement after a real PostgreSQL
COMMIT leaves its durable effect and existing charge intact. A replacement
claim can commit before that older acknowledgement arrives; neither response
delivery nor a rejected response establishes current ownership. The tests make
one COMMIT attempt and perform no uncertain replay.

Loopback generation tests exercise the production capture/client and worker:
replacement before open permits zero generation POSTs; replacement before
record/publish preserves the one charged POST and prevents stale saving or a
second cleanup/HTTP attempt. These worker fixtures use explicit synthetic
initial authority; real claim-session ordering is proved by the database suite.
Existing manual-cache, finalization, reservation and restore controls also pass.

## Ownership review and quality

The complete repository, extracted leaves, claim helper, caller and transaction
path were reviewed. Exactly two affected inventory source entries were pinned
to a dedicated unresolved review. The existing manifest already had 100 reviews;
an unreferenced comparison_concurrent_measurement review was removed to retain
that limit. No current source used it. The baseline, parser, classifications and
gate implementation are unchanged. The gate and its 42 unit tests pass;
productionCompatible remains false and grants no production writer authority.

The first coverage attempt loaded the oversized review manifest. It was stopped
and restarted after the manifest correction; that interrupted receipt is not
reported as passing coverage. Final coverage and delivery receipts follow below.

## Limits and next recommendation

The fence rejects an older automatic checkpoint transaction serialized after a
new claim commits. A transaction serialized earlier can commit first. It does
not revoke a previously accepted charge, make SQL/HTTP atomic or fence the
independent manual cache writer. Older binaries, physical rollback and ordinary
read-time reset/pruning remain separate boundaries.

The subsequent [advance fence outcome](capture-advance-fence-outcome.md) records
completion of same-revision rotation/progress-clear fencing. The next separate
investigation is read-time budget retention maintenance under row contention.
Keep manual cache authority, broader shutdown/acquisition and any durable
provider-dispatch protocol separately scoped.

The recommended stack remains private acknowledged authority, owner prelock plus
guarded SQL, settled trusted refusal, atomic save without uncertain replay, and
real database/HTTP proof. The extra short row-lock query is the cost; preserving
an existing progress/cache publication inside that boundary closes the full
automatic transaction gap without a new coordination framework.

Routine operation stays automatic. No schema, UI, API, CLI trigger, setting,
job, provider permission, routing/learning change, release or deployment is added.
The [independent client tooling outcome](client-tooling-pr-579-outcome.md) records
its own dependency, compiler and npm hold boundaries.

## Final verification and maintenance

| Check | Observed result |
| --- | --- |
| Focused unit and isolated PostgreSQL | Seven suites / 102 tests; ten suites / 80 tests passed |
| Fresh full backend unit coverage | 1,922 suites; 62,274 passed, one existing skip; 782.118 seconds |
| Backend coverage S/B/F/L | 89.24 / 86.64 / 90.79 / 89.24 percent |
| Fresh client coverage | 483 files / 7,508 tests passed; 277.51 seconds |
| Client coverage S/B/F/L | 87.90 / 82.04 / 87.69 / 89.58 percent |
| Joint coverage ratchet | Passed with both current reports; baseline unchanged |
| Production client build and browser checks | Passed; eight Chromium checks |
| Lint/types, both Knip gates, source/policy/ownership checks | Passed |
| Markdown, staged secret and whitespace checks | Passed |

No earlier coverage result is reused. The client ratchet artifact is its current
coverage/index.html; the backend uses coverage-summary.json. Hashes and bounded
verification receipts remain private under .tmp.

Artifact maintenance reused the verified filesystem inventory and existing
changed-directory/unreviewed-file exclusions. Fresh same-context daemon,
all-container and comparable image reads confirm three unchanged containers and
425 image-tag rows, no remaining Testcontainers, stable image metadata and an
unchanged healthy Classifarr identity/image/start time. No files/images were
removed. Recovery/reference assets, current evidence, worktrees, shared cache/
volumes and other projects remain protected. The independent client outcome
records the corrected comparison of Docker inventory flags.

Separate design/outcomes, historical follow-ups and Unreleased are updated on
main. The selected client PR is only partially adopted locally and remains
unmerged; both open Dependabot branches are fresh and mergeable at delivery
review, so no stale branch rebase is required. No release, deployment or service
restart is performed. Raw evidence and credentials are not committed.
