# Production image package-manager outcome

November 22, 2026 Eastern. The
[approved design](production-image-package-manager-design.md) separates
the builder toolchain from the production image.

The two builders still inherit the pinned Node image and install npm/npx
12.2.2. Production starts from the matching Alpine base and copies the
exact Node binary. A checksum-pinned download supplies its release
notice for both architectures. The production image checks Node,
Alpine, the certificate bundle and zlib, and checks that the global
Node modules directory and npm/npx commands are absent.

GitHub listed zero open pull requests at intake and during qualification.

## Verification

Qualification used the clean implementation revision
`ce0348a133580e4b544338a4bbc3e7ac3ab2da90` and immutable local image IDs.
The builders retained the existing lockfiles and install policy. All
three development-inclusive workspace audits reported zero findings.
The dependency tooling suite passed 126 tests with its existing
Windows WASI skip. The 136 focused runtime and workflow tests, Docker
build checks, CI preflight, Markdown and ESM checks passed. The
coverage ratchet reused verified reports for the unchanged application
inputs.

The previous qualified amd64 image was the detection control. Trivy
reported the two known findings in its global npm bundle. A per-layer
walk found 2,615 distinct global tool paths, including npm, npx and
the relevant bundled package manifests. The archive configuration's
layer list was matched to Docker's image inspection. This verifies
layer content as well as the merged filesystem.
[Docker image export](https://docs.docker.com/reference/cli/docker/image/save/)

| Platform | Local image ID | Exported layers | Global tool paths | Trivy findings |
| --- | --- | ---: | ---: | ---: |
| amd64 | `sha256:09c2490c1ac387870292c8ad916ad6c3ef23353d6012d125f3d9fca3dea7e19b` | 18 | 0 | 0 |
| arm64, emulated | `sha256:d10ebfb3064b6f1b1b82be6b1509c140135598ca4174bd543aea6e72134808fc` | 18 | 0 | 0 |

Both scans used the same Trivy database as the control and included all
severities. Docker's reported amd64 image size dropped from 584,417,703
to 471,443,368 bytes in this comparison.

The production checks matched each copied Node binary to its source
image and verified the release notice hash on both platforms. They
confirmed the expected Classifarr identity, system certificate bundle,
Node 24.22.3 and Undici 7.30.2. Both images passed real bcrypt, zlib and
curl checks, loaded pgvector 0.8.7, and reproduced the synthetic
PostgreSQL 17 and 18 gzip archives. Separate builder image checks
reported npm and npx 12.2.2 on both platforms.

The amd64 New Install and Published Upgrade rehearsal passed all 12
checks with the disposable Unraid profile. The runner verified
the published comparison image's attestation, fresh startup,
scheduled crash recovery, preserved migrations, interrupted restore,
explicit recovery, normal restart and cleanup. This qualifies a local
profile rehearsal.

The first emulated arm64 candidate completed fresh startup and reached
the verified scheduled-crash checkpoint. PostgreSQL refused startup
after container recreation because `postmaster.pid` already existed.
The previous arm64 image reproduced the same refusal with a new
disposable volume and the same runner. A second candidate run on a fresh
volume reproduced it again. All disposable resources from these runs
were removed. The compared images have
identical installed Alpine package inventories and identical hashes
for Node, PostgreSQL, Tini, `su-exec` and the entrypoint. The diagnostics
establish the behavior on this host. The origin of the PID conflict
remains unresolved. The lock and recovery safeguards stayed in force.
[PostgreSQL 18 startup guidance](https://www.postgresql.org/docs/18/server-start.html)

## Next recommended item

Qualify scheduled crash recovery on native arm64 before release. If the
refusal recurs, capture the owned fixture's stored PID and the matching
process identity before teardown. Preserve PostgreSQL's ownership
checks throughout the diagnosis.

Qualify a published npm update for the builders and CI when it contains
corrected Glob and Minimatch bundles. Verify the published artifact
contents and strict installs before changing the pins.
