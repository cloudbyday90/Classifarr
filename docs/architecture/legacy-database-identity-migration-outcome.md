# Legacy database identity migration outcome

Date: September 30, 2026. See the [design and research](legacy-database-identity-migration-design.md).

## Delivered

Modular ESM phase runner, protected durable journal, process-held migration lock
and bounded cold-tree utilities. The disposable PostgreSQL adapter migrates a
legacy shared-identity cluster copy, replaces candidate authentication, removes
the old password and verifies restricted runtime access without changing the source.

## Validation

- Final backend coverage run: 1,576 suites and 47,905 tests passed, one Linux-only
  test skipped on Windows. Statement/line coverage is 90.06%, branch coverage
  85.16% and function coverage 91.78%.
- Targeted migration/lifecycle tests: 71 passed, one Linux-only filesystem test
  skipped on Windows. The real Linux Docker drill exercises directory sync and
  ownership separately.
- Frontend coverage run: 411 files and 5,795 tests passed.
- Focused PostgreSQL integration: 58 tests in five suites passed, covering schema
  maintenance, restore sessions/tables and restore admission evidence.
- Real Docker isolation drill: seven core checks passed, including legacy data
  conversion, process termination after phase effects, termination while the
  candidate PostgreSQL process remained running, and independent resumption.
  The final rerun also verified runtime schema readiness with the restricted role.
- Existing non-root default/custom identity and Unraid `99:100` lifecycle checks
  passed. The final Unraid stop check took 3,782 ms including verification, within
  its ten-second deadline. Disposable containers and volumes were cleaned up.
- The first complete core drill measured 62,276 ms and 93,924 KiB peak orchestrator
  RSS. These are synthetic fixture observations, not database capacity estimates
  or total container memory. A subsequent final-source run also passed.
- Server/client lint, type checks, Markdown lint, copyright, ESM static import and
  mock-shape checks, Knip and policy naming/language/maintenance gates passed.
- The ownership-review gate passed with 19 owned, 163 separately coordinated and
  490 unresolved paths. Existing unresolved coverage is not waived or represented
  as production compatibility.

The combined server/client coverage ratchet passed. An initial full run overlapped
the ownership manifest update and failed its current-tree review check; the
targeted recheck and the clean final full run both passed against the final source.

The real migration check is included in `npm run test:local:embedded-isolation-drill`.
It builds and exercises a uniquely named disposable Compose project, never the
operator's running Classifarr service. Targeted host checks can be reproduced
from `server/` with:

```sh
node scripts/run-jest.mjs --testPathPatterns='embeddedMigration|embeddedIsolationLifecycle' --no-coverage --runInBand
node scripts/run-jest.mjs -c jest.integration.config.mjs --testPathPatterns='schema-maintenance|backup-restore-session|backup-restore-tables|restore-admission-seed' --no-coverage --runInBand
```

## Open PR selection

Both GitHub MCP search and the saved GitHub CLI login returned no open pull
requests for `cloudbyday90/Classifarr`. No PR could be randomly selected or
implemented. No PR was merged, closed or created to stand in for that request.

## Outcome and next component

Production startup, live data, credentials, routing and saved templates remain
unchanged. This implements and tests the migration component; it does not enable
automatic upgrades or claim production privilege separation. No release is created.

The next component is the bounded privileged index-rebuild job, preserving queue
claims and maintenance admission while removing owner-only DDL from normal workers.
