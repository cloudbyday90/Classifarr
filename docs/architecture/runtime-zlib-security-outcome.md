# System zlib security assessment outcome

Date: November 9, 2026 Eastern. Baseline main 8879fcf7c. Scope agreed and implemented;
production-image qualification and delivery receipts are in progress.
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

## Real before/after evidence so far

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

## Verification and delivery pending

Native PostgreSQL 17/18 gzip custom-format dump/restore, native curl, full frozen
production image/scan/recovery, final coverage/quality, maintenance and exact-source
CI identities will be recorded after their completion. Node's embedded compression
fork and Undici, plus npm's separate Glob/Minimatch findings, remain explicit.
The historical beta exception and November 16 rejected-CVE triage are unchanged.

Intake maintenance reuses the recent full inventory on the same Docker daemon,
verifies all three protected service identities/state/health and four registered
worktrees, and preserves recovery assets, current evidence/tools and shared cache.
No stale asset retirement or production action occurs. Development test images
are independently owned; final cleanup must be verified before a passing handoff.
No release or deployment is made.
