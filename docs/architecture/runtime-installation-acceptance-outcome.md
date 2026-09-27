# Runtime installation acceptance outcome

## Implemented

The [design](runtime-installation-acceptance-design.md) is implemented as a
dedicated least-privilege CI job. Release acceptance requires both existing
database tests and this installation job to succeed. Publication gates remain
unchanged; no release or deployment was created.

The shared ESM runner verifies a fresh candidate install before starting the
published baseline on a separate empty volume. Only the two allowlisted receipt
files are uploaded. CI refuses dirty or wrong-revision checkouts; local runs
explicitly disclose dirty-tree status.

## Measured local result

On 2026-09-27 at 10:01:50 UTC, all nine checks and owned-resource cleanup passed:
baseline provenance, fresh seeds, published startup/export, persisted-volume
migrations, container interruption, blocked unverified startup, explicit verified
retry/rollback, movie/TV recovery into learning, and verified normal restart.
Music stayed excluded; synthetic routing task count stayed zero.

| Scenario | PostgreSQL server version number | Applied migrations |
| --- | --- | --- |
| Fresh candidate | 180006 | 286 |
| Published v0.48.4-beta | 180006 | 222 |
| Upgraded candidate | 180006 | 286 |

Candidate image ID:
`sha256:30403691a183a1184c8e21e7f6154e3884bdc0f33adaa7e709dbbdeeaa692296`.
The owned candidate image and test volumes were removed by verified cleanup.
This was a dirty-worktree local run, not a clean-checkout CI acceptance claim or
published-image attestation. Its bounded receipt is generated under ignored
`.tmp/ci/`; raw failure logs, if present, are not uploaded.

## Limits and next step

The final backend coverage run passed 1,479 suites / 44,008 tests, including fresh
seed checks, receipt validation, clean-checkout enforcement, workflow bypass
regressions and owned-resource cleanup tests. Type, dependency, documentation,
static-import, copyright and migration checks also passed.

This covers one pinned published release on one local Docker platform, same-major
PostgreSQL, and synthetic providers. It does not prove real-provider accuracy,
arbitrary backup compatibility, multi-architecture upgrades, or live deployment
recovery. The live Classifarr service and persistent data were not replaced.

Next for release infrastructure: observe the first clean-checkout Actions receipt
before expanding the supported baseline/architecture matrix. A GitHub MCP search
found no open PR to select, so no PR was merged or substituted with a closed one.
