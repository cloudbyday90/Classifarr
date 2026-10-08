# Rate-limit debug allocation outcome

Date: 2026-10-08. See the separate
[design, sources and tradeoffs](rate-limit-debug-allocation-design.md).

## Implemented and reproduced

Updated express-rate-limit 8.7.0 → 8.7.1. Only that package changed in the server
lockfile: no added, removed or updated transitive packages. Production rate-limit
configuration, proxy trust, authentication, database schema, memory safeguards
and install-script policy are unchanged. New code is ESM; no fork, replacement
middleware or singleton was added.

Seven new installed-package tests cover login, token-refresh and password-change
quotas, rejection bodies and retry headers, untrusted forwarded-IP claims,
fail-closed store errors, and debug-off/debug-on behavior. Existing real-HTTP
IPv4, mapped-IPv4 and IPv6 subnet regressions remain active.

On 8.7.0, six checks passed and the disabled-debug regression failed: request
metadata was enumerated for both synthetic requests despite logging being off.
On 8.7.1, that count is zero with debug off and two with debug on. Enabled debug
output remains available, and both modes preserve 200/429 and retry behavior.
This confirms the upstream avoided work, not a retained-memory reduction or a
fix for the comparison-worker memory incident.

## Source checks

| Check | Result |
| --- | --- |
| Toolchain | Node 24.21.0 / npm 12.2.0; global toolchain unchanged |
| Installation | Scripts-disabled lock review, then normal `npm --prefix server ci` passed |
| Dependency tree | `npm --prefix server ls --all --json` passed without dependency problems |
| npm audit | Zero reported vulnerabilities before and after, including development dependencies |
| Focused tests | 3 suites / 46 tests passed |
| Full backend unit tests | 1,748 suites / 54,296 passed / one Linux-only Windows skip; 308.898 seconds |
| Quality | Backend lint, typecheck, Knip and production Knip passed |
| Tooling | All 40 dependency/install-policy tests passed |
| Documentation / modules | Documentation lint, static-import check and whitespace check passed |
| Preflight | Copyright and inventory ownership drift checks passed without baseline changes |

The initial test draft omitted the ESM Jest import; corrected it before the
before/after reproduction. Lint also caught an implicit promise-executor return
in fixture cleanup; fixed it before the full suite. These were test-authoring
errors, not dependency regressions.

The unchanged ownership gate still reports 501 reviewed unresolved paths and
`productionCompatible: false`. Passing its drift check is not completion of the
separate privilege-isolation work. No safeguard or scanner was disabled.

Full frontend coverage and database integration were not rerun locally for this
HTTP-middleware-only patch. The production frontend build passed in Docker.
Hosted checks are tracked separately; a clean audit is not a guarantee of safety.

## Random open PR trial

Fresh enumeration returned #555 and #556. One random draw selected
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`9d74537d7917c248d15926f37b2e40ceba7559a4`. Applied its exact server manifest and
lockfile patch locally. The runtime-major gate passed 8/8 before, failed 1/8 with
Node 26 declarations, then passed 8/8 after explicitly reversing the trial.

The trial stopped at this gate, before installing an incompatible dependency tree.
It was not adopted. Node declarations remain 24.19.1, matching the deployed Node
24 major. Neither PR was merged, closed or changed remotely.

## Exact image checks

Implementation commit: `ff70ed46170a0522a1dfc33b0e4e3d814da606a1` on `main`.
Built from a clean checkout with the existing Compose files using
`build --no-cache --require-provenance` and `PGVECTOR_BUILD=multi`.

- Local Docker image/index ID:
  `sha256:a66294f52be2dbb74b2f0408d6f9395679242197618162c627573fc9c0b402af`.
- Native manifest:
  `sha256:509649d344250ef56d10a54f8747de9867c9974261f68037c81c400bdf6af439`.
- Config digest:
  `sha256:f2c00edb3c88e6ee48f8ae69c9c589d2d804feff44251611be7c5782fd1111a8`.
- OCI revision matches the implementation commit. This is local build evidence,
  not verified signed registry provenance or a multi-platform release rehearsal.

The committed synthetic fixture ran against the installed Linux package in both
debug modes and preserved rejection/retry behavior. The image contains Node
24.21.0, Express 5.2.1 and express-rate-limit 8.7.1. Its 58 APK package versions
match the prior local image exactly. Actual-image Linux directory fsync,
exclusive copying and source preservation also passed, covering the Windows skip.

