# Runtime transport and IP update outcome

## Implemented scope

Follow the [design and official research](runtime-transport-ip-update-design.md).
Server overrides and lockfile now select Engine.IO 6.6.11, ws 8.22.0 and
ip-address 10.7.3. Exactly three package records changed: versions, registry
tarballs and integrity hashes only. No added/removed packages, new installers,
client/root dependency edits, migration or application configuration changes.
New tests are ESM; no production WebSocket endpoint was activated.

## Dependency and local regression evidence — 2026-10-08

- Node 24.21.0 / npm 12.2.0; clean install under unchanged strict lifecycle policy.
- `npm ls --all` reports no problems. Full server npm audit, including development
  dependencies, reports zero vulnerabilities. This is point-in-time scanner
  evidence, not a guarantee of safety.
- Old installed dependencies: 31 pass / 10 fail across 41 focused assertions.
  The same tests pass after the update. One initial reverse-DNS fixture put the
  subnet suffix on the wrong octet; it was corrected before the recorded baseline.
- Expanded transport/IP/Discord regression run: **8 suites, 83 tests passed**.
  Real loopback sockets cover invalid close arguments on both peers, binary
  messages, graceful closure, fragmented payload limits and compression rejection.
  Engine.IO uses real packets/timers; a spy counts timer refreshes across two
  heartbeat cycles, followed by a real timeout despite continuing non-pong traffic.
  IP tests retain real Express quotas and mapped/IPv6/private-range boundaries.
- Backend typecheck and both Knip modes pass. Initial new-test lint errors were
  promise-executor return style, corrected without suppressions; lint then passes.
- Dependency-tooling/install-policy suite: **40 tests passed**.

- Full backend coverage: **1,753 suites, 54,369 tests passed, 1 skipped** in
  749.091 seconds. The skip is Linux directory fsync on the Windows host; the
  actual rebuilt Linux image passed the complete/exclusive-copy/source-preservation
  probe. No test was removed or timeout relaxed.
- Full frontend coverage: **445 files, 6,421 tests passed** in 235.44 seconds.
  The coverage ratchet passed with both fresh reports and unchanged baselines.
  Backend statement/branch/function/line coverage: 89.74/85.81/91.12/89.74%.
  Frontend: 86.96/80.37/86.54/88.78%.
- Production frontend build and **8 Chromium navigation/asset tests passed**.
  These use synthetic API responses and block mutations; no provider writes.
- Copyright and Markdown checks pass. The Discord fixtures exercise loopback
  HTTP/REST, not a live Discord gateway session; shared ws behavior is tested
  through real local client/server sockets.

## No-cache image and local installation

Built from clean implementation commit
`f70b92717518b2a3adb9ac41164dd3ca6f3f8d54` using the existing Compose files and
`build --no-cache --require-provenance`, with `PGVECTOR_BUILD=multi` (CPU variants,
not a published multi-architecture test). Local image ID:
`sha256:8e6ddcbe7b9220d569bbdb759d2628a44ec055c391e736d7176f746a3fc665e1`.
Baseline local image:
`sha256:1dc10c5ce8c6becf35f060ef9934600ec8a5c6dd43a23d6cb3faaffebe2c4fa8`.

- Compared all 172 production npm package records: exactly the three reviewed
  versions changed. All 58 APK records and Node 24.21.0 match the baseline;
  development Knip is absent. Unreviewed drift would fail the comparison.
- Disposable, network-isolated, non-root/read-only image probes passed websocket
  invalid-close recovery and delivery, bounded Engine.IO heartbeat closure,
  IP quota normalization, reverse-DNS hardening and Linux directory fsync.
  HTTP/2 transferred 26,624 bytes correctly with nghttp2 1.70.0. Probe containers
  were removed and cleanup verified; no live appdata was mounted.
- Ran `check-schema-snapshot-container.mjs --dump` **after** rebuilding, then the
  schema check in another fresh disposable database. Both passed and cleaned up;
  `database/schema/current.sql` has no diff. Applied migrations through
  `20261005_180000_ingestion_compatibility_fence.sql`, with all 22 seed migrations.
- Before replacing local Classifarr, verified its Compose working directory,
  image and mounts. Preserved a 76,129,073-byte private database archive at
  `.tmp/pre-memory-fingerprint-63419a08-0819-47d5-989e-5c91fb04a387.dump` and rollback
  tag `classifarr:pre-memory-63419a08-0819-47d5-989e-5c91fb04a387`. Archive checksum
  and `pg_restore --list` passed; this is not a full restore rehearsal.
- Recreated only local Classifarr with `--no-build --wait`: healthy, using the
  exact candidate image and revision. Kept user 1000:1000, read-only root, existing
  mounts/capabilities and the 2 GiB memory limit. Unraid was not accessed.
- All 71 served JS/CSS assets and the HTML entry point matched packaged hashes,
  MIME types and successful HTTP responses (2,177,757 bytes).

- Five-minute observation: **19 healthy samples**, 23:05:42–23:10:38 UTC, zero
  cgroup limit failures, zero OOM kills and zero restarts. Whole-container raw
  memory ranged from 393.5 to 798.6 MiB; cgroup-recorded peak was 818.3 MiB under
  the unchanged 2 GiB cap. These readings include PostgreSQL, workers and caches;
  they are not a controlled performance comparison or sustained leak assessment.
  The post-startup read-only error-log query returned no records.
  Container ID: `65da4a1ca3148dc4c34379a3c5bb3f17b76616795ad2249513ea2c282813d388`.

Local image IDs and revision labels are not signed published-image evidence or
release approval. The later outcome-only commit does not change the built code.

## Random open PR

The current open set was #555 and #556; `Get-Random` selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest and
lockfile changes locally (Node declarations 26.6.4 and undici-types 8.9.0).
The runtime-baseline gate went from **8 passing** to **7 passing / 1 failing**:
Node 26 declarations violate the deployed Node 24 contract. Reversed only the
trial changes and confirmed **8 passing** and no retained client diff. No install
or PR merge. An incompatible PR is not retained merely to include a second change.

## Limits and next work

The predecessor implementation `d8ec4dc9cf8779a17547e68e1e235295d423a596` completed
[main CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37852609737)
successfully, including database and installation checks. Publication/release jobs
were skipped by policy; those results are a baseline, not evidence for this batch.

For implementation `f70b92717518b2a3adb9ac41164dd3ca6f3f8d54`,
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/37856103172),
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/37856102363),
[Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/37856102427),
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37856102365),
copyright and resource-capacity checks passed. Its
[main CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37856102748)
passed database integration and fresh-install/published-upgrade jobs; the main
build/test job remained in progress at this handoff, with no failed steps observed.
Do not freeze a release candidate until the full exact-commit pipeline completes.

Next: separately review immutable pins for
[setup-node 7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0),
[upload-artifact 7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2)
and [download-artifact 8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2),
reconfirmed through GitHub MCP on 2026-10-08. Review version-file validation,
manifest retries and artifact 429/Retry-After handling, including evidence-transfer
consumers. Keep Node 26 declarations,
client TypeScript 7 and unrelated major updates held. No release, tag, version bump,
new branch, Unraid deployment or comparison-memory improvement is claimed here.
