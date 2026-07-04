# Policy Builder Phase 8R Backup, Restore, And Post-Upgrade Safety

Status: implemented as the eighth Phase 8R storage-migration component.

## Problem

Native policy intent storage cannot become the default durable model until the
operational path is safe. The risk is not only data loss. A failed post-upgrade
conversion could leave a policy split between native intent records and legacy
preset/custom-signal behavior, which would be harder to recover than either
model alone.

Phase 8R.8 defines a side-effect-free safety contract that answers:

```text
Are native intent records covered by backup/restore, can restored data prove
rollback and migration history, and can post-upgrade apply fail atomically?
```

This component does not run backup, restore, schema migration, or post-upgrade
apply. It defines the required operational proof before later implementation can
enable apply mode.

## Official Guidance Reviewed

- [PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)
  and [SQL dump backup guidance](https://www.postgresql.org/docs/current/backup-dump.html)
  describe portable logical dumps and restore workflows. Phase 8R.8 applies
  this by requiring every native intent table to be explicitly included in
  backup and restore coverage.
- [PostgreSQL transaction documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  and [`BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html) /
  [`ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html)
  define transaction boundaries and rollback behavior. Phase 8R.8 therefore
  requires post-upgrade apply to be atomic, rollback on failure, retain legacy
  behavior until commit, and prevent mixed partial writes.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  recommends contingency planning, recovery strategy, and testing. Phase 8R.8
  turns backup/restore into a testable recovery contract instead of assuming
  backups are useful because files exist.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign) emphasizes
  secure-by-default outcomes and transparent upgrade paths. Phase 8R.8 applies
  this by requiring dry-run reporting and clear operator-facing migration errors
  before apply mode.

## Recommendations

1. **Treat backup coverage as an allow-list.**
   Native tables must be enumerated from the native schema contract and each
   table must be present in both backup and restore coverage.

2. **Validate more than row restoration.**
   Restore must prove native policy recovery, rollback snapshot recovery,
   migration event recovery, and schema version recovery.

3. **Require fresh/upgraded schema parity.**
   Fresh-install and upgraded-install schema versions and checksums must match
   before native storage can become default.

4. **Make post-upgrade apply dry-run first.**
   Post-upgrade apply must be blocked unless a current dry-run report exists.

5. **Make apply mode atomic.**
   Native conversion apply must run within a transaction boundary that rolls
   back on failure, keeps legacy behavior active until commit, and prevents
   mixed partial native/legacy writes.

6. **Use operator-facing error IDs.**
   Schema mismatch, backup/restore gaps, dry-run-required state, rolled-back
   apply failures, and mixed-write blocks must be exposed as clear error IDs.

7. **Keep this safety contract side-effect-free.**
   This component defines and validates safety. Live backup/restore wiring is
   implemented separately, while post-upgrade conversion apply remains gated.

## Pros And Cons

Pros:

- Prevents native storage from becoming default before recovery is proven.
- Makes backup/restore coverage explicit and testable.
- Requires rollback snapshots and migration events to survive restore.
- Blocks post-upgrade apply unless dry-run and transactional guarantees exist.
- Gives operators clear failure categories instead of generic migration errors.
- Preserves the Phase 8R policy of shrinking compatibility without creating
  permanent dual models.

Cons:

- The safety contract itself remains plan-only; operators still need the live
  backup service for actual export/restore.
- Keeps post-upgrade conversion apply blocked until transaction and
  operator-error coverage is intentionally supplied.

## Final Recommendation Stack

- Server module:
  `server/src/services/policyBuilderPhase8BackupRestoreSafety.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase8BackupRestoreSafety.test.mjs`
- Native schema input:
  `server/src/services/policyNativeSchemaContract.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-8r-backup-restore-post-upgrade-safety.md`
- Live backup/restore wiring:
  `docs/architecture/policy-builder-phase-8r-native-backup-restore-wiring.md`
- Roadmap owner:
  Phase 8R.8 in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- backup/restore mode IDs,
- restore validation IDs,
- post-upgrade operator error IDs,
- operational safety status IDs,
- validation risk IDs,
- a backup/restore/post-upgrade safety plan builder,
- a plan validator,
- an audit summary builder.

Default status is `blocked_by_schema_mismatch` because fresh/upgraded schema
parity and backup/restore coverage are not assumed. A plan becomes
`ready_for_operational_apply` only when:

- the native schema contract validates,
- fresh-install and upgraded-install schema versions match,
- optional schema checksums match when supplied,
- every native intent table is covered by backup and restore,
- native policy recovery, rollback snapshot restore, migration event restore,
  and schema-version restore validations are supplied,
- post-upgrade dry-run reporting is current,
- apply mode is atomic and rolls back on failure,
- legacy behavior remains active until commit,
- mixed partial writes are prevented,
- all operator-facing migration error IDs are present,
- this planning slice performs no backup, restore, post-upgrade, or schema
  mutation side effects.

## Security Outcome

- Backup/restore readiness is fail-closed.
- Native intent tables are allow-listed from the native schema contract.
- Restore validation covers rollback and migration history, not just current
  policy rows.
- Post-upgrade apply cannot skip dry-run reporting.
- Transaction safety blocks mixed partial native/legacy writes.
- Operator-facing errors are explicit and bounded.
- The contract validates that Phase 8R.8 performs no operational mutation.

## Live Wiring Outcome

Native intent tables are now included in the real backup/export and
transactional restore flow. The implementation is documented in
[Policy Builder Phase 8R Native Backup And Restore Wiring](policy-builder-phase-8r-native-backup-restore-wiring.md).

Live backup export includes native intent headers, rules, routing targets,
starter-template provenance, migration events, rollback snapshots, and
validation status. Restore remaps old policy, library, and native intent IDs
before restoring native child rows, and returns bounded native restore counts.

## Next Step

Proceed to **Phase 8R Post-Upgrade Dry-Run Wiring**. Native backup/restore is
now live; the next operational gap is connecting the candidate report and
explicit conversion workflow to a post-upgrade dry-run action that reports
readiness and blockers without applying conversion.
