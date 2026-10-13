# Local Docker rollback protection outcome

Date: 2026-10-13. See the separate
[design, official sources and tradeoffs](local-docker-rollback-design.md).

## Delivered

Both local rebuild aliases now preserve the existing container's exact image
before building and verify the retained reference after a successful build and
before replacement. They no longer stop the container before the build. Protection
uses the selected Compose project/service, full container/image IDs and a retained
tag named for that container, not a global container name or revision label.

Missing images, conflicting tags, ambiguous instances, changed identity and failed
Docker reads stop the protected operation. Replacement cannot manufacture missing
pre-build evidence. The general wrapper's unprotected development commands remain
available and make no rollback guarantee. First installations explicitly report
that no previous container/image exists. No automatic image deletion, database
restore, downgrade, production deployment or release is added.

The implementation is split into ESM argument and image-guard modules. The README,
build-provenance guide, release runbook and Unreleased changelog now describe the
protected workflow. The release-evidence review kept image identity, source labels,
database backup and release authorization as separate claims.

## Verification

- Focused guard/provenance tests: two suites, 57 tests passed. All script tests:
  169 suites and 2,604 tests passed, zero failures, 59.765 seconds.
- Current preflight passed: copyright, inventory ownership review and normal/
  production dependency analysis. Type checks, backend/frontend lint, static-import
  and ESM mock-shape checks passed. Staged secret scan and whitespace checks passed.
- The tracked `verify-local-docker-rollback.mjs` rehearsal passed seven checks with
  actual Docker and the actual smart Compose CLI: first install, changed mutable
  image, exact retained identity, missing/wrong-reference rejection, conflict
  refusal and build-failure preservation. Protected replacement admission was
  verified without starting its deliberately non-runnable synthetic image.
  This is image-metadata/CLI evidence, not an application upgrade rehearsal.
- Synthetic old image:
  `sha256:a42d748138fedc8abb868b63e2cb3bc7a9fd6f54d482068dbbfdb40c4069ddb3`.
  Synthetic new image:
  `sha256:ec45ab8dbd0eb5de6fd1f3565f1d1d1698b4c7a98f6ee399a3034ccab249538b`.
  The fixture has no ports, mounts or provider calls and declares network isolation,
  32 MiB memory, half a CPU, eight PIDs, read-only root and dropped capabilities.
  Only owned containers/tags and the validated UUID directory were removed;
  cleanup was verified. Build cache was not pruned.
- The first rehearsal exposed a fixture limitation: Docker refused removal of the
  last tag of a used image. A fixture-only hold reference now permits the missing-tag
  test without losing the synthetic baseline. The corrected rehearsal passed;
  the first failed run also cleaned up. No live image was faulted.

Full application coverage suites were not rerun in this tooling-only change;
the forthcoming release still requires fresh full suites and applicable CI for its
exact candidate. Earlier coverage results are not claimed as new evidence here.

## Exact local build and replacement

Started on clean `main` at `1effec8657755605abedc69acba7445a97436150`.
Implementation/source-image commit: `e406c6619aa6ef3946a84b011328d3bf96c3cfa7`.
Subsequent documentation-only changes do not alter application runtime files.

Before the build, the guard retained the original image:

- Image: `sha256:11f1fd56c0b8cb4e117b209024b26319ceb503db6b346a3a5123278820ef88aa`.
- Container: `57a04a9d74ce4896e33467d2bfd9133cbbea011eeac0436bace9c9db7cc590d9`.
- Retained tag:
  `classifarr-local-rollback:57a04a9d74ce4896e33467d2bfd9133cbbea011eeac0436bace9c9db7cc590d9`.

The first no-cache build failed while fetching pgvector because Docker could not
resolve `github.com`. The application remained healthy under the same container
and image ID; the retained reference still resolved exactly. After read-only host
and container DNS checks passed, the same no-cache command succeeded without DNS,
Dockerfile, checksum, dependency or security changes.

Successful local image:
`sha256:ee519a81497550072ea47931930b952739a53079313d580900b087e9ab0ce397`.
The OCI revision label matches the implementation commit. This is a local Docker
image ID, not a registry publication digest or signed source attestation. Build:
Linux/amd64, AVX2, `--no-cache --require-provenance --protect-running-image`.

The exact candidate passed normal-entrypoint startup and schema checks in an
isolated container with fresh disposable data, no network or published ports,
1 GiB memory, two CPUs and 256 PIDs. Schema matches the checkout, including
migrations through `20261010_220000_source_catalog_mappings.sql` and 22 seed
migrations. Container `classifarr-schema-check-cd6b0296-9426-48eb-bbf8-791aee397f2e`
and its exact temporary data directory were removed and verified absent.

A separate 76,279,184-byte database backup passed SHA-256 comparison and
`pg_restore --list`; this is archive-read verification, not a full restore test.
Local artifact:
`.tmp/pre-memory-fingerprint-50b60b0e-a7a0-467e-b80f-b9747453a504.dump`.
That helper also retained an additional exact old-image tag. No fallback to an
older application image was needed. Appdata/encryption-key preservation remains
separate from a database-only dump.

Only local Classifarr was recreated with `--no-build --no-deps --pull never`,
after rollback verification. It started at `2026-10-13T11:19:07.952958521Z`, healthy
with zero restarts and no OOM. After replacement the original retained image still
resolves to its exact pre-build ID.

Checks after replacement:

- Health, liveness and readiness returned 200; unauthenticated detailed health
  returned 401. Thirty-two packaged runtime source files match the checkout.
  Controlled health/freshness fixtures and compiled System UI checks passed with
  no provider requests or application-data writes from those checks.
- UID/GID 1000, read-only root, 2 GiB memory, no-new-privileges and the PostgreSQL
  noexec/nosuid/nodev tmpfs are unchanged. Startup pgvector reporting is not proof
  of which binary an arbitrary database session loaded.
- Before/after counts remain 6,837 classifications, ten active/covered libraries,
  four unresolved identities (two source review, two retry wait), zero pending
  text embeddings and 6,815 pending image embeddings.
- The three retained pre-rebuild sync warnings were all known unresolved-source
  skips. The immediate new-startup sample had no warnings/errors. This short
  sample is not a memory soak or proof that every background issue is resolved.

Normal startup work remained enabled. Unraid, Plex, shared Ollama and unrelated
containers were not modified. No production fault or manual recovery was induced.

## Recommendation and next step

Keep the exact-image guard, separate consistent backups, isolated candidate tests
and scoped health-checked replacement as the local stack. The guard is inexpensive
and prevents the observed ordering failure; it does not protect against Docker
administrators retagging/deleting images concurrently or prove database downgrade
safety. Run rebuilding exclusively and retain backups independently.

Proceed to release preparation next, as requested. No new application blocker was
identified in this scope; the DNS failure recovered on retry. Do not turn that into
a release-readiness claim: fresh full release tests, security checks, candidate
rehearsals and exact-SHA CI remain required by the release runbook. Defer additional
OMDb instrumentation and other routine improvements until after release work.

GitHub MCP enumerations found zero open PRs, so none could be randomly selected or
implemented. No PR was merged; no branch, version bump, tag or release was created.
