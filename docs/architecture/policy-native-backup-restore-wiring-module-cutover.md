# Policy Native Backup And Restore Wiring Module Cutover

Status: implemented.

## Purpose

Native backup and restore wiring closes the recovery gap for converted policy
intent records. This cutover removes phase-coded architecture naming from the
standing backup/restore record while keeping the existing production services:
`backupService.mjs`, `backupRestore.mjs`, and `backupRestoreTables.mjs`.

No new wrapper service is introduced. The live code already uses durable
backup/restore domain names, so adding another abstraction would make the system
less clear without improving recovery safety.

## Official Guidance Reviewed

- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
  describes backup approaches and the need to understand each technique's
  assumptions.
- [PostgreSQL SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html)
  describes SQL dump backup/restore as recreating database state from generated
  SQL commands.
- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
  documents consistent logical exports, including exports while the database is
  in use.
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  and [SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html)
  define atomic rollback boundaries for recovery operations.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends verification and risk-based change control as part of secure
  software development.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends actionable logging while avoiding unnecessary sensitive payload
  exposure.

## Recommendations

1. Keep the existing backup/restore service names.
   They describe product behavior directly and do not contain roadmap phase
   labels.

2. Rename the standing architecture record.
   The durable doc path should describe the recovery boundary, not the roadmap
   step that introduced it.

3. Keep restore transactional.
   Native policy intent records should restore inside the same transaction as
   the rest of backup restore.

4. Keep restore stats bounded.
   Operators need counts and outcomes, not raw native intent payloads in logs.

5. Hand off to post-upgrade dry-run wiring.
   Backup parity is now established; the next recovery-sensitive boundary is
   dry-run reporting before any apply mode can write native storage.

## Pros And Cons

Pros:

- Removes phase-coded naming from the active backup/restore architecture path.
- Avoids adding an unnecessary wrapper around already durable service names.
- Keeps backup/export, restore remapping, and transactional behavior together.
- Preserves focused recovery coverage.

Cons:

- Adjacent post-upgrade dry-run components still use phase-coded names until
  their own cutovers are completed.
- Historical changelog and roadmap entries still mention the old phase record
  for traceability.

## Final Recommendation Stack

- Backup export:
  `server/src/services/backupService.mjs`
- Transactional restore:
  `server/src/services/backupRestore.mjs`
- Native table restore helpers:
  `server/src/services/backupRestoreTables.mjs`
- Standing architecture record:
  `docs/architecture/policy-native-backup-restore-wiring.md`
- Focused tests:
  `server/src/__tests__/backupService.evidence.test.mjs`
  `server/src/__tests__/services/backupRestoreTables.nativePolicyIntent.test.mjs`
  `server/src/__tests__/integration/backup-lifecycle.test.mjs`

## Implementation Outcome

- Renamed `policy-builder-phase-8r-native-backup-restore-wiring.md` to
  `policy-native-backup-restore-wiring.md`.
- Updated the Phase 8R evidence map to point at the durable architecture path.
- Updated roadmap and upstream storage safety references to use the durable
  architecture path.
- Preserved the existing backup/export and restore service names because they
  are already product-domain names.
- Kept the next handoff focused on post-upgrade dry-run wiring.

## Security Outcome

- Native policy intent recovery remains inside the existing restore transaction.
- Native child rows continue to restore only after policy, library, and native
  intent IDs are remapped.
- Orphaned native rows remain skipped fail-closed.
- Restore stats remain bounded counts rather than raw policy payload logs.
- Backup payloads continue through the existing backup mechanism, including its
  encryption support.

## Validation

```powershell
cd server
node ../scripts/run-jest.mjs --testPathPatterns="backupService.evidence|backupRestoreTables.nativePolicyIntent|backup-lifecycle|policyBuilderPhase8CompletionEvidenceRun|policyNativeStorageTestReset" --no-coverage --runInBand
cd ..
npm run lint:docs
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
git diff --check
```

## Next Step

Proceed to **Post-Upgrade Dry-Run Wiring**. The next component should remove
phase-coded production naming from the post-upgrade dry-run boundary while
preserving the current plan-only, no-apply behavior.
