# Library catalog preservation outcome

Date: 2026-09-27. Release status: Unreleased; no release or deployment in this change.

## Root cause and implemented outcome

Manual discovery used absence from a provider list to delete local libraries,
including related data. Plex's missing-envelope fallback could produce that empty
list without any affirmative source evidence. Scheduled discovery had a separate
merge implementation. Both paths now share a non-deleting merge, bounded catalog
validation and a source-configuration check inside the write transaction.

The administrator selected reversible archiving. A disabled, unobserved library
can be archived after fresh review, ownership checks and stopped-worker attestation.
The database enforces archived-implies-disabled. Returning source IDs do not clear
archives or overwrite their metadata. Restore retains the disabled state. Inventory,
history, policies, mappings and provider media are not deleted by either operation.

## Operator steps

1. Sync Libraries. Unobserved libraries are preserved and linked in the result.
2. Check media-server access/permissions first. A missing library is not proof of deletion.
3. To archive intentionally, open the library, turn off **Library enabled** and save.
4. Open **Review archive status**. Finish/reconcile any blocked import first; stop
   older instances and external writers. Review the library name and preserved count.
5. Confirm **Archive reviewed library**. Keep the audit receipt. If the response is
   lost, use **Check recorded outcome**; do not assume failure or start a new request.
6. To restore, refresh the archive review and confirm **Restore library (keep disabled)**.
   Review its source before separately enabling it. Existing owned ingestion/recovery
   resumes normally; restoration alone does not claim backfill completion.

Archive is not disk reclamation. Existing log retention and manual log cleanup are
unchanged. No live libraries were archived or restored during implementation.

## Verification

Disposable PostgreSQL tests cover all three providers and movie/TV libraries,
first discovery, empty/reduced/returning catalogs, malformed rollback, source edits
during fetch, disabled constraints, concurrent confirmation, active owners, stale
reviews, audit failure rollback, and receipt replay with an offline source.

- Full integration suite: 183 suites and 2,098 tests passed; one existing test skipped.
- Final focused database suite: 18 tests passed, including loading the full schema
  snapshot into a separate empty PostgreSQL container and exercising both the
  archive-disabled constraint and unique receipt index.
- Full frontend coverage run: 400 files and 5,620 tests passed.
- Final memory-bounded backend rerun: all 1,501 suites and 44,988 tests passed.
- Migration freshness and archive authorization rerun: 31 tests passed.
- Coverage ratchet passed. Backend lines/branches: 90.30% / 84.68%; frontend
  lines/branches: 87.89% / 78.37%.
- Frontend production build, both typechecks, lint, dependency checks, ESM static
  import check, migration naming/snapshot integrity, copyright and documentation
  lint passed. Security lint retains one pre-existing non-literal filesystem-path
  warning in `captureOperatorCorrectionFrozenPolicy.mjs`; no new lint errors.
- Inventory ownership gate passed with no new unreviewed drift. This is not a
  claim that the existing unresolved legacy writer paths are production-compatible.

The first backend coverage run caught two schema-freshness assertions: migration
DDL alone was insufficient for fresh installs. The snapshot was corrected using
the migrated disposable database definitions, and the fresh-install test above
now protects that path. No production database was used to generate or verify it.

Use `npm --prefix server run test:unit` for the full backend rerun: its two workers
recycle at the configured memory bound. A single-process full-suite attempt in this
work exhausted the test runner's heap; targeted `--runInBand` checks remain suitable
for small test selections. The application container was unaffected.

## PR request

GitHub MCP search for open PRs in `cloudbyday90/Classifarr` returned none. No random
PR could be selected; no closed/unrelated PR was substituted and no PR was merged.

## Recommendation stack and next item

1. Keep additive discovery and bounded fail-closed provider validation.
2. Keep reversible administrator archive with exact review, owner coordination and
   transactional receipts. Benefit: recoverability; cost: retained storage/manual review.
3. Keep existing ESM/Express/PostgreSQL and Vue/non-persistent SWR architecture.
   Benefit: fewer moving parts; cost: explicit provider-contract maintenance.
4. Next: provider-specific catalog compatibility fixtures, starting with current
   Emby's paginated `VirtualFolders/Query` response. Test current and legacy versions
   before changing endpoints. Do not infer identical Emby and Jellyfin APIs.

Research, alternatives, source links, limits and concurrency rationale are in
[the design document](library-catalog-preservation-design.md).
