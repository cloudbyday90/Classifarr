# Restricted-runtime interrupted routing outcome

Implementation and local validation, 2026-10-04. See the separate
[design and research](restricted-interrupted-routing-design.md).

## Implemented

The existing embedded isolation drill now exercises actual manual movie and TV
routing with a killed restricted application process after each accepted provider
add. Real login, CSRF, queue commands, persisted intent and read-only observation
remain in use. The provider survives application restarts and counts every add
attempt. No production service, permission, schema or saved-template changes.

The fixture initially exposed its own duplicate library-name setup and missing
startup health endpoints. Both were corrected without disabling real constraints
or health checks. Fixed phase/SQLSTATE/count diagnostics omit credentials and raw
exception payloads. Tests cover rejection, state loss, rewritten decisions,
unrecorded observations, cleanup failure, invalid paths and held HTTP responses.
Application dependencies load only after the data probe's isolation guards.
Fixed-port HTTP tests share one suite, use closing connections and bound the
admission wait; this avoids both cross-worker binds and stale keep-alive reuse.

## Verification

- 250 focused unit tests in 12 suites passed, including a two-worker run.
- 27 real PostgreSQL manual-routing integration tests in two suites passed.
- Backend ESLint, TypeScript and Knip passed.
- The development-image interrupted-routing phase passed: two accepted adds,
  zero duplicate attempts, two persisted observations, two preserved cooldowns,
  four item reads and 32 ordinary startup health reads. No deadline advances.
- Migration naming/snapshot integrity, static-import, copyright and Markdown
  checks passed. The ownership review passed with 19 owned, 253 separately
  coordinated and 501 unresolved entries; production compatibility remains false.

## Final artifact

The completed no-cache Compose build uses source
`b5b4aa5c31dc386780958ec8b854ee19421e8e1d` and local image
`sha256:a7bf20245e7097f28842c1aeb7042fe391c474103bbe70c5c1d6bd7bc4589f7e`.
Its OCI revision matches that source. This is a local image ID, not registry
provenance. All 11 restricted-runtime phases passed in 88.1 seconds with
`productionCutover: false`. The existing schema dumper ran against this image's
isolated PostgreSQL 18, then a fresh load/dump round trip produced zero drift;
`database/schema/current.sql` is unchanged. No real installation was dumped.

All three packaged profiles passed: unchanged UID 1000, root provisioning to
UID/GID 2345, and Unraid-style UID 99/GID 100. They retained immutable-code
denials, compatible maintenance workers, clean shutdown/restart and forced-kill
recovery checks. Disposable resources were removed and cleanup verified. These
are Linux Docker profiles, not tests performed on an actual Unraid or Synology NAS.
Later test-only organization changes are excluded from the image by `.dockerignore`;
the packaged application/probe code remains the source revision above.

## Local evaluation

Only the local `classifarr` test container was recreated, starting at
`2026-10-04T21:50:47.960110565Z`, hostname `5e477152a8d7`, using the exact image above.
The previous image is retained as `classifarr-local-rollback:before-interrupted-routing`
(`sha256:05b1bf7d449193b46b3bda11b31d1810086b107d9be44a1cba0f5d8fe1a1180e`);
retention is not a tested rollback. Other local containers remained running.

| Check | Observed result |
| --- | --- |
| Health / unauthenticated libraries | Healthy, database connected / HTTP 401 |
| Node / PostgreSQL / pgvector | 24.21.0 / 18.6 / 0.8.7 |
| First background cycle | All 8 owned ingestion states complete and updated since boot |
| Errors / warnings since boot | 0 errors; 2 existing `legacy_owner_unknown` warnings |
| Settled sample | CPU 0.50%; 405.7 MiB of 2 GiB (19.8%); 44 PIDs |
| Restarts / OOM | 0 / false |
| Database sessions | 5 idle sessions |

CPU briefly reached 41.58% during the startup cycle, then settled. Process inspection
showed the expected supervisor, application and PostgreSQL processes; no persistent
maintenance child. This short observation is not a sustained resource soak. The
local template caps memory but has no explicit CPU or PID cap.

The warnings still concern libraries 4 and 5: two and six legacy running markers,
respectively, without corresponding ingestion ownership rows. No owner, retry
budget, library status or inventory was rewritten to suppress them. Their safe
recovery remains a separate review, not a benefit claimed for this routing test.
Remote CI has not been claimed or verified in this round.

No open PR was available in the repository's current enumeration. No PR was
merged, no release created and no Unraid instance or database modified.

## Scope and next recommendation

This is same-image Linux amd64 restart evidence with synthetic providers, not an
upgrade, native ARM/NAS test, live provider test, resource soak or production
privilege cutover. Recovery observations do not rewrite original routing success.
Legacy ingestion ownership warnings are a different safety boundary.

Next: trace and test automatic-policy/queue interruption at the same accepted-add
boundary. It does not currently use the manual intent persistence callback; that
difference needs its own evidence, not an assumption that this manual test covers
it. Then finish remaining privileged-adapter coverage before proposing production
identity migration. The extended real-image drill gives stronger evidence than
mocks at the cost of runtime and a deliberately narrow synthetic provider model.
