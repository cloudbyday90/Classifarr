# Policy Native Backup And Restore Wiring

Status: implemented as the native storage backup/restore recovery boundary.

## Problem

Native intent storage now has SQL migration coverage, but backup and restore
were still legacy-policy only. That created a concrete recovery gap: converted
policy intent could exist in native tables, while exported backups would only
preserve `library_policies` and other legacy configuration tables.

This component wires native intent tables into the real backup and transactional
restore path without enabling automatic native conversion apply.

## Official Guidance Reviewed

- [PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)
  and [SQL dump backup guidance](https://www.postgresql.org/docs/current/backup-dump.html)
  describe logical backup and restore as explicit recovery mechanisms. This
  component applies that principle by making every native intent table part of the
  application backup payload.
- [PostgreSQL transaction documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  and [`SAVEPOINT`](https://www.postgresql.org/docs/current/sql-savepoint.html)
  document atomic recovery boundaries. Classifarr already restores inside
  `db.withTransaction`; this component keeps native intent restore inside that
  same transaction instead of adding a separate partial-write path.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends secure development practices that include verification and
  risk-based change control. This component adds focused tests for native table
  export and restore remapping.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  emphasizes actionable, security-aware operational logging. This component
  returns bounded restore stats for native intent rows so operators can see what
  was recovered without dumping raw intent payloads into logs.

## Recommendations

1. **Export every native intent table.**
   Backups now include native intent headers, rules, routing targets,
   starter-template provenance, migration events, rollback snapshots, and
   validation status.

2. **Restore by remapping durable parents.**
   Restore maps old library IDs and policy IDs to restored IDs, then maps old
   native intent IDs to restored native intent IDs before child rows are
   inserted.

3. **Keep restore transactional.**
   Native intent restore runs inside the existing backup restore transaction so
   failed restore cannot leave a partial native/legacy split.

4. **Skip orphaned native rows.**
   Native rows whose restored parent policy, library, or intent is unavailable
   are skipped rather than attached to stale IDs.

5. **Do not enable conversion apply here.**
   This component makes recovery safe. Automatic post-upgrade conversion apply
   remains gated by dry-run, validation, rollback, and operator approval.

## Pros And Cons

Pros:

- Closes the most immediate native-storage recovery gap.
- Preserves native policy intent through existing backup/export flows.
- Restores native records with remapped IDs instead of stale foreign keys.
- Keeps restore atomic by using the existing transaction wrapper.
- Adds focused regression coverage for export and native row restoration.

Cons:

- Merge-mode restore intentionally skips rows whose parent mapping is missing.
- Automatic post-upgrade conversion apply remains blocked.
- Existing backup payloads created before this change do not contain native
  intent data and therefore cannot restore it.

## Final Recommendation Stack

- Backup export:
  `server/src/services/backupService.mjs`
- Transactional restore:
  `server/src/services/backupRestore.mjs`
- Native table restore helpers:
  `server/src/services/backupRestoreTables.mjs`
- Focused tests:
  `server/src/__tests__/backupService.evidence.test.mjs`
  `server/src/__tests__/services/backupRestoreTables.nativePolicyIntent.test.mjs`
  `server/src/__tests__/integration/backup-lifecycle.test.mjs`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Outcome

Backup export now includes:

- `policyIntents`
- `policyIntentRules`
- `policyIntentRoutingTargets`
- `policyIntentTemplateApplications`
- `policyIntentMigrationEvents`
- `policyIntentRollbackSnapshots`
- `policyIntentValidationStatus`

Restore now:

- clears native intent tables during replace mode before legacy policy rows are
  cleared,
- restores `library_policies` with an old-policy-ID to new-policy-ID map,
- restores native intent headers after policy and library IDs are remapped,
- restores native child rows after native intent IDs are remapped,
- preserves migration events and rollback snapshots through remapped policy and
  intent references,
- returns bounded native restore counts in restore stats.

## Security Outcome

- Recovery is fail-closed for rows with missing restored parents.
- Native restore remains inside the existing transaction boundary.
- User foreign-key references from native intent actor fields are not restored
  as hard dependencies; the policy intent recovery path prioritizes policy,
  library, migration, rollback, and validation data.
- Raw native intent payloads are exported only through the existing backup
  mechanism, which defaults to encrypted backup creation.
- Restore stats are bounded counts, not raw policy payload logs.

## Next Step

Proceed to **Post-Upgrade Dry-Run Wiring**. That task should connect the
candidate report and explicit conversion workflow to a post-upgrade dry-run
action that reports readiness and blockers without applying conversion.
