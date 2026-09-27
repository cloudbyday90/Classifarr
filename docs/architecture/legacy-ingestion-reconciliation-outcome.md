# Legacy ingestion reconciliation outcome

## Scope and design

The [design decision](legacy-ingestion-reconciliation-design.md) is implemented
as modular ESM contract, repository, service and route files, plus a demand-loaded
Vue review component and non-persistent SWR composable. No dependency, service,
timer or workflow engine was added. Fresh installations without legacy markers
do not require this workflow; ordinary interrupted imports retain automatic
recovery.

The Library detail page now exposes an explicitly labeled enable checkbox.
Legacy markers remain discoverable while the library is disabled. Review shows
the exact bounded sync IDs and capture generation; confirmation requires the
administrator to verify that older instances and external scripts have stopped.
The server independently rechecks current administrator access, a disabled
movie/TV library, cooperative ownership and the exact snapshot revision.

The database transaction marks only reviewed unfinished records failed, retains
inventory and observations, creates a retry-wait checkpoint and records an audit
receipt. It never marks an unfinished import complete or enables the library.
Re-enabling is separate: the existing watchdog then replays from page zero, and
learning remains gated until full completion. Normal post-replay pruning is not
performed by reconciliation itself.

## Operator procedure

1. Open the affected library and select **Review blocked import**.
2. Clear **Library enabled** and save. Stop older Classifarr instances and any
   external capture scripts that write to this library. Keep them stopped during
   recovery; disabling this library alone cannot stop a noncooperating old writer.
3. Refresh the review. If ownership is active, wait for that import to stop; do
   not force takeover. If you cannot establish that older writers stopped, do
   not confirm.
4. Review the records, select the stopped-worker confirmation, and reconcile.
5. If the response is lost, select **Check recorded outcome**. An absent receipt
   is not proof of failure. A retry retains the same request ID and revision.
6. After a receipt appears and older workers remain stopped, enable the library
   and save. Watch normal ingestion recovery; the receipt proves reconciliation,
   not current enabled state, successful replay, metadata quality or learning.

Receipts follow existing audit retention. After retention, an old confirmation
still cannot replay against changed state: it must pass the exact revision
precondition. Preview and confirmation data are not persisted in browser storage.

## Verification

- Backend coverage run: **1,492 suites / 44,584 tests passed**. Statements and
  lines 90.29%, branches 84.59%, functions 92.25%.
- Final frontend coverage run: **397 files / 5,572 tests passed**. Statements
  85.87%, branches 78.33%, functions 85.33%, lines 87.85%.
- PostgreSQL integration: **182 suites / 2,055 tests passed**, with one existing
  skip. This includes 15 reconciliation regressions covering concurrent
  confirmations, exact revision checks, revoked administrator access, invalid
  receipts, overflow, audit-failure rollback, completed full replay and a
  fresh-library no-op.
- The final 16 focused client tests passed, including retention of an uncertain
  original confirmation after a rejected retry and UUIDv4 generation without
  `randomUUID`. Missing secure randomness sends no confirmation request.
- Chromium browser rehearsal passed both the new review/disable/confirm/receipt
  flow and the existing import-progress recovery flow. The mobile screenshot was
  inspected; the review has no horizontal overflow. Mocked APIs confirm no
  automatic enable request or additional confirmation write.
- Disposable application image builds, fresh-database startup, authoritative
  schema generation and the second schema round-trip check passed. Test
  containers and synthetic databases were cleaned up; the live container was
  not changed.
- Backend/frontend type checks, frontend lint, backend test lint, dependency
  checks, ESM checks, migration checks, Markdown lint and copyright checks passed.
  Backend security lint retains one pre-existing filesystem-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; there are no new lint errors.

The existing coverage ratchet passed unchanged. No test limits, thresholds or
production safety controls were relaxed to obtain these results.

## Operational boundaries

No live database mutation, deployment, release, tag or PR merge is included.
Two GitHub MCP open-PR queries returned no open PRs, so there was no random open
PR available to implement; a closed PR was not substituted.

An absent advisory lock cannot establish shutdown of older writers. This remains
explicit administrator-attested maintenance. It is not an automatic force-unlock
mechanism. Existing retention, routing, provider calls and AI configuration are
unchanged.

## Next component

Extend the existing inventory-writer compatibility tool into an **ingestion
ownership CI gate**. This addresses the remaining cause, rather than adding
another retry loop or asking operators to repeat legacy maintenance.

Reuse its static discovery and source fingerprints. Cover sync status, capture
state and ingestion checkpoints as well as inventory writes; classify each
reachable writer as owned, separately coordinated, or unresolved. A new or changed
unresolved writer should fail the gate until reviewed. Keep dynamic SQL and
external historical processes explicitly outside the proof boundary.

Then add isolated late-writer tests for each current writer admitted to the common
gateway. Acceptance is a reproducible writer inventory, no silent coverage gaps,
and evidence that a writer losing ownership cannot finalize or prune. This does
not retroactively make arbitrary old binaries safe; database-role separation and
database-enforced fencing would need their own design and compatibility tests.

The benefit is preventing new unowned write paths from reintroducing this issue.
The tradeoff is maintaining a small reviewed compatibility manifest, and static
analysis cannot prove arbitrary runtime behavior. Do not create a second writer
scanner or a new user-facing queue.
