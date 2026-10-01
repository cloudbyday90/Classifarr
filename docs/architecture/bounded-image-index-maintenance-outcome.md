# Bounded image-index maintenance outcome

Date: September 30, 2026. No release or deployment identity cutover.

## Implemented

The [design](bounded-image-index-maintenance-design.md) is implemented as four
small service modules: immutable index definitions, catalog validation, queue
claims and bounded execution. The existing queue adapter delegates to that
executor; a new one-shot command shares it through the fixed supervisor allowlist.

The executor repairs an interrupted matching index, preserves healthy indexes,
and refuses unexpected same-name objects or definitions. It validates all three
indexes before acknowledging the received, unexpired queue claim. Payloads cannot
supply SQL or increase resource limits. Session settings and locks cannot leak
back into the connection pool because the session is discarded on every exit.

Index work uses 64 MiB maintenance memory, no parallel maintenance workers, a
two-second lock timeout, a two-minute session budget and the claim's remaining
deadline. These are work bounds, not a total RSS/CPU/disk quota. The CLI adds a
three-minute process watchdog covering connection and cleanup failures.

Index-lock contention defers an owned task for 60 seconds without charging an
attempt. Admission denial or a restore quarantine does not write to the queue:
an online claim remains subject to normal visibility recovery. Actual one-shot
failures consume the stored finite attempt budget. No new polling loop is added.

## Validation

- Targeted unit/adapter regression: 199 tests in seven suites passed.
- Real PostgreSQL/pgvector: 27 tests in two suites passed, covering cancelled
  concurrent build recovery, wrong definitions, no-work setup, claim loss/expiry,
  contention, restore exclusion and terminal retry budgets.
- Disposable embedded Docker drill passed: actual maintenance identity and
  fixed child execution, restricted runtime CREATE/DROP INDEX denial, data
  preservation, encrypted restore and legacy crash/restart recovery.
- Default/custom UID and Unraid `99:100` lifecycle checks passed. Stop checks
  measured 2,426 / 2,563 / 2,589 ms in the final-source run, including verification,
  within ten seconds.
  Disposable drill containers, images and volumes were removed successfully.
- Clean final backend coverage run: 48,008 tests passed in 1,578 suites; one
  existing skip. Frontend coverage run: 5,795 tests passed in 411 suites, and the
  production build passed. Combined coverage ratchet passed without regressions.
- Server/client lint and types, Markdown, copyright, ESM imports/mock shapes,
  Knip and policy naming/language/maintenance checks passed.
- Ownership review passed with 19 owned, 169 separately coordinated and 490
  unresolved paths. No unresolved path was waived or certified compatible.

The initial full regression exposed an old pooled-query expectation and a broad
classification-method scanner collision. The queue tests now assert delegation,
while executor/real-database tests assert actual DDL and completion. Renaming the
index contract field to `accessMethod` disambiguated the domain without relaxing
the classification constraint test. A clean full rerun then passed against the
final source; no failing validation check is being handed off.

## Operation and boundaries

With normal runtimes stopped, a trusted maintenance operator can run:

```sh
node server/src/scripts/runImageIndexMaintenance.mjs --apply
```

Use the existing trusted database connection configuration. The command processes
at most one already queued `rebuild_hnsw_index` job; it creates no new jobs and
accepts no SQL, object names or payload arguments. Exit 0 means completed/no work,
75 means deferred, and 1 means failure. Connection details are not printed.

The legacy online adapter still uses the existing database identity. This change
does **not** claim that production runtime owner privileges have been removed.
The offline path is ready for the later coordinated identity cutover. No live
database, running Classifarr container, saved Compose/Unraid template, routing
setting, schema version or release number was changed.

Concurrent index DDL and claim revocation cannot be atomic. Revocation can race
a statement start/completion; subsequent claim checks and acknowledgement fail
closed. The advisory lock coordinates participating executors, not arbitrary
external administrator SQL. Large builds may exhaust the finite time/attempt
budget and require a planned maintenance window.

## Open PR request

GitHub MCP and the saved GitHub CLI login returned no open pull requests. The CLI
recheck also returned an empty list. No random PR was available to implement;
none was invented, merged or closed.

## Recommendation and next component

Keep this bounded, allowlisted executor and the staged one-shot identity handoff.
The tradeoff is additional catalog checks and explicit failure for builds exceeding
the budget, in exchange for avoiding false success and unrestricted background DDL.

Next: evaluate the two `VACUUM ANALYZE task_queue` paths in
`queueMaintenanceService.mjs`. Measure autovacuum coverage and queue churn, then
move any necessary supplemental vacuum into a bounded maintenance path with
verified execution evidence. PostgreSQL can skip unauthorized tables rather than
throw, so a successful query promise is insufficient. The official research and
recommendation stack are recorded in the design document.
