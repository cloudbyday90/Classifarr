# System zlib security assessment outcome

Date: November 9, 2026 Eastern. Baseline main 8879fcf7c. Scope agreed, implemented
and qualified locally and in exact-source CI. No release or deployment.
See the [design and trade-offs](runtime-zlib-security-design.md).

## Implemented boundary

The shared application base and isolated provider fixture install exact signed
Alpine zlib 1.4-r0, then check its exact installed constraint with apk info --exists.
Node 24.22.1, npm/npx 12.2.2, Alpine marker 3.24.3, base index digest, PostgreSQL/
pgvector and application transport/authorization remain unchanged. Only the
single zlib APK is upgraded in the observed native-base transaction. Trusted
repository/signature verification remains enabled; no alternate repository,
manual library replacement or scanner exception is introduced.

Native test/compiler and orchestration are small separate leaves. Compiler/header
packages stay in a throwaway build stage. Runtime probes use read-only, network-
isolated, resource-bounded containers with numeric nonroot identity, disposable
temporary storage, exact random names/labels and verified cleanup. No application
data volume is mounted. The existing CI verification build now records its trusted
source SHA and runs native/PG/curl checks before the existing container gates;
its aggregate receipt contains source/image/architecture and fixed test results.
No new job, operator CLI trigger or UI is added.

## Real before/after evidence

The compiled probe resolves the actual dynamically loaded libz.so.1, not Node's
separate compression implementation. On the old immutable native base it reports
1.3.2 and preserves a custom gzip header after deflateReset; on patched AMD64 and
emulated ARM64 bases it reports 1.4 and clears the header. Reapplying a header
still works and both streams decode exactly. Eight-byte offsets, ordinary gzip,
exact-buffer completion, bounded truncation and seek/zero-fill controls pass.

The probe uses public gzseek/gztell with measured 64-bit offsets; new 1.4 headers
do not declare the older suffixed APIs. No corruption/exhaustion payload is used.
The old observed failure is not converted into a permanent requirement that bad
behavior persist. ARM64 execution uses Docker Desktop emulation and is not native
ARM64 certification.

The initial package assertion incorrectly assumed older apk info verbose output.
Installed apk-tools 3 emits descriptive fields instead. The final supported exact-
constraint query accepts installed 1.3.2-r1 and rejects 1.4-r0 on the old base;
the patched base accepts the new exact constraint. This preserves a real installed
version check rather than weakening it to a success/version-string assumption.

## Node assessment and remaining gaps

Node 24.22.2 is published but retains the exact Undici 7.30.1 source/generated
bundle and compression fork from 24.22.1. A bounded current-native-fetch probe
reproduces acceptance of a tab-surrounded wrong SHA256 digest; ordinary wrong
digests reject and valid ones succeed. Standalone server Undici 8.12.4 rejects
both wrong forms. No application integrity option or cache-interceptor use was
found, so this is library evidence rather than a demonstrated application exploit.

The next Node security cycle is announced for November 11 without a specific
corrected version/fix list. No current Node 24 artifact closes the target gap.
The published 24.22.2/Alpine 3.24.4 image and its async-context fix remain separate
options; no global fetch/vendor patch or Node major migration is introduced.

Alpine's scanner finding references contrib/infback9. Old/new default object
lists select core infback.o, and the inspected new APK exports have no infback9
entry points. This narrows demonstrated reachability without proving complete
non-reachability or authorizing suppression. Source SHA512 matches the immutable
Alpine recipe; actual trusted installation supplies signature verification that
archive inspection alone did not provide.

## Frozen production image

The clean source-bound rehearsal qualifies implementation
c74f9bfe2e4fa733a279b35648b414caa5d663e2 and one immutable AMD64 candidate:
sha256:b63517c16223bb253847234b01a838013bd522cd3af7417cd0632f9fd5d5ccc2.
Native, scan, runtime and installation receipts all identify that same image.
All 9,915 frozen source files and both coverage-report hashes remain unchanged
through qualification; worktree cleanliness and owned cleanup both pass.

