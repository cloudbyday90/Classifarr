# Configuration backup consistency outcome

Date: 2026-09-26. No release, deployment or live restore.

## Result

Configuration exports now collect all 31 configuration sections and both optional
evidence sections on one bounded, read-only PostgreSQL snapshot. Collection,
commit and file creation remain separate: a failed capture cannot publish a
partial configuration backup. Encryption, password exclusion, version 2.0 and
`includePatterns` behavior are preserved.

The query catalog and snapshot orchestration are small ES modules; the existing
backup service retains file handling, encryption and restore lifecycle ownership.
No new dependency, migration, endpoint or client contract was introduced.

## Demonstrated restore defect and fix

The first real-database canary failed with
`libraries_media_server_id_fkey`: restore allocated a new media-server ID but
inserted the library using the old ID. If that old ID belonged to another server,
the same bug could silently reconnect the library to the wrong source.

Restore now passes a source-to-destination server-ID map into library restoration.
An exact existing legacy uniqueness-key match retains its credentials and maps to
its current ID. Missing and duplicate source server references fail validation;
they do not fall back to destination IDs or guessed names. Transaction failure
rolls back configuration changes and leaves existing reconciliation gates closed.

If restore reports a missing media server, use a complete export containing that
server. Investigate edited or incomplete files in an isolated instance; do not
patch source IDs to whatever numeric IDs happen to exist in the live database.

## Verified boundaries

Six new real-PostgreSQL cases run only against disposable integration databases:

- A separate writer commits library, policy and evidence updates during export.
  Export retains the original generation in both optional evidence sections.
- A write attempted inside capture is rejected by PostgreSQL; the next export
  succeeds after rollback.
- Movie/TV library, server, policy, learned-pattern and classification-evidence
  relationships survive changed IDs in merge mode, including an unrelated server
  occupying the source ID and an already-existing server uniqueness-key match.
- Replace mode also reconstructs those relationships with new IDs.

The canary uses production export and table-restore functions, not mocked query
results. It does not launch the application, invoke providers, run AI or authorize
routing. Existing lifecycle/API tests cover encrypted files and native-intent
restore gates; the new canary is not an exhaustive restoration certificate.

Unit tests check transaction configuration, shared-client propagation, selected
user fields, singleton shapes, optional evidence omission, query/evidence/commit
failures, rollback/release, no file publication on capture failure, ID mapping and
closed reconciliation after a missing-reference failure.

Run targeted checks from `server/`:

```powershell
node scripts/run-jest.mjs --testPathPatterns='backup|databaseTransaction|codeHealth' --runInBand --no-coverage
node scripts/run-jest.mjs -c jest.integration.config.mjs --testPathPatterns=backup --runInBand --no-coverage
```

## Final validation

- Full backend unit coverage run: **43,506 tests, 1,462 suites passed**.
- Full frontend coverage run: **5,410 tests, 386 files passed**.
- Targeted PostgreSQL backup integration: **59 tests, three suites passed**,
  including the six new canary cases. The full integration collection was not run.
- Focused coverage for the two new export modules: **100% statements, lines,
  branches and functions** across 52 tests. These tests overlap the full unit run;
  their counts are not additional independent cases.
- Coverage ratchet passed using fresh backend and frontend reports. Backend
  coverage is 90.39% lines / 84.45% branches; frontend is 87.85% / 78.07%.
- Backend/frontend type checks, frontend production build, backend lint, normal
  and production dependency checks, ESM import/mock checks, copyright, Markdown
  and diff checks passed. Backend lint retains the pre-existing nonliteral-path
  warning in `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was added.

The first broad run caught unsafe mock-reset setup in a new test. It was corrected
before the final full run above. Baselines and quality thresholds were not lowered.

## PR and operational disposition

GitHub MCP returned no open PRs for `cloudbyday90/Classifarr` on both checks this
turn. No random open PR was available; no closed or unrelated PR was substituted
and none was merged.

The production container, persistent database, routing settings and background
jobs were untouched. No tag, version bump, release or application-container
rebuild belongs to this change.

## Recommendation stack and next concrete item

Adopt **consistent configuration snapshot → explicit restore-ID mapping →
disposable recovery canary → separately verified full-database recovery**. The
[design](backup-snapshot-consistency-design.md) records official PostgreSQL/W3C
research, pros and cons, timeout choices and the backup coverage matrix.

Next: complete a **restore-reference preflight and remapping audit** before
claiming full configuration recovery. Current table restore code still copies
some references without source-to-destination translation, including native
`arr_config_id`, policy `source_library_ids`, learned-preference `policy_id` and
label `label_preset_id`. Test those with deliberately different destination IDs,
define missing-reference behavior, and verify the restored routing configuration
before opening lifecycle gates. Also examine provider `client_identifier`, which
the existing export omits. These are pre-existing limitations, not fixed or
certified by the server/library canary.

Then rehearse an encrypted full-database backup and isolated restore, including
evaluation evidence and external artifacts that configuration JSON does not
cover. Keep scheduled maintenance conservative; no automatic `VACUUM FULL`,
blanket deletion or replay of old operational leases is part of this work.
