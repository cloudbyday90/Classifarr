# TypeScript 7 review and CodeQL update outcome

Date: 2026-10-12. Development on `main`; no release or PR merge.
See the [design, official research and tradeoffs](typescript-seven-review-design.md).

## Compiler trial and retained implementation

Client TypeScript 7.0.2 installed successfully under the existing strict lifecycle
policy. The candidate lockfile changed TypeScript and added its 20 optional native
platform packages; no unrelated dependency or install script changed. Its complete
dependency tree and all-dependency npm audit passed, with zero advisory findings.
Those checks did not establish Vue compatibility.

Both actual checking commands, API/configuration and strict Vue components, failed
with exit 1 before checking source: `ERR_PACKAGE_PATH_NOT_EXPORTED` for
`typescript/lib/tsc`, resolved inside vue-tsc 3.3.13. The new installed-API contract
also failed because `createProgram` is absent. That focused negative run selected
one test and skipped the other 21 by filter; it was not a full-suite result.

Restored TypeScript 6.0.3 and reinstalled normally. The client manifest and lockfile
are byte-for-byte unchanged from the starting commit. Root/server TypeScript 7.0.2,
Node 24.21.0, npm 12.2.0 and all security overrides remain unchanged. There is no
native Vue speedup to claim, and no change to application memory usage or limits.

Retained ESM regression checks verify the installed compiler resolves from the
client workspace, matches the manifest and exposes the API/entrypoint used by
Vue. Dependency-policy tests require exact manifest/lockfile compiler alignment.
The existing positive/negative source-diagnostic fixtures remain mandatory; a
startup failure cannot satisfy a negative type-error test. No checker suppression,
third-party patch, new service singleton or runtime behavior change was added.

## Random PR implementation

The fresh inventory contained one open PR. Random selection chose
[#560](https://github.com/cloudbyday90/Classifarr/pull/560), immutable head
`ee260e7d5cc7be8dfd6a25ab55bd3a62450a0fe6`. Applied its exact four action-reference
updates in the two workflow files locally, without merging or closing the PR.
Upstream v4.38.3's annotated tag resolves to
`24c54180a607b1449ed407dd24f251e4e9147c8d`; the API does not report a verified tag
signature, so this is identity matching, not a signed-provenance claim.

Updated the existing workflow contract and added assertions for no error bypass,
unchanged analysis/SARIF categories and unconditional report upload. Permissions,
scan languages, extended queries and Trivy's failure gate are preserved. Local
YAML contracts do not execute the hosted CodeQL analysis or upload to GitHub.

## Validation completed before image work

- Baseline and restored client typechecking: both scopes passed.
- Restored compiler contracts: 42 tests across two files passed in 85.17 seconds.
- Dependency/toolchain policy: 42 tests passed; workflow contract: six passed.
- Client and server lint passed. No runtime backend or schema changes require
  another full backend/database suite for this batch; no fresh combined coverage
  ratchet is claimed using the earlier backend report.
- Restored strict install and complete dependency tree passed. All-dependency npm
  audit reported zero vulnerabilities; 295 registry signatures and 122 attestations
  verified. These are point-in-time checks, not proof of universal package safety.
- Full frontend coverage: **459 files, 6,899 tests passed**, no skips, in 435.88
  seconds. Coverage: 87.33% statements, 81.07% branches, 87.05% functions and 89.08%
  lines. The run began before the final test-only import-style correction below.
- Production Vite build and all eight production-browser checks passed (9.9 seconds
  for browser tests), using synthetic API responses and rejecting mutation requests.
- Client test-runner/configuration checks: 12 passed. Copyright, Markdown (2,133
  files), npm CLI policy and staged secret scan passed.
- The first ESM static-import check rejected the new test's dynamic TypeScript
  import. Converted it to a static ESM import without changing assertions; final
  ESM check and client lint passed. All 22 affected compiler-contract tests passed
  again on the final file in 36.82 seconds. This was a focused rerun, not a second
  full coverage run after the import-only correction.

## Local baseline and image verification

At 13:25:52 UTC the read-only local consumer probe found ten covered active
libraries, 6,837 classifications, four unresolved identities (two requiring source
review and two awaiting retries), no pending text embeddings and 6,815 pending
image embeddings. One `cached_vectors_incomplete` comparison warning existed
since startup. No database writes or provider calls were made by the probe.

Retained a checksum-verified, readable 75,905,416-byte local database archive and
an exact rollback image tag for
`sha256:feb100764ff2990d220075425bad84a92d0a0fa80f328815d6bfc46ebb97e6e1`.
Private backup paths and data remain ignored.

The requested no-cache Compose build passed from clean implementation commit
`e584c9f401987edb9a4ecc02f470a0a10c3105ba`. Local Docker image ID:
`sha256:a774eb830ca03a7b09b2626b51b50bb3fc12a06ee51e6e505b605c1d961ae72b`.
The inspected OCI revision matches that commit. This identifies the locally tested
image, not a published registry digest or signed multi-platform provenance.

After the build, the exact image passed schema generation using disposable appdata,
no network or published ports, 1 GiB memory, two CPUs and 256 PIDs. The tracked schema
is unchanged through `20261010_220000_source_catalog_mappings.sql`, including 22
seed migrations. Fresh consumers reported no invented pending work, images or
unresolved identities. The runner and an independent check confirmed that owned
fixture `classifarr-schema-check-4907255c-482e-4f90-bf5d-bb284903347d` and its data
directory were removed. No production database was used for schema generation.

Replaced only the local test container with `--no-build --pull never --no-deps
--force-recreate --wait`. It started at 13:39:13 UTC and became healthy; the actual
running image and OCI revision match the tested artifact. HTTP `/health` returned
200, with zero restarts, no OOM kill, user 1000:1000, read-only root, the existing
2 GiB memory cap and `no-new-privileges` retained. The unrelated Harmoniarr container
remained running. These are short startup observations, not a sustained memory soak.

At 13:39:50 UTC, the read-only consumer probe retained the baseline library,
classification, identity and embedding counts. Its ten-item batch was unique and
took 6 ms. It made zero writes/provider calls and found no warning/error entries
since the new startup. A short quiet startup does not prove the baseline incomplete
vector warning is permanently resolved; this change adds no vector recovery.

Unraid, Plex, shared Ollama and identity approvals were not changed. Version
0.49.1-beta remains unchanged; no tag, release or PR merge was created.

## Recommendation stack

1. Keep client TypeScript 6.0.3 with Vue 3.5.43 and vue-tsc 3.3.13. Benefit:
   working Vue diagnostics; cost: native compiler performance remains unavailable.
2. Retain the reviewed CodeQL pins with least-privilege regression tests, then
   check the pushed revision's hosted workflows. Local contracts alone are not
   evidence that GitHub's scanner and SARIF upload passed.
3. Next enroll `ConnectionStatus.vue` and `Toast.vue` in strict component checking
   with accurate status/error/event types and runtime regression tests. They are
   the remaining common Vue components outside the current explicit scope.
4. Revisit native Vue compilation when upstream support changes; avoid repeating
   the same incompatible update or adding an unused dual-compiler stack.

The dependency-update skill required the real candidate trial and restoration of
the incompatible compiler. The image-evidence skill requires a clean source commit,
exact local image identity, isolated schema generation and verified cleanup.
