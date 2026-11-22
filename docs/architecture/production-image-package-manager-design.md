# Keep package managers in the Classifarr build stages

November 22, 2026 Eastern. The objective is to omit the global package-manager
files from the production image while retaining the current application,
builder and recovery contracts.

## Consumer and source evidence

The Classifarr shell entrypoint invokes Node directly for identity, database
startup and upgrades, and the embedded supervisor. Recovery child processes
use `/usr/local/bin/node`. Astra traced npm and npx usage to the builders,
developer tooling, CI runners, and policy evidence collection in a source
checkout. No supported production operation in that trace invokes either
package manager in a running container.

The existing image inherits the global npm files. Its last image scan
found two medium findings in that copy of npm's Glob and Minimatch.
The current registry release, npm 12.2.3, ships the same affected versions.
[Runtime qualification](node-24-22-3-runtime-outcome.md)
· [npm publisher metadata](https://registry.npmjs.org/npm/12.2.3)

The Alpine 3.24.4 index
`sha256:f59abe656b692d901e184be3445e084786602108599d2a51d229c0f5a48c71bf`
has amd64 and arm64 children that match the actual Alpine parent annotations
of the pinned Node 24.22.3 image. The Node binary's observed dependencies
are musl, libstdc++ and libgcc on both architectures. Preserve libatomic
and the Alpine certificate bundle available in the current image.
[Alpine official image](https://hub.docker.com/_/alpine)
· [Node official image source](https://github.com/nodejs/docker-node/blob/1274f3ee37d4d0e59d308ea25b83d9e21e4db862/24/alpine3.24/Dockerfile)

The official amd64 child contains `/usr/local/LICENSE`. The arm64 child
does not have the same file at that path. Use the exact release commit's
notice on both platforms, with SHA-256
`5888dbb9a1d2b18f2c3e6c5f6af1b39de658372b402a0577b002777f14c62ace`.
[Node release notice](https://github.com/nodejs/node/blob/e63cab040c09d43ceef8cb35508c40044614e906/LICENSE)
· [Docker checksum support](https://docs.docker.com/reference/dockerfile/#add---checksum)

## Options

| Option | Benefit | Cost |
| --- | --- | --- |
| Keep the existing base | Preserves the already qualified image layout | Continues shipping npm and its bundled findings |
| Delete the global tools in the final stage | Clears the final filesystem with a small diff | Earlier image layers still contain the files |
| Assemble the runtime from the matching Alpine base | Excludes package-manager layers while keeping the pinned Node binary | Requires a second base pin and fresh native and recovery checks |

Recommend assembling the runtime from the matching Alpine base. OCI
whiteouts hide a file from lower layers during filesystem assembly. A
dedicated stage can instead leave unused build inputs out of production.
[OCI image layers](https://specs.opencontainers.org/image-spec/layer/)
· [Docker multi-stage guidance](https://docs.docker.com/build/building/multi-stage/)
· [Node image best practices](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md#smaller-images-without-npmyarn)

## Acceptance

1. Keep the pinned Node image and npm/npx 12.2.2 in the builders.
   Preserve strict installs, dependency locks, native build steps and
   existing CI installer policy.
2. Start production from the matching digest-pinned Alpine base.
   Copy the exact `/usr/local/bin/node` binary and include its checked
   release notice. Retain the Node and Alpine assertions and signed
   Alpine libraries, including zlib 1.4-r0. Preserve PostgreSQL 17/18,
   pgvector, Classifarr identity, signals and recovery behavior.
3. Require npm/npx and the associated upstream package-manager files
   to be absent from the resulting image. Inspect both the mounted
   filesystem and the exported layers. Scan exact local image IDs across
   all severities and distinguish npm's bundle from application packages.
4. Exercise both shipped image architectures locally with recorded
   platform evidence. Use the existing native compression, PostgreSQL,
   health and recovery checks. Record arm64 emulation separately from
   native release evidence. Require the existing contract checks and
   verify the pushed source in CI.

No product interface is involved. The existing browser checks provide web
regression coverage where applicable. [W3C accessibility evaluation guidance](https://www.w3.org/WAI/test-evaluate/)
