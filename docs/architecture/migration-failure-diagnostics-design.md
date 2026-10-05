# Durable migration failure diagnostics

Date: 2026-10-05. No release or production recovery.

## Decision and scope

Record failures where schema maintenance actually runs, not by inferring them from
missing migration history. Keep a bounded, ordered migration-attempt trace with an
attempt ID, timestamps, migration filename/content digest, step, error-code/cause
chain, safe stack locations and Node/platform context. Unknown errors retain this
context too. Never record SQL, row values, credentials, connection strings, raw
error messages or absolute host paths. PostgreSQL error text can contain row data;
the report explicitly states what was omitted or truncated.

Use a private file under existing app-data, outside the failing database. Write a
complete report to an exclusive temporary file, sync, atomically rename, and sync
the directory on Linux. Bound each report to 128 KiB, 512 events and eight causes;
bound orphan temporary files to eight directory entries. No automatic deletion of
user evidence. Recording failure must not turn a failed migration into success or
mask its original exception. Healthy runs create no files; recovered snapshot
failures are marked recovered. The last failure is retained, not silently cleared.

The file is observation, never authorization or a migration replay instruction.
Bind it to a hash of the database connection target (not credentials), and recheck
the current migration ledger when reporting whether its named update is now applied.
This is configuration correlation, not cryptographic database/restore identity.
Concurrent attempts are distinct; the most recently saved report wins, not a global
ordered audit. Process death before persistence may leave no report. Say so rather
than inventing a failed migration or attributing a previous failure to this startup.

An administrator-only, no-store GET exposes the validated report. No API keys,
viewer sessions, arbitrary paths, SQL, rerun or clear action. A shared UI panel in
Command Center/library recovery provides scenario-specific guidance and an explicit
JSON download. Reads do not repair anything. An offline CLI reads the same report
when failed startup prevents the web app from running; never start normal workers
against an unready schema merely to display diagnostics.

Existing owner-capable saved deployments require no Compose/template edits. Separate
OS identities may need the established maintenance identity to read its private
report. Do not broaden filesystem or database permissions to make it web-readable.

## Recommendation stack and tradeoffs

1. Local sanitized failure evidence: survives container replacement using existing
   app-data and works when PostgreSQL is unavailable; storage can fail and private
   reports are not a tamper-proof audit system.
2. Current-ledger comparison plus precise fixed guidance: separates historical and
   unresolved failures; cannot establish a historical root cause when no report exists.
3. Keep startup refusal and privilege boundaries: secure; offline failures require
   the report file/CLI instead of a working dashboard.
4. Next: a bounded startup-support export that correlates PostgreSQL/supervisor
   failures with these migration attempts, without collecting raw secrets or enabling
   generic repair/replay.

## Validation plan

Exercise known and unknown SQL errors, nested causes, malicious/oversized input,
trace truncation, disk/permission failures, corrupted/symlinked files, restart reads,
target mismatch, access denial, historical applied state and zero mutation from reads.
Use isolated PostgreSQL for actual failing migrations and rollback. Test the browser
with visibly synthetic data, then rebuild without cache, run image-level persistence
and schema-dump checks, and replace/evaluate only local Compose.

## Official sources

Discovered and read October 5, 2026:

- [PostgreSQL error codes](https://www.postgresql.org/docs/18/errcodes-appendix.html):
  classify with stable SQLSTATE codes rather than localized message parsing.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html):
  capture context, restrict access, exclude sensitive values, bound logs and test
  logging failures without breaking application behavior.
- [Node 24 filesystem documentation](https://r2.nodejs.org/download/release/v24.21.0/docs/api/fs.html):
  explicit file flushing; rename and directory durability require deliberate handling.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22):
  announce loaded results in a persistent polite status region without moving focus.

## Operator access

Unknown/unmapped failures explicitly ask the administrator to open an issue on the
[verified Classifarr issues page](https://github.com/cloudbyday90/Classifarr/issues),
attaching the reviewed sanitized report and image version so maintainers can provide
a proper fix. The fixed link opens in a labelled new tab with no referrer, diagnostic
query parameters, automatic upload or automatic issue creation. Known operational
failures retain their specific instructions; recovered/applied historical failures
do not request a new issue solely because the old report exists. The offline reader
provides the same unknown-failure GitHub instruction. URL verified through GitHub's
repository-to-Issues navigation on October 5, 2026.

When Command Center or a library shows a deployment-related import problem, choose
**View migration diagnostics**, then **Download sanitized report**. This is a
read-only inspection; it does not claim that a historical failure caused the current
library issue. The download includes the ordered steps and nested/aggregate errors.

If startup cannot finish, keep normal workers stopped. With the existing app-data
mount and maintenance OS identity, run `node src/scripts/readMigrationDiagnostics.mjs`
from `/app`. The fixed file is `logs/schema-migrations/last-failure.json` under the
existing `/app/data` mount (or under configured `LOG_DIR`). For a restart-looping
container, use its stopped-container/app-data support workflow instead of repeatedly
starting it or changing database privileges. No database connection is opened by
the reader. Windows test runs inherit host ACLs; Linux production requires private
owner-only directory/file permissions. A separately privileged web identity may
not read a maintenance-owned report; use the maintenance identity, not broad chmod.

The trace intentionally excludes raw PostgreSQL error text and detail fields, which
can contain credentials or entire row values. It cannot reconstruct failures from
older images. A missing report, an interrupted process or storage failure is unknown,
not evidence of successful migration. The full server log is not copied into this
report. Preserve existing operator-controlled logs separately when escalating.

The ownership review was scoped to the three affected SQL adapters. The existing
migration runner remains `analysis_debt`; maintenance retains its existing admission
classification. Only the new administrator reader receives a read-only classification.

The random open PR draw selected #556 (Node 26 declarations). Trial its exact diff
locally against the pinned Node 24 toolchain; do not relax that contract to retain
an incompatible update, and do not merge the PR.
