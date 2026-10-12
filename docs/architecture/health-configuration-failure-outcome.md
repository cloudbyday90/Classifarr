# Health configuration-read failures: outcome

Date: 2026-10-12. See the separate
[design, alternatives and official sources](health-configuration-failure-design.md).

## Delivered

All ten configuration-dependent health checks now distinguish failed reads from
absent configuration. Failures return unknown with a safe reason, stage, code and
attempt time. Last-success history remains available; stale instance membership,
credentials and raw database errors are not copied into the new result. Failed
configuration admission performs no provider probe. Successful later checks clear
the diagnostic; successful empty/disabled reads retain normal inactive semantics.

System displays the diagnostic reference and actionable database/schema/access
guidance. It does not invent zero RAG counts or disabled image mode when those
settings could not be read. Detailed health includes unknown Arr groups rather
than hiding them. Unknown image checks do not send provider recovery/failure alerts.
Transition diagnostics use normal console/configured file logs, avoiding database
log persistence against an already failing database.

No retry loop, extra provider polling, schema migration, backfill or credential
mutation was added. Database readiness, authentication, memory limits, provider
timeouts and normal scheduling remain unchanged. This does not repair the earlier
unresolved identities, cached-vector gaps or production data.

## Source and local image

- Started on clean `main` at `ba38c3513930bbb97d41c624296d514e936b610f`.
- Final image source: `85a764cff2901068c80264893ad6edbf248ce60e`.
- No-cache Compose build with `--require-provenance`, clean checkout and AVX2.
- Local Docker image `.Id`:
  `sha256:e774bb42042079cba5c23ee630bfeb3ea8728ae71e60d7b4b4ea6c7fb3b68f3b`.
- Previous local image retained:
  `sha256:c3250d00433bdbde23a48e07c392b730401b58ca9bfcc18391d8b28a0358944a`.
- Database backup before replacement: checksum matched and archive listing was
  readable. This was not a full restore rehearsal.
- Local container replaced at 19:18:18 UTC, with uid/gid 1000, read-only root,
  2 GiB limit, no-new-privileges and PostgreSQL noexec tmpfs retained.

An earlier development image was superseded, not deployed. This is local
Linux/amd64 evidence, not published multi-platform verification or signed registry
provenance. Subsequent documentation-only changes do not alter application runtime.
No release, tag, version bump, new branch, Unraid deployment, Plex change or shared
Ollama change was performed.

## Verification

- Focused backend checks: 34,652 tests across ten suites passed. This includes
  existing aggregate status combinations, health/HTTP contracts, all ten failed
  configuration admission paths, malformed results, history, recovery, safe error
  mapping, synchronous/asynchronous logging failures and image alert suppression.
- Focused client checks: 37 tests passed for System and named health API methods,
  including safe text rendering, diagnostic references and polling recovery.
- Frontend full coverage: 7,178 tests / 468 files passed. Statements 87.59%,
  branches 81.56%, functions 87.26%, lines 89.31%.
- Backend full unit coverage: 56,678 passed, one skipped, across 1,805 suites.
  Statements/lines 89.73%, branches 86.22%, functions 91.16%. The new read boundary
  has 100% statements, branches, functions and lines. Combined coverage ratchet
  passed without baseline changes.
- Lint, backend/frontend type checks, full/production dependency analysis,
  static-import check, npm CLI policy, copyright and Markdown checks passed.
  Frontend test-runner configuration: 12 passed.
- Chromium: two responsive health-summary checks and eight production-route asset
  checks passed. These browser checks cover existing summary/navigation behavior;
  the new diagnostic card binding is covered by the System component tests.
- Staged secret scans passed before both implementation/review commits.

The initial backend coverage run caught a new indirect-query ownership-review
entry and was stopped, not counted as passing. Reviewed the complete fixed
metadata-query chain and added only that file's explicit read-only review. The
gate and all 39 ownership-gate tests then passed. No existing classifications,
digests, parser, baseline revision or gate rules were relaxed.

### Exact-image checks

The packaged implementation passed six aggregate cases, five synthetic freshness
HTTP cases and one configuration-failure HTTP case. The latter uses the actual
packaged read boundary and route, then proves failed Arr membership stays unknown
and the private fixture exception is absent from the response. Freshness fixtures
use controlled observation times; they do not prove a real heartbeat elapsed.
All nine changed server runtime files matched the deployed image byte for byte.
Compiled System diagnostic/compatibility text was present. Probes attempted zero
provider calls or data writes.

The running application returned 200 for `/health`, system liveness and readiness;
unauthenticated detailed service health returned 401. Scoped pgvector startup
evidence matched the restarted database. A separate diagnostic process correctly
reported the application's record as `other_process`.

After the final build, ran `dumpSchema` using an owned, network-isolated synthetic
container with 1 GiB memory, two CPUs, 256 PIDs and no published ports. The snapshot
has no diff, includes migrations through
`20261010_220000_source_catalog_mappings.sql` and all 22 seed migrations. Five real
PostgreSQL configuration checks passed: empty rows, successful row, missing table,
missing column and a statement cancelled by a transaction-local timeout. These
made no provider calls or writes. The fresh database had no invented pending
work; the owned container and temporary data directory were verified absent.

Read-only local before/after counts remained 6,837 classifications, ten active and
covered libraries, four unresolved identities (two source review, two retry wait),
zero pending text embeddings and 6,815 pending image embeddings. The pre-rebuild
sample retained a `cached_vectors_incomplete` warning; the immediate post-restart
sample had no warnings. This is not evidence that the vector issue is repaired,
nor a retained-memory profile or long-running soak. Normal startup jobs remained on.
The local container remained healthy, with no OOM termination or restarts; a short
post-start sample showed 395 MiB / 2 GiB. This is not memory-leak verification.

## Recommendation stack and next item

1. Keep explicit unknown status and fixed diagnostics. Benefit: an unperformed
   check is not confused with missing credentials or provider downtime. Cost:
   operators must investigate the named database condition; this is not repair.
2. Keep normal scheduling and no stale-credential fallback. Benefit: no new retry
   pressure or unintended endpoint use. Cost: recovery waits for the next existing
   check or an explicit Refresh.
3. Keep transition-only safe context outside database persistence. Benefit: no secret/SQL leak
   or recursive database logging attempt. Cost: this boundary's detailed reference
   is in container/server logs, not the database-backed error history.
4. Next: configuration-revision and in-flight completion fencing. Each check still
   assigns its awaited result to the shared cache; an older, slower check can
   finish after a newer one. A fresh timestamp cannot prove current configuration.
   Add per-service completion ordering and revision-aware invalidation without
   changing heartbeat cadence or memory safeguards.

Non-configuration RAG catalog and image evidence fallback semantics, legacy
provider-error formatting and full deployment coverage are not claims of this fix.
GitHub MCP reported zero open PRs on two checks; no random open PR was available and none was
merged. Remote CI is separate from these local checks and is not claimed passed.
