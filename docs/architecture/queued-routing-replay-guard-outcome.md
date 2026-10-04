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

## Verification in progress

- 291 focused unit tests (14 suites) and 57 isolated PostgreSQL tests (5 suites)
  passed before the final build.
  PostgreSQL covered concurrent admission, claim replacement/expiry, transaction
  rollback, retained markers after history deletion, and saved-success semantics.
- The development-image queue rehearsal observed one accepted add each for movie
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
  enabled for admission. Production maintenance policy is unchanged. Final-image
  verification must still pass the strict completion/cooldown assertions.

Final immutable-image, saved-template, schema-after-build and local observation
results will be recorded here after completion. No release or live Unraid change
is part of this work. No open PR was available in the repository's enumeration,
so no PR was selected or merged.

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
