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
96 episodes in one source group. The final-image run completed with reference
`c37c470c-7750-45f0-a68e-637fc5a36463`: eleven selected source groups, 49 seasons,
834 episodes and fourteen candidate-series comparisons. Of those episodes:

- 795 had a TMDb episode ID present in a candidate series with the same numbering.
- 38 had no TMDb episode ID.
- One TMDb episode ID was absent from the completely enumerated candidate series.
- No matched group spanned multiple candidate series in this sample; no matched
  episode had different numbering. This is not proof against grouped works elsewhere.

A separate bounded read-only database check with the existing wider selection
also returned eleven current conflicts (four libraries, counts 1/2/4/4), so the
four-per-library cap did not exclude another item in that check. This is local
evidence, not a substitute for Unraid's twelve-item list. Source/configuration
rechecks passed. No raw provider IDs, titles, credentials or response bodies are
retained in this report.

The episode matches do not resolve contradictory series IDs. Missing IDs are not
proof that Plex lacks descriptions/artwork; an absent candidate match is not
proof of the correct replacement. No warnings were cleared and no item rematched.

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
The restored client graph also passed npm audit with zero reported advisories.
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
- Full server/client lint, Markdown lint (2,076 files), ESM static-import and
  mock-shape checks passed; staged secret scan found no leaks.
- Scoped coverage: 125 tests, 100% statements/functions/lines and 98.34% branches
  across five comparison/capture modules. These tests overlap the focused run.
- Full frontend run: 449 files and 6,543 tests passed, with no skips; its separate
  test-project configuration check also passed.
- Full backend run: 1,775 suites and 55,434 tests passed. One Linux-only directory
  fsync test was skipped on Windows and exercised in the exact Linux image below.
- Production-name, product-language, delivery-term and runtime-maintenance gates
  passed. The combined coverage ratchet passed using both fresh full reports.
  No test timeout, assertion, install policy or coverage baseline was weakened.

## Exact local image and schema

No-cache Compose build used clean runtime revision
`12853487fc611277c99336eba7ea37dee3218c72`; Docker image ID
`sha256:9ed36309ef6607bce440c5b09edc5667effd7e9a9e06741b613d01c848a17d02`.
This is a local image identity, not a published release or registry verification.
Final outcome documentation is a separate commit from the tested runtime.

Retained a checksum-verified, readable 76,821,667-byte PostgreSQL backup and a
rollback tag for original image
`sha256:08419a88c32223d1c2a6f5216c7c3c1f18a745863a56eca47868e600d5364a70`.
Readability is not a restore rehearsal. Only the local Classifarr test container
was replaced; no shared-provider or production deployment occurred.

The candidate started at `2026-10-10T16:11:03.609280974Z`: healthy, HTTP 200, zero
restarts, no OOM, user `1000:1000`, read-only root, no-new-privileges and unchanged
2 GiB limit. Early usage was 805.6 MiB. This is startup evidence, not a sustained
memory study or a memory fix.
An aggregate read-only database check found no error-log rows since that startup.

The exact-image Linux directory-fsync/exclusive-copy test passed with synthetic
files, network disabled, non-root execution, read-only root and bounded resources.
Source/destination digests matched; a second exclusive copy failed with `EEXIST`
without changing either tree. The disposable test container's absence was verified.

Post-build schema dump ran against a separate fresh database in this exact image:
through `20261010_140000_classification_metadata_failure_context.sql`, with 22 seed
migrations. The tracked snapshot is unchanged. Disposable container
`classifarr-schema-check-4aff7394-f237-46e7-bd13-35ad00da12c3` and its generated
data directory were removed; both absences were independently verified. Live
appdata was not used for schema generation. No release or version bump was made.

## Recommendation stack

1. Use bounded episode membership evidence; advantage: reveals grouping/numbering
   differences with bulk requests. Limitation: exact TMDb membership is not a
   cross-provider consensus or verified viewing order.
2. Next, investigate the 38 missing episode IDs and one unmatched episode using
   bounded, typed independent cross-references, alongside the series conflicts.
   Do not translate an episode match into whole-series identity or ownership.
3. Add authenticated, revision-bound per-item mapping review for confirmed relationships.
   Preserve grouped source items and explicitly exclude ambiguous/missing episodes.
4. Introduce durable scoped edges and scope-aware consumers before activation;
   then backfill eligible records through the existing guarded workflow.

Do not drop conflicting IDs, reset imports or select a whole-series scalar ID
just to clear warnings. Provider polling and retries are not expanded here.
