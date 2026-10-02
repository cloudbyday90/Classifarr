# pgvector 0.8.7 validation outcome

Date: 2 October 2026. Scope: repository, disposable validation databases/images,
and the subsequently requested local Compose deployment. No release, remote PR
merge or routing configuration change was performed.

## Completed checks

- The old 0.8.6 binary failed the new native-entry-point assertion while a
  legitimate vector-distance query returned zero. This is a harmless focused
  substitute, not a reproduction of arbitrary code execution or the vulnerable
  IVFFlat build overflow. The old binary also rejects the particular mismatched
  query later; the changed error identifies the new earlier boundary check.
- Patched IVFFlat and HNSW query paths reject invalid dimensions for vector,
  halfvec and bit. Plans must actually use each index, and valid queries must
  still work after rollback of each rejected statement. Empty-result average
  returns NULL; nonfinite vector input is rejected.
- Persisted PostgreSQL 18 databases upgrade from both 0.8.2 and 0.8.6 to 0.8.7.
  Pre-existing vector rows and HNSW indexes survive and are used by queries.
  Replaying both extension migrations does not downgrade the result.
- Missing update files and insufficient extension ownership fail. An absent
  extension stays absent. A transaction-local future-version catalog fixture
  verifies numeric comparison without attempting a downgrade.
- The release schema rehearsal replays 91 migrations and matches the current
  fresh schema across 313 ledger entries. The library-profile rehearsal retains
  retry, enrollment and resume behavior; its synthetic checks do not measure AI
  accuracy.
- PostgreSQL startup smoke covers fresh installs, missing optional
  pg_stat_statements files, the persisted PostgreSQL 17-to-18 bridge, and included
  configuration diagnostics. The bridge finishes with pgvector 0.8.7.
- Native probes pass on PostgreSQL 17 generic and PostgreSQL 18 generic, AVX and
  AVX2 builds in isolated amd64 containers. Each has no host ports or network,
  a 1 GiB memory limit, two-CPU limit and 128-process limit, and is removed after
  testing. No live data is mounted.
- The same probes pass on ARM64 PostgreSQL 17 and 18 generic libraries under
  Docker Desktop emulation. This checks compiled ARM64 code, not NAS performance
  or every physical ARM CPU.

## Verification commands and results

All commands run from the repository root unless noted. No full-repository
test-suite or real-NAS acceptance claim is made.

| Gate | Command or check | Result |
| --- | --- | --- |
| Build and source | `docker build --build-arg PGVECTOR_BUILD=multi --tag classifarr:pgvector-087-check .` | Passed; all amd64 variants compiled from checksum-verified source |
| Build and source | `docker buildx build --platform linux/arm64 --load --build-arg PGVECTOR_BUILD=multi --tag classifarr:pgvector-087-arm64-check .` | Passed under emulation; portable PG17/PG18 builds |
| Native boundary | `verifyPgvectorSecurityBoundary` in isolated containers | Passed on four amd64 and two emulated ARM64 major/variant combinations |
| Focused unit compatibility | `node scripts/run-jest.mjs --testPathPatterns='pgvector\|dumpSchema\|pgStatStartupSmoke\|schemaReleaseReplay\|libraryProfileUpgradeRehearsal' --runInBand --no-coverage` from `server/` | 65 tests passed in 8 suites |
| Database compatibility | `node scripts/run-jest.mjs -c jest.integration.config.mjs --testPathPatterns='pgvector-(security\|extension-upgrade)\|held-out-semantic-study\|inventory-description-vector-cache' --runInBand --no-coverage` from `server/` | 12 tests passed in 4 suites |
| Changed fixture images | Same integration runner, `--testPathPatterns='library-catalog-archive\|mediaSyncRecoveryFairness'` | 28 tests passed in 2 suites |
| Release replay | `node server/src/scripts/runSchemaReleaseReplay.mjs` | Passed; catalogs match |
| Backfill compatibility | `node server/src/scripts/runLibraryProfileUpgradeRehearsal.mjs` | Passed |
| Fresh schema | `node scripts/check-schema-snapshot-container.mjs` with the candidate `IMAGE_NAME` | Passed; generated snapshot matches |
| PG17 bridge and startup | `node scripts/check-pg-stat-startup-smoke.mjs` with the candidate `IMAGE_NAME` | Passed all four scenarios |
| Repository checks | `npm run migration:check`, `npm --prefix server run lint:tests`, `npm --prefix server run lint:security`, `npm run lint:docs`, `git diff --cached --check` | Passed |

An independent read-only reviewer found no concrete surviving source-level
bypass or regression. Runtime evidence above was collected separately by the
implementer, not claimed as independently executed by that reviewer.

Initial validation exposed and corrected a bit(1) test-fixture cast and the
missing historical install script in release replay. No assertions were removed
to obtain a pass. Compose validation correctly requires a drill password; it
passes with a synthetic value and does not start a stack.

