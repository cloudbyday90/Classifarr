# Legacy database selection outcome

Date: 2026-10-04. See the [design and official sources](legacy-database-selection-design.md).

## Delivered

Added a small ESM selection module, separate durable selection receipt and a
copy-phase guard. A completed conversion must pass verification before selection,
including on every restart. Failed or missing evidence stops the operation; it
never selects the old database as a fallback. Selection intent prevents recopy
even when the conversion receipt is missing. Directory-sync failures are retried
through verification and durable selection, not treated as successful startup.

The isolated PostgreSQL rehearsal now commits a restricted-role write after
selection, kills the actual process, reads that write in an independent restart
before replaying any write, and verifies the original cold source is unchanged.

This is a tested prerequisite, **not production activation**. Ordinary startup,
saved permissions, existing appdata and library ownership remain unchanged. No
new timer, API, dependency, database migration or release was added. The recovery
skill kept ambiguous ownership fail-closed; the release-evidence skill kept local
synthetic checks distinct from deployed upgrade acceptance.

## Validation

- Focused backend checks: 210 passed across nine suites; one Linux-only
  filesystem test skipped on Windows. The real Linux drill separately exercised
  file/directory sync, protected ownership and process death.
- Final full backend unit run: 1,680 suites passed, 51,756 tests passed and one
  Linux-only filesystem test skipped. No full client suite or coverage ratchet
  rerun is claimed for this increment.
- XML contract: all ten tests passed. README Compose tests parse both the
  optional-media example and its no-media default.
- Repository lint, both client/server type checks, Markdown lint (1,882 files),
  copyright, ESM import/mock-shape checks, migration/schema integrity and both
  Knip modes passed. Docker Compose validated both README example variants.
- Ownership gate passed after reviewing only the changed migration paths and
  adding explicit selection dependencies: 19 owned, 260 separately coordinated,
  502 unresolved. Existing unresolved paths remain unresolved.
- Development image `sha256:f7fe990d2d5a673007e55595c4b57cd3180ff6031005863ae3929e46fee12d69`
  passed the full isolated drill: 12 core checks plus the existing default
  non-root, custom `2345:2345` and root-start Unraid-style `99:100` profiles.
  Core duration was 125,727 ms; orchestrator peak RSS was 92,336 KiB (not total
  container memory). The profiles retained their ten-second host stop budget.
  All owned disposable containers, volumes and aliases were removed; their
  synthetic data is regenerable. The caller's image and real appdata were retained.

The broader backend run exposed a pre-existing code-health failure in queued
routing: the fixed SQL builder was interpolated without the required review
annotation. Review confirmed that all inputs remain bound parameters. Added the
narrow annotation and a regression test proving identical SQL across different
classification IDs and rejection of invalid IDs before database access; no guard
was disabled and no routing behavior changed. The corrected full run passed;
the final image was rebuilt after this correction.

### Final image and local evaluation

Clean-source no-cache build: `b922ba65e1dc36067f27369ed5ff0e6747d039e4`.
Exact local Docker image ID:
`sha256:842e7dbbd300786223760e0c0ec0e02967d7a20e0a333b04cb72d9cd39461bc2`.
The OCI revision matches that source; this is not a registry digest or a release.
Subsequent edits only clarify README directory preparation and record results.

The exact image passed all 12 isolated core checks, including candidate-write
preservation across actual process death and verification that the cold source
remained unchanged. Core duration was 143,676 ms; orchestrator peak RSS was
94,136 KiB, not total container memory. Default forced-non-root `1000:1000`,
root-start custom `2345:2345` and root-start Unraid-style `99:100` profiles
passed startup, restart, persisted-data and bounded shutdown checks. Their stop
times were 3,031 ms, 2,597 ms and 2,595 ms respectively, within the existing
ten-second test budget. Unexpected Node exit, database loss and forced host
termination recovery checks passed. All owned disposable containers, volumes
and aliases were removed; their synthetic data is regenerable.

Only local Docker Desktop's `classifarr` Compose service was then recreated,
using that image without another build. The separate Unraid installation and
database were untouched. The replacement reached healthy status with Node
24.21.0, PostgreSQL 18.6 and pgvector 0.8.7.

At 146 seconds of database uptime, health remained green with zero restarts or
OOM events. Startup database logs contained no errors and one warning: Movies
(library 5) still reported `legacy_owner_unknown`, with its six legacy running
markers unchanged. Family (library 4) retained its completed 864-item import;
its latest recovery record was `superseded`, not evidence of completed metadata
backfill. This increment neither resets those records nor claims to recover them.
The latest resource sample was 0.56% CPU, 390.6 MiB of the existing 2 GiB limit
and 41 PIDs. CPU and PID caps remain unset in this saved local configuration;
short startup samples do not establish a sustained resource ceiling or absence
of leaks.

After replacement, `dumpSchema` ran against an isolated PostgreSQL instance from
the same image. Loading the current snapshot, dumping, loading into a second
fresh database and dumping again produced zero drift. The tracked schema did
not change; no migration was added. The owned scratch container was removed.

## Template compatibility

The README example now clearly targets a new `1000:1000` installation, leaves
media access optional, disables missing-media-directory creation in the opt-in
bind, and includes the maintained 60-second shutdown grace period. Existing
installations are told to retain their saved configuration. New installations
must prepare appdata with the matching host identity; Docker-created root-owned
bind directories cannot be repaired by this forced-non-root profile. Existing
database ownership must not be recursively reset to match an example.

The project XML and existing upstream request explicitly preserve legacy
appdata, identities and media mappings. This does not change a saved CA template
or require copying forced-non-root Compose settings into it. The separate
[template outcome](unraid-template-startup-outcome.md) records the upstream handoff.

## PR and remaining work

The saved GitHub CLI login returned no open Classifarr PRs on 2026-10-04. No
random PR was available; none was invented, merged or substituted.

Recommended next step: compose the protected startup path around the verified
copy and durable selection, then finish database-enforced ingestion-writer
admission before activating unattended recovery. Preserve ordinary non-root
compatibility while defining and testing that transition. Recovery completion
means import plus metadata backfill, not disabled optional AI work.

The next increment connects selection to the existing supervisor in the isolated
drill; see its [design](selected-database-startup-design.md) and
[separate results](selected-database-startup-outcome.md). It is not production
activation of the remaining protected entrypoint and writer boundaries.

This avoids post-upgrade write loss at the cost of a small protected receipt and
additional startup integration. A published-image upgrade, physical Unraid/
Synology validation, power-loss durability and completed unattended legacy import
recovery are **not** proved by this increment.
