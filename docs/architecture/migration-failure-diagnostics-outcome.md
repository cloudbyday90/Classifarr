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

Unknown failures now explicitly ask the administrator to open a GitHub issue with
the reviewed sanitized report and image version. The UI uses the verified fixed
repository issues link; there is no automatic upload, issue creation, diagnostic
query string or outbound referrer. Known operational and resolved historical cases
do not incorrectly receive the unknown-failure escalation.

## Validation

- Targeted backend: 120 tests passed, including access denial, unknown/aggregate
  errors, redaction, corrupt storage, atomic replacement, bounded output, historical
  ledger comparison, original-error preservation and failed-rollback refusal.
- Isolated PostgreSQL: 17 schema-maintenance tests passed, including real DDL and
  ledger rollback with retained diagnostic evidence.
- Full frontend: 441 files / 6,383 tests passed with coverage, zero skips. Initial concurrent
  lint-plugin setup timeouts passed on rerun without skipping assertions or
  increasing timeouts. The intentional extra diagnostic control required updating
  the banner test expectation.
- Chromium: keyboard inspection/download at 390px and 1280px, read-only network
  assertions, and the existing reviewed-repair flow passed. Layout was visually
  inspected; the synthetic fixture is visibly labelled and is not a live repair.
- Final combined backend: 1,706 suites / 53,064 tests passed. One Linux directory
  durability test is skipped on Windows; its actual-image Linux probe passed.
  This run includes the subsequent comparison-context diagnostic fix.
- Coverage ratchet passed with fresh reports: server 89.81% statements/lines,
  85.63% branches, 91.20% functions; client 86.76% statements, 79.64% branches,
  86.28% functions and 88.62% lines. The new comparison formatter has 100% coverage.
- Lint, server/client typechecks, copyright, reviewed ownership gate, dependency
  analysis, ESM static-import checks and Markdown validation passed. Initial
  ownership-review and intentional-cleanup-comment findings were corrected;
  no baseline or assertion was weakened to pass.

No release-readiness claim follows from local validation alone.

## Exact-image and local checks

The final no-cache build includes the subsequent comparison-context diagnostic fix:

- Source: `c139f1147ebc0da541fbc93f40323ffcca92cd34` (clean build checkout).
- Local image: `sha256:304471cbc6e621c9408738c322b00c6dee8a3bce32060becfce64ba83f2b852b`.
- This is a local image ID, not a published manifest digest or signed attestation.

Network-isolated, resource-bounded Linux containers using that image verified
private 0700/0600 storage, synced writes, original-error preservation, excluded raw
messages, and an offline read from a separate container using the same disposable
volume. Unsafe file modes and hardlinks were refused. The owned fixture volume was
removed. The Linux-only exclusive-copy/directory-fsync case also passed in-image;
Windows cannot exercise that filesystem behavior in its normal unit run.

After rebuilding, `dump-schema` ran against an isolated PostgreSQL 18 instance from
the exact image. Loading the snapshot into a fresh database and dumping it again
produced zero drift; `database/schema/current.sql` has no changes. No new migration
was required. Only the local Classifarr Compose container was recreated; Unraid,
the other local application, volumes and historical warning records were not changed.

Read-only checks confirmed healthy startup, HTTP health 200, unauthenticated library
access denied (401), all 12 safeguards enabled ALWAYS, zero unfinished legacy
markers and no safeguard repair needed. At 184 seconds after replacement, all ten
libraries had completed another normal scan, including Family (866 items) and
Movies (2,339 items). No OOM kill or restart was recorded.
The offline reader returned `none` (documented exit 1): no failure was fabricated
to create a report. New logs contained no ownership or migration warnings.

The 2 GiB memory limit is unchanged; Compose has no explicit CPU quota or PID cap.
Early samples ranged from approximately 354–784 MiB with temporary startup CPU
activity; at 197 seconds memory was approximately 421 MiB and CPU 0.72%.
Four startup/background slow-query warnings took 1.1–3.8 seconds, with negligible
pool wait. They were not suppressed or classified as migration failures. These
samples are not a sustained resource soak or proof that resource growth is bounded.

The follow-up user report concerned optional comparison context, not ownership.
Its retained recovery log confirms automatic recovery after about 3 minutes 23
seconds. See the separate [comparison outcome](comparison-context-diagnostics-outcome.md).

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
3. Next for migration diagnostics: add a bounded startup-support export correlating database/supervisor
   failures with migration attempt IDs, keeping credentials, raw SQL and row values
   out of exports. Do not broaden automatic repair to unknown migrations.

The subsequent comparison warning exposed a nearer diagnostic gap: add safe
origin codes for generic `unavailable` outcomes, as described in its separate
design. This is preferable to raising memory limits without causal evidence.

The recovery skill kept diagnostics separate from recovery authority; the
dependency skill kept the incompatible PR trial reversible; the release-evidence
skill requires exact-image receipts rather than a successful build alone. Research,
operator instructions and tradeoffs are in the companion
[design](migration-failure-diagnostics-design.md).
