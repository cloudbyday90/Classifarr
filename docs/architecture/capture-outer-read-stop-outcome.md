# Capture outer maintenance stop outcome

Date: 2026-11-02 (America/New_York).
Design and research: [stop design](capture-outer-read-stop-design.md).
Base: a8f3d431b2d5a054915d1e097252847a4af1626c on main.

## Observed defect and change

The pre-edit isolated PostgreSQL regression failed: a fresh disabled budget row
was already committed and visible to an independent connection, the worker was
stopped while delivery of that successful COMMIT acknowledgement was gated, and
the original flight returned disabled after release. It remained pending before
release, so this was a result-acceptance gap rather than detached work.

Added one permanent controller throwIfAborted check immediately after the outer
budget.read await in the existing worker factory. Existing failure handling now
returns stopped before any readiness branch or admission. No new service layer
is necessary for a single check in this small factory.

This result describes lifecycle only. A committed default row, quota rollover
or prune remains durable. The transaction still settles normally; no SQL,
timeout, cancellation adapter, retry, refund or uncertain replay was added.
The admitted callback and its production post-callback stop fences are unchanged.

## Verification evidence

The new production-factory PostgreSQL matrix has sixteen cases: disabled,
outside-window, cooldown and ready states; delayed and lost acknowledgements;
with and without permanent stop. Tests pause only after actual PostgreSQL COMMIT
succeeds, observe durable state through another connection, then release the
reply. They verify:

- Stopped original flights await settlement; pre-stop joiners share that flight,
  while post-stop invocations immediately return stopped.
- Stop prevents discovery admission and all downstream workload, evaluation,
  capture, reservation, checkpoint, rotation and finalization calls.
- Bootstrap or reset/prune remains committed, one transaction is attempted, and
  an existing shared cached batch remains byte-for-byte unchanged.
- Unstopped early statuses remain unchanged. Ready may reach an observation-only
  admission stub; this does not claim the production admission was bypassed.
- Unstopped lost replies remain unavailable with the existing local cooldown;
  stopped lost replies return stopped. Neither causes a replay.

Eight focused unit cases also cover missing returned state, rejected reads and
exact five-minute retry boundaries for ordinary budget-changed and unknown errors.
The existing admitted ownership/finalization suites remain in the selected checks.

| Check | Result |
| --- | --- |
| Focused unit suites, including real ESLint and ownership guards | Nine suites / 161 tests passed |
| Production-factory PostgreSQL and related lifecycle suites | Six suites / 67 tests passed |
| Lint, types, both Knip gates | Passed |
| Dependency install/tooling contract suite | 72 tests passed; no skips |
| Static imports, mock shapes, copyright and policy gates | Passed |
| Fresh full backend unit coverage | 1,927 suites; 62,402 passed, one existing skip; 809.47 seconds |
| Backend coverage S/B/F/L | 89.25 / 86.65 / 90.80 / 89.25 percent |
| Joint coverage ratchet | Passed; baseline unchanged |
| Markdown, staged secret and whitespace checks | Passed |

Client evidence is reused only after verifying its unchanged Git tree
72dc634291e67d06612aaf487ef3dbfbb4af1e03, clean source status, manifests/locks,
installed lock and actual coverage/index.html hash. Its retained report has
484 files / 7,521 tests. No new client test/build/browser run is claimed.

## Scope and next investigation

Routine execution remains automatic. No UI, operator CLI trigger, endpoint,
setting, schema, job, provider permission, routing or learning change, release,
deployment or production restart was added. Separate tooling work is recorded in
the [PR 580 outcome](server-eslint-pr-580-outcome.md).

Next, reproduce contention in the other caller of the exact budget-prune SQL:
sourcePairWindowProgressionRepository.mjs. The source-pair report/history save
can bootstrap the budget, prune progress and then attempt a revision/offset CAS
advance. It has no unconditional budget-row prelock before pruning; a later CAS
does not guard that earlier command. A waiting prune may recheck freshly committed
capture times against its older statement anchor. This is a concrete follow-up
hypothesis, not a newly demonstrated production defect. Start with isolated real
PostgreSQL ordering and existing retention/CAS controls; inspect the surrounding
report/history/sweep lock order before designing a prelock. The cooperating
evaluator and captures share discovery admission, which may already prevent the
interleaving: a direct repository fixture alone would not prove production
reachability. If that scheduling boundary excludes it, record the limitation
instead of adding speculative machinery. Keep manual/shared-cache authority and
broader ownership changes separately scoped.

Private receipts and diagnostic logs remain under .tmp, outside source control.

Artifact maintenance reused the verified filesystem inventory and protected
exclusions. Fresh same-context daemon, all-container and comparable image reads
confirm three unchanged containers, 425 image-tag rows, five worktrees and the
same healthy Classifarr identity/image/start time; no Testcontainers remain.
No pre-existing files, images or worktrees were removed. Recovery/reference
assets, current evidence, shared caches/volumes and other projects are preserved.
