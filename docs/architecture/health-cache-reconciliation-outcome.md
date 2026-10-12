# Completed health-cache reconciliation: outcome

Date: 2026-10-12. See the separate
[design, alternatives and official research](health-cache-reconciliation-design.md).

## Delivered

Accepted configuration-dependent health observations now retain a private digest
and read callback. While the heartbeat is running, a bounded background cycle
re-reads committed settings, including changes made by another process. A changed
or unreadable configuration invalidates that service and the aggregate cache. Old
instance details are removed; check and last-success times remain historical.

At most two reconciliation reads run concurrently. The next cycle starts 30
seconds after the previous one settles, not on a catch-up interval. No provider
probe, database write, immediate retry or new connection listener is introduced.
An invalidation fences an already-running probe without releasing its admission
early. A slow old reconciliation cannot replace a newer accepted result. Reset
fences old work; stop prevents future cycles. All new runtime code is ESM.

Authentication, readiness, memory safeguards and provider timeouts are unchanged.
There is no schema change or dependency update. This is eventual content comparison,
not an atomic revision/lease: query latency adds delay, A-to-B-to-A changes between
reads are not detected, and a commit after the read remains possible. Whole selected
rows are deliberately still compared, so unrelated counters can invalidate results.

## Verification

- Focused backend: 258 tests passed. Cases include changed/empty/disabled/deleted
  configuration, safe read failures, bounded concurrency, reset, concurrent Refresh,
  stale-result races and timer stop/restart without additional provider traffic.
- Checked-in PostgreSQL integration suite: three tests passed using separate
  connections in an isolated test database. Uncommitted changes and rollback retain
  the accepted result; committed endpoint/disable/delete changes invalidate it.
- Full backend coverage: 1,808 suites, 56,777 passed and one skipped in 1,113.752
  seconds. Statements/lines 89.75%, branches 86.23%, functions 91.18%. The private
  guard and scheduler have 100% coverage in all metrics; coordinator statements,
  lines and functions are 100%, with 97.5% branches.
- Full frontend coverage on the final UI source: 468 files / 7,180 tests passed in
  363.73 seconds. Statements 87.60%, branches 81.55%, functions 87.28%, lines 89.31%.
  The combined coverage ratchet passed without baseline changes.
- Backend/frontend lint and type checks, backend full/production dependency
  analysis, static imports, npm CLI policy, ownership, copyright and Markdown
  gates passed. No ownership digest or review baseline was changed.
- Frontend runner configuration: 12 tests passed. Chromium: two responsive
  System checks and eight production-route asset checks passed.

An earlier full frontend run hit the existing ESLint setup hook's 10-second
deadline under concurrent work; its assertions were not failing. A diagnostic
retry was stopped when the user requested the UI edit. The final full run passed
after the backend coverage run ended. No timeout, assertion or coverage gate was
relaxed. This observation does not establish the exact cause of the earlier delay.
The first backend-image build also hit an Alpine DNS failure; the same command
was retried successfully without changing DNS, image or security configuration.

## Image evidence

Started on clean main at `d597426caaa9ffa7fd3bc0179676884b9d82f7a2`.
Backend implementation is `be2bf2371c5a63d78e4847e426831857d2240aa0`.
Final clean runtime/UI source is `e50019ffb540bc7a1a830000e5845cfecb529974`.
The final no-cache Compose build used `--require-provenance`, Linux/amd64 and AVX2.
Its local Docker image ID is
`sha256:67dfdb5435d097f00d841e75fd04fc48ae1c8f4d9c55b647a47e3bae4e9a85d8`.
This identifies the tested local image, not a published registry manifest or
signed multi-platform attestation. Outcome-document edits do not alter runtime.

A fresh 76,000,949-byte local database backup passed checksum and archive-list
verification before the final container replacement. This is not a full restore
rehearsal. The prior local image was retained for rollback. No release, tag,
version bump, new branch or Unraid/Plex/shared Ollama change is part of this work.

### Final-image and database results

The local container was recreated at 21:30:35 UTC and is healthy. Its image ID
matches the build above, and all twelve checked backend runtime source files match
the checkout byte for byte. Packaged code passed six aggregate cases, five synthetic
freshness HTTP cases, a configuration-read failure, concurrent configuration drift,
and completed-cache reconciliation through the actual route. Controlled observation
times are fixture time, not a timed heartbeat soak. Actual health/liveness/readiness
returned 200; unauthenticated detailed health returned 401. The compiled System
bundle contains the concise information labels and mismatch warning.

After rebuilding, `dumpSchema` ran against an owned network-isolated synthetic
container with 1 GiB memory, two CPUs, 256 PIDs and no published ports. The dump
produced no schema diff, includes migrations through
`20261010_220000_source_catalog_mappings.sql` and includes 22 seed migrations. Five
actual PostgreSQL configuration-read checks and six cross-connection drift/cache
checks passed. Only a synthetic fixture table was written after the dump; probes
made no external provider calls or application-data writes. The owned disposable
container and data directory were verified removed; these fixtures are reproducible.

The local application retains uid/gid 1000, read-only root, a 2 GiB memory limit,
no-new-privileges and PostgreSQL noexec tmpfs. The startup report matches database
startup; a separate diagnostic process correctly identifies it as another process's
report. Read-only before/after counts remain 6,837 classifications, ten active and
covered libraries, four unresolved identities (two source review, two retry wait),
zero pending text embeddings and 6,815 pending image embeddings. No startup warnings
were present in the final sample. Normal application startup jobs remained enabled.
The short post-start sample was 833.9 MiB / 2 GiB, no OOM termination and no restarts;
this is not a retained-memory profile or evidence that earlier memory issues are fixed.

## Recommendation stack and next item

1. Keep bounded background reconciliation: all existing configuration writers are
   covered without schema/privilege changes or provider traffic; accept eventual
   visibility and a small read cost.
2. Keep safe unknown states and fenced publication: do not show stale results as
   current; explicit Refresh or the next ordinary heartbeat obtains fresh health.
3. Next: audit each check's exact configuration dependencies. Exclude incidental
   usage counters only after proving all transport-affecting inputs remain covered.
   Consider durable revisions/notifications only if measured latency or read cost
   warrants the extra migrations, listener lifecycle and reconnect handling.

GitHub MCP found zero open PRs on admission and recheck. No random PR was available
and none was merged. The prior head's seven workflows passed; that is baseline
evidence, not remote CI proof for this new change.
