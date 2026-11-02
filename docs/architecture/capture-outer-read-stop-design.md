# Capture outer maintenance stop design

Date: 2026-11-02 (America/New_York). Status: implemented and verified.
Observed results: [stop outcome](capture-outer-read-stop-outcome.md).
Base: a8f3d431b2d5a054915d1e097252847a4af1626c on main.
Predecessor: [maintenance outcome](adjudication-budget-maintenance-outcome.md).

## Reproduced boundary

The automatic capture worker awaits budget.read before discovery admission.
That read performs ordinary transactional maintenance, including default-row
bootstrap, quota reset and progress pruning. Its repository checks stop before
COMMIT, but a successful COMMIT acknowledgement can settle after permanent stop.
The worker currently examines the returned state without rechecking stop.

An isolated production-database-factory test pauses delivery after PostgreSQL
actually commits. A second connection sees the durable default-disabled row.
Stopping the worker does not settle its original flight before acknowledgement;
after release, that flight incorrectly returns disabled rather than stopped.
This is a lifecycle result defect, not evidence that the commit was undone.
The production inner admission already checks its signal after its callback;
this proposal does not infer an equivalent inner defect from simpler test mocks.

## Agreed implementation candidate

Immediately after the outer budget.read await, check the existing permanent
controller signal with throwIfAborted, before any state branch or admission.
Use the current catch/failure result, where permanent stop takes precedence.
Keep this single check in the existing small worker factory; another service
abstraction would add no independent responsibility.

Keep awaiting the ordinary transaction. Preserve SQL, limits, isolation,
coalescing, original errors, early statuses when running, local cooldowns,
ownership, reservations, finalization and all provider gates. Add no deadline,
SQL cancellation, detached task, replay, refund or claim of immediate shutdown.
A committed maintenance effect can survive a stopped lifecycle result; rejected
or lost acknowledgements remain uncertain and must not cause another attempt.

No UI, operator CLI trigger, endpoint, setting, schema, job, routing, learning,
release, deployment, production restart or cleanup is included.

## Official research and alternatives

Sources were discovered/read through MCP on November 2, 2026. Node documents
that throwIfAborted throws the signal reason when aborted; using it after an
await is our application-specific result-acceptance check, not SQL cancellation.
See [Node AbortSignal](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html).
The installed Node 24.22.1 pin remains unchanged.

The existing transaction uses one checked-out client for all statements, as
required by [node-postgres transaction guidance](https://node-postgres.com/features/transactions).
Keep that boundary instead of racing a write against an abort promise.

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Post-await permanent-stop check | Small, truthful lifecycle result; blocks later admission | Does not undo a completed write or bound its settlement |
| Race the transaction against stop | Earlier local response | Detached settlement and ambiguous durability; rejected |
| Change shared transaction handling | Broader uniformity | Unrelated callers and commit semantics would change; separate design required |

Recommendation stack: retain transaction settlement, recheck permanent stop at
this acceptance boundary, verify it with durable PostgreSQL evidence, then keep
broader lifecycle/ownership work separately scoped.

[W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
applies to user-visible markup status changes. This backend-only batch adds no
status content or announcement and makes no accessibility-conformance claim.
It preserves the existing automatic process without operator steps or UI clutter.

## Verification

Freeze the failing real PostgreSQL test before the runtime edit. Cover disabled,
outside-window, cooldown and ready successful settlements after stop; assert no
admission, claim, workload, capture or finish. Verify pre-stop coalescing,
post-stop immediate results, pending original settlement, rejection/lost replies
and unstopped controls. Observe actual committed reset/prune/bootstrap through
an independent connection; exactly one COMMIT and no replay.

Run focused lifecycle suites, the production-factory PostgreSQL suites, quality
and ownership gates and fresh backend coverage. Client evidence may be reused
only with unchanged source/tree/report hashes. Record results in a separate
outcome document and Unreleased, then commit/push on main without a release.