Probe containers used no external network or appdata, read-only roots, UID/GID
1000, no capabilities, no-new-privileges, 256 MiB memory, 64 PIDs and 32 MiB tmpfs.
Fixtures were mounted separately, never over application source or dependencies.
Confirmed probe-container cleanup.

After rebuilding, ran `check-schema-snapshot-container.mjs --dump` and then the
independent check against this exact image, each with a fresh disposable database.
Both passed. `database/schema/current.sql` is unchanged through
`20261005_180000_ingestion_compatibility_fence.sql`, including 22 data-only seeds.
Verified both generated containers and host data directories were removed.

## Local replacement and observation

Preserved the prior image
`sha256:a061862c9d823b5f65551bc6552f52f53e8a5700b3301c28d40d8465ad9b234e`
as `classifarr:pre-memory-4da827d9-7b2c-4f27-8e00-4294be2d9a3c`.
Created the private, ignored 75,880,525-byte archive
`.tmp/pre-memory-fingerprint-4da827d9-7b2c-4f27-8e00-4294be2d9a3c.dump`.
Checksum and archive-index verification passed; no full restore or full appdata
backup was performed. Do not commit or share the archive.

Recreated only local Compose with `up -d --no-build --force-recreate --wait`.
It started at `2026-10-08T09:45:12.18394305Z` and runs the exact candidate image.
Health returned HTTP 200; the unauthenticated libraries API returned HTTP 401.
User 1000:1000, mounts, read-only root, security options, 2 GiB container limit
and `--max-old-space-size=1536` are unchanged. Unraid was not accessed.

The five-minute sampler recorded 19 healthy readings from
`2026-10-08T09:46:56.862Z` through `2026-10-08T09:51:53.253Z`. Raw cgroup usage
ranged from 516.53 to 619.30 MiB, with a kernel high-water mark of 898.04 MiB.
Memory-limit failures stayed at zero; no OOM kill or container restart occurred.
Timezone-correct read-only checks found no error-log entries since this startup.
These are container-wide startup observations, not JavaScript retained-heap
measurements, a long-term soak or evidence that this patch fixed memory pressure.

## Hosted checks

For implementation commit `ff70ed46170a0522a1dfc33b0e4e3d814da606a1`, these checks
completed successfully:
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/37758241115),
[Gitleaks](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240252),
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240264),
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240227),
[copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240232)
and [resource regression](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240430).
The [main CI pipeline](https://github.com/cloudbyday90/Classifarr/actions/runs/37758240764)
is still running at the latest check; no pass is claimed for pending backend
coverage, database integration or installation-acceptance jobs. The later
documentation-only commit does not change the tested image contents.

## Pre-existing observations and follow-up

Before candidate replacement, the old local image logged one scheduler error,
`inventory_description_refresh_unavailable`, paired with a description-recovery
warning code `transport` at 09:34:04 UTC. The earlier comparison warning at
09:15:46 UTC has a recovery event at 09:18:44 UTC. Those events predate this
update's deployment and are not evidence of a rate-limit regression.

Corrected the ignored local diagnostic helper to compare the timezone-less
`error_log.created_at` with startup converted to the database session timezone,
and report counts by level. Its previous untyped UTC-string comparison could
undercount recent entries. This only improves the local observation; it is not
an application schema or timestamp change. Do not infer a clean baseline from
the old helper's zero count.

Recommend retaining this narrowly scoped upstream patch and its regression tests:
less request-path allocation without new middleware policy, at the cost of a small
fixture to maintain. Replacement middleware offers no justified benefit here.

Next dependency item: js-yaml 5.4.2 → 5.4.3. The
[official changelog](https://github.com/nodeca/js-yaml/blob/master/CHANGELOG.md),
discovered through GitHub and retrieved through MCP on October 8, describes a
whitespace-only block-scalar parsing fix released October 6. Review the YAML
import/export boundary and preserve parser resource/security limits. Then review
Knip 6.39.0 → 6.40.0 separately. If the description-provider transport failure
persists, investigate its provider/network cause separately; do not loosen retry,
quota or memory protections. No release, tag or application version bump.
