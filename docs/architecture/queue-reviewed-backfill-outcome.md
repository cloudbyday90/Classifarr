# Selected reviewed-repair backfill outcome

Date: 13 October 2026. No release, version change or production recovery.

## Delivered behavior

Command Center provides a collapsed, explicitly loaded list of reviewed repairs.
Administrators select up to five task/receipt pairs and separately consent to retry.
One guarded transaction queues all newly eligible selections and records their
retry receipts, or rolls them all back. Existing saved retries are never undone
or replayed. Replacement approvals cannot propagate to other requests.

A modular ESM coordinator reuses the individual guarded retry writer, preserving
attempts, identity aliases, source evidence and competing-work checks. The batch
also verifies current local provider configuration against each unconsumed receipt.
No provider HTTP occurs while the database locks are held. Discovery and receipt
checks are read-only. Generic Retry All and automatic same-ID recovery still
exclude repaired requests.

There is no new scheduler, schema migration or automatic enrollment. The durable
one-enqueue ceiling uses existing receipts; an interrupted client can query saved
outcomes. A lost response does not trigger another write. The UI distinguishes
enqueue evidence from classification completion and escapes candidate titles.

## Verification

- Focused backend unit and real HTTP tests: 31 passed. Authentication, ordinary
  admin sessions, API-key refusal, cookie CSRF, no-store, input bounds and shared
  mutation rate limits are covered.
- Initial focused frontend run: 38 tests passed across three suites.
- Final isolated PostgreSQL run: 126 tests passed across six suites. Coverage
  includes five-item admission, bounded pagination, changed/deleted requests,
  provider changes/disablement, revoked actor, transaction rollback, competing
  manual/batch commands, interruption after the first and final receipt writes,
  repeated saved outcomes after service restart/retention and unchanged budgets.
- Type checking, ESLint, copyright, dependency/unused-code preflight, static ESM
  imports, ESM mock shape, migration naming/schema integrity and Markdown passed.
- Inventory ownership check passed without baseline changes. Its existing
  unresolved writer-isolation debt remains; this does not claim full production
  writer isolation.

The first full frontend run passed all 472 suites and 7,300 tests, but exited with
Windows `EBUSY` while deleting one temporary coverage JSON file. That run is not
counted as a clean coverage-command pass. The holder of the file lock was not
identified. A fresh full run completed with exit zero: all 472 suites and 7,300
tests passed. Coverage: statements 87.72%, branches 81.68%, functions 87.43%, lines
89.42%.

Full backend coverage passed all 1,832 suites: 57,927 tests passed, with the existing
Linux directory-fsync test skipped on Windows. Coverage: statements/lines 89.72%,
branches 86.32%, functions 91.08%. The runtime/test source was frozen during these
runs. The coverage ratchet passed on fresh backend JSON and frontend HTML reports;
no baseline was changed. Final Markdown check covered 2,192 files without errors.

## Packaged image and local evaluation

The no-cache Compose build passed using clean source
`0533e2ae40d99b3164819924441ede646e75d9c2`:

- Image: `sha256:9af929e5ecfdad6127b201b7d377149ea5630640d23d7e69a14ef60503690b4e`.
- Platform manifest: `sha256:90e9964df758e975f0a2dc6498cbbf6d4acc8df5bb69b292a821dbeab5479a52`.
- Config: `sha256:a16be63d9b187ba72a539a1b28e4f9629f89b22bb97dc62d92421b67542fdd8d`.

The previous local image remains tagged for rollback. Before replacement, a
custom-format backup was created and its 1,928-line archive listing checked:
`queue-backfill-before-20261013-2356.dump`, 76,262,448 bytes, SHA-256
`eba1e1d6f8537faa14d035b44b358763c905ca320587338c5ce75fe7aa3ea73d`.
A restore was not performed. Read-only local checks found no repair receipts and
no failed tasks; no real backfill or approval was executed.

An isolated fresh container used the exact image, no network or published ports,
bounded CPU/memory/PIDs and unchanged entrypoint/authentication/migrations. Schema
matched. Packaged nested/legacy identity repair preserved aliases, episode context
and an unrelated integer above JavaScript's safe-integer range. Confirmation left
the synthetic task failed at one attempt; after restart, duplicate confirmation
read the existing receipt. Explicit selected backfill then queued that task.

After a second same-image restart, the retry receipt persisted, the task was still
pending at one attempt, and replay left the complete task row unchanged. The saved
retry also remained readable/replay-safe after deleting the synthetic task.
Configuration was disabled/changed for the final replay to prove a consumed receipt
does not perform new work. No provider HTTP, external writes or real classifications
were exercised. Both the owned container and its temporary data were removed and
absence checked. These are same-image restarts, not published-version upgrade or
crash-during-commit evidence; transaction interruption was covered in PostgreSQL tests.

Local Compose replacement started at 00:03:15 UTC on 14 October (20:03 Eastern
on 13 October) and became healthy. `/health` reported database connected, UI
returned HTTP 200 and unauthenticated backfill discovery returned HTTP 401.
Read-only checks found 1,958 completed tasks, no failed tasks, zero repair receipts
and no error-log rows since startup using the database timezone conversion.
Memory sampled at 372 MiB during startup and later 451.3 MiB of 2 GiB; this is not
a memory-leak study.
UID/GID 1000, read-only root filesystem, no-new-privileges and the 2 GiB limit were
retained. OOM was false and restart count zero. No real task was approved/retried.
Unraid, Plex and shared Ollama were not modified.

## PR and recommendation

GitHub MCP enumeration and final recheck found zero open Classifarr PRs on
13 October 2026 (Eastern). There was no eligible random PR to implement; no closed
PR was substituted or merged. All seven workflows for the preceding main commit
`3903e4926` passed, including CI/CD, database and fresh-install/upgrade checks.

The [design and verified official sources](queue-reviewed-backfill-design.md)
record the pros, cons and recommendation stack. Selected atomic backfill reduces
repetitive work without granting unattended retry authority. The cost is a
five-item ceiling and a stale item blocking the whole selection.

Next: add bounded, read-only per-item readiness reasons to identify stale selections
before submission. Assess unattended scheduling afterward, with persisted consent,
cancellation, cooldowns and admission limits. Do not automatically enroll previous
approvals or extend an approval beyond its original task.
