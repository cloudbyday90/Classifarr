# Pgvector startup report: outcome

Date: 2026-10-12. Runtime implementation: `8ab8737478d5f866c1df65680a2c553ed1a5133b`.
Version remains `0.49.1-beta`; no release, tag, branch or production deployment.
See the [design, research and tradeoffs](pgvector-startup-report-design.md) and
[API contract](../api/system.md#get-apisystemstatus).

## Delivered

The entrypoint records its actual selection reason without changing binary
selection or security checks. Small ESM modules produce, persist and validate a
bounded latest report. One parameterized statement updates the report and legacy
settings atomically. Both status APIs share the reader; System displays scoped
references/timestamps, and Dashboard gives specific advice only for current
embedded evidence. Older or inconsistent observations do not become current facts.

The application-run UUID is correlation only. Last-writer-wins storage is not a
per-instance history, lease, signature, loaded-binary check or readiness result.
No hostnames, paths, connection strings, credentials or arbitrary environment
values are copied into the report. No migrations, provider changes, memory-guard
changes, automatic repairs or identity approvals were introduced.

## Verification

- Focused backend: 124 tests across seven suites passed, including final boundary
  rechecks, both API projections and legacy compatibility.
- Real PostgreSQL integration: atomic six-key persistence, older-writer mismatch
  detection and rejected-write rollback passed in an isolated test database.
- Frontend: 7,051 tests across 465 files passed; final focused replay passed 64
  tests. Coverage: statements 87.40%, branches 81.21%, functions 87.11%, lines 89.14%.
- Browser: 14 shared-control checks and eight production route/asset checks passed;
  current/stale notice cases verified mobile width, safe wording and no form/API
  mutation. These are synthetic fixtures, not authenticated production UI testing.
- Dependency tooling: 42 tests; client runner configuration: 12 tests passed.
- Server/client lint and typechecks, production/development Knip, static-import
  checks, npm CLI policy, copyright, Markdown and staged secret scan passed.
  A fixture global-name lint error was corrected and lint rerun successfully.
- Full backend: 56,418 tests passed across 1,802 suites. One existing Linux-only
  directory-fsync test was skipped on Windows. Coverage: statements/lines 89.71%,
  branches 86.16%, functions 91.12%. The combined frontend/backend coverage ratchet
  passed. The complete integration suite was not run; the targeted PostgreSQL test
  and image cases above are the database evidence for this change.

## Exact image and local rehearsal

The local no-cache Compose build used a clean implementation checkout. Linux/amd64
only; this is not published multi-platform release evidence.

- Docker image ID: `sha256:09336999641f87d4e3fe1f2f90f12d31dae62ba5c2c9d8483efdf366e2bdd66c`.
- Build manifest: `sha256:a7d63a01a8128c2d868c2c7e4da6b0205535ce12c9b16a133cf75dc0237c054c`.
- Build config: `sha256:48bab10825924b05d95562c4e9a2ba1b3c5005a11b3865ae5e7d99218dbfccb5`.
- OCI revision equals the implementation SHA above. This is local identity
  matching, not a signed registry attestation.

`node scripts/check-pgvector-startup-report.mjs <exact-image-ID>` runs the ordinary
entrypoint with fresh synthetic data, no published ports/network, 1 GiB memory,
two CPUs and 256 PIDs per case. Cleanup verifies exact ownership labels and absence
of each generated container/data directory. All three cases passed:

| Runtime staging | Reported variant | Reason |
| --- | --- | --- |
| `auto` | `avx2` | `optimized_staged` |
| `disabled` | `generic` | `staging_disabled` |
| Invalid fixture value | `generic` | `staging_invalid` |

Reports were 337-340 bytes. Each fixture's container/data directory was verified
absent after cleanup. Other fallback reasons have boundary/unit coverage, not
individual image-level fault injection in this batch.

The schema dump ran after rebuilding, against another isolated instance of the
exact image. It was unchanged, includes migrations through
`20261010_220000_source_catalog_mappings.sql` and 22 seed migrations. Fresh-data
aggregate checks found no invented work or unresolved identities. Its owned
container and data directory were removed and verified absent.

Before local replacement, a private 75,935,770-byte custom-format database backup
passed checksum and archive-list checks; the previous exact image was retained
under a unique rollback tag. This is not a full restore rehearsal. The read-only
baseline had 6,837 classifications, 10 covered active libraries, four unresolved
identities, no pending text embeddings, and 6,815 pending image embeddings. One
existing incomplete-vector warning was present.

Local replacement used the exact image above without another build or pull. At
16:17 UTC, health returned HTTP 200 and Docker reported healthy. The database
report recorded `optimized_staged`/`avx2`, selected at 16:16:34 UTC and recorded at
16:16:39.500 UTC; its database-start timestamp matched PostgreSQL's current value.
The independent probe correctly returned `other_process`, rather than pretending
to be the application process. Same-process API projection is covered by tests.
The container retained UID/GID 1000, read-only root, no-new-privileges, runtime
tmpfs `noexec,nosuid,nodev` and its 2 GiB limit. The inventory counts above were
unchanged; the ten-row batch remained unique and took 8 ms. No startup warning was
present at this short observation point; this is not a long-running soak.

These probes made zero provider calls and zero database writes. Normal background
startup was not disabled. Unraid, Plex and shared Ollama were not modified.

## PR selection and next item

Two live GitHub MCP inventories returned zero open PRs. No random candidate could
be selected, and no PR was merged or represented as implemented.

Next: replace the System pgvector badge's CPU-only health inference with clearly
separated compatibility and actual database/RAG readiness. Unknown CPU flags or
stale reports must not imply a healthy database. Preserve all execution/memory
safeguards and avoid forcing extension loads merely to collect diagnostics.

Remote CI is separate from this local outcome; consult the exact pushed revision's
runs. Local checks do not constitute a full release gate or published-image approval.
