# Released-schema replay gate — outcome

## Delivered

- Added an ESM, disposable release-to-current schema replay command and a
  shared pinned-release schema reader; the existing profile-upgrade rehearsal
  continues to use the same checked baseline.
- Required the full release tag history in the database CI job and ran the
  replay after its integration suite. The command does not deploy or publish.
- Reconciled the current snapshot's two policy-change review-history primary
  key names with the migration-produced names. Its schema drift check and the
  47-migration released-schema replay now agree.
- Added tests for the pin, isolation boundary, narrow dump normalization, and
  detection of altered constraints.

## Verification and limits

Local replay result: 47 post-release migrations applied; 269 migration ledger
entries checked in each disposable database; full catalogs matched. The
rebuilt-image fresh-snapshot check passed. No live Classifarr container,
persistent database, or routing setting was changed. `pg_dump --schema-only`
checks schema, not data backfills or classifier quality. The existing
synthetic profile-upgrade rehearsal remains the behavioral check.

The backend CI suite passed 1,397 suites and 40,924 tests. The database
integration suite passed 149 suites and 1,718 tests (one suite/test skipped).
Server lint, typecheck, migration naming, dependency-use checks, copyright,
diff whitespace, and the coverage ratchet passed.

The open-PR search for `cloudbyday90/Classifarr` returned no open pull
requests, so there was no PR to select, copy, merge, or test locally.

## Next high-value item

Add a release-gated, mixed movie/TV upgrade canary using synthetic library
inventories and a held-out, operator-corrected evaluation set. Report profile
refresh completion and classification quality separately from worker liveness;
do not grant automatic routing from the benchmark alone. This closes the gap
left by structural and behavioral migration checks without requiring more
operator acknowledgements.
