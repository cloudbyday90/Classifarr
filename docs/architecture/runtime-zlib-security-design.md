# System zlib security assessment design

Research: November 9, 2026 Eastern. Baseline main
8879fcf7c55dc94fe6ff57ecc9603b80c51b290a, clean at intake.
Status: agreed and implemented November 9. See the separate
[qualification outcome](runtime-zlib-security-outcome.md). No release/deployment.

## What the Node follow-up established

The [published Node 24.22.2 release](https://nodejs.org/en/blog/release/v24.22.2)
contains five V8 backports and a TransformStream async-context fix. It retains
exactly the same Undici 7.30.1 source and generated bundle as current 24.22.1.
The six newer Undici advisories require 7.30.2/8.12.4. Updating that Node patch
therefore cannot be described as remediation of the identified transport issue.

The [official security announcement](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases)
schedules releases on or after November 11, without an exact version or guaranteed
fix list. No currently published Node 24 artifact contains the needed correction.
Retain that gap; verify actual future contents rather than assume a release date
or version proves remediation. The existing standalone server Undici 8.12.4 and
npm's 6.29.1 copy cannot replace Node's separate built-in fetch.

The official Node 24.22.2/Alpine 3.24.4 image is available, index
sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8,
with AMD64/ARM64 descriptors and the same Node ABI 137/N-API maximum 10. It was
built November 5, before Alpine's November 6 zlib package. A base-tag refresh alone
does not prove the package or Node transport findings are fixed.

## Recommended first implementation boundary

Conditionally install exact Alpine **zlib 1.4-r0** from the existing signed v3.24
repositories in the shared application base stage and provider-fault fixture.
Use the same concrete package pin in both, guarded by existing container-policy
checks and an actual installed-package assertion. Keep Node 24.22.1, npm/npx
12.2.2, Alpine release marker 3.24.3, base index digest, PostgreSQL/pgvector,
application dependencies and all npm install/scanner policies unchanged.

Use normal APK signature/index verification; do not allow untrusted packages,
replace the library manually, add an alternate repository, or relax a scanner.
Review the actual APK transaction and reject unrelated upgrades/removals. A
missing pinned package is a failed qualification, not permission to float.

This addresses the independent OS-library assessment. Node's embedded compression
fork 1.3.2.1-motley-285e94b and built-in Undici remain separate, explicit residuals.
Do not add LD_PRELOAD, patch Node's vendor tree, replace global fetch, or alter
application transport/cancellation/retry authority.

## Evidence and compatibility limits

The [immutable Alpine recipe](https://github.com/alpinelinux/aports/blob/bdf501c870a92a05c097857401f69c48c4810384/main/zlib/APKBUILD)
and [v3.24 security data](https://secdb.alpinelinux.org/v3.24/main.json) identify
1.4-r0 as the package correction for CVE-2026-4738. Both actual shipped-architecture
APKs are published. Archive/ELF inspection finds only the library and metadata,
SONAME libz.so.1, 111 exports, and the existing architecture's musl dependency.
At research intake the downloaded archives had not independently passed signature
verification. Successful trusted APK installation remains an implementation gate;
the separate outcome records its result.

The reported CVE concerns contrib/infback9. Old/new default build object lists
compile core infback.o instead, and the inspected exports contain no infback9
entry points. This narrows what was demonstrated; it does not justify an exclusion
or establish complete non-reachability. Keep the finding until the actual image
and unchanged scanner prove the installed-package boundary.

The [upstream 1.4 release](https://github.com/madler/zlib/releases/tag/v1.4)
contains additional core fixes and observable API changes: reset clears custom
gzip headers, exact-boundary completion reports Z_STREAM_END, and gzip truncation/
error ordering changes. SONAME continuity is not behavioral acceptance. Linux
64-bit offset compatibility must be measured, not inferred from Windows changes.

## Verification and automation

Reuse existing execution/image/install helpers. Add only small native test and
orchestration leaves needed to exercise the actual dynamically loaded OS library;
do not introduce an application service or singleton for a build-time dependency.
Wire permanent image checks into the existing CI image-verification path. Add no
operator CLI requirement, page, endpoint, setting, scheduled job or schema.

1. Freeze old-library observations using bounded legitimate inputs. Verify the
   actual loaded library/version, z_off_t width and ordinary compression/gzip.
2. Verify custom gzip header/reset/reapply behavior, exact output-buffer completion,
   safe truncated streams and bounded seek/zero-fill controls. Execute no memory
   corruption or resource-exhaustion proof of concept. Do not require old incorrect
   behavior to remain in a permanent passing test.
3. Use actual PostgreSQL 17 and 18 gzip custom-format dump/restore on disposable
   databases with exact data checks, plus curl compressed-response and native
   bcrypt controls. Preserve real authentication/entrypoint behavior in the
   separate application installation rehearsal.
4. Check AMD64 and ARM64 package identity/linking and bounded execution where
   available. Label emulation accurately; do not claim native ARM64 certification.
   Keep compiler/header packages inside owned throwaway test tooling, outside the
   production candidate. Never mount fixtures over application source or libraries.
5. Qualify one source-bound candidate with the existing fresh/published-upgrade/
   routing runner and a fresh full image scan. Keep Node's unresolved components
   and npm's Glob/Minimatch entries visible. No new scanner acceptance is proposed.
6. Run relevant native/container-policy, lint/type/ownership/ESM/copyright/Markdown
   and normal dependency gates. Use fresh coverage for changed inputs; reuse
   reports only after source, installed trees, configuration and reports are
   verified unchanged. The independent client batch requires fresh client coverage.

The agent performs bounded artifact maintenance before heavy work and at delivery,
preserving current evidence, recovery assets, reference images, worktrees, global
tools, shared cache and other projects. Keep receipts private and allowlisted.
Update Unreleased and the separate outcome, then commit/push on main. No release,
deployment, live recovery or production cleanup is included.

## Options, pros and cons

| Option | Benefits | Costs/limits | Recommendation |
| --- | --- | --- | --- |
| Exact OS zlib 1.4-r0, current Node/base | Published narrow repair; package graph stays small | Native compression/backup behavior needs real proof; Node remains unresolved | First applicable batch |
| Node 24.22.2/Alpine 3.24.4 refresh | Published supported point update and async-context fix | Does not fix Undici; zlib contents still require proof; wider runtime validation | Defer while awaiting security release |
| Wait for corrected Node 24 only | Avoids repeated runtime upgrades | Leaves independently available OS repair unassessed | Keep Node wait, assess OS separately |
| Node 26 migration or vendor/global-fetch replacement | Could change available implementations | Changes runtime major or transport contracts without solving this bounded assessment | Separate scope |

Recommended stack: assess the narrow OS repair and independent client transport
patch; verify the announced Node 24 release when actually published; then assess
npm bundle residuals, existing startup-browser contracts and category-neutral
compatibility-purpose prompt projection. Publication remains separately gated.

## Official sources

URLs above were discovered/retrieved through MCP. Additional exact sources:

- [Node bundle](https://github.com/nodejs/node/blob/v24.22.2/deps/undici/src/package.json)
  and [compression header](https://github.com/nodejs/node/blob/v24.22.2/deps/zlib/zlib.h).
- [Official image mapping](https://github.com/docker-library/official-images/blob/master/library/node)
  and [immutable Dockerfile](https://github.com/nodejs/docker-node/blob/e994dfe115899a82684caa7533380aa7d439aae1/24/alpine3.24/Dockerfile).
- [SRI advisory](https://github.com/nodejs/undici/security/advisories/GHSA-r4pc-4jcp-7pqc)
  and [cache-hop advisory](https://github.com/nodejs/undici/security/advisories/GHSA-mqg3-3v4r-cm32).
- [PostgreSQL dump/backup guidance](https://www.postgresql.org/docs/18/backup-dump.html)
  motivates actual compressed archive compatibility checks.
- [OWASP dependency guidance](https://cheatsheetseries.owasp.org/cheatsheets/Vulnerable_Dependency_Management_Cheat_Sheet.html)
  supports tracing the actual affected consumer and testing available patches;
  a detection result or a wrapper alone does not establish remediation.
- [W3C writing guidance](https://www.w3.org/WAI/tips/writing/) supports concise,
  precise outcome wording. This batch creates no new UI/accessibility surface or
  WCAG conformance claim.
