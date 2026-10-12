# Health provider adapters: outcome

Date: 2026-10-12. See the separate
[design, alternatives and official sources](health-provider-adapters-design.md).

## Delivered

Health checks now require explicit success from connection helpers. Previously,
Arr and TMDb helpers could return `{ success: false }` without throwing, and the
caller marked that resolved promise healthy. False results now remain disconnected;
malformed results remain unknown. Provider response bodies and error messages are
not copied into the health result.

Small ESM modules now handle AI and media-server checks using current saved
configuration. Ollama uses the active legacy configuration before the AI settings
row, matching the runtime's existing precedence, and reads model listings without
generation. Plex, Emby and Jellyfin use saved header credentials and recognizable
server information. New probes enforce a ten-second deadline, a 1 MiB decoded
response limit, certificate verification and no redirects. Cloud AI settings are
reported as configured, not as a verified healthy connection; no paid probe runs.

The existing configuration-change guard, freshness policy and single-flight
coordination remain in place. These are read-only observations, not a migration,
backfill, ownership takeover or change to classification. No memory safeguards,
authentication, provider configuration or retry budgets were changed.

## Verification

- Final focused backend run: five suites / 281 tests passed, including ownership
  review, helper contracts, current configuration and real loopback HTTP cases.
- Isolated PostgreSQL: three suites / 69 tests passed. Actual saved columns,
  legacy selection and committed/rolled-back cross-connection changes are covered.
- Frontend coverage: 469 files / 7,190 tests passed in 330.16 seconds. Statements
  87.63%, branches 81.56%, functions 87.30%, lines 89.34%. The initial full run hit
  a ten-second setup timeout in the Vue event-lint contract suite; the complete
  rerun passed without changing timeouts or tests.
- Full backend coverage: 1,810 suites passed and one failed; 56,914 tests passed,
  one failed and one was skipped, in 1,206.762 seconds. The sole failure was the
  ownership-review check: this run began before the updated review manifest was
  saved. The final focused run above verifies the reviewed manifest; no ownership
  rule was loosened. A further post-full-run ownership rerun passed all 39 tests
  in 15.42 seconds. This is not represented as a clean full-suite rerun.
- Backend coverage: statements/lines 89.74%, branches 86.24%, functions 91.14%.
  The combined frontend/backend coverage ratchet passed without baseline changes.
- Backend/frontend type checks and lint, copyright, normal/production dependency
  analysis, static imports and the staged secret scan passed. Markdown validation
  checked 2,161 files with zero errors.

## Local image evaluation

Started on clean `main` at `9314ab0a7af034822e7365a3315d7578d2b712a1`.
Runtime source is `dddfe2328500c76c8582f7af4b8316628c98c081`. The no-cache Compose
build used a clean checkout and `--require-provenance`, Linux/amd64 and AVX2.
The tested local image ID is
`sha256:a3b93e3992c20a310888e16973fa8c764e0b6624f2a694ed9616afb0997ba4cd`.
This is local Docker identity, not a published registry digest or signed
multi-platform release attestation. Later outcome-document edits do not change
runtime code.

A 76,027,543-byte local database backup passed checksum and archive-list checks;
the exact previous image was retained. This is not a full restore rehearsal.
Only local Classifarr was replaced. Unraid, Plex, the shared Ollama service and
unrelated containers were not modified. Normal local startup jobs stayed enabled.
No branch, version bump, release or tag was created.

The built image first ran in an owned disposable container with no external
network or published ports, 1 GiB memory, two CPUs and 256 PIDs. Fresh migrations
produced no schema diff, through `20261010_220000_source_catalog_mappings.sql`,
with 22 seed migrations. Checks passed for an empty installation, five PostgreSQL
configuration cases, six cross-connection cases, all eight health projections,
OMDb incidental-counter retention and credential invalidation. Eight packaged
adapter cases used six synthetic loopback requests, zero external provider
requests and zero real database queries. Separate SQL cases wrote only fixture
tables. Both disposable containers and their data directories were removed.

The first packaged-adapter rehearsal failed because its fixture replaced
`pool.query` while the database wrapper used `pool.connect`; it read the empty
isolated database instead of synthetic configuration. Correcting the fixture
made the full rehearsal pass. No production code change or weakened assertion
was needed. Cleanup also succeeded after the failed attempt.

Local replacement completed from the exact image above, starting at 22:41:34 UTC.
Seventeen checked runtime files match the checkout. Packaged route checks passed
six aggregate cases, five freshness cases, configuration-read failure, in-flight
drift and completed-cache reconciliation. Fixture observation times were
controlled, not a timed heartbeat soak. Health, liveness and readiness returned
200; unauthenticated detailed health returned 401. The compiled System panel
retained its concise information labels.

The authenticated browser showed seven of seven active services healthy, zero
unknown, one disabled and four not configured. Plex and Ollama had actual response
times; no manual provider refresh or settings change was performed. The local
container remains uid/gid 1000, read-only root, 2 GiB memory, no-new-privileges and
PostgreSQL noexec tmpfs. A short sample showed 509.3 MiB, no OOM and zero restarts;
this is not a retained-memory profile.

Read-only before/after counts stayed at 6,837 classifications, ten active/covered
libraries, four unresolved identities (two source review, two retry wait), zero
pending text embeddings and 6,815 pending image embeddings. One existing optional
comparison `cached_vectors_incomplete` warning was present before replacement;
none appeared in the initial new-container sample. This change does not establish
that optional vector coverage or unresolved identities are repaired.

## Recommendation stack and next item

1. Require explicit success: prevents false healthy results, but helpers that
   swallow structured errors can only report a generic connection failure.
2. Use bounded, authenticated read-only probes against current settings: avoids
   stale endpoint tests and paid generation; connectivity still does not prove
   model readiness, full library access or independent credential validity when
   a server permits anonymous access.
3. Keep cloud providers configuration-only: avoids cost and shared-provider load,
   but deliberately leaves authentication/generation unverified. Existing API
   normalization represents configured-only services as degraded, not healthy.
4. Next, audit and bound the remaining Arr/TMDb/OMDb helper transports and their
   response validation, separate from richer settings-page connection tests.
   Their current fan-out and transport behavior were not rewritten in this task.

Ordinary AI/legacy Ollama save handlers already call `resetConfig()`; this work
does not establish a missing same-process save invalidation bug. Any later
cross-process runtime-cache audit should be evidence-led and separate.

GitHub MCP returned zero open PRs on enumeration and recheck. No random open PR
was available, and none was implemented or merged. Remote CI for the final push
is separate evidence from these local checks.
