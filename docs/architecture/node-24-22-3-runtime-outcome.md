# Node.js 24.22.3 qualification outcome

November 21, 2026 Eastern. Qualification of the
[approved runtime update](node-24-22-3-runtime-design.md) began at checkout
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

Implementation revision `8cb567c12a9797ff591f68ad8792a81c387b4e70`
aligns the container, fixture and workspace Node pins
with the verified index. The three regenerated lockfiles change only the
root Node engine declarations. The synthetic gateway test found that the
guest guard still admitted 24.22.2. The guard now requires 24.22.3, and the
test takes its current guest version from `.nvmrc` and tests malformed
versions at that floor. The OSV exception draft is outside the runtime batch.

## Local application checks

- Strict `npm ci`, complete dependency tree checks and development-inclusive
  npm audits passed in all three workspaces. Each npm audit found zero
  issues in its project dependency tree. OSV scanned 1,139 lockfile entries
  and found zero issues. It still reports the existing expired exception.
- The corrected runtime and gateway contracts passed all 23 tests. The
  dependency tooling run passed 125 tests with one Linux-only WASI case
  skipped on Windows. CI preflight, ownership, both Knip modes, types, lint,
  policy, ESM and Markdown checks passed.
- Fresh client coverage passed 7,592 tests in 489 files. The production
  build and all eight production Chromium checks passed. All 19 shared-form
  and pgvector Chromium checks passed on a fresh Vite server after coverage.
- Fresh server coverage passed 64,108 tests across 1,955 suites with one
  existing Windows skip. The two-report coverage ratchet passed.
- The first concurrent browser run passed 17 of those 19 checks. Retained
  traces show repeated Vite connections and page state resets. Astra found
  that the Vue compiler tests write temporary `tsconfig.json` files under
  `client/.tmp`, which can trigger Vite's full reload. The trace does not
  identify which file triggered it. The serial check used the same
  assertions, deadlines and zero retries. [Vite watcher configuration](https://vite.dev/config/server-options#server-watch)
- A separate loopback Chromium control created one synthetic compiler
  `tsconfig.json` in `client/.tmp` after entering a draft. Vite logged the
  exact path, reloaded the fixture and cleared the draft on both Node
  24.22.1 and 24.22.3. This confirms the reload mechanism on both versions.
  Isolate the compiler fixture root from Vite watching in a follow-up and
  verify that authored configuration changes still reload normally.

## Disposable production images

Both images were built from the clean implementation revision. These are
local image IDs.

| Platform | Image ID |
| --- | --- |
| linux/amd64 | `sha256:c8aed197a1f1ff96628391a9b85cb8c3753c25d7fa4d260e92efe8a635a80e3e` |
| linux/arm64, emulated | `sha256:cdd1a63a3163838703a04b3e96b1dcf20977674be47a0fbd5a7f3ab73bfed7f6` |

Both images passed real bcrypt correct- and wrong-password checks, native
zlib and curl compression controls, and PostgreSQL gzip archive round
trips with 32 synthetic rows per major. Both loaded pgvector 0.8.7 in
PostgreSQL 17 and 18 and returned the expected vector distance. Both
installed `postgresql17-17.12-r0`, `postgresql18-18.7-r0`, and
`zlib-1.4-r0`. Runtime probes confirmed Node 24.22.3 and Undici 7.30.2.

Trivy 0.76.2 with a freshly downloaded database found zero Alpine
package findings on either image. Both report the same two medium
findings from global npm's bundled Glob 13.0.6 and Minimatch 10.2.5.
The scans used the exact local image IDs and included every severity.

The amd64 image passed all 12 fresh-install and upgrade checks with the
isolated Unraid profile, including attested published-baseline startup,
persisted-volume migrations, interrupted restore, explicit recovery,
and scheduler progress. The rehearsal verified cleanup. Arm64 results
cover the emulated local build and native-library controls. A native
arm64 release rehearsal remains a separate publishing requirement.

The isolated provider fault behavior and its source-bound receipt passed
in the qualification checkout after a strict server install. The initial
isolated attempt lacked Jest. A run from the installed main checkout
passed behavior but encountered the receipt writer's existing-file
protection. The final run used a fresh receipt path in the qualification
checkout and preserved both earlier records. The previously running
local containers retained their image IDs, start times and health.

## Follow-up

Keep the verified Node and Alpine pins and retain npm/npx 12.2.2.
Start with the reproduced Vite watcher interference so parallel compiler
and browser validation can keep their normal isolation. Qualify a later
npm release when its published archive contains fixed Glob and Minimatch.
