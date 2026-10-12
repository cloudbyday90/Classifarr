# Pgvector compatibility notice: outcome

Date: 2026-10-12. Scope and tradeoffs are in the separate
[design](pgvector-banner-contracts-design.md).

## Changes

The Dashboard supplies the existing named RAG status loader. The banner now
requires an enabled RAG status and the exact generic variant, distinguishes
reported build/CPU constraints, and does not promise that restarting enables AVX.
Unknown causes point to container startup selection messages. No response values
are rendered as HTML, and raw request errors are not logged by this notice.

Two small ESM utilities isolate status presentation and best-effort session
dismissal. Storage property access, reads and writes can fail without breaking
the notice. Dismissal takes effect immediately; if storage cannot persist it,
the notice may return on remount. The original session key is preserved. Late
request completions after unmount are ignored, not represented as cancelled.

The banner joins the 16-component strict-checking scope. Its loader must return
a promise, and the shared non-submit button uses the checked listener binding.
There are no backend/API contract, database, dependency, compatibility-selection,
recovery-budget, memory-safeguard, or production configuration changes.

## Verification

- Client API and component typechecks pass; lint has no warnings or errors.
- Full frontend coverage: 7,019 tests across 464 files pass in 368.57 seconds.
  Coverage is 87.38% statements, 81.16% branches, 87.10% functions and 89.12%
  lines. A final focused run passes all 81 tests across six files, including the
  final listener syntax and both negative loader compiler probes.
- Chromium: 12 shared-control checks and 8 production-route checks pass. The
  four notice scenarios cover working storage and blocked getter/read/write,
  keyboard dismissal, no form submission and no network API requests.
- The 390-pixel screenshot was inspected: readable wrapping, visible keyboard
  focus and no horizontal overflow.
- Backend: 36 tests across RAG status, AVX reporting and startup-smoke helper
  contracts pass. The smoke-helper tests are not a live upgrade rehearsal.
- Toolchain/install-policy: 42 tests pass. Client runner configuration: 12 pass.
  Static ESM imports, npm CLI flags and copyright checks pass (1,600 files).
  Markdown lint passes for 2,139 files; whitespace validation passes.

An initial unit test correctly failed: the shared test setup uses MemoryStorage,
so spying on the browser Storage prototype did not inject a write failure.
The unit tests now spy on the actual storage object and assert the failing
method was called; real Chromium tests independently exercise native storage.
Strict checking also rejected an undeclared shared-button aria-label input;
the button instead has a descriptive visible label, with no type suppression.

No fresh full backend coverage or combined coverage-ratchet result is claimed
for this frontend-only batch. Image evaluation follows below.

## Local baseline and image evaluation

A fresh private PostgreSQL archive was checksum-verified and readable by
pg_restore before replacement: 75,923,454 bytes. The retained rollback image is
`sha256:caa1cf08879b548cbd82776665781894dc81b6295d33a2e2104e8fb9fe7f86f7`.
The archive and exact rollback tag remain in ignored local artifacts.

At 15:29:22 UTC, the read-only local probe reported 10 active/covered libraries,
6,837 classifications, 4 unresolved identities (2 source-review, 2 retry-wait),
0 pending text embeddings and 6,815 pending image embeddings. Its ten-item batch
was unique and took 7 ms. It recorded zero writes/provider calls and no stored
startup warnings in its bounded projection. These counts do not establish that
all historical memory or vector-coverage issues are solved.

The no-cache Compose build passed from clean implementation revision
`2d6e19eeb71c80c2008a387705c8c43aa8f92d4f`, verified against its OCI revision label.
The follow-up outcome commit changes documentation only. Local build identities:

- Docker image ID / local index:
  `sha256:7d7e36e02d5cc28bc245f441182ebf190608a8718bacd8397ac391369bfcc996`
- Platform manifest:
  `sha256:4e7b99ca89cd501bffd8a3dc03f03da06d6856f6f6471ee7d2e14a372325e09a`
- Image configuration:
  `sha256:931843a27cb672cf5d77e41feb832aed62c733c323bc874abb07f6b3d450098d`

These are local build identities, not published-registry or multi-platform
release evidence. The isolated schema container used this exact image, the
ordinary entrypoint, synthetic fresh data, no network or published ports, and
limits of 1 GiB, two CPUs and 256 PIDs. The schema dump completed through
`20261010_220000_source_catalog_mappings.sql`, including 22 seed migrations,
with no change to `database/schema/current.sql`. The fresh database had zero
invented pending work or unresolved identities. Cleanup checked the container's
ownership label before removal; its container and owned data directory are absent.

Only local Classifarr was recreated, without pulling or rebuilding during `up`.
It runs the exact image above, is Docker-healthy, returns HTTP 200 from `/health`,
has zero restarts and reports no OOM kill. UID/GID 1000:1000, read-only root,
2 GiB limit, no-new-privileges and the existing mount protections are preserved.

At 15:37:30 UTC, the same read-only probe returned the baseline counts unchanged;
its ten unique results took 8 ms. No startup warnings appeared in the bounded
stored-log projection. Selected/build values remained AVX2 and both CPU flags
remained true, so this local instance should not display the generic-mode notice.
Generic-mode interaction evidence comes from synthetic browser fixtures, not an
AVX-disabled production experiment. Probe writes/provider calls were zero;
ordinary application background activity was not disabled or represented as zero.
This is a startup check, not a long-running memory or load test.

## PR, publication and next item

Two fresh GitHub MCP enumerations returned zero open PRs. There was no random
candidate to implement; no PR was invented, reopened or merged. The preceding
main revision's seven workflows completed successfully, but they are not CI
evidence for this patch. Current-patch CI status must be checked after push.

No release, version bump, tag or new branch is part of this work. Unraid, Plex
and the shared Ollama service remain unchanged.

Next: record bounded pgvector startup selection reasons with timestamp and
instance/database context. Current saved build and CPU fields cannot distinguish
disabled staging, missing optimized binaries and unsafe staging targets, or prove
which extension binary an external database loaded. Preserve existing safety
checks; improve evidence before offering more specific deployment actions.
