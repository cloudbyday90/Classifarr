# Adjudication budget maintenance serialization outcome

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Design: [agreed maintenance boundary](adjudication-budget-maintenance-design.md).
Base: 1abeb78f35a109e8b0e76dc669a0c0972bc940f5 on main.

## Result and reproduced failure

Budget read-time maintenance now acquires an unconditional singleton row lock
before the existing reset/prune/SELECT commands. A sixteen-line ESM leaf reuses
the current transaction/bootstrap wrapper and SQL module. Its postlock stop
check precedes the time-based commands, whose statement anchors are dispatched
after serialization. No global clock replacement or query-predicate change is
needed.

The pre-change production-factory PostgreSQL regression failed: while maintenance
waited on checkpoint open, the owner committed a fresh capture and maintenance
then erased it. Both transactions succeeded; saved progress was null. The same
normative test now passes, with fresh progress/lease, current charge and UUID
preserved. Its gates observe actual row contention, rather than assuming a delay
or mocking database locking.

Maintenance remains independent of flight claims and works before admission and
while capture is disabled. It does not issue, recover or replace a UUID. Exact
prelock count one continues; exact zero becomes ordinary budget-changed/deferral,
not private ownership evidence. Missing/malformed counts are a fixed contract
failure. Existing reset/prune result handling and final projection remain intact.

Default bootstrap, UTC predicates, charges, revision/UUID, status/cooldown,
rotation, payload retention and cache authority are preserved. An ordinary write
transaction retains inherited isolation, 15-second statement/one-second lock
limits, acquisition policy and existing cooperative checks. The private status
CLI still bypasses maintenance with its existing SELECT. No SQL cancellation,
retry, queue, cooldown or whole-worker shutdown guarantee was added.

## Verification

Focused unit checks pass nine suites / 141 tests. The affected production-factory
PostgreSQL and existing loopback controls pass thirteen suites / 116 tests.
Coverage includes both maintenance/checkpoint lock orders, fresh/disabled
bootstrap, unchanged valid leases/cooldowns/cache, legitimate expired/future
cleanup and ordinary row absence after concurrent deletion.

A deliberately malformed driver lock reply rolls back a real fresh bootstrap;
that is adapter fault injection, not a claim that PostgreSQL emitted malformed
metadata. Unit controls distinguish exact zero from every malformed-count case
and reject private ownership attribution. Existing caller tests preserve deferral
versus unknown failure, five-minute local fallback and no claim/provider/finish
work before successful admission.

Real tests retain queued/postlock/post-DML stop rollback and repeatable-read
write semantics. PostgreSQL 40001 and 55P03 remain genuine errors with no private
refusal evidence; the row-lock timeout issues no maintenance DML or retry.

Delayed/lost replies after a real COMMIT preserve durable UTC reset/pruning, a
subsequent current-day charge and the current UUID. The earlier successful read
can acknowledge an older count; it is not current reservation authority. Each
transaction attempts one COMMIT and one reset/prune sequence. An independent
later maintenance invocation preserves the new charge instead of resetting it
again. No uncertain transaction is replayed, refunded or assumed rolled back.

## Ownership and independent evidence

The complete common repository, new maintenance leaf, SQL, transaction runner,
worker callers and private status boundary were reviewed. Exactly two inventory
entries changed: the common repository and the new indirect-query leaf. Their
actual source/analysis digests are pinned to the existing applicable review,
whose rationale was deliberately compressed below its limit. The 100-review cap,
baseline, server parser and unresolved classifications are unchanged. The gate
passes with productionCompatible false; it grants no production inventory-writer
authority.

