# Protected runtime dispatch outcome

Date: 2026-10-05. Base: `0c16d7f2f4b9e653efc9964e4d7efc28b1051602`.
See [design, official sources and tradeoffs](selected-runtime-dispatch-design.md).

## Implemented

Added a shell-free application launcher and pre-import identity/environment guard,
using the real application startup with restricted peer-auth credentials. Replaced
the selected-startup database-probe adapter with the actual application in the
isolated rehearsal. Normal mode performs schema maintenance first. Restore-only
mode cannot start the application or online maintenance brokers, waits for its
one-shot operation, and joins database shutdown. Cancellation is failure for
restore-only mode, without changing normal container shutdown semantics.

The real-image fixture now checks HTTP health, unauthenticated refusal, admin
setup/login, authenticated identity, actual runtime exclusion of maintenance,
pool bounds, restore-only completion and return to normal startup. It keeps the
selected-database lease and the existing immutable-source checks.

This does not activate production conversion, a privileged restore web server or
unattended legacy ownership recovery. The internal composition is default-layout
only; custom runtime settings and the restore HTTP handoff remain prerequisites
for the production dispatcher. Existing Compose/Unraid templates are unchanged.
No schema or version change; Unreleased updated; no release.

## Verification

The preceding [CI run 37288286129](https://github.com/cloudbyday90/Classifarr/actions/runs/37288286129)
passed for the base revision, including database tests, build/tests and installation
rehearsals. Publication jobs were skipped. It is not CI evidence for this increment.

Focused tests passed: five suites, 173 tests. Full backend unit tests passed:
1,687 suites, 52,103 tests in 301.328 seconds. The one Windows skip is the existing
Linux directory-fsync case. Its complete-copy, source-preservation and existing-
destination refusal assertions passed separately against real Linux operations
inside the newly built image; no skip or filesystem requirement was weakened.
Server lint/typecheck, copyright,
ownership review, both knip modes and ESM static-import/mock-shape checks passed.
Nine changed/new ownership entries were individually reviewed; the obsolete
fixture adapter entry was removed. Gate counts remain 19 owned, 279 separately
coordinated and 502 unresolved, with production compatibility false. Fingerprint:
`044640ca6cf5b17d8a871a45b487591c9695dcdd0824635b51e9a902a58d468f`.

The recovery and release-evidence skills kept cancellation, real SQL admission,
disposable image checks and production-activation limits explicit.

## Image and schema evidence

The no-cache Compose build used clean source
`84bb64be4c3709638c3a1822ca514148747b42c0`. Its local Docker image ID is
`sha256:5a42a054f2b54d3ec545d3d70d5c6e0eb1cad2fb8af54a7ad012de4ffc53f0d7`.
The matching OCI revision label is metadata, not signed registry provenance.
The frontend production build also completed; no fresh client-test or coverage
claim is made because this increment changes no client code.

The exact-image isolation drill passed all twelve core checks in 149.025 seconds.
This includes the new real-application authentication/admission and one-shot
restore dispatch inside the migration/startup scenario. The protected source
database remains unchanged across crash/resume; the selection lease stays held
until application and database shutdown have joined. The core fixture is
network-isolated, bounded to two CPUs, 2 GiB and 128 PIDs, and uses synthetic data.
Its reported 92,472 KiB maximum RSS describes the reporting process, not total
container memory or a sustained production resource bound.

After building, schema dump and reload ran against disposable PostgreSQL 18 in
that same image. The snapshot loaded into a second empty database and dumped
again with zero drift; the tracked schema is unchanged. No application database
was used for snapshot generation. The schema and filesystem-check containers
removed their own disposable data on completion.

Saved-template profiles also passed: UID/GID 1000:1000, custom 2345:2345 and
Unraid-style 99:100. Each exercised fresh startup, immutable packaged code,
compatible queue/image workers, clean stop/restart and preserved synthetic data.
Clean stops with the unchanged ten-second host timeout measured 3,052, 2,794 and
2,399 ms respectively, including verification. Default-profile fault cases also
passed unexpected Node exit, database loss and forced host kill; the forced kill
correctly returned nonzero and recovered committed data through WAL, not a clean
shutdown claim. The runner reported cleanup passed, independently confirmed by
zero remaining project containers/volumes; only owned synthetic fixtures and
temporary image aliases were removed. The caller's image remains available.

The full scoped patch passed a redacted Gitleaks scan with no findings. Markdown
validation checked 1,898 files with zero errors. This is not published-image
upgrade, native ARM64, physical Unraid or Synology, power-loss durability, or
sustained resource-soak evidence.

## Local replacement

Recreated only the local Compose `classifarr` service with `--no-build`, using
the tested image above and preserving its app-data volume. The replacement is
healthy, returns HTTP 200 from `/health`, has zero restarts and no OOM event.
Unraid and its separate database were not accessed or changed.

At 138 seconds of database uptime, read-only queries found no ERROR records and
one `mediaSync` warning: `legacy_owner_unknown` for Movies, library 5. Its six
ownerless legacy running records remain preserved; no ownership was invented or
takeover attempted. Family, library 4, remains complete at 866/866 with no legacy
running records. Sharing a Plex server does not make the separate local and
Unraid databases compete for the same database ownership lease.

A process sample showed one application, one supervisor and zero active
compatible/selected maintenance workers. Short startup samples ranged from
329.9 to 431.6 MiB under the unchanged 2 GiB container limit, with CPU readings
of 22.00%, 0.86% and 47.51%. At 192 seconds, memory was 418.7 MiB and CPU 0.61%,
still with zero ERROR records and the same single warning. Startup activity
varies; these are observations, not
an average, leak diagnosis or long-running capacity guarantee. The saved local
profile remains read-only, UID/GID 1000:1000, with no CPU quota or PID ceiling.
No deployment resource limits were silently changed. The isolated fixture caps
do not establish production limits.

Random [PR 556](node-types-pr-556-outcome.md) was applied and tested locally, then
removed after its Node-major compatibility failure. All 30 dependency/tooling
tests passed afterward; no PR was merged.

## Next item

Validate custom runtime configuration (including existing encryption-key and data
paths), add a restricted restore HTTP handoff, and connect the production
dispatcher. Finish database-enforced ingestion writer isolation before enabling
unattended legacy recovery. A healthy local rebuild does not resolve unknown
Movies ownership or authorize an age-based reset.
