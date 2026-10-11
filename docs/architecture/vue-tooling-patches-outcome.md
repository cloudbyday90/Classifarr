# Vue tooling patch outcome

Date: 2026-10-11. Main development, no release or PR merge.

## Implemented

Following the [design and source research](vue-tooling-patches-design.md), update
the client to exact Vue plugin 6.0.10 and vue-tsc 3.3.13. The lockfile changes only
those packages and language-core 3.3.13: no packages added/removed, new native
platform packages, lifecycle installers or override changes. Runtime Vue 3.5.43,
Vite 8.3.4, client TypeScript 6.0.3, Node 24.21.0 and npm 12.2.0 stay unchanged.

Extended the existing ESM compiler contract with valid import-free setup macros
and rejection of an invalid macro-prop expression. It uses the installed checker,
source-specific diagnostics, bounded fixture execution and existing cleanup.
No runtime service refactor, new singleton, API or database migration is needed.
Memory safeguards, unresolved identity visibility and explicit consent are intact.

## PR trial

Fresh random selection chose [#556](https://github.com/cloudbyday90/Classifarr/pull/556)
at `a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server Node
declarations 26.6.4 and undici-types 8.9.0 locally, without merging.

Normal strict-policy install, complete dependency tree and all-dependency npm
audit passed (zero reported vulnerabilities). The server typecheck failed in
`discordDeliveryWriter.mjs`: Discord's request-body/FormData type is incompatible
with the new ambient File/FormData declarations. Independently, tooling tests
passed 39/40, rejecting Node 26 declarations for the deployed Node 24 runtime.
No casts, suppressed diagnostics, security overrides or guard changes were used.

Restored both server manifest and lockfile exactly to HEAD, reinstalled and passed
server typecheck and all 40 tooling-policy checks. The PR change is not retained;
its failure is not attributed to the independent client patches.

## Validation and scheduling diagnosis

Baseline client typecheck, updated client typecheck, client lint, normal strict
install, complete dependency-tree validation and all-dependency audit passed.
The updated client audit reports zero vulnerabilities as of 2026-10-11; that is
point-in-time advisory coverage, not proof of universal safety.

All 44 tests in the three focused compiler/tooling suites passed, including both
new macro contracts. Copyright, ESM static-import and Markdown checks passed.

The first full two-worker client run completed in 407.97 seconds: 456 files and
6,880 tests passed; the unchanged CSRF static source test alone failed its
5-second deadline after 8.23 seconds. A separate private read-only probe over the
same 584 source files took 100.68 ms, including 73.89 ms reading and 6.80 ms in
the three regex scans. This is not an OS-level root-cause proof; the full runner's
load/overhead differs, the probe may have warm filesystem caches, and the previous
development cycle also saw the timeout.

Moved that unchanged test to the existing sequential static-contract project,
ahead of parallel UI/compiler work. The resolved-config test failed before the
edit, then passed: all 457 files remain discovered exactly once, with unchanged
isolation, 5-second test deadlines, 10-second hook deadlines and source assertions.
No file exclusions or reduced coverage were introduced. The full two-worker rerun
passed **457 files and 6,881 tests** in 326.08 seconds with no skips. Coverage:
87.25% statements, 81.01% branches, 86.88% functions and 89.02% lines. This proves
the candidate passed that run, not that every possible host delay is eliminated.

Both workspace typechecks, client/server lint, npm CLI flags, copyright, ESM
static imports, ownership drift and Markdown checks passed. Ownership findings
remain classified as before; the drift pass does not authorize unresolved paths.
No fresh full backend coverage was generated for this client-only retained change,
and no old backend report was combined with this run to claim a local combined
coverage-ratchet result. Backend candidate typechecking was tested and rejected;
the restored backend typecheck passed.

Production Vite build passed, followed by all eight production browser checks in
10.0 seconds: cold route asset budgets, lazy Command Center navigation, browser
history, no page/script errors and no backend mutation requests. The browser smoke
uses synthetic API responses, not Unraid, Plex or local application credentials.

## Local rehearsal preparation

Before replacement, retained a checksum-verified, readable 75,506,097-byte local
database archive and an exact rollback tag for image
`sha256:e12dd548c0208b55ea31ec9808985b6f996db38e9084fb7714bf018df5a23801`.
The read-only baseline showed four unresolved identities across ten covered active
libraries, 6,832 classifications and 6,810 pending image embeddings. No direct
database writes or provider calls were used for that probe. The existing container
was healthy with zero restarts and no OOM kill before replacement.

## Recommendation stack

1. Retain compatible, tested patch updates: small change surface, with compiler
   output and diagnostics still checked rather than assumed safe.
2. Keep Node 24 declarations and the client TypeScript 6 compatibility pin. This
   forgoes newer-major APIs/performance but avoids the reproduced incompatibility.
3. Next review Playwright 1.64.0 and its browser binaries as one separate batch;
   defer Vue Router 5.4.0 and server Zod 4.6.6 to their own behavior-focused checks.
4. Verify real media before approving remaining mappings. This tooling work does
   not resolve the four identity issues or authorize changes to Plex or Unraid.

The dependency-update skill required exact lock review and rejection of the failed
PR trial. The image-evidence skill will bind local rehearsal claims to the exact
committed source/image and require isolated schema generation and cleanup.