Random selection again chose PR 581 at the same immutable head and published
compiler artifact already shown to fail five controls. Official upstream reports
remain unresolved. The settled deferral is retained without reinstallation,
new dependency changes or resampling; the
[compiler outcome recheck](client-compiler-pr-581-outcome.md#november-2-repeated-selection-recheck)
separates prior receipts from current checks. Neither open PR is merged; stale
branch handling is assessed again at delivery.

Client tracked source, manifest, lock, installed lock and coverage HTML remain
unchanged. Its existing report is reused, not presented as freshly executed:
484 files / 7,521 tests, coverage S/B/F/L 87.90 / 82.04 / 87.69 / 89.57 percent.
Both current project typechecks and client lint pass through the root gates.
Fresh backend coverage and the joint ratchet pass; their exact scope is below.

Full current project audits include development dependencies: root has zero
findings, server has 29 moderate / three low affected nodes and client has eleven
moderate nodes. Neither has high/critical project findings; runtime-only audits
are clear. The separate npm bundle hold remains: exact npm 12.2.2 still returns
registry E404. No scanner suppression, global upgrade or advisory-free toolchain
claim is made.

## Tradeoffs and next recommendation

The benefit is preserving freshly committed capture progress after contention
without weakening retention. The cost is one additional short query and row
serialization within existing limits. Keep the recommended stack: independent
maintenance authority, singleton prelock, explicit result boundary/postlock stop,
unchanged commands, one transaction and no uncertain replay.

Independent manual/shared-cache maintenance, older binaries and physical
rollback remain separate. This fix does not establish a global cache fence or
prove that another table has the same race. Existing coherent read snapshots
must not be mechanically changed to newer clock semantics.

Next reproduce the outer worker's successful-read settlement after permanent
stop. It currently interprets the returned state before rechecking the stop
controller, so a delayed successful COMMIT acknowledgement may yield disabled,
outside-window or cooldown after stop. This is a static lifecycle gap awaiting
a real delayed-acknowledgement regression, not a demonstrated provider dispatch
or production inner-read failure. Production admission already rechecks the
inner callback's signal; synthetic fixtures alone do not prove that wider bug.

If confirmed, scope a post-outer-read permanent-stop check while still awaiting
the existing transaction. Stopped would describe lifecycle only: committed
maintenance can remain durable. Keep SQL, timeouts, retries, admission and any
shared-worker extension separate from that follow-up.

## Final delivery

| Check | Observed result |
| --- | --- |
| Focused backend units | Nine suites / 141 tests passed |
| Affected isolated PostgreSQL and existing loopback | Thirteen suites / 116 tests passed |
| Fresh full backend unit coverage | 1,926 suites; 62,384 passed, one existing skip; 718.194 seconds |
| Backend coverage S/B/F/L | 89.25 / 86.65 / 90.80 / 89.25 percent |
| Client coverage | Reused unchanged 484-file / 7,521-test report; no new client coverage run |
| Joint coverage ratchet | Passed with fresh backend and verified unchanged client report; baseline unchanged |
| Dependency/tooling suite | 72/72 passed; no skips |
| Lint/types, both Knip gates and source/policy/ownership checks | Passed |
| Markdown, staged secret and whitespace checks | Passed |

The client Git tree, clean source status, manifests/locks, installed locks and
actual coverage/index.html hash match the retained receipts. All nine project
manifest/lock/installed-lock hashes remain unchanged; no dependency is updated.
Fresh backend JSON and retained client HTML hashes are recorded privately.

Artifact maintenance reused the verified filesystem inventory and six changed-
directory / 3,541 unreviewed-root-file exclusions. Fresh same-context daemon,
all-container and comparable image reads confirm three unchanged containers and
425 image-tag rows, no remaining Testcontainers, stable image metadata and an
unchanged healthy Classifarr identity/image/start time. No pre-existing files,
images or worktrees were removed. Recovery/reference assets, current evidence,
shared cache/volumes and other projects remain protected.

Both current Dependabot heads remain open, unmerged and mergeable at delivery
review; no genuinely stale applicable branch needs another rebase. The selected
compiler remains deferred. Separate design/outcome, relevant follow-ups and
Unreleased record the change. Routine execution stays automatic with no new
UI/API, operator CLI trigger, setting, job, schema, provider permission,
routing/learning change, release, deployment or service restart. Work stays on
main; raw test/SQL evidence, hashes and maintenance receipts remain under .tmp.
