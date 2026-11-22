# November Node.js 24 LTS security update

November 21, 2026 Eastern. The candidate is Node.js 24.22.3 and Alpine
3.24.4 on the existing Node 24 and Alpine 3.24 release lines.

## Publisher evidence

Node.js 24.22.3 includes November's HTTP/2, TLS and zlib fixes and advances
the bundled Undici client from 7.30.1 to 7.30.2. The installed npm/npx
package and the server's standalone Undici have independent version
boundaries. [Node security release](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)
· [24.22.3 release notes](https://nodejs.org/en/blog/release/v24.22.3)

The Docker Official Image index identifies the following platform children.
Live read-only probes for both returned Node 24.22.3, Alpine 3.24.4,
Undici 7.30.2 and upstream npm 11.19.1. The arm64 probe ran under emulation.
The Classifarr image continues to install its own exact npm/npx version.
[Official image](https://hub.docker.com/_/node)
· [Pinned source Dockerfile](https://github.com/nodejs/docker-node/blob/1274f3ee37d4d0e59d308ea25b83d9e21e4db862/24/alpine3.24/Dockerfile)
· [Alpine 3.24.4 release](https://www.alpinelinux.org/posts/alpine-3.21.10-3.22.8-3.23.8-3.24.4-released/)

```text
node:24.22.3-alpine3.24
index  sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5
amd64  sha256:d8d97e479cdc64f052f81f129362168717c59783ade8dcc1abd22e1cca8dbd7c
arm64  sha256:f44b069ce4b5d00cb4f7dff81821a4a6953e3790420040abf300139b1d317c6c
```

The Windows test runner uses a private executable verified against a signed
checksum and an official release-key fingerprint. The workstation-wide
toolchain stays outside this batch. [Node.js release keys](https://github.com/nodejs/release-keys)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep 24.22.1 | Retains current qualification | Defers November security fixes |
| Adopt the reviewed official index | Gets the security update on the existing LTS and musl lines | Requires fresh application, native and platform checks |
| Use a floating image tag | Receives later patches automatically | Weakens reproducibility and makes failures harder to attribute |
| Change Node major, distro or npm in this batch | Could advance more of the stack | Mixes unrelated changes in the same test results |

## Recommendation and acceptance

1. Align `.nvmrc`, three workspace engine floors and their lockfile
   metadata with the production Dockerfile and both test fixtures. Use
   the reviewed index digest and retain the image's actual Node and
   Alpine version checks. Keep historical fixtures with their original
   versions when they test previous evidence. Update the synthetic
   gateway guest fixture and its rejection controls. CI already uses
   the version file. [Docker digest guidance](https://docs.docker.com/build/building/best-practices/#pin-base-image-versions)
2. Keep npm/npx 12.2.2, strict installer settings, the existing dependency
   graph, signed Alpine zlib 1.4-r0, PostgreSQL 17/18 and pgvector 0.8.7.
   Record the resolved APK revisions because the base image digest does
   not pin packages downloaded in later build stages.
3. Qualify strict installs, dependency trees, full audits, fresh coverage,
   the existing browser suite and ordinary loopback HTTP/stream/cancellation
   behavior. Reuse the production image and provider checks for bcrypt,
   native compression, PostgreSQL archive round trips and local recovery.
   Record the application image and platform used for each check.
4. Inspect the exact push's CI. Ordinary amd64 CI and emulated arm64
   checks have different evidence than a native arm64 release rehearsal.
   Keep approval for publication and deployment separate. Preserve
   scanner severities and document any findings with their actual scope.

Astra confirmed the coupled pin boundary and the two-platform qualification
need. This batch uses the existing browser suite for web regression evidence
without changing the product's accessibility requirements.
[W3C accessibility evaluation guidance](https://www.w3.org/WAI/test-evaluate/)
