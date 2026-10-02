# Node 24.21 Runtime Update Design

Reviewed: 2026-10-02. Scope: the existing Node 24 LTS / Alpine 3.24 image,
development baseline and isolated provider fixture. No release or live rollout.

## Decision

Use Node 24.21.0 on Alpine 3.24.2. Keep npm/npx 12.2.0, the locked application
dependencies, PostgreSQL majors and pgvector 0.8.7 unchanged. Retain existing
Compose/Unraid/Synology settings and persistent-data paths.

Pin the official Node multi-platform image index, not a single architecture:

```text
node:24.21.0-alpine3.24
sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1
```

The registry index contains Linux amd64 and arm64/v8 manifests. A local base
probe reports Node 24.21.0 and Alpine 3.24.2. The shared build stage must fail
if its actual Node, Alpine, npm or npx version disagrees with the declared
baseline. Changing a version build argument alone must not silently keep an
old digest. The provider fault fixture uses the same reviewed base.

## Evidence And Tradeoffs

| Choice | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Update within Node 24 LTS and Alpine 3.24 | New runtime fixes without a major platform migration | Native dependencies and startup still require testing | Adopt |
| Pin the multi-platform base digest | Reviewed base cannot silently move; preserves architecture selection | Maintainers must review new digests to receive base fixes | Adopt |
| Keep a moving base tag | Automatic base refreshes | Rebuilds can change without a reviewed source change | Reject for this baseline |
| Switch to Debian or Node 26 now | Different libc support profile or newer features | Larger runtime/package/upgrade change than this maintenance step | Defer to separate evaluation |

Node's release notes include OpenSSL, HTTP client and certificate updates.
These justify testing TLS/HTTP behavior, not claiming that every dependency
vulnerability is resolved. Alpine's patch announcement covers security fixes
and bug fixes. Node's Docker documentation notes that musl builds have a
different support status from glibc; an official image does not erase that
limitation. Test the shipped architectures rather than assume parity.

A base digest does **not** freeze later APK repository contents or npm registry
availability. Keep locked npm installs, the existing pgvector source checksum,
and record observed PostgreSQL/package versions in validation. Do not introduce
blanket APK upgrades, install-script bypasses or a new database migration.

## Validation Plan

1. Check all workspace engines and lockfile roots against `.nvmrc`; check the
   Docker and provider fixture pins and build-time version assertions.
2. Build independent amd64 and arm64 candidate images, serially on shared hosts.
   Prefer a dedicated validation host. Test real bcrypt bindings,
   Node/npm/npx/Alpine versions and installed PostgreSQL/pgvector artifacts.
3. Run the existing Linux migration-copy and runtime dependency tests under the
   new runtime, plus installer-policy tests and client build/tests where feasible.
4. Run the existing disposable startup/PG17-to-PG18 upgrade smoke suite. Never
   mount the user's persistent database into a validation container.
5. Report failures, platform limitations and skipped checks explicitly. Updating
   `.nvmrc` does not update the host installation or the running application.

Use concise headings and descriptive links following W3C writing guidance.
This is an infrastructure change; it makes no new UI or WCAG conformance claim.

## Recommendation Stack

1. Validate this bounded runtime update and keep release/deployment separate.
2. Resolve the newly reported `braces` development-tooling advisory without
   suppressing the security gate; review exposure and upstream fixes separately.
3. Investigate database startup/recovery under host storage pressure. A timeout
   is not proof that PostgreSQL stopped; preserve single-writer and durability
   guarantees. See the [observed incident](node-24-21-runtime-outcome.md#shared-host-observation).
4. Review application dependency updates in small runtime/tooling groups next.
5. Before release, run the frozen same-image installation/upgrade/resource
   acceptance workflow, including native ARM64 evidence rather than only emulation.

## Official Sources

- [Node 24.21.0 release notes](https://nodejs.org/en/blog/release/v24.21.0)
- [Alpine 3.24.2 patch announcement](https://alpinelinux.org/posts/Alpine-3.21.8-3.22.6-3.23.6-3.24.2-released.html)
- [Official Node Docker image and musl notes](https://github.com/nodejs/docker-node)
- [Docker build and digest-pinning guidance](https://docs.docker.com/build/building/best-practices/)
- [W3C accessible writing guidance](https://www.w3.org/WAI/tips/writing/)

URLs were verified through web/MCP research; image identities were read from
`docker buildx imagetools inspect`, not inferred from a release number.
