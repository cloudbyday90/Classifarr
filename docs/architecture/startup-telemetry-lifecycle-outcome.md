# Optional startup telemetry: implementation outcome

Date: 2026-09-30. Base revision: `381dcf1fb52c41a2b8db60415d91c99a39215e71`.

## Delivered

Implemented the [independent lifecycle design](startup-telemetry-lifecycle-design.md)
using the existing receipt service/repository and a separate ESM diagnostics
module. Timers and manual flushes now use the bootstrap context, concurrent
flushes share a promise, and normal shutdown stops optional collection. No database
ownership guard was removed or weakened.

The regression suite was run against the old implementation first: the delayed
receipt failed, overlapping flushes did not share ownership, shutdown had no stop
operation and logger failures were not contained. Those cases now pass.

## Validation

Focused validation passed 61 tests in four suites, covering delayed context,
156-key bounds, idle/unreferenced timers, concurrent observations, stop during a
write, idempotent destruction, all diagnostic categories and failing loggers, plus
existing health, shutdown and database-client ownership behavior.

Four disposable PostgreSQL tests passed across the new receipt suite and the
existing database-client recovery suite. They exercise real advisory unlock,
actual aggregate increments, atomic aggregation by independent service instances,
late inventory-query refusal, actual missing-table rejection and subsequent
recovery without replay. No live database or provider is used by these tests.

The wider integration run initially passed all 49 assertions but failed the
existing fencing suite's role-cleanup hook with `could not open relation with
OID`. This is consistent with a race between connection socket closure and backend
temporary-object cleanup. The fixture now waits for actual termination of only
its generated roles' sessions in its disposable database before reassigning and
dropping roles. PostgreSQL documents that a positive timeout waits for termination,
whereas the default only confirms signal delivery.
[PostgreSQL server signaling](https://www.postgresql.org/docs/18/functions-admin.html).
All 49 tests and cleanup then passed; the fencing suite also passed three
additional consecutive isolated runs (25 tests each).

The final expanded PostgreSQL run passed 145 tests across 11 suites, including
queue API/robustness, claim/enrichment fencing, metadata-refill retry ownership,
schema maintenance and runtime admission alongside the new receipt tests.

The first full backend run flagged three intentionally swallowed best-effort
rejections. They now have the repository-required explanation comments, and the
focused code-health/ownership/lifecycle run passed 30,526 tests across six suites.
No check or safety baseline was disabled.

Final full validation on Node 24.18.1:

- Backend: 47,433 tests passed in 1,560 suites, with coverage (517 seconds).
- Frontend: 5,795 tests passed in 411 files, with coverage (250 seconds).
- Expanded PostgreSQL integration: 145 tests passed in 11 suites.
- Backend/frontend lint and type checks, frontend production build, development
  and production Knip checks, copyright, Markdown, ESM import/mock-shape checks,
  npm CLI flag checks, ownership review and `git diff --check` passed.
- Coverage ratchet passed without baseline changes. Backend statements/branches/
  functions/lines: 90.21/85.10/91.89/90.21%; frontend:
  86.11/78.76/85.56/88.03%. The receipt service and new diagnostics module report
  100% across these measures; coverage is not a proof of complete correctness.
- The ownership gate pins seven lifecycle/guard dependencies, passes drift review
  and still reports 490 unresolved entries with `productionCompatible: false`.
  No unrelated writer was reclassified or authorized.

## PR, release and deployment boundaries

GitHub MCP search for open PRs in `cloudbyday90/Classifarr` returned no candidates
on September 30, 2026. No PR could be selected, applied or merged; no substitute
PR was invented. This is an Unreleased change with no version bump or release.

The previous round's no-cache rebuild ran the preceding schema-boundary image.
This round has not rebuilt or restarted the running container, changed routing,
edited ownership records or replaced credentials. Live disappearance of the
telemetry warning is therefore not claimed. `legacy_owner_unknown` is a separate
unresolved safety condition and is not repaired by this change.

## Next item

Rehearse embedded OS/HBA/credential isolation and privileged-task handoff,
including orderly Node/PostgreSQL shutdown and fresh-install/upgrade/restore
parity. This is the next prerequisite for safe automatic legacy recovery; adding
more status text or assigning fictional historical owners would not solve it.
