# Pgvector compatibility and health: outcome

Date: 2026-10-12. Implementation: `60fea94bc880088e01ce6475e7f33c688bf9bd3d`.
Version remains `0.49.1-beta`. No release, tag, branch or Unraid deployment.
See the [design, official research and tradeoffs](pgvector-health-separation-design.md).

## Delivered

System no longer invents a pgvector service-health result from CPU flags. The
startup panel lives outside service totals, with a small ESM presenter and explicit
CPU match/mismatch, generic selection, and unknown labels. Current embedded report
scope is required for comparison. Unknown CPU support is not a match; legacy,
external or stale evidence cannot turn a database healthy. References, UTC times,
fixed guidance and the loaded-binary disclaimer remain visible.

Database/RAG checks and API contracts are unchanged. No new queries, native vector
execution, migrations, backfill, provider configuration changes or automatic repairs.
Memory limits, staging checks and container security settings are unchanged.

## Verification

- Client: 7,101 tests across 466 files passed (475 seconds); 70 focused tests passed.
  Coverage: statements 87.46%, branches 81.36%, functions 87.13%, lines 89.19%.
- Backend: 111 focused health/startup-report tests across three suites passed.
  No backend source changed. The coverage ratchet passed with fresh client coverage
  and the same-day backend report from the unchanged `8ab87374` server tree
  (56,418 tests in that earlier run). The full backend suite was not rerun here.
- Browser: all five new startup cases passed at mobile/desktop widths, with no
  API requests or page errors. The 19-test shared/new group initially had one
  failure in the unchanged synthetic IME/tag-input case. That test passed three
  unchanged repeats, and the entire 19-test group then passed with retries off.
  The intermittent failure's cause remains unproven; no assertion, timeout or
  runtime behavior was weakened. The mismatch screenshot was visually inspected.
- Eight production route/asset checks and 12 client runner-configuration checks
  passed. The browser fixtures exercise real components with synthetic data, not
  an authenticated production session.
- Client/server lint and typechecks, production Knip, static-import policy, npm
  CLI policy, copyright, Markdown and staged secret scan passed. Strict component
  typing now includes the extracted panel; its test attribute is explicitly
  allowlisted. An initial missing-attribute type error was corrected and rechecked.

## Exact image and local checks

The no-cache Compose build used the clean implementation commit above, on
Linux/amd64. This is local image evidence, not a published multi-platform release.

- Docker image ID / local manifest-list digest:
  `sha256:b597f0484fba827d8aba5b48c401b162f7aa5b1dd107b9bc9b2d0f6a34aba93d`.
- Build platform manifest:
  `sha256:48ba1617b830d40f9dbb095aae3081d63352b7e837ddc873a45a9c079c41a313`.
- Build config:
  `sha256:75dbb584fc0cef60803cbec3a750a9e44bf6134b4770e09441dae7978aa8f876`.
- OCI revision matches the implementation SHA; this is not a signed attestation.

Before replacement, a private 75,951,219-byte custom-format local database backup
passed checksum and archive-list checks. The previous exact image was retained
under a unique rollback tag. This is not a restore rehearsal. The read-only baseline
at 16:35:50 UTC found 6,837 classifications, ten covered active libraries, four
unresolved identities (two source review, two retry wait), zero pending text
embeddings and 6,815 pending image embeddings. A ten-row batch was unique and took
11 ms; no warning/error was recorded since startup at that observation point.

The post-build schema dump ran against the exact image in a fresh synthetic
database, with no network/published ports and limits of 1 GiB, two CPUs and 256
PIDs. It produced no schema change, included migrations through
`20261010_220000_source_catalog_mappings.sql` and 22 seed migrations, and found
no invented pending work or identities. Cleanup checked the ownership label and
verified absence of the generated container and its exact data directory.

Local replacement used that image without another build or pull. At 16:43:09 UTC,
Docker reported healthy and `/health` returned HTTP 200. A read-only artifact
check found the new startup labels in the compiled System bundle. The startup
report recorded `optimized_staged`/`avx2`, with database start time matching
PostgreSQL. The separate diagnostic process correctly saw `other_process`; it did
not pretend to be the serving application. Same-process presentation has unit
coverage, not a live authenticated browser observation in this batch.

UID/GID 1000, read-only root, no-new-privileges, runtime tmpfs
`noexec,nosuid,nodev` and the 2 GiB limit were retained. The baseline inventory,
identity and embedding counts were unchanged. The ten-row batch remained unique
and took 5 ms. No startup warning/error was present at this short observation
point; this is not a long-running soak. Explicit probes made zero provider calls
and zero database writes; normal application background work was not disabled.
Unraid, Plex, shared Ollama and the unrelated local container were not modified.

## PR selection and next item

Two fresh GitHub MCP inventories returned zero open PRs; no candidate was available
for random selection or local implementation. No PR was merged.

Next: correct overall-health aggregation for unknown, disabled and stale service
observations. A direct call to the existing helper with only `unknown`, or only
`disabled`, returns `healthy` / `All systems operational` with zero healthy
services. That is independently reproducible and was not introduced by this patch.
Define the aggregate contract across UI/API consumers before changing it, then
test initial load, failed refresh, disabled-only and mixed states. Retain memory
and execution safeguards. Also retain the intermittent IME browser case for
separate investigation if it recurs; a passing rerun is not a root-cause fix.

Remote CI results belong to the exact pushed revision and are separate from these
local checks. No release-readiness or long-running-soak claim is made here.
