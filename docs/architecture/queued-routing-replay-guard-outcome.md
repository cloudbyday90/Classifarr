# Queued routing replay guard outcome

## Implemented

See the [design and tradeoffs](queued-routing-replay-guard-design.md).
Queued automatic routing now commits a claim-checked classification reference
before provider work. A retry returns the saved decision without repeating
classification, routing or notifications. Unknown routing remains explicit;
history deletion, configuration changes and expired claims do not reopen the
automatic write. No new background worker or optional AI feature was added.

The additive migration and fresh schema include the marker. The migration was
applied twice to an isolated PostgreSQL 18 database and the generated snapshot
loaded/dumped again with zero drift. No real application database supplied the
snapshot. ES modules separate the routing guard from classification orchestration.

## Verification completed — 2026-10-04

- 291 focused unit tests (14 suites) and 57 isolated PostgreSQL tests (5 suites)
  passed before the final build.
  PostgreSQL covered concurrent admission, claim replacement/expiry, transaction
  rollback, retained markers after history deletion, and saved-success semantics.
- The final-image queue rehearsal observed one accepted add each for movie
  and TV, killed only the app, and let the real queue reclaim both commands after
  restart. It required zero repeated adds, zero replay item reads, unchanged
  classification decisions and one history row per item.
- The provider deliberately hid accepted items from GET results. All attempted
  POSTs were counted, including rejected duplicates. Each fixture deadline was
  advanced only after the original app exited; this is not elapsed-lease evidence.
- The first combined rehearsal failed a later aggregate startup-error assertion.
  Its generic diagnostic did not identify the underlying error. Added bounded
  module/count diagnostics without weakening the zero-error assertion; a repeat
  passed all 12 restricted-runtime phases. This is not a claimed root-cause fix
  for that intermittent failure.
- The repeat also exposed `deferred` instead of `complete` in the separate Unraid
  compatible-vacuum fixture. Its synthetic pressure was exposed to concurrent
  autovacuum between assertions. The fixture now validates, temporarily raises,
  and finally restores its two fresh-schema vacuum thresholds; autovacuum remains
  enabled for admission. Autovacuum interference is a plausible explanation, not
  a captured root cause. Production maintenance policy is unchanged. The final
  image passed the strict completion/cooldown assertions in all three profiles.
- Backend ESLint, TypeScript, Knip, static ESM imports, migration naming, schema
  integrity, copyright and Markdown checks passed. The ownership gate passed
  after explicit review of changed entries; existing unresolved ownership debt
  was not reclassified or bulk-refreshed.

## Exact image and local deployment

- Code revision: `0dee3de88eaafe9cce22065a750abbfa09d23393` on `main`.
- Built with `docker compose build --no-cache --build-arg VCS_REF=<revision> classifarr`.
- Local image ID: `sha256:ea1b0c02e06a0e75cc0165910741a823b3dcae7744eb0c0643f31c2bfd1ab170`.
  Its OCI revision matches the code revision. This is not a registry manifest
  digest, publication or signed provenance. The subsequent documentation-only
  commit changes files excluded from the Docker build context.
- `run-embedded-isolation-drill.mjs --image <immutable-id>` exited zero. All 12
  restricted-runtime phases passed in 96,662 ms, including interrupted queued
  and manual routing, authenticated HTTP routing, backup/restore and recovery.
- Packaged runtime UID 1000, custom UID 2345 and Unraid-style UID 99 profiles
  passed fresh startup, immutable code, bounded maintenance, data-preserving
  restart and unchanged 10-second host-stop timeout checks. Observed stops were
  2,576 / 2,847 / 2,862 ms including verification. Runtime Node exit, database loss
  and forced host kill also passed their nonzero-exit/recovery assertions.
- Cleanup passed. Only the runner's synthetic containers, volumes and image
  aliases were removed; the tested image was retained.
- After the build, `dumpSchema` ran against a fresh isolated database in this
  exact image. Loading that dump into a second isolated database and dumping
  again produced zero drift. The tracked snapshot was unchanged.
- Only local Compose service `classifarr` was replaced, without dependencies,
  rebuilding again or changing Compose settings. Its started image matches the
  tested ID. Node is 24.21.0, PostgreSQL 18.6 and pgvector 0.8.7. The additive
  migration has one recorded receipt; health is connected and unauthenticated
  library access returns HTTP 401.

Observation at 22:36:51 UTC, more than two minutes after container startup:

- Healthy, zero restarts and no OOM flag; no ERROR records for the new container.
  Eight owned ingestion states completed and were updated during this startup.
  No pending or processing queue commands remained.
- Docker sampled 0.65% CPU, 385 MiB / 2 GiB and 40 PIDs. Seven database connections
  were idle. Process inspection showed the supervisor, one application process,
  PostgreSQL and its expected workers/connections. This short sample does not
  prove sustained resource bounds; local Compose still has no CPU or PID cap.
- Two `legacy_owner_unknown` warnings remain for libraries 4 and 5, which retain
  two and six legacy running markers respectively and no ingestion-owner row.
  No takeover or marker reset was attempted. Three other sync warnings report
  conflicting provider IDs: 4, 4 and 2 skipped source-item observations in
  libraries 8, 9 and 10. These are not resolved by this queue-routing change.

No release or live Unraid change is part of this work. Open-PR enumeration
returned an empty list, so no PR was selected, implemented or merged.

## Limits

These are focused tests and a same-image synthetic crash/restart exercise, not
the complete repository test suite, remote CI, an old-published-image upgrade,
native NAS/ARM testing or a sustained resource soak. No frontend behavior changed.
Keeping the old local image provides a rollback artifact, not proof that an old
worker can safely process unresolved marked commands. Existing ingestion ownership
remains a separate issue; sharing a Plex server does not share queue ownership
between independent Classifarr databases.

## Recommendation stack

1. Keep the durable command marker: conservative uncertainty is safer than an
   uncertain repeated write. It is prospective protection for marker-aware workers,
   not a backfill of legacy routing or ingestion ownership.
2. Add bounded, provider-scoped read-only reconciliation using saved identity and
   configuration revision evidence. Resolve uncertainty without another add.
3. Decouple deterministic policy and saved-result queue work from AI availability.
   The current queue requires AI selection even when the operation needs no AI;
   this rehearsal used a synthetic selection and allowed no generation requests.

The recovery and release-evidence skills shaped the fault boundary, isolated data,
attempt counters, explicit deadline disclosure and exact-image verification.
