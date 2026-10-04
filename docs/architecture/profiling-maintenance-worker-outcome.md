# Profiling maintenance worker outcome

Date: 2026-10-04. Branch: `main`. No release.
See the [design, tradeoffs and official research](profiling-maintenance-worker-design.md).

## Implemented

Normal embedded startup runs one fixed profiling-assessment child before the web
process. Restore mode skips it. Missing optional profiling is installed only
after known catalog eligibility, exclusive runtime/restore admission, a ready
existing restore gate and unchanged administrator identity. Already-active
profiling performs no DDL. Unknown or unavailable state defers without guessing.

The old generic database installer and web-preflight call are removed. A small
read-only status service replaces reason-string-based write selection. The worker
uses a single pinned transaction, fixed extension/schema, bounded SQL and 20-second
child lifetime, 128 MiB V8 old-space limit and bounded discarded output. Parent
logs contain a fixed operation/status, not child logs or raw database errors.

Completion is joined before app startup. Explicit optional deferral permits the
app to continue; a failed/killed/unjoined process does not. No persistent daemon,
scheduled retry, provider call, new host setting, mount or template is added.
Disconnect rolls back uncommitted work; uncertain commits are re-observed on the
next startup. Installed extension metadata is the durable completion record.

## Verification before image build

- Focused unit tests: 266 passed in 9 suites. Isolated PostgreSQL tests: 24 passed
  in 2 suites, including 8 new profiling scenarios. No skips.
- An additional startup/admission/maintenance regression selection passed 99
  tests in 5 suites; that selection overlaps the earlier schema-maintenance suite.
- Full backend ESLint, backend typecheck and Knip, static-import check, migration
  and schema integrity, copyright and all 1,870 Markdown files passed.
- Reviewed ownership changes retain the generic database wrapper as unresolved
  analysis debt. Four fixed worker/status modules are separately coordinated,
  not ingestion owners. No existing unresolved entry is promoted.
  The gate passes with 19 owned, 242 separately coordinated and 501 unresolved
  entries; `productionCompatible` remains false.
- Current open-PR enumeration returned no PRs; none was selected or merged.

## Built-image evidence

- Tested code commit: `9044538783161d6ec3e546df751c2d58395d987b`.
- No-cache Compose build passed with that OCI revision. Local image ID:
  `sha256:18a419aa1c09ea03a310274bc1a6a8abd7ac3887e0f4274d6cb14d021d5f79ca`.
  This is local image evidence, not published multi-platform release evidence.
  Client production build succeeded; build-time npm audit reported zero
  vulnerabilities and no npm warnings were observed.
- The actual packaged entrypoint passed two network-isolated, read-only,
  non-root UID 1000 scenarios with synthetic tmpfs data, 1 CPU, 1 GiB memory and
  128 PIDs: fresh snapshot startup reported `already_active`; a current-schema
  fixture with only the optional extension deliberately removed reported
  `installed`. Both became healthy, left no profiling worker running and shut
  the application/database down with exit 0 and no OOM. Both containers were
  removed. This is not an upgrade from a published historical image.
- The first image fixture incorrectly expected fresh startup to install again.
  The packaged snapshot had already done so; the assertion was corrected to
  require the no-op result. The separate missing-extension scenario proves repair.
- All ten owned PostgreSQL startup-smoke checks passed, including delayed start,
  live-owner refusal, WAL recovery, verified worker-PID reuse, foreign PID refusal,
  native signal reporting, timeout, cancellation, invalid configuration and
  entrypoint TERM/INT forwarding. The disposable container was removed.
- After the no-cache build, `dump-schema` used this image's PostgreSQL 18.6 in a
  separate network-isolated database, loaded the committed snapshot, dumped it,
  loaded a second fresh database and dumped again. Zero drift from the committed
  schema; no new migration or schema artifact was necessary. No application
  database was used for generation, and the owned fixture was removed.
- Only local Compose service `classifarr` was recreated, preserving its mounts.
  Container `ee9a2ce5a120` started at `2026-10-04T19:46:18.289275179Z` on the tested
  image. The parent reported `already_active`, joined maintenance, then started
  normal supervision. No profiling child remained. Node 24.21.0, PostgreSQL 18.6
  and pgvector 0.8.7 were verified directly.
- After the normal startup/import cycle, health remained healthy with zero
  restarts and OOM events. All eight owned ingestion states completed and updated
  during this start. No ERROR entries were recorded for this container; two
  `legacy_owner_unknown` warnings remained. Existing running markers are still
  library 4: two and library 5: six, with no invented ownership rows for either.
- Resource samples: 77.84% CPU during ingestion, then 1.15%; settled memory
  406.7 MiB of 2 GiB (about 20%) and 44 PIDs. This is a short startup observation,
  not a sustained-load guarantee. Compose retains its existing memory limit and
  still has no explicit CPU/PID cap. No resource settings were changed.
- For code commit `90445387`, OSV, Trivy, Gitleaks, CodeQL and copyright CI checks
  succeeded. The [main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37229385332)
  and [resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37229385139)
  were still running at handoff; local success is not substituted for their result.

The following documentation-only commit records these results without changing
the image's tested runtime code. Unraid and unrelated local containers were not
modified. Remote CI is separate from these local checks.

## Limits and next recommendation

This is an operation handoff, **not privilege isolation**. The compatible worker
still shares today's OS and SQL identity. Default startup still runs migrations;
historical migrations are unchanged. External PostgreSQL administrators remain
responsible for provisioning profiling; there is no automatic elevated fallback
for external schema mode or direct host development.

Legacy ingestion warnings are unchanged: neither profiling installation nor an
image rebuild proves a historical writer stopped. No owner is manufactured and
no real library is recovered by this change. Unraid remains untouched.

Next: compose schema migration and profiling maintenance into the protected
identity startup path, then remove direct runtime administrative access and port
remaining ingestion writers before enabling automatic legacy retirement. Preserve
the compatible non-root deployment mode until enforced separation is available.