The final amd64 validation image is
`sha256:8ae9f25c7265b3b005c89fcbb86b37b9106a8d71e82687989f5cf66cde2a1403`.
The final ARM64 validation image is
`sha256:366123fc9cc1c02eed0d3e78bb6ae4eed324c1ae87c2276104076cdb6126e1e8`.
Builds reused unrelated cached layers; neither is described as a full no-cache
rebuild. The changed pgvector compilation layer was executed.

The live container remained on 0.8.6 during those isolated tests. The subsequent
authorized deployment below updated it to 0.8.7.

## Local no-cache deployment

Source revision: `db329d57e1128ac53c9049ade6f9beddc086fda8`.

- Created a custom-format `pg_dump` backup before deployment; `pg_restore --list`
  successfully read its archive directory. This is an archive-readability check,
  not a full restore rehearsal of the private live database. The backup remains
  under the existing persistent `data/backups/` mount, excluded from Git.
- Retained the previous image as
  `classifarr:rollback-pre-pgvector-087-20261002`. Image rollback alone is not a
  database rollback; retain the pre-upgrade backup as well.
- Ran `docker compose -f docker-compose.yml build --no-cache` with the source
  revision supplied as `VCS_REF`. Every build step ran; the existing pinned Node
  base image was reused, not updated to a different Node release.
- Repeated all four startup/upgrade smoke scenarios and all four amd64 native
  variant probes against this exact image. A synthetic bcrypt hash/compare probe
  also passed. These probes used disposable containers, not live tables.
- Recreated only the local `classifarr` service using `--no-deps --no-build
  --pull never --force-recreate`. Existing data/media mounts, routing settings,
  the read-only root filesystem and the 2 GiB memory limit stayed unchanged.
  Other running applications were left untouched. No image was published.

The deployed image is
`sha256:09c436ac8508a273c6ad5606b9dcacf76f7fabb7b42243074bf64145fd7d2282`.
Its revision label matches the source commit. Startup selected the packaged
AVX2 library; PostgreSQL restarted and reports vector **0.8.7**. A normal vector
distance query passed. All three pending migrations completed, including two
previously committed recovery-tracking migrations; the ledger contains 313
entries. The health endpoint reports a connected database.

Library, classification-history and classification-embedding row counts were
unchanged immediately after startup. The existing startup retention policy
removed 2,446 expired **completed queue records**, recorded in the cleanup
history. These are included in the pre-upgrade backup; this deployment did not
manually delete library inventory or embeddings.

Short post-startup observations showed roughly 378–414 MiB of Docker-reported
memory use against the 2 GiB limit. A delayed sync briefly used about 69% of one
CPU before returning below 1%; no restart, OOM kill, memory-limit failure or
idle-in-transaction database session was observed. Existing configuration has
no container CPU quota or PID limit. This is a short startup observation, not a
peak-load or long-running leak test.

### Remaining operational warnings

The rebuild does **not** clear unrelated ingestion conditions. During delayed
sync, two libraries still reported `legacy_owner_unknown`; their takeover
safety checks were preserved. Three other libraries reported ten source items
with conflicting provider IDs. No new application ERROR records appeared in
the initial observation window. Two startup queries took approximately 1.2 and
1.5 seconds and produced slow-query warnings.

Review ownership recovery and source identity conflicts separately. A healthy
container and patched extension do not mean every library import is complete.

## PR request

GitHub MCP returned no open pull requests for `cloudbyday90/Classifarr` during
this round. There was no eligible random PR to implement; no closed or unrelated
PR was substituted.

## Limits and next work

The dependency fix does not prove the whole platform is vulnerability-free.
No exploit payload was run. Only the explicitly requested local installation
was updated; other installations need a patched image rollout. Real NAS
hardware remains a separate deployment acceptance check.

The next dependency round should update Node/npm/Alpine together, leaving other
package upgrades separate enough to diagnose regressions. On 2 October, the
deployed versions remain Node 24.18.1, npm/npx 12.0.2 and Alpine 3.24.1. The
reviewed targets are [Node 24.21.0 LTS](https://nodejs.org/en/blog/release/v24.21.0),
[npm/npx 12.2.0](https://github.com/npm/cli/blob/latest/CHANGELOG.md) and
[Alpine 3.24.2](https://alpinelinux.org/posts/Alpine-3.21.8-3.22.6-3.23.6-3.24.2-released.html).
Keep PostgreSQL 18.6 and the 17.11 bridge: both are current in the
[official release archive](https://www.postgresql.org/docs/release/).
Repeat native dependency, database-upgrade, fresh-install and persisted-data
checks before deploying that runtime update. Follow the
[design and rollout guidance](pgvector-0-8-7-design.md).
