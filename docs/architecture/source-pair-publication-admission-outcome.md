# Source-pair publication admission investigation outcome

Date: 2026-11-02 (America/New_York).
Design, alternatives and official research: [admission design](source-pair-publication-admission-design.md).
Base: a85ec7eb76e80ba1ad86ef16fef35f999f281080 on main.

## Finding and implementation

No healthy cooperating-worker pruning defect was demonstrated. The evaluator
holds shared discovery admission through publication. Current automatic capture
creates fresh progress under the same advisory key. The claimless outer budget
read can overlap, but cannot create the fresh lease required by the proposed
race. Preserve current SQL and transaction ordering.

The implementation adds five isolated PostgreSQL regression cases and a small
integration-only fixture. They use the production database factory, evaluator
constructor, discovery/finalization admission, resource policy and repository
writes. Independent owners have separate pools and resource-policy instances;
exclusion therefore exercises the shared PostgreSQL advisory key, rather than
only an in-process busy flag.

The fixture supplies deterministic memory telemetry and synthetic bounded
snapshot/computation data. It does not exercise live ingestion, provider
generation, the worker-thread transport or the separate quality collector.
The existing broader domain suites run alongside it. These tests concern
orchestration and durability, not classifier accuracy or historical recovery.

## Observed PostgreSQL boundaries

1. Capture holds admission while checkpoint open has the real budget row lock.
   Evaluation returns its existing busy deferral before snapshot/computation or
   report save. After capture commits and releases admission, a due evaluator
   reaches the real progression prune/CAS, publishes its report and preserves the
   exact fresh unpublished progress, revision, cursor and charged reservation.
2. Evaluation holds its own session lock and discovery admission while its report
   write waits for pool capacity. Capture's independent admission refuses entry.
   After capacity is released, the same exclusion holds while the report write
   is paused and remains uncommitted.
3. After actual successful COMMIT, an independent observer sees the report while
   delivery of the acknowledgement remains paused. Capture is still excluded.
4. After actual ROLLBACK, the observer sees no report while the rollback reply is
   paused. Capture remains excluded through that transaction settlement too.
5. A lost acknowledgement is injected only after PostgreSQL actually commits.
   The observer first proves durability; the evaluator later keeps its existing
   failed lifecycle/failure-record behavior. This is not rollback evidence and
   does not replay report publication. Failure metadata remains a separate
   existing write, rather than a second report-save attempt.

Every case retains valid unpublished budget progress and quotas. The shared cache
is empty in this focused fixture and stays empty; broader cache retention is
covered by the existing related suites. Capture never reaches its callback/claim/checkpoint while evaluation
owns admission; normal admission becomes available after settlement. Existing
CAS-zero semantics, retry authority and observed lease-loss handling are unchanged.

The first run passed four new cases. One fixture's due-state UPDATE violated the
database's observed-at/next-check constraint. Correcting both synthetic timestamps
resolved that setup error; no application or database constraint was changed.

## Verification and coverage provenance

| Check | Observed result |
| --- | --- |
| New and related isolated PostgreSQL suites | Seven suites / 82 tests passed |
| Focused retention, progression and ownership unit suites | Five suites / 144 tests passed |
| Background lifecycle and source-pair readiness wiring | Two suites / 14 tests passed |
| Retained compiler's real-CLI regression controls | One file / 12 tests passed |
| Root lint/types and both server Knip gates | Passed |
| Static imports, mock shapes, copyright, policy and ownership gates | Passed |
| Joint coverage ratchet | Passed with verified unchanged reports |

No production source, unit test, compiler fixture, manifest, dependency lock or
installed-lock input changed. New code is confined to the integration directory,
which the unit configuration explicitly excludes. All nine project manifest/
lock/installed-lock hashes and both actual coverage-report hashes match intake.

Reuse the full backend report from the predecessor: 1,927 suites, 62,402 passed,
one existing skip; S/B/F/L 89.25/86.65/90.80/89.25 percent. Reuse the client
484-file / 7,521-test report at 87.90/82.04/87.69/89.57 percent. These are prior
full runs with unchanged inputs, not new full coverage executions. The fresh
targeted executions are listed above; no new build/browser run is claimed.
Coverage baselines, ownership review entries/classifications and parser pin stay
unchanged; the passing ownership gate still does not establish global writer
compatibility.

## Selected PR, audit and maintenance

One uniform random selection chose [PR 581](https://github.com/cloudbyday90/Classifarr/pull/581).
The exact candidate head, published artifact and client inputs are unchanged
from its [five-regression assessment](client-compiler-pr-581-outcome.md). Fresh
official upstream review found no changed fixed candidate. Retain vue-tsc 3.3.13
and the settled deferral; no second PR or dependency change was forced into the
batch. PR 580's patch is already present on main. Both heads remain unmerged and
mergeable; neither requires a rebase merely because main has advanced.

Fresh full audits include development dependencies: root zero findings; server
29 moderate / three low affected package nodes; client eleven moderate nodes;
zero high/critical in each project. These counts are not unique advisories or
proof of exploitability. Existing tooling findings and the separate npm bundled
parser hold stay visible; install/scanner policy is unchanged.

Fresh artifact inventory confirms the same daemon, three containers, 425 image-
tag rows and five worktrees. The existing Classifarr identity/image/start time
and healthy state are unchanged; no Testcontainers remain. No pre-existing files,
images or worktrees were removed. Recovery/reference assets, current evidence,
shared caches/volumes and other projects are preserved. Raw logs, hashes,
selection and maintenance receipts remain privately under .tmp.

## Recommendation stack and remaining limits

Retain shared admission and the existing report/history/sweep/budget order;
keep the new production-factory regressions as evidence for that boundary;
require a demonstrably reachable failure before proposing a progression prelock.
The benefit is regression protection without a second coordination protocol.
The limit is cooperative ownership: this does not prove exclusion against delayed
loss observation, older/nonparticipating writers, privileged SQL or physical
rollback. Observed lease-loss and atomic rollback controls remain necessary.

Close this maintenance thread rather than require another speculative fence.
Existing nested lock-scope and queued-child rollback tests already cover the
observed-loss mechanism; another evaluator-specific fault case would add optional
evidence, not fix a demonstrated defect or close the undetected-loss boundary.

Next, read-only verify the currently running Unraid revision/schema and saved
automatic purpose-evaluation summary. Distinguish undeployed capability, no
retained choices, evidence gaps, deferred work and stale/failed collection before
choosing a classification change. Do not reuse older deployment observations as
current. Use the existing Evaluation progress and History review surfaces; add
no dashboard or routine CLI step. If needed code is not deployed, prepare a
separate concrete readiness/deployment recommendation; deployment is not
authorized by this batch. If it is deployed, prioritize a demonstrated disagreement
from its automatically collected evidence. This follows the earlier
[automatic-summary recommendation](automatic-purpose-evaluation-outcome.md).

Routine operation remains automatic. No runtime SQL/lock, schema, job, endpoint,
UI, operator CLI trigger, provider permission, routing/learning, release or
deployment change is part of this batch. Separate design/outcome documentation
and Unreleased record the evidence; delivery stays on main.
