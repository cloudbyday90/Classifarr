# Selected database process adapter outcome

Date: 2026-10-04. Base: `6306fed3ba6799bdc3d9ec5ec5add409bfd65755`.
See the [design, research and tradeoffs](selected-database-adapter-design.md).

## Implemented

- Three ESM modules separate fixed layout validation, direct process/control
  operations and supervisor-facing lifecycle state. The disposable legacy drill
  now uses this adapter, not its former `pg_ctl` start/adopt implementation.
- The adapter checks root-protected ancestors/configuration, separate non-root
  accounts, private PostgreSQL data, empty auto-configuration and an absent PID
  before launch. It fixes critical paths on the PostgreSQL command line and
  inherits no caller environment. It never modifies permissions or PID files.
- The shared startup runner joins cancelled reads/probes within one second and
  explicitly reports unjoined work. Broken diagnostics cannot skip child cleanup.
  Existing compatible startup also benefits from these two changes.
- The compatible shell refuses the reserved layout before account provisioning,
  directory creation or recursive ownership changes, including dangling links.
  No existing deployed database is converted by this change. Older images that
  predate this guard cannot be assumed to respect the new reserved directory.
- The Linux fixture covers cancelled direct-child startup, clean-state checking,
  normal selected startup and SIGTERM, and verifies source/committed-write
  preservation. Fixture provisioning makes only its disposable appdata parent
  root-owned; this is not a production appdata conversion implementation.

No SQL schema/API/dependency/version/template changes, external PR merge or release.
GitHub CLI using the saved login returned no open Classifarr PRs on 2026-10-04,
so there was no eligible random PR to implement.

## Verification

Focused tests: twelve suites, 250 tests passed, including the ownership gate.
Server lint/typecheck, CI preflight, ESM import/mock gates and Markdown lint passed.
Full backend unit run: **1,684 suites passed; 51,889 tests passed, one skipped**
in 270.415 seconds. The skip is the existing Linux directory-fsync test on Windows;
the image drill separately exercises actual Linux copy/sync behavior. The earlier
full run reached the ownership gate before reviewed hashes were updated: all other
tests passed, and the committed-tree rerun above passed completely. No gate was
disabled or unresolved writer waived.

CI preflight reviewed 19 owned, 268 separately coordinated and 502 unresolved
paths; fingerprint `fa41529b4fac319b151725c02f6c1d093af3770c34399feb570d99e5fff9b6a8`.
Markdown lint checked 1,886 documents. No full client test/coverage run or remote
CI result is claimed for this backend-only change.

## Exact image and database snapshot

Built from clean code commit `5e02a95d4ef5276b3e447734188153e9989fba2d` with
`node scripts/docker-compose-smart.mjs build --no-cache --require-provenance`.
The inspected Docker image ID is
`sha256:05467790f3c6adefa3db1774f986c1eab8eca35032df8bc94d76a0889a5f0ddb`;
the OCI revision matches the code commit. This is a local image, not a published
registry-upgrade claim. The build selected AVX2 and rebuilt the client as well.

Ran the existing isolated schema runner against that exact image after building:
fresh snapshot load, `dump-schema`, fresh reload and another dump passed with zero
drift. `database/schema/current.sql` is unchanged; no migration was needed. Its
random, labelled, network-isolated database container was removed afterward.

The exact-image isolated drill passed all 12 core checks in 164,218 ms, including
the actual fixed-path adapter, cancelled start, lease contention, schema/runtime
ordering, SIGTERM, copied-data readback and protected-entrypoint refusal. Maximum
reported orchestrator RSS was 94,084 KiB (not total container memory). Standard
UID 1000, custom UID/GID 2345 and Unraid-style UID 99/GID 100 profiles all passed.
Observed stop-and-verification durations were 3,507 / 2,562 / 2,566 ms under the
unchanged ten-second host timeout. These small fixtures do not guarantee every
busy installation fits that timeout.

Unexpected application death and database loss failed closed. The deliberate host
SIGKILL test reported nonzero exit and recovered committed data on restart; it was
not labelled a clean shutdown. All disposable project containers, volumes and
image aliases were removed and absence verified; the caller's image was retained.
No live Unraid state or unrelated local container was changed.

## Local replacement and evaluation

Recreated only the local `classifarr` service with `--no-build --force-recreate
--wait`, using the tested image and existing appdata. Container
`8da0bf1a904ad85a745950ea4e15552c91e6ef6eaab61417baac1bc2a5be2e22`
started at `2026-10-05T00:36:36.693038981Z` (October 4 locally).

- Healthy; HTTP `/health` returned 200; zero restarts and no OOM event.
- Node 24.21.0, PostgreSQL 18.6, pgvector 0.8.7. Existing UID/GID 1000:1000,
  read-only root filesystem and 2 GiB memory limit remain unchanged. CPU and PID
  limits remain unset in this local deployment; this change does not impose them.
- At 147 seconds of database uptime: 0.50% sampled CPU, 409 MiB / 2 GiB, 46 PIDs.
  An earlier sample was 383.3 MiB. These are short startup observations, not
  representative load, leak detection or a sustained resource-soak result.
- Process inspection found one application, one supervisor and zero compatible
  maintenance workers. No new idle worker/retry loop was introduced.
- Since startup: no persisted ERROR entries and one `mediaSync` WARN,
  `legacy_owner_unknown` for Movies/library 5. Its six old running markers remain
  unchanged. Family/library 4 remains import-complete at 864/864 with no legacy
  running markers. Those counts do not independently certify metadata completion.

The warning is **not fixed by a rebuild or this adapter**. Nothing fabricated a
new owner or discarded existing inventory. Production conversion, writer fencing
and unattended recovery remain the implementation work below.

The first focused run exposed a test double that kept returning a PID after
simulated shutdown; corrected the mock rather than weakening shutdown checks.
Lint found two unnecessary suppression comments; removed them. The import check
found a static-import candidate in the new test; changed it to a static ESM import.

Ownership review updates are limited to the inspected startup/adapter and
synthetic fixture files. They remain separately coordinated, not proof that
unknown ingestion writers are fenced; unresolved inventory entries are unchanged.
The recovery and release-evidence skills required explicit cancellation, real
PostgreSQL lifecycle checks, isolation and honest activation limits.

## Remaining work and recommendation

Next: **protected production provisioning and capability-aware entrypoint dispatch**.
It must separate app-writable subdirectories from root-protected metadata, preserve
major PostgreSQL upgrade handling and saved non-root configurations, and wire the
restricted runtime plus privileged maintenance paths. Provide bounded operational
database diagnostics before production activation; this adapter currently discards
native subprocess output rather than exposing raw SQL/configuration details.

Then complete database-enforced ingestion writer admission and activate unattended
legacy import recovery/backfill. Do not infer old ownership from age, reset markers,
or silently fall back to the pre-conversion source. No claim is made here about
published-image upgrades, physical NAS behavior, power-loss durability or long
resource soaks. Existing Movies ownership warnings are not resolved by this adapter.
