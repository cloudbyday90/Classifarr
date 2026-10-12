# Health configuration dependencies: outcome

Date: 2026-10-12. See the separate
[design, dependency matrix, alternatives and official research](health-configuration-dependencies-design.md).

## Delivered

Six health checks now fetch only reviewed configuration fields: Radarr, Sonarr,
TMDb, OMDb, Tavily and image embeddings. Their initial read, completion guard and
background reconciliation share the same fixed ESM query factory. Ordinary OMDb
request accounting and unrelated cache timestamps no longer invalidate connection
health. Credential/lifecycle, transport, displayed identity and active-selection
changes remain covered where applicable.

The operator's screenshot exposed a real false-invalidation path, not proof that
someone edited settings. The old private digest did not retain a field-level
history, so the exact field responsible for that historical warning is unknown.
An existing Unknown result must still be replaced by a completed ordinary check;
the change never manufactures a Healthy result or resets provider retry state.

AI/Ollama and media-server comparisons remain conservative because their health
adapters use legacy/cached configuration assumptions. Discord and RAG already had
explicit reads and are unchanged. Authentication, memory safeguards, readiness,
cadence, two-reader concurrency, probe timeouts and cancellation/fencing remain
unchanged. There is no migration, dependency update or backfill requirement.

## Verification

- Focused backend: six suites / 236 tests passed.
- Isolated PostgreSQL: two suites / 53 tests passed. Fifty new cases cover all
  six projections, incidental changes during completion and reconciliation,
  every retained field, committed versus rolled-back changes, active membership
  and newest-active metadata selection. The prior three cache tests also pass.
- Ownership gate and 39 gate tests passed. Three changed indirect-query consumers
  were individually reviewed and recorded with their fixed SELECT factory; no
  parser rules or unrelated writer classifications were relaxed.
- Backend/frontend lint and type checks, full/production dependency analysis,
  static imports, npm CLI policy, copyright, Markdown and staged secret scan pass.
- Full frontend coverage: 469 files / 7,190 tests passed in 494.61 seconds.
  Statements 87.63%, branches 81.56%, functions 87.29%, lines 89.33%.
  Twelve frontend runner-configuration tests and eight production-navigation
  browser checks passed, alongside the two responsive tooltip checks.
- Full backend coverage: 1,809 suites / 56,807 tests passed, one skipped, in
  947.456 seconds. Statements/lines 89.75%, branches 86.23%, functions 91.18%.
  The new query factory has 100% coverage in all four metrics. The combined
  frontend/backend coverage ratchet passed without baseline changes.

## Local image evaluation

Started on clean `main` at `ae6a21b945c8f5e79ac8b579045e77145256c773`.
Runtime source is `4aa3f0d9949c5d7cb639f22fcf4b583de0035580`. The no-cache Compose
build used a clean checkout with `--require-provenance`, Linux/amd64 and AVX2.
Its local image ID is
`sha256:31de2cdc9d31eae11c980048f50a749d883efd14f92285797fd99f33a99fcc3e`.
This is a local Docker image identity, not a registry manifest or signed
multi-platform release attestation. Later outcome-document edits do not change
runtime code.

A final 76,009,419-byte local backup passed checksum and archive-list verification;
the exact prior local image was retained. This is not a full restore rehearsal.
Only local Classifarr is in deployment scope. Unraid, Plex, shared Ollama and
other containers are unchanged. No branch, release, tag or version bump is made.

After rebuilding, the schema dump ran against a new owned, network-isolated
container with 1 GiB memory, two CPUs, 256 PIDs and no published ports. It produced
no schema diff, includes migrations through
`20261010_220000_source_catalog_mappings.sql` and includes 22 seed migrations.
Five PostgreSQL configuration-read checks, six cross-connection cache checks and
all six packaged projections passed. A synthetic OMDb row retained health after
a usage update and invalidated it after a credential change. Only synthetic
fixture tables were written after the dump; no provider request or application-data
write was made by these probes. The owned container and directory were verified
removed; these disposable fixtures are reproducible.

The local application was recreated at 22:04:26 UTC with the exact image above.
All thirteen checked backend runtime files match the checkout byte for byte.
Packaged route checks passed six aggregate cases, five synthetic freshness cases,
a configuration-read failure, concurrent drift and completed-cache reconciliation.
Fixture observation times are controlled, not a timed heartbeat soak. Actual
health/liveness/readiness returned 200; unauthenticated detailed health returned
401. The compiled System bundle retained the concise information labels.

The local deployment remains uid/gid 1000, read-only root, 2 GiB memory,
no-new-privileges and PostgreSQL noexec tmpfs. Read-only before/after counts were
unchanged: 6,837 classifications, ten active/covered libraries, four unresolved
identities (two source review, two retry wait), zero pending text embeddings and
6,815 pending image embeddings. The old container had one optional comparison
`cached_vectors_incomplete` warning; none appeared in the initial new-container
sample. That does not prove optional vector coverage is fixed by this change.
The short memory sample was 391.5 MiB / 2 GiB with no OOM or restarts; it is not a
retained-memory profile. Normal application startup jobs remained enabled.

## Recommendation stack and next item

1. Use explicit dependency projections for fully traced probes: removes false
   invalidations and fetches less data; requires review when probe inputs change.
2. Retain conservative comparisons for unresolved adapters: safer than guessing,
   but some unnecessary invalidations remain until those paths are corrected.
3. Keep eventual reconciliation and safe Unknown states. This is not a lease or
   durable change history; changes between snapshots may not be observed.
4. Next, repair AI/Ollama and media-server health adapters against current saved
   configuration, and consistently handle helpers returning `success: false`.
   Some existing Arr/TMDb/Ollama helpers return failure rather than throw; the
   health caller must not interpret promise resolution alone as success.

GitHub MCP returned zero open PRs on admission and recheck. No random open PR was
available and none was merged. Remote CI for the final push is separate evidence.