The portability review of [BuildKit's local receiver](https://github.com/moby/buildkit/blob/master/session/filesync/diffcopy.go)
and [fsutil's root-skipping walk](https://github.com/tonistiigi/fsutil/blob/master/fs.go)
finds that a host-private export directory cannot be assumed readable by container
UID 1000 on Linux. The final harness mounts only its compiled binary read-only,
following [Docker's file-bind contract](https://docs.docker.com/engine/storage/bind-mounts/).
It keeps the parent directory private and avoids relying on Docker Desktop's
permission translation. Actual file-bind native controls and the full final
source-bound candidate rehearsal pass. The original pre-correction Linux run
failed its native gate; the final Linux gate passes with the narrower file mount.

| Boundary | Actual result |
| --- | --- |
| OS package/native ABI | Exact installed zlib 1.4-r0; dynamically loaded libz.so.1; all bounded native controls pass |
| PostgreSQL compression | Both PG17 and PG18 pg_dump/pg_restore link libz.so.1 and reproduce all 32 synthetic rows and aggregate contents through gzip custom archives |
| Other native consumers | Actual curl --compressed and bcrypt good/bad-password controls pass |
| Provider test image | Separate signed APK build installs exact 1.4-r0; actual tags, synthetic 503, recovery, successful generation and bounded counters pass |
| Preserved runtime | Node 24.22.1, npm 12.2.2, built-in Undici 7.30.1 and compression fork unchanged |
| Installation/recovery | All twelve fresh/published-upgrade checks pass, including interrupted restore, verified retry, crash recovery, restart and profile preservation |
| Routing rehearsal | All eight phases pass; two movie/two TV GETs, zero provider writes, History preserved, legacy work not enrolled |
| Resource cleanup | Owned container/network/volume and random candidate-tag cleanup passes; protected services are unchanged |

Fresh and upgraded PG18 instances report 180006 and 338 migrations. The attested
published v0.48.4-beta baseline has 222 migrations. Local qualification uses the
ordinary installation mode. Same-revision CI ordinary acceptance also passes;
its downloaded artifact digest, source/workflow binding, clean worktree and
cleanup are verified independently. The resource-budget mode is manual-only and
skipped on this push; no repeated budget-mode evidence is claimed.

Trivy 0.76.2 scans the exact candidate with unchanged scanner policy: no OS
findings, installed zlib 1.4-r0, and two remaining medium findings in global npm's
Glob 13.0.6 (CVE-2026-118773) and Minimatch 10.2.5 (CVE-2026-118764). No suppression
or acceptance is added. This package scan does not establish that Node's embedded
Undici/compression is corrected; the separate observed gaps above still apply.
The historical beta exception and November 16 rejected-CVE triage are unchanged.

## Repository verification and delivery

Fresh client coverage passes 486 files / 7,557 tests, with 87.93% statements,
82.17% branches, 87.72% functions and 89.60% lines. Production build and all eight
production-asset plus fourteen shared-form Chromium cases pass. Lint, type checks,
107 tooling controls, complete dependency trees, full audits, ownership, both
Knip modes, policy gates, ESM checks and copyright pass. Root/client audits have
zero entries; the same five existing server entries are low severity.

The new receipt initially tripped two existing workflow contracts: shutdown's
closed artifact allowlist and the repository-wide upload count. A separate
bounded artifact preserves the original shutdown allowlist; its exact immutable
upload action raises the expected count from fourteen to fifteen. All 93 affected
workflow controls pass without changing scanner severities or publication gates.
Fresh backend coverage passes 1,933 suites / 62,791 tests with one existing skip:
89.28% statements/lines, 86.72% branches and 90.81% functions. The current two-report
ratchet passes. Backend source, tests and configuration remain unchanged during
that local run; the final committed revision also passes fresh backend/client
coverage, ratchet and browser gates in CI.

All seven exact-code workflows succeed at c74f9bfe2: [main CI](https://github.com/cloudbyday90/Classifarr/actions/runs/42689376043),
[CodeQL](https://github.com/cloudbyday90/Classifarr/actions/runs/42689376045),
[OSV](https://github.com/cloudbyday90/Classifarr/actions/runs/42689376906),
[Trivy](https://github.com/cloudbyday90/Classifarr/actions/runs/42689375787),
[secret scanning](https://github.com/cloudbyday90/Classifarr/actions/runs/42689376034),
[capacity](https://github.com/cloudbyday90/Classifarr/actions/runs/42689375971)
and [copyright](https://github.com/cloudbyday90/Classifarr/actions/runs/42689375699).
Main CI passes database integration, ordinary installation, native compression,
PG startup/monitoring/adoption, loaded shutdown, queue recovery and acceptance
readout. Manual, tag-only and publication jobs remain skipped under unchanged gates.

The downloaded Linux system-zlib-verification artifact 13706679563 has verified
ZIP SHA256 e943def9e5b6c7d89a0610cea843e650821aaba6e7d580f89842a6794102dec3.
Its closed receipt binds the exact code revision to CI image
sha256:32e665191f8bbc3c27d9ec9c6cf80b9e88fadb02517973c8edf26a7d7bc004da
and independently confirms native/PG17/PG18/curl/cleanup success. This CI image is
distinct from the locally scanned candidate above; their receipts are not mixed.
The ordinary installation artifact is also digest- and source/workflow-verified.

The final documentation-only follow-up records these completed code-revision
receipts. It does not rebind the image evidence to a different commit.

Maintenance reuses the recent reviewed inventory on the same pinned Docker daemon.
The delivery check verifies all three protected service identities/start times/
state/health, four worktrees and rehearsal cleanup. No newly verified stale asset
qualifies for retirement: zero files/images are removed. Recovery/reference images,
volumes, current evidence/tools, shared cache and other projects are preserved.
Docker reports 162.5 GB of image storage and 300.8 GB of shared build cache; these
overlap and are not additive or attributable cleanup savings. About 1.05 TB remains
free on C:. This scope does not authorize shared-cache or recovery-asset retirement.

## Recommendation stack

Retain the qualified exact OS repair and independent client Undici patch. Next,
assess the actually published Node 24 security artifact and its bundled components;
the announced November 11 window is not evidence of a fix. Then assess npm's
independent Glob/Minimatch bundle and JSDOM/browser-contract debt. Choose a
category-neutral provider-prompt evidence contract separately from post-choice
learning provenance; the [consumer trace](compatibility-purpose-consumer-boundary.md)
corrects the former queued-task label. No release or deployment is made.

## Follow-up availability research

The November 9 follow-up at approximately 16:01 Eastern, baseline main 4a6d345db,
still finds Node 24.22.2 as the latest published 24.x release. Its actual Undici
remains 7.30.1, and the [official security announcement](https://github.com/nodejs/nodejs.org/blob/main/apps/site/pages/en/blog/vulnerability/november-2026-security-releases.md)
still schedules releases on or after November 11. A newer point version alone
does not establish the needed bundle correction.

[Official npm metadata](https://registry.npmjs.org/npm/latest) and full alternate-tag
research still identify 12.2.2, with no published 12.2.3. The actual existing bundle
retains Glob 13.0.6 and Minimatch 10.2.5. [Upstream release PR 10244](https://github.com/npm/cli/pull/10244)
is open; its manifest ranges do not establish unpublished bundle contents or a fix.
Keep current pins and residual findings. The separately assessed
[PR 585 tooling batch](server-tooling-pr-585-design.md) changes neither runtime.
