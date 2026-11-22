# Node.js 24.22.3 qualification outcome

November 21, 2026 Eastern. Preliminary qualification of the
[proposed runtime update](node-24-22-3-runtime-design.md) against checkout
`e53947904f31f0dfb61e3190713642e6cb16ca2b`.

## Verified inputs

- Verified the Windows x64 binary against Node's signed checksum. The
  SHA-256 was
  `86fc4785327db5f5c7558dc6156c543b433c313e813a222e088086222ab4afa6`.
  GPG verified release-key fingerprint
  `5BE8A3F6C8A5C01D106C0AD820B1A390B168D356` in the reviewed
  keyring. The GPG home and executable were private to the ignored test
  directory. The verification used the publisher's listed key and did
  not assign it local owner trust. [Node release keys](https://github.com/nodejs/release-keys)
- Both official base-image children reported Node 24.22.3, Alpine 3.24.4,
  and bundled Undici 7.30.2. The application Dockerfile's
  `node-runtime-base` target, built with candidate argument overrides,
  passed its exact Node, Alpine, npm and npx version checks. Both target
  images installed the signed Alpine zlib 1.4-r0 package. The Windows Docker
  host ran the arm64 variant with emulation.
- Under the verified Windows binary, six transport suites passed 103
  tests, and the runtime pin and gateway guest contracts passed 23 tests.
  These tests used the existing application source and installed packages.

The published npm 12.2.3 archive matched its registry integrity. It still
bundles Glob 13.0.6 and Minimatch 10.2.5, along with ip-address 10.7.5
and Undici 6.29.1. The new npm version therefore leaves the two previously
recorded Glob and Minimatch findings unresolved. Keep npm 12.2.2 in this
batch. [npm registry metadata](https://registry.npmjs.org/npm/12.2.3)

GitHub returned zero open pull requests at intake and recheck, so there
was no applicable PR to qualify locally or stale Dependabot branch to
rebase.

## Implementation

The approved change aligns the container, fixture and workspace Node pins
with the verified index. The three regenerated lockfiles change only the
root Node engine declarations. The synthetic gateway test found that the
guest guard still admitted 24.22.2. The guard now requires 24.22.3, and the
test takes its current guest version from `.nvmrc` and tests malformed
versions at that floor. The OSV exception draft is outside the runtime batch.
