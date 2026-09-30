# Database-enforced ingestion boundary: outcome

Date: 2026-09-30. Base revision: `7b4570ccdc6ed05d0274256e93ffeb8846150c60`.

## Delivered scope

Implemented the [design](ingestion-writer-fence-design.md) as modular ESM and fixed
SQL in a disposable real-schema PostgreSQL rehearsal. It uses independently
authenticated roles, not a privileged connection pretending to be a worker.
The ownership review gate explicitly tracks the five candidate source files;
unrelated shared-writer and indirect-SQL analysis debt is not reclassified.

## Verification

The focused real-database run passed **95 tests across three suites**: the new
25-test fence contract, 35 existing legacy reconciliation tests and 35 existing
ingestion recovery tests. Command, from `server/`:

```powershell
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --testPathPatterns='ingestion-writer-fence|library-ingestion-recovery|legacy-ingestion' --no-coverage
```

The fence tests verify:

- Committed legacy-login retirement, rejection of reconnects and rollback of an
  old session's unfinished write; removal of its table ownership.
- Direct DML, TRUNCATE, trigger disabling, parent cascades, owner-role escalation,
  private state, internal-function access and trusted-schema creation are denied.
- Cutover cannot conceal login retirement in an outer transaction. Lock timeout
  leaves adoption disabled and permits a later controlled retry.
- Shared advisory locks, wrong libraries/sessions/tokens and changed source
  revisions fail; reacquiring a lock cannot resurrect a superseded token.
- Terminating an active worker permits a replacement to replay its partial item
  idempotently. This is local row idempotency, not exactly-once provider execution.
- Recovery/receipt failures roll back; temporary objects cannot shadow trusted
  relations. Old inventory and unresolved-ID observations are preserved.
- Library-agnostic movie/TV fixtures work for Plex, Emby and Jellyfin. Disabled
  and unconfigured fixtures remain idle; music creation remains schema-rejected.
- Invalid payloads, cross-library identity stealing and the run item limit fail.

The focused unit contract contains 18 tests for environment/database/role guards,
idle construction, busy-owner deferral, retry/unlock and parameterized SQL.
The first complete backend coverage run executed 47,304 cases: 47,303 passed;
one ownership-gate assertion ran before its new review manifest was saved. After
the explicit source review was registered, the gate and both affected unit suites
passed (57 cases). A subsequent clean full backend run passed **all 47,304 tests
in 1,558 suites** using the completed source and manifest (`--no-coverage`, two
workers with a 512 MB idle worker limit). Coverage figures below come from the
preceding complete coverage run; the clean rerun did not overwrite that report.

Frontend validation passed 5,795 tests in 411 files. Server and client lint and
type checks, development/production dependency checks, ESM static-import and
mock-shape checks, Markdown lint, copyright, npm-flag checks and the ownership
gate passed. The gate still reports 490 unresolved paths: passing means no
unreviewed drift, not production writer compatibility.

The completed coverage reports pass the unchanged repository ratchet:

| Workspace | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| Server | 90.20% | 85.06% | 91.89% | 90.20% |
| Client | 86.11% | 78.76% | 85.56% | 88.03% |

No coverage threshold or baseline was lowered. The role installer's successful
database paths are covered by the separate integration suite, not the unit
coverage percentage alone.

## What this does not prove or change

The bootstrap superuser used by the live installation cannot be demoted like the
generated ordinary superuser in this fixture. No bootstrap/HBA cutover, historical
published binary, production migration, complete capture/prune contract or
representative performance benchmark was exercised. Synthetic budget seeding
tests the 1,000-item boundary, not 1,000 completed real-provider requests.

The live unknown-owner warning remains unresolved. No live marker, historical
ownership, inventory, routing, log retention, provider setting or credential was
changed. No local application rebuild, PR merge, tag or release was performed.
This change does not add a background process or alter production resource limits.

## Open PR check

GitHub MCP searches for open pull requests in `cloudbyday90/Classifarr` returned
no results on September 30. A random open PR could not be selected or implemented;
none was invented, substituted with a closed PR, or merged.

## Recommendation

Keep reviewed recovery as the current operational path. The next production
component is runtime/maintenance credential separation with a bootstrap-login
cutover and fresh/restore/restart acceptance tests. Follow that with full writer
capability migration before automatic legacy adoption. The benefit is an enforced
storage boundary; the cost is a deliberate compatibility migration rather than
an unsafe ownership backfill.

The first shared component is now specified and implemented in the
[schema maintenance/startup boundary](schema-maintenance-boundary-design.md).
Its [outcome](schema-maintenance-boundary-outcome.md) distinguishes the tested
one-shot process from the still-required OS/authentication and full writer cutover.
