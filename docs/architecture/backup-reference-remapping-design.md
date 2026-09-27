# Restore reference safety design

Date: 2026-09-26. No release or live restore.

## Findings and scope

Restore allocated new Radarr/Sonarr and label-preset rows without recording their
new IDs. Native destinations, preference-policy links and library-label links
could therefore reference missing or unrelated rows. The snapshot exporter also
omitted `library_arr_mappings`, and library restore discarded its direct routing
fields. A consistent backup alone cannot repair those relationship errors.

Not every identifier is a local database reference. Root-folder and quality-profile
IDs belong to the external provider and must remain unchanged. The schema comment
on `library_policies.source_library_ids` documents provider source-library IDs;
preserve these values rather than guessing a local remapping. This corrects the
previous follow-up's blanket assumption about that field. Runtime producers use
mixed terminology, so changing that identifier contract needs a separate audit.

## Decision

Use small ESM modules for reference validation and destination restoration:

1. Validate known local reference edges and duplicate source IDs before any
   configuration writes, including replace-mode deletion.
2. Obtain destination IDs with `RETURNING`; use only the exact label-preset
   uniqueness key when a preset already exists. Never choose an arbitrary row by
   name, numeric coincidence or provider type alone.
3. Pass separate Radarr and Sonarr maps to direct library routes, library fallback
   mappings and native intent targets. Preserve external provider IDs and settings.
4. Remap learned-preference policy IDs and library-label preset IDs. Validate that
   each preference's policy belongs to its library.
5. Replace destination rows only for restored libraries/intents so retained merge
   rows cannot silently win routing lookup. Missing legacy fallback sections are
   not permission to retain unrelated destination mappings.
   Replace mode clears obsolete Arr links on libraries retained for completed
   history before deleting connections, then reconstructs captured links.
6. Prove changed-ID, collision, merge, replace and rollback behavior with isolated
   PostgreSQL tests before claiming success.

Add `libraryArrMappings` to version 2.0 configuration exports without changing the
REST endpoints. Older files can omit it; direct library fields are restored when
present. Missing referenced parents fail with bounded field-path guidance, not
raw record contents, credentials, URLs or SQL. Restore uses the existing atomic
configuration transaction and reconciliation lifecycle gate; it does not create
a second orchestrator or claim that this gate pauses every application worker.

## Recommendations and tradeoffs

| Approach | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Explicit domain-specific ID maps | No accidental cross-domain bindings; easy to test | Must inventory each reference edge | Implement |
| Reuse original numeric IDs | Small code change | Can bind to unrelated destination rows | Reject |
| Guess connections by names/URLs | May avoid duplicate configurations | Names/URLs are not universal identities | Reject outside existing database uniqueness contracts |
| Fail on missing local parents | Prevents silent partial recovery | Incomplete older/edited backups need correction | Implement with actionable text |
| Full database recovery | Preserves non-configuration state | Needs private backup storage and isolated restore procedures | Follow-up after reference and worker-safety verification |

Recommended stack: **coherent snapshot → preflight → typed ID maps → atomic
configuration writes → existing lifecycle verification → isolated recovery drill**.
Keep existing encryption, authorization and no-routing test boundaries.

## Official research

URLs discovered through search and reviewed on 2026-09-26:

- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html):
  `RETURNING` reports actually inserted/updated rows; `DO NOTHING` does not return
  the conflicting row. Existing preset lookup therefore needs an explicit path.
- [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html):
  foreign keys enforce existence, not the intended identity of a row occupying
  the same number. Polymorphic Radarr/Sonarr references also need typed checks.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification):
  errors should identify the problematic input in text. Report a bounded section,
  row index and field plus corrective guidance through existing error handling.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  future restore progress should expose programmatic status without focus changes.
  No new UI is introduced or accessibility conformance claimed here.

## Limits

This is not a full backup-format validator, user-account restore, arbitrary
historical JSON rewrite or proof of external provider availability. Historical
audit payloads, content-preset snapshots, provider machine identifiers and worker
quiescence need separate recovery coverage. No schema migration, release, live
restore, paid inference or media routing is part of this change.

Merge retains the existing Arr insertion behavior: replay can create additional
connection rows because these tables have no portable uniqueness contract. New
routing references point to the newly inserted rows; this is not whole-restore
idempotence or permission to delete older connections by guessed equivalence.
