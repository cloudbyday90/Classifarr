# Protected maintenance handoff outcome

Date: 2026-10-05. Base: `1cdbf9aaa501486e4c1280621307fb6c9932feea`.
See the [design, sources and tradeoffs](selected-maintenance-handoff-design.md).

## Implemented

Added modular ESM contracts, launcher and one-shot worker for schema and restore
maintenance against the fixed selected database. The worker validates actual
separate OS accounts and a constructed environment before database/service imports.
It refuses dotenv configuration, inherited credentials and arbitrary targets.
Restore input stays on bounded stdin; child output is bounded and discarded.

The selected startup fixture now uses this launcher instead of its ad-hoc schema
command, with a supervisor deadline that accommodates the schema worker's bound.
Schema CLI refusal preserves the typed unfinished-restore result after cleanup.
Normal startup still requires success. Existing SQL locks, quarantine, migration
checks, source preservation and child join ordering are unchanged.

Added real-image checks for peer-identity refusal, busy schema/restore admission,
invalid encrypted input, killed restore quarantine, schema refusal and verified
merge/replace followed by selected startup. Synthetic blocker sessions are labelled
and explicitly terminated in the disposable database, since disconnecting a client
does not necessarily end a running server query immediately.

This increment **does not activate production conversion or unattended legacy
ingestion recovery**. It adds the reusable protected maintenance handoff, not the
remaining runtime dispatcher, custom-path support or complete ingestion fences.
Saved forced-non-root templates remain on their current compatible path. No schema,
API, deployment template, dependency or version change; no release.

## Verification

The preceding [CI run 37253720051](https://github.com/cloudbyday90/Classifarr/actions/runs/37253720051)
passed for the base revision, including database tests, fresh/published upgrade,
build/tests and release readout. Publication jobs were skipped. That is baseline
evidence, not CI evidence for this new change.

Final focused run: four suites, 150 tests passed. Full backend unit run: 1,686
suites passed, 52,023 tests passed and one skipped, in 319.763 seconds. The existing
Linux directory-fsync unit is skipped on Windows; the image drill exercised real
Linux filesystem behavior instead. Server lint/typecheck, CI
preflight, ESM static import/mock checks and Markdown lint passed. The changed
ownership entries were individually reviewed, not blanket-refreshed. Current gate:
19 owned, 276 separately coordinated, 502 unresolved; production-compatible false.
Fingerprint: `ee13db75c883227844b566f626dcc462c0653f82e73becc7ee150f5f58064309`.
The recovery and release-evidence skills guided bounded processes, isolated image
tests and the explicit limit on what this change proves.

The requested random open PR was locally applied and rejected by the unchanged
Node-major compatibility gate. See [PR 555 outcome](node-types-pr-555-outcome.md).
No PR was merged and no rejected dependency update remains in the tree.

The dependency/tooling suite also passed all 30 tests after removing the rejected
PR trial. Full client tests, new coverage reports, published-image upgrade and
physical NAS validation were not run for this increment. The Docker build did
complete the production client build.

## Exact-image rehearsal and schema dump

Built with `node scripts/docker-compose-smart.mjs build --no-cache --require-provenance`
from clean code revision `8984c766f6ba9a5cf1628d8fcf3d8024397af695`.
Local Docker image ID:
`sha256:4bb8b9de4a8add76483c3d8259c9824a2d8f500b16ca84ff5dac1d5df4546c89`.
The OCI revision label matches that code revision. This is a local image identity,
not a published registry manifest or signed remote provenance. Later documentation
commits do not change the tested code.

The first exact-image drill rejected the protected worker before database access:
the packaged `su-exec` changes HOME to the target passwd entry even for a numeric
UID. A disposable no-network probe reproduced `/tmp` becoming
`/var/lib/postgresql`. Corrected the constructed environment to the packaged
PostgreSQL account home and added a regression test; the exact-environment guard
was not relaxed. That failed rehearsal cleaned up its project and volumes. The
local application was not replaced with that unverified image.

The corrected exact-image isolation drill passed all 12 core checks, including the
new real protected schema/restore handoff and the existing source-preserving
identity migration. Core duration: 157.920 seconds; maximum reported orchestrator
RSS: 93,988 KiB (not total container memory). Saved compatible profiles for UID
1000, custom UID 2345 and Unraid-style UID/GID 99:100 passed startup, worker,
stop/restart and preservation checks. Their unchanged 10-second host stop limits
were sufficient: observed stops took 2,475, 2,425 and 2,338 ms respectively.

The owned disposable project
`classifarr-isolation-drill-1605b288847f7370b9eebcba6d281a51` cleaned up successfully;
read-only checks found no remaining project containers or volumes. Only synthetic
test data and project image aliases were removed. The tested application image
and local application data were retained.

Ran the isolated schema dump after this no-cache build against the same image.
Loaded the tracked schema into fresh PostgreSQL 18, dumped it, loaded the result
into a second fresh database and dumped again: zero drift; tracked
`database/schema/current.sql` unchanged. The last migration remains
`20261004_230000_queue_routing_replay_guard.sql`, with 22 seed migrations. The
owned temporary schema container was removed after success.

## Local replacement and evaluation

Recreated only the `classifarr` service in local Docker Desktop's `desktop-linux`
context using `up -d --no-build --force-recreate --wait classifarr`. Its image is
the exact tested ID above; health returned HTTP 200, restart count remained zero,
and Docker reported no OOM. Existing appdata and Compose settings were preserved.
The separate live Unraid installation and unrelated local containers were untouched.

The local container still uses UID/GID 1000:1000, a read-only root filesystem and
a 2 GiB memory limit. CPU quota and PID limit remain unset; this change does not
silently impose new limits on saved templates. Short samples showed 322.4 MiB at
0.43% CPU after startup, 396.5 MiB at 66.75% CPU during Family ingestion, and
411.1 MiB at 0.70% CPU after ingestion. Docker PID counts ranged from 40 to 48.
Process inspection found one application, one supervisor and zero active compatible
or protected maintenance workers. No runaway worker was observed, but these short
samples are not a sustained resource soak or proof that every process is bounded.

At database uptime 178 seconds, Family completed its normal scan (864/864, no
ownerless running records). Movies retained six legacy running records without an
ingestion-state owner. Exactly one new WARN was recorded: `legacy_owner_unknown`
for Movies/library 5; no new ERROR was recorded in that interval. The warning is
**not fixed by rebuilding** and is not caused by the separate Unraid database
sharing Plex. This increment intentionally does not invent ownership, clear those
records or run live recovery.

## Next item

Wire the protected runtime and restore-mode dispatcher, including custom writable
paths and bounded PostgreSQL diagnostics. Then finish database-enforced ingestion
writer admission before enabling unattended ownership recovery. Do not clear the
Movies warning or fabricate an owner merely because this worker passes its tests.
