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
Full-suite, exact-image rebuild/rehearsal and local-container observations will
be recorded below after completion. No previous image result substitutes for them.

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
