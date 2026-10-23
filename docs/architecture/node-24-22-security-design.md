# Node 24.22 Security Runtime Design

Reviewed: October 22, 2026. Approved scope: Node 24.22.1, Alpine 3.24.3,
aligned development/image pins and the pure guest-readiness version guard.
Work on main; no release, live replacement, provider call or VM operation.

## Decision and evidence

Adopt the October 21 Node 24 LTS security release rather than change runtime
major. The [Node advisory](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
identifies affected Node 24 TLS, DNS, Brotli and HTTP behavior. This establishes
a reason to update, not application exploitability or remediation of every npm
advisory. The [release notes](https://nodejs.org/en/blog/release/v24.22.1)
also document certificate, OpenSSL and bundled HTTP-client changes.

Use the official multi-platform index, inspected from the registry rather than
inferred from its tag:

```text
node:24.22.1-alpine3.24
sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53
amd64: sha256:1200d815de24f8dcca745fbf7651d166034a35adbcad8860a8538ffff44f1420
arm64: sha256:398bcf38afb035ae76feb9ad3c7493a93feff4751351c65310811761e37bbfc7
```

The bounded, unprivileged, read-only amd64 base probe reports Node 24.22.1,
Alpine 3.24.3, OpenSSL 3.5.9 and bundled Undici 7.30.1. The initially assumed
Alpine 3.24.2 was incorrect; the user separately approved 3.24.3 after that
observation. Keep the same Alpine 3.24 family. Its
[patch announcement](https://alpinelinux.org/posts/Alpine-3.21.9-3.22.7-3.23.7-3.24.3-released.html)
documents security fixes in core components. Do not downgrade packages or
remove the build-time actual-version assertions to accommodate the new image.

The [exact upstream Dockerfile](https://github.com/nodejs/docker-node/blob/80f02a542da739e6a662451d1db66456a0dea253/24/alpine3.24/Dockerfile)
is linked by the image's source annotation. An index or source annotation is not
native-platform acceptance. The [official image guidance](https://github.com/nodejs/docker-node)
describes musl compatibility limitations; test real native bindings.

## Options and safeguards

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Node 24.22.1 / Alpine 3.24.3, reviewed digest | Supported-line security fixes; bounded platform change | Native bindings, TLS and startup need fresh tests | Adopt |
| Retain 24.21.0 | No immediate runtime change | Misses the October security fixes | Reject |
| Moving tags or blanket package upgrades | Less manual maintenance | Unreviewed inputs and poor failure attribution | Reject |
| Node 26 or different libc/distribution | Separate platform options | Major migration unrelated to this patch | Defer |

Initially retain npm/npx 12.2.0, locked packages/integrities, declarations on Node
major 24, PostgreSQL majors, pgvector 0.8.7, schema and Compose settings. The
user requested a fresh review of other updates, including npm; findings and any
separately agreed toolchain batch must be recorded explicitly, not silently
folded into the runtime change. Preserve strict installer decisions and security
overrides. A digest does not freeze subsequent APK repository contents.

The subsequently approved npm 12.2.1 and server parser 10.7.4 batches have their
own [dependency design](dependency-readiness-2026-10-design.md) and
[outcome](dependency-readiness-2026-10-outcome.md); they do not widen this runtime
change into a blanket dependency or major-version migration.

Update all three manifest/lock root engines, `.nvmrc`, the shared Docker base and
the provider fault-fixture base together. Update the pure guest guard to reject
24.22.0 and earlier; synthetic checks must also reject prereleases/other majors
and accept later stable Node 24 versions. No VM commands are authorized by this
guard change. Frozen private recovery scripts, receipts, consumed authority,
permissions, networking and on-demand power policy remain untouched.

## Verification

Use a private portable Node executable, not a global installation. Verify the
signed checksum document against the official Node release keyring and compare
the exact executable hash before running it. Follow the project's
[binary verification guidance](https://github.com/nodejs/node#verifying-binaries);
keep downloaded tools under ignored `.tmp/`.

Generate lock metadata with scripts disabled, review package graph equality,
then perform strict locked installs, dependency trees and development-inclusive
audits. Run existing toolchain/installer tests through the pinned npm CLI, pure
guest fixtures, runtime/TLS/cancellation tests, lint/type/dependency checks and
the real frontend suite/build. Do not report the coverage ratchet unless both
coverage reports are current.

Run heavy Docker work serially: the prior runtime outcome records shared-host
storage-pressure observations. CPU/RAM limits do not establish I/O isolation.
Commit clean implementation source before the existing no-cache frozen Compose
rehearsal. Reuse one immutable candidate for its synthetic soak and saved
standard/unraid/custom installation/upgrade profiles; verify exact-owned cleanup.
Never mount live appdata or replace the running application. Record any ARM64
emulation separately from missing native release evidence.

## Recommendation stack

1. Complete this bounded security runtime qualification and document actual results.
2. Review current npm and direct dependency updates as separate attributable batches.
3. Prepare the release next: agree its version and verify exact-source CI,
   published-image/native architecture and release gates before publication.
4. Resume representative-refresh and retained-fixture troubleshooting afterward.

Keep design separate from the observed outcome. No version bump, tag, PR merge,
release or deployment is part of this commit.
