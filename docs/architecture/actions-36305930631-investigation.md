# Actions run 36305930631 investigation

## Evidence

The [reported run](https://github.com/cloudbyday90/Classifarr/actions/runs/36305930631)
tested commit `94be13e` on 2026-09-27, before the current branch. GitHub MCP job
steps/logs show:

- Database tests, schema replay, unit/client tests, coverage, asset smoke and image
  build succeeded.
- The schema-container check timed out waiting for application health. Its log
  shows PostgreSQL and the snapshot loaded successfully. It did not report a
  schema comparison mismatch: the application never became ready for that check.
- Release Acceptance Readout failed because required repository validation failed;
  it is not a second independent application defect.

## Root cause and existing repair

That revision's fresh snapshot creates the restore-admission table without its
initial row, while normal startup requires that row to be `ready`. The subsequent
commit `a93a1e34` repairs the omission, adds the fresh seed and permits narrowly
verified legacy migration. It does not bypass a real maintenance or unverified
restore state. See [the original repair outcome](published-upgrade-recovery-outcome.md).

The old check prints container stdout but omits stderr, so the original timeout
log alone does not expose the admission exception. The diagnosis above combines
the checked-out historical source with the already-tested repair, not an invented
stack trace from that run.

## Current verification

Built a separate local candidate image and booted an empty disposable schema-check
container; the running Classifarr service and its persistent data were not changed.
Startup now succeeds. The first comparison found non-canonical formatting/order in
the newer hand-maintained catalog/content schema additions. Regenerated the
snapshot from that disposable database and retained the same tables, constraints,
triggers and safe seed rows. No live data was exported.
The repeat isolated startup and schema comparison passed. Restore-admission unit
regressions also pass; no startup or release acceptance safeguard was relaxed.

The standard live-source schema wrapper correctly refuses to run against the
older deployed schema. Do not migrate a user's deployment merely to satisfy a
local development check; use the existing isolated-container check for this case.

## Follow-up

Implemented the [bounded startup diagnostic design](container-startup-diagnostics-design.md):
capture both streams, publish recognized safe signals and container state, and
stop promptly after exit. Application readiness remains mandatory. See the
[validation outcome](container-startup-diagnostics-outcome.md) for test results
and the remaining local provenance-check limitation.
