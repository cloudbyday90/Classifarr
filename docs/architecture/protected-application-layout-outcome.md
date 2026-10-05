# Protected application data layout outcome

Date: 2026-10-04. Base: `2621ecae3f2d881d5292f9e62e9ade331e4d8b4e`.
See the [design, sources and tradeoffs](protected-application-layout-design.md).

## Implemented

Added a fixed-path ESM provisioner for application config, secrets, logs and
backups below already protected appdata. It preflights every child before writes,
uses retained no-follow directory handles, restricts permissions to 0700,
preserves all contents, syncs metadata and verifies ownership before success.
It does not recursively change ownership or make the appdata parent root-owned.

Extracted shared separate-account validation for this provisioner and the selected
database adapter; duplicate application UID aliases are now rejected as well.
The selected startup rehearsal calls provisioning while holding the migration
lease, before runtime admission. New Linux scenarios cover a real killed
provisioning process, restart, substituted links, nonempty root-owned refusal,
preserved synthetic settings/key bytes and restricted application writes.

No production conversion, schema/API/dependency/version/template change or release.
Saved forced-non-root startup is unchanged. The compatible entrypoint still refuses
a reserved protected layout. Movies ownership warnings are not resolved by this
increment; no inventory or legacy markers are reset.

Saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04. No eligible
random PR could be implemented; none was merged or represented as open.

## Verification

Final focused run: six suites, 148 tests passed, including the ownership gate and
added cancellation-after-mkdir/deadline cases. Full backend unit run: **1,685
suites passed, 51,929 tests passed, one skipped**, in 262.745 seconds. The existing
Linux directory-fsync unit test is skipped on Windows; the image rehearsal below
separately executes real Linux filesystem synchronization and recovery.

Server lint/typecheck, CI preflight, ESM import/mock checks and Markdown lint passed
(1,888 documents). Lint caught one promise-executor return in the synthetic
interruption worker; fixed the code rather than disabling the rule. The client
production build passed as part of the image build. No full client test/coverage
run or remote CI result is claimed for this backend-only change.

Ownership pins were reviewed only for the changed provisioner/identity helpers
and synthetic fixture modules. New entries remain separately coordinated, not
proof of completed ingestion fencing. The recovery and release-evidence skills
required the bounded lifecycle, real Linux checks and explicit activation limits.

The ownership gate passed with 19 owned, 271 separately coordinated and 502
unresolved paths. Fingerprint:
`a264d45341077dee05c8d3e72abbebcefbed82c6af8f3ff2cdeb13dbdaf1beb5`.
No unresolved entry was waived.

## Image and schema

Built with `docker-compose-smart.mjs build --no-cache --require-provenance` from
clean code commit `71f0404e894ce8f71d552495ddaa1e1ee5fdeee5`. Inspected Docker
image ID: `sha256:82058410259a55c9d477550d8f596f2b05c533d4b0d61a55010233a96b094795`.
Its OCI revision matches that commit; this is local build evidence, not signed
published-upgrade evidence. Both image dependency installs reported zero npm audit
findings; that is not a complete security audit.

After building, the isolated PostgreSQL 18 runner loaded the current schema,
ran `dump-schema`, loaded the result into a second fresh database and dumped again
with zero drift. `database/schema/current.sql` is unchanged. The labelled temporary
schema container was removed; no live database was used.

The exact-image drill passed all twelve core checks in 138,062 ms. Maximum reported
orchestrator RSS was 92,372 KiB, not total container memory. Its migration scenario
executed the new real SIGKILL/restart, symlink rejection, nonempty root-directory
refusal, content-preservation and application write-boundary checks. Selected
database startup also ran the provisioner before maintenance/runtime admission.
Standard non-root UID 1000, custom UID/GID 2345 and Unraid-style UID 99/GID 100
profiles passed startup, on-demand maintenance, data preservation and shutdown.
Stop-and-verification times were 2,400 / 2,422 / 2,414 ms under the unchanged
ten-second host deadline. These small fixtures do not prove that every loaded
deployment fits that deadline or certify physical NAS compatibility.

Unexpected application death and database loss failed closed. Deliberate host
SIGKILL returned nonzero and restart recovered committed synthetic data; this is
not labelled a clean shutdown or physical power-loss proof. The random project
`classifarr-isolation-drill-37973d492925628acc57962ccc0ed074` was removed with only
its disposable containers, volumes and image aliases; cleanup/absence verification
passed and the caller's tested image was retained.

## Local replacement and evaluation

Recreated only the local `classifarr` service with `--no-build --force-recreate
--wait`. Container `4aef056672309cd30ce5ed0f13070e5ca01c60f369fb2bcff95fd60c80ffbae1`
started at `2026-10-05T01:05:30.69332505Z` (October 4 locally), using the exact
tested image above. Live Unraid and the unrelated local Harmoniarr container were
untouched. Existing appdata and deployment settings were retained.

- Healthy with HTTP 200, zero restarts and no OOM event. Node 24.21.0,
  PostgreSQL 18.6 and pgvector 0.8.7.
- At 153 seconds of database uptime: 1.91% sampled CPU, 424.1 MiB / 2 GiB and
  45 PIDs. Initial memory sample was 328.1 MiB. These short startup samples do
  not establish steady-state usage, absence of leaks or a sustained resource soak.
- Existing UID/GID 1000:1000, read-only root filesystem and 2 GiB limit remain.
  CPU/PID limits remain unset; this change does not add deployment resource caps.
- The process sample at 60 seconds found one application, one supervisor and
  zero compatible maintenance workers. No new idle process or retry loop is added.
- No persisted ERROR entries since startup. One WARN remains: `mediaSync`,
  `legacy_owner_unknown`, Movies/library 5. The earlier read-only database check
  found its six legacy running markers unchanged and no ingestion phase.
  Family/library 4 remained import-complete at 864/864 with zero legacy running
  markers; this is not independent proof of metadata completion.

The rebuild did **not** clear the ownership warning. Automatic takeover remains
disabled until production identity separation and writer fencing are integrated.
No library reset, fabricated ownership, data deletion or warning suppression was
used. No published-image upgrade, physical NAS or production release is claimed.

## Next item

Connect the protected production dispatcher with restricted runtime, startup and
restore maintenance, custom-path validation and bounded PostgreSQL diagnostics.
Then enforce ingestion writer admission and activate unattended legacy recovery.
Do not use file permissions alone as proof that an older database writer stopped.
