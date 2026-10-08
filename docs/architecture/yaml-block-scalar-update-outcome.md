# YAML block-scalar patch outcome

Date: 2026-10-08. Implementation:
`8fc8647ab1178fa5a5e26972ef1724b7b237f82a` on `main`.
See the [design and source research](yaml-block-scalar-update-design.md).

## Change and observed reproduction

Updated the server's single shared js-yaml installation from 5.4.2 to 5.4.3.
The manifest minimum and exact lock resolution changed; no other package,
override, install policy, runtime major, database migration or Compose setting
changed. Existing modular parsing code is retained; no extra service wrapper
or third-party backport was introduced.

Before updating, eight assertions failed: six empty-scalar style/chomping cases,
a following sequence item and the actual OpenAPI annotation generator. The
generator omitted the valid schema. The other 53 focused assertions passed.
After updating, all 61 passed. Controls include tagged/quoted first keys,
anchors, separate documents, ordinary scalars, duplicate keys, invalid
indentation, executable-tag rejection and default merge-key behavior. Existing
merge-budget regression tests are unchanged.

## Local validation

| Check | Result |
| --- | --- |
| Lockfile generated with scripts disabled and reviewed | Only js-yaml changed; registry integrity matches |
| Normal strict-policy server `npm ci` | Passed |
| Server `npm ls --all` | No dependency-tree problems |
| Server audit, including development dependencies | Zero advisories reported on October 8 |
| Focused parser, Swagger, merge-budget and package-import tests | 4 suites, 61 tests passed |
| Actual overridden Istanbul YAML configuration loader | Parsed booleans, hyphenated keys and array settings correctly |
| Full backend unit suite | 1,749 suites; 54,316 passed, 1 skipped; 261.970 seconds |
| Server lint, typecheck, Knip normal/production | Passed |
| Repository CI preflight | Passed; ownership drift caveat below remains |
| Dependency-tooling tests | 40 passed |
| Markdown and static ESM import checks | Passed |

The Windows skip is `embeddedMigrationTree`'s Linux directory-fsync test.
Coverage percentages and the two-workspace coverage ratchet were not recomputed;
the real Istanbul loader probe is a compatibility check, not a coverage claim.
The full unit suite includes workflow/Compose parsing and rejection tests. A new
database-driver integration run and frontend unit run were not required by this
server-only parser patch; the image build still builds the production frontend.

Preflight reports no unreviewed inventory drift, but still lists 501 reviewed
unresolved paths and `productionCompatible: false`. That existing static
hardening debt is not resolved by this dependency update or waived by a pass.

## Random PR trial

The fresh draw selected [PR 556](https://github.com/cloudbyday90/Classifarr/pull/556)
at `9d74537d7917c248d15926f37b2e40ceba7559a4`. Its exact manifest/lockfile changes
were applied locally. The runtime-baseline tests went from 8 passing to 7 passing
and 1 failing because Node 26 declarations do not match the deployed Node 24
major. Reversing only that patch restored all 8 passes. No incompatible install,
PR merge, PR closure or retained Node 26 change occurred; the PR remains open.

## Image and local runtime

The clean implementation revision was built with `build --no-cache
--require-provenance` using the unchanged local Compose files and multi-variant
pgvector setting. The frontend production build passed. The pinned base image
was reused, while build steps reran without layer cache.

- Local image/index ID:
  `sha256:55c581b59fccfb6d81dbe50b22ada55bacdba3675f6feb7f49b1e23feb0effea`.
- Native manifest:
  `sha256:3261dd997e39d223930e65dca9ae5e37e228752ef214418602c8cb75f8d2acd0`.
- Image config:
  `sha256:90cbfa14b48b057debc31523d39e43e94aea0a59f7118565efd2b1cf14e3b263`.
- OCI revision matches the implementation commit. These local identities are
  not registry publication or signed-provenance claims.

Isolated probes used the actual image's installed js-yaml and Swagger generator,
with synthetic separately mounted fixtures, no network, read-only rootfs,
UID 1000, dropped capabilities, 256 MiB memory and a 64-PID limit. All six scalar
styles, annotation retention, invalid-indentation rejection and merge budgeting
passed. The Linux directory-fsync/exclusive-copy check also passed. Every probe
container was removed and absence checked. All 58 installed APK package versions
match the previous local image; Node remains 24.21.0.

Both `check-schema-snapshot-container.mjs --dump` and its check mode passed
against separate disposable databases from this exact image. The tracked schema
is unchanged, includes migrations through
`20261005_180000_ingestion_compatibility_fence.sql`, and retains all 22 seed
migrations. Both generated containers and their exact temporary data directories
were removed; absence was verified. No live schema was copied into the repository.

Local Compose was recreated with `--no-build --force-recreate --wait` after the
image checks. Container
`bb6a1c7b712d67ce1b6df9f8831962d9788d8db2b046b8000ff29a11deba0a2e`
started at 10:16:46.824 UTC on the exact candidate image. UID 1000, read-only
rootfs, no-new-privileges and the 2 GiB limit are unchanged.

The five-minute observation completed with 19 samples from 10:17:25.520 to
10:22:20.570 UTC. Every sample was healthy, with zero OOM events or cgroup memory
failures; final restart count was zero and `/health` returned HTTP 200. Raw
cgroup usage ranged from 497.59 to 920.45 MiB, with a recorded peak of 926.06 MiB.
These readings include the container's other processes and caches, not just the
Node heap. A bounded, read-only database query found no error-log entries since
this restart. This is startup/short-run evidence, not a complete-refresh
retention profile, performance improvement or production/Unraid acceptance.

Before replacement, the old local image was
`sha256:a66294f52be2dbb74b2f0408d6f9395679242197618162c627573fc9c0b402af`.
Its single comparison warning since startup was `memory_pressure` at
09:55:45 UTC; bounded file logs recorded recovery at 09:58:45.483 UTC, with no
scheduler error. This pre-update observation is not attributed to js-yaml.

The local PostgreSQL backup is 75,891,445 bytes, with matching SHA-256 on both
sides and a readable `pg_restore --list` archive. It remains private in
`.tmp/pre-memory-fingerprint-db1a75da-eb5d-4813-8825-374d1680ef3b.dump`.
The exact previous image is pinned as
`classifarr:pre-memory-db1a75da-eb5d-4813-8825-374d1680ef3b`.
This checks archive integrity/readability, not a complete restore or appdata
backup. No Unraid database, container or template is changed.

## Hosted checks

For the implementation commit, the
[OSV scan](https://github.com/cloudbyday90/Classifarr/actions/runs/37761682140),
[Trivy scan](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681386),
[CodeQL analysis](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681463),
[secret scan](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681395),
[copyright check](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681453)
and [resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681388)
passed. The [main pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37761681793)
was still running during the local evaluation; do not describe the complete
pipeline or a later documentation commit as green on that evidence.

## Recommendation

Keep the tested patch: it corrects valid YAML with little dependency churn;
the tradeoff is ongoing compatibility coverage for overridden tooling. A parser
replacement would be disproportionately broad, and deferral retains the proven
annotation loss. Next, review Knip 6.39.0 to 6.40.0 as an independent tooling
batch, keeping Node 24 declarations and all memory/security safeguards unchanged.
No version bump, tag or release was created.
