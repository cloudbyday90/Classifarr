# Episode gap cross-reference outcome

## Scope — 2026-10-10

Implemented [the design](episode-gap-cross-reference-design.md) as two small ESM
services behind `--episode-cross-references` in the existing read-only replay CLI.
Source capture, catalog comparison and selection rechecks remain shared. No new
database relations, background jobs, provider writes or mapping activation.
The recovery-change skill required bounded reads and explicit invalidation tests.

Unraid's read-only list refreshed at 12:55:39 Eastern still showed 12 unresolved
items: ten needing source review and two waiting for automatic retry. All ten
active libraries had recent complete captures; no ownership issue was reported.
Descriptive metadata in Plex does not settle conflicting external identifiers.
No source edits, retry actions or production deployment were performed.

The local database read at 17:02:45 UTC returned eleven current unresolved items:
nine TVDB conflicts marked insufficient evidence and two TMDb conflicts with
inconclusive external evidence. Nine needed source review and two were waiting
for retry. This is a different database from Unraid's twelve-item population.

## Exact-image findings

The new diagnostic completed with reference
`652c7b6d-4c93-4897-87bf-d1a1217d5a98`: eleven stable source groups, 49 seasons,
834 episodes and fourteen candidate series. Source/configuration rechecks passed;
no group hit a request limit or provider failure.

- 795 episode IDs remained present in candidate catalogs with the same numbering.
- 38 episodes lacked all three supported external-ID families in the source
  capture, so there was no declared IMDb/TVDB ID to look up.
- The remaining episode's one declared external reference produced no typed
  episode match in TMDb. Its existing TMDb ID was absent from the candidate series.
- Exactly one gap lookup was needed. No title search, missing-ID guess, mapping
  write or warning clearance followed. All activation/verification flags stayed false.

A supplementary read-only three-episode Plex detail sample also found no external
IDs or descriptions, but artwork on all three. Fresh source/configuration checks
passed. An earlier unavailable sample was discarded; its cause was not established.
This bounded sample rules out a bulk-listing omission for those three records,
not for all 38 or every Unraid item. Artwork alone is not identity evidence.

These episode results do not repair the conflicting parent-series declarations.
The missing evidence must remain visible and excluded from any future verified
mapping scope; changing the warning count is not the completion condition.

## Random open PR trial

Fresh MCP enumeration returned two open PRs, #555 and #556. Random selection chose
[PR #556](https://github.com/cloudbyday90/Classifarr/pull/556), immutable head
`a62b4d210fda8579fa961a5da3d6a7b6e3d7b888`. Applied its exact server manifest and
lockfile diff locally: Node types 24.19.2 → 26.6.4, undici-types 7.24.6 → 8.9.0.

The script-disabled install and npm audit passed with zero reported advisories.
Type checking failed in `discordDeliveryWriter.mjs`: Discord's Undici `BodyInit`
and `FormData` types are incompatible with the proposed declarations. The tooling
suite had 39 passes and one runtime-major alignment failure. A direct test-file
invocation initially lacked npm's required runner environment; rerunning through
the documented `npm run test:tooling:dependencies` produced that meaningful result.

Restored the exact original manifest/lockfile and performed the reviewed normal
install. Type checking and all forty tooling tests then passed, with zero npm
advisories. No dependency changes or weakened type/runtime checks were retained;
the PR remains unmerged. The dependency-update skill kept this trial separate
from runtime migration and required before/after verification.

## Verification and local image

Focused unit/real-HTTP run: seven suites, 221 tests passed. A separate scoped run
covered both new services with 43 tests and 100% statement, branch, function and
line coverage. Those tests overlap the focused run. Isolated PostgreSQL: two
suites, 25 tests passed, including retained observation preservation and actual
configuration drift. Preflight, ESM import/mock-shape checks, four policy gates
and Markdown lint (2,078 files) passed without baseline changes.

Both workspace type checks and full server/client lint passed. The full frontend
run passed 449 files and 6,543 tests with no skips, plus its test-project
configuration check. The full backend run passed 1,776 suites and 55,509 tests
in 948.9 seconds. One Linux-only directory-fsync test was skipped on Windows;
the exact-image fixture below exercised that behavior. No assertion, timeout,
security policy, ownership baseline or coverage threshold was relaxed.
The combined coverage ratchet passed using both fresh full reports. Staged
secret scanning found no leaks.

The local no-cache Compose build used clean runtime revision
`0b1af2a25347b01a6f449ad7abb1ea0b8383cea2`; local Docker image ID
`sha256:823c954b1819dc4a6d380774983baf61767bf6a7546379f2ef1ce1d5ef6af7fd`.
This is not a published multi-platform release or registry-verification claim.
Final outcome documentation is a separate commit from that runtime source.

Before replacement, retained a checksum-verified, readable 76,829,225-byte database
backup and rollback tag for image
`sha256:9ed36309ef6607bce440c5b09edc5667effd7e9a9e06741b613d01c848a17d02`.
Readability is not a restore rehearsal. Only the local Classifarr test container
was replaced, starting at `2026-10-10T17:04:22.681457362Z`: healthy, HTTP 200,
zero restarts, no OOM, user `1000:1000`, read-only root, no-new-privileges and
unchanged 2 GiB limit. Early usage was 375.3 MiB; this is not sustained memory evidence.
The read-only startup-window error-log query returned no rows.

The exact-image Linux directory-fsync/exclusive-copy fixture passed with networking
disabled and bounded non-root resources. Its disposable container was removed.
The post-build schema dump used a separate fresh database in that same image,
through `20261010_140000_classification_metadata_failure_context.sql` and 22 seeds.
The tracked schema is unchanged. Disposable container
`classifarr-schema-check-d0b19709-7c53-402f-8b0f-a5a7b363d337` and its generated
data directory were removed; both absences were independently checked. No live
appdata was used to generate the schema. Image-rehearsal guidance kept source,
artifact and startup evidence distinct from release or memory-soak claims.

## Recommendation stack

1. Retain bounded exact-ID diagnosis. It is reproducible and non-mutating, but
   TMDb's cross-reference index can be incomplete and is not independent IMDb/TVDB
   verification. Keep descriptive metadata and identity assurance distinct.
2. Next, implement authenticated, revision-bound review of explicitly scoped
   source-to-catalog mappings, carrying unresolved episode exclusions and the
   parent-series conflicts into the preview. Preserve Plex grouping across all
   libraries; do not infer whole-series consent from matching episodes. Direct
   detail review can investigate the remaining unsampled gaps without guessing IDs.
3. Implement scope-aware consumers before activating mappings, then use the
   existing guarded backfill. No reset, memory-policy change or release here.
