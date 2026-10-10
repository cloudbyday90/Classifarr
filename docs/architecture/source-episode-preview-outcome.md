# Episode catalog preview outcome

## Scope — 2026-10-10

Implemented the explicit read-only `--episode-preview` diagnostic described in
[the design](source-episode-preview-design.md). Small ESM services handle catalog
transport, validation and comparison; the existing orchestrator owns source and
database rechecks. No schema, scheduling, identity, routing or recovery writes.
The recovery-change skill drove bounded reads, failure tests and unchanged guards.

## Current observations

At 12:02:59 Eastern, refreshing Unraid's visible metadata diagnostics still showed
12 unresolved items: ten needing source review and two waiting for automatic
retry. All ten active libraries had recent complete full scans. This is not
evidence of missing artwork/descriptions, and a complete scan is not an identity
verification. No Unraid/provider changes were made.

The first local read-only probe found all three external-ID families on all
96 episodes in one source group. That justified exact episode-ID analysis, not
automatic mapping. Final-image aggregate findings and full verification are
pending below; this document does not yet claim completed validation.

## Random open PR trial

Randomly selected [PR #555](https://github.com/cloudbyday90/Classifarr/pull/555),
head `4cbffcb7dd726af152382a1f92edb9dc326fe349`, from the two open PRs (#555/#556).
Applied its exact client manifest/lockfile diff locally: Node types 24.19.2 →
26.6.4 and undici-types 7.24.6 → 8.9.0. Registry integrity matched both artifacts;
no new lifecycle scripts. Reviewed install, dependency-tree and client type checks
passed; the full-scope npm audit reported zero advisories.

The tooling suite rejected the Node 26 declarations (39 passed, one failed):
`client/ Node declarations stay on the deployed runtime major`. Restored the
original manifest/lockfile and installed tree; all forty tooling tests passed.
No PR merge, package update, engine-policy relaxation or release resulted.

The version alignment offers accurate deployed APIs; the cost is deferring newer
Node-only types until a separate runtime migration. The dependency-update skill
required the before/after install and compatibility checks.

## Verification

- Focused unit/real HTTP: seven suites, 177 tests passed.
- Isolated PostgreSQL: two suites, 23 tests passed, including unchanged retained
  observations and invalidation after actual configuration/enablement changes.
- Preflight (copyright, ownership and dependency checks) and both type checks
  passed. No ownership baseline changes were needed.
- Full suites, final image, schema dump and cleanup: pending.

## Recommendation stack

1. Use bounded episode membership evidence; advantage: reveals grouping/numbering
   differences with bulk requests. Limitation: exact TMDb membership is not a
   cross-provider consensus or verified viewing order.
2. Add authenticated, revision-bound mapping review for confirmed relationships.
   Preserve grouped source items and explicitly exclude ambiguous/missing episodes.
3. Introduce durable scoped edges and scope-aware consumers before activation;
   then backfill eligible records through the existing guarded workflow.

Do not drop conflicting IDs, reset imports or select a whole-series scalar ID
just to clear warnings. Provider polling and retries are not expanded here.
