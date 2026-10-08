# Environment loader boolean-option outcome

Date: 2026-10-08. See the separate
[design and tradeoffs](dotenv-boolean-options-design.md).

## Implemented

Updated server dotenv 18.0.5 → 18.0.6. Only that installed package changed in
the regenerated lockfile; there are no additions, removals or transitive updates.
The existing centralized ESM environment loader and all production configuration
defaults are unchanged. The upstream package still publishes CommonJS; application
imports and the new tests remain ESM. No dependency fork or parallel loader was added.

Nine additional installed-package tests cover false/true override options,
preservation of empty externally supplied values, debug suppression and missing
optional files. Existing ESM, parsing, path/URL and quiet-loading tests remain.
Three regressions failed on 18.0.5: string `false` and `0` overwrote existing
values, and string `false` enabled logging. All pass with 18.0.6. These reproduce
the dependency behavior; they do not establish an incident in Classifarr's loader,
which does not supply those string-valued options.

## Source validation

| Check | Observed result |
| --- | --- |
| Toolchain | Node 24.21.0 / npm 12.2.0; no global upgrade |
| Lock generation | `npm --prefix server install --package-lock-only --ignore-scripts`; only dotenv changed |
| Clean installation | `npm --prefix server ci` passed under unchanged strict script policy |
| Dependency tree | `npm --prefix server ls --all --json` passed without dependency problems |
| npm audit | Zero reported vulnerabilities before and after, including development dependencies; not a guarantee of safety |
| Focused tests | 2 suites / 24 tests passed after final test-helper adjustment |
| Full backend unit suite | 1,747 suites / 54,282 tests passed; one Linux-only test skipped on Windows; 289.196 seconds |
| Lint and typecheck | Backend lint and typecheck passed |
| Preflight | Copyright, inventory drift gate, Knip and production Knip passed |
| Dependency tooling | 40 tests passed; install-script restrictions unchanged |
| Documentation and ESM | Documentation lint, static-import check and whitespace check passed |

The first lint run rejected direct console spies in the new test. Replaced them
with the repository's existing console helper and reran lint and focused tests.
The inventory gate still reports 501 previously reviewed unresolved paths and
`productionCompatible: false`; its passing drift check does not authorize those
paths or claim privilege-isolation completion. No baseline was relaxed.

Full frontend coverage and database integration were not rerun locally this round;
there are no frontend or database-driver changes. The frontend production build
passed inside Docker. Hosted CI results are distinct from these local results.

## Random open PR

Fresh enumeration returned #555 and #556. The random draw selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest and
lockfile changes locally. The existing runtime compatibility test passed 8/8
before, failed 1/8 with Node 26 declarations, then passed 8/8 after explicitly
reversing the trial. Client files are unchanged in the retained implementation.

The trial stopped at the compatibility gate, before installing the incompatible
client tree. It is not a successful PR adoption. Neither PR was merged, closed,
or changed remotely; matching the deployed Node 24 major remains required.

## Actual image verification

Implementation commit: `a0519f6d7a3a3942769afe8a96112b7f35209d23` on `main`.
Built from its clean checkout with the existing Compose files and
`build --no-cache --require-provenance`, using the multi-variant pgvector build.

- Local Docker image/index ID:
  `sha256:a061862c9d823b5f65551bc6552f52f53e8a5700b3301c28d40d8465ad9b234e`.
- Native manifest:
  `sha256:ba85714208aaef97ea429848fe2c34a37f0f06660982f654f97a5698e31f97ed`.
- Config digest:
  `sha256:c6d9cf4fa7fd395468e0f339b4915560c4416c70ee849b93ccc962d4751cee4b`.
- OCI revision matches the implementation commit. This local build evidence is
  not signed registry provenance or multi-platform release verification.

Eleven synthetic dotenv checks passed against the installed package in a disposable
Linux container. It had no network or app-data mount, a read-only root, UID/GID
1000, no capabilities, no-new-privileges, 256 MiB memory, 64 PIDs and a 32 MiB
temporary filesystem. The Linux directory-fsync/exclusive-copy check also passed
against the actual image module, covering the Windows platform skip.
All probe containers were removed. The 58 installed Linux package versions match
the prior local image exactly, including the database/runtime packages.

Ran `check-schema-snapshot-container.mjs --dump`, followed by the independent
check, against the exact candidate image. Each used its own fresh disposable
database. Both passed; `database/schema/current.sql` remains unchanged through
`20261005_180000_ingestion_compatibility_fence.sql`, with 22 data-only seeds.
Confirmed both generated containers and data directories were absent afterward.

## Local replacement

Before replacement, retained the prior image
`sha256:d22706999bf1941f608b67329cb5272f8c3436dd403bae0d5954f9130de36512`
as `classifarr:pre-memory-d26ececa-dce0-4369-8575-0cf3c3e73cbc` and produced a
75,764,770-byte database archive in ignored
`.tmp/pre-memory-fingerprint-d26ececa-dce0-4369-8575-0cf3c3e73cbc.dump`.
Its checksum and archive index verified; a full restore and full app-data backup
were not performed. Do not commit or share that private archive.

Recreated only local Compose, without another build. The container started at
`2026-10-08T09:05:05.371169366Z`, reported healthy, and ran the exact candidate ID.
Health HTTP returned 200; unauthenticated libraries API returned 401. Existing
mounts, non-root identity, read-only root, security options, runtime settings,
2 GiB memory limit and V8 safeguards are unchanged. Unraid was not accessed.

The five-minute sampler recorded 19 healthy readings from
`2026-10-08T09:05:36.174Z` through `2026-10-08T09:10:31.093Z`. Raw cgroup usage
ranged from 492.55 to 889.99 MiB; the kernel peak was 895.92 MiB. Memory-limit
failure count stayed zero, with no OOM kill or container restart. These are
container-wide readings, not retained JavaScript heap or evidence of a memory
improvement caused by dotenv.

Bounded read-only diagnostics found zero new error-log entries since startup;
inventory readiness progressed from ingesting to backfilling. The latest saved
comparison warning predates replacement and has a subsequent recovery event.
Backfill is not yet complete. This short startup observation is not a long-term
memory soak or a new complete-refresh retention study.

## Hosted checks at handoff

For the implementation commit, these workflows completed successfully:
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/37753569041),
[Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/37753567805),
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/37753568020),
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37753567946),
[copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/37753567835)
and [resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37753567844).
The [main CI pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37753568362)
was still running backend coverage, database integration and isolated installation
acceptance at the last check. No hosted pass is claimed for those pending jobs.
The later documentation-only commit does not change the tested image contents.

## Recommendation stack

Keep the scoped upstream patch with its regression coverage. It fixes a known
option-handling defect without reworking startup; the cost is maintaining a small
dependency contract test. Replacing the loader would require a separate grammar,
precedence and startup-order study and is not justified by this patch.

Next, review express-rate-limit 8.7.0 → 8.7.1. Its
[official changelog](https://github.com/express-rate-limit/express-rate-limit/blob/main/docs/reference/changelog.mdx),
retrieved through GitHub MCP on October 8, reports avoiding unnecessary work when
logging is disabled. Verify real rejection/Retry-After behavior, authentication
limits, IPv4/IPv6 keys and logger behavior before adoption. Do not relax limits.
Then review js-yaml 5.4.2 → 5.4.3, followed separately by Knip/tooling updates.
Memory safeguards and the earlier retention findings remain unchanged; this patch
does not claim a memory improvement. No release, tag or version bump was created.
