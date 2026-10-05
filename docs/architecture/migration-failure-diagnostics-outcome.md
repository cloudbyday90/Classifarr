# Migration failure diagnostics outcome

Date: 2026-10-05. Work on `main`; no release, PR merge or Unraid change.

## Implemented

Schema maintenance and the legacy startup migration runner now record failures at
execution time. Reports include a correlation ID, ordered/timestamped steps,
migration filename and executed-content hash, nested/aggregate error codes and
safe stack locations, Node/platform/architecture and the image source revision
when available. Rollback failure preserves the original exception and prevents
further work on that session. Unknown failures receive the same diagnostic trace.

Private app-data persistence is independent of PostgreSQL. Atomic replacement and
Linux file/directory sync preserve the last saved failure. Healthy runs do not
write or clear reports. The bounded report explicitly identifies omitted events,
truncated cause chains and excluded sensitive fields. It is not a raw server log
or a tamper-proof audit trail and cannot reconstruct older failures.

Command Center and library deployment guidance offer on-demand inspection and a
sanitized JSON download. Administrator access and current active-admin status are
checked; API keys, query-selected paths and mutations are not supported. A current
ledger lookup distinguishes historical applied migrations. Failed startup remains
blocked; the offline reader works without a database connection.

## Validation

- Targeted backend: 120 tests passed, including access denial, unknown/aggregate
  errors, redaction, corrupt storage, atomic replacement, bounded output, historical
  ledger comparison, original-error preservation and failed-rollback refusal.
- Isolated PostgreSQL: 17 schema-maintenance tests passed, including real DDL and
  ledger rollback with retained diagnostic evidence.
- Full frontend: 441 files / 6,382 tests passed with coverage. Initial concurrent
  lint-plugin setup timeouts passed on rerun without skipping assertions or
  increasing timeouts. The intentional extra diagnostic control required updating
  the banner test expectation.
- Chromium: keyboard inspection/download at 390px and 1280px, read-only network
  assertions, and the existing reviewed-repair flow passed. Layout was visually
  inspected; the synthetic fixture is visibly labelled and is not a live repair.

Full backend rerun, final gates, exact-image persistence, no-cache local replacement
and schema dump results will be recorded after they complete. No release-readiness
claim is made by this intermediate record.

## Random open PR trial

The GitHub MCP-discovered open PR draw selected
[#556](https://github.com/cloudbyday90/Classifarr/pull/556), head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact Node declaration/Undici lockfile
change was applied locally and installed with npm 12.2.0 under Node 24.21.0. The
audit reported zero vulnerabilities, but the runtime-major contract and the Discord
`BodyInit` type check failed. The candidate was reverted, the original lockfile was
reinstalled, and all 30 tooling tests passed. No PR was merged, closed or edited.

Keeping the compatible Node 24 declarations preserves the runtime contract; the
tradeoff is deferring Node 26 declarations until a separately tested runtime move.

## Recommendation stack

1. Ship bounded migration evidence with unchanged startup refusal and permissions.
   Benefit: actionable evidence without requiring a healthy database. Limitation:
   disk failure, abrupt termination and older images can still leave no report.
2. Use current checks and reviewed repair for operator actions. Benefit: an old
   failure cannot justify replay or permission escalation. Cost: unknown failures
   still need investigation.
3. Next: add a bounded startup-support export correlating database/supervisor
   failures with migration attempt IDs, keeping credentials, raw SQL and row values
   out of exports. Do not broaden automatic repair to unknown migrations.

The recovery skill kept diagnostics separate from recovery authority; the
dependency skill kept the incompatible PR trial reversible; the release-evidence
skill requires exact-image receipts rather than a successful build alone. Research,
operator instructions and tradeoffs are in the companion
[design](migration-failure-diagnostics-design.md).
