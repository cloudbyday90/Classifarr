# Policy Native SQL Migration Coverage Module Cutover

Status: implemented July 4, 2026.

## Problem

The native SQL migration coverage contract already proved the native policy
intent migration against the native schema contract, but the production module,
focused test, contract version, and handoff still used phase-coded names. That
made a durable storage verifier look like temporary roadmap scaffolding.

## Official Guidance Reviewed

- [PostgreSQL `CREATE TABLE`](https://www.postgresql.org/docs/current/sql-createtable.html)
  documents table constraints, column constraints, foreign keys, and
  `IF NOT EXISTS`. The coverage contract keeps asserting executable native
  table DDL, required columns, and idempotent migration naming.
- [PostgreSQL constraints documentation](https://www.postgresql.org/docs/current/ddl-constraints.html)
  describes database-level integrity boundaries and constraint behavior. The
  coverage contract continues to reject missing JSONB shape and rollback expiry
  constraints before treating native storage as covered.
- [PostgreSQL GIN indexes](https://www.postgresql.org/docs/current/gin.html)
  documents GIN indexes for composite values. The coverage contract keeps
  proving the bounded native rule-value GIN index exists.
- [PostgreSQL `ALTER TABLE`](https://www.postgresql.org/docs/current/sql-altertable.html)
  documents schema-change behavior. The coverage contract stays additive and
  does not mutate schema while auditing.
- [NIST Secure Software Development Framework SP 800-218](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends verifying software changes and addressing root causes. The module
  cutover keeps the verifier side-effect-free and preserves explicit failure
  reasons for missing migration coverage.

## Recommendations

1. Rename production code from roadmap wording to product-domain wording.
2. Keep the SQL migration filename unchanged because it is historical database
   migration evidence, not a live product contract.
3. Move the public contract version from
   `phase8r.native_sql_migration_coverage.v1` to
   `policy.native_sql_migration_coverage.v1`.
4. Rename exported constants and helpers to
   `POLICY_NATIVE_SQL_MIGRATION_*`,
   `buildPolicyNativeSqlMigrationCoverage`, and
   `validatePolicyNativeSqlMigrationCoverage`.
5. Replace the roadmap handoff with
   `nextStep.stepId = native_storage_operational_wiring`.
6. Preserve the existing side-effect-free validation behavior exactly: no
   database writes, no schema mutations, no file writes, and no legacy-storage
   drops.

## Pros And Cons

Pros:

- Makes migration coverage a durable native-storage verifier.
- Keeps downstream imports clear and product-oriented.
- Preserves contract-to-migration drift detection.
- Keeps migration history intact without renaming applied SQL files.
- Removes another phase-coded production service from the naming inventory.

Cons:

- Direct consumers that still carry phase-coded names remain for later cutover
  tasks.
- The applied migration filename remains dated by design.
- Operational backup/restore wiring is still the next live-storage risk.

## Final Recommendation Stack

- Service:
  `server/src/services/policyNativeSqlMigrationCoverage.mjs`
- Focused test:
  `server/src/__tests__/services/policyNativeSqlMigrationCoverage.test.mjs`
- Active architecture record:
  `docs/architecture/policy-native-sql-migration-coverage.md`
- Contract version:
  `policy.native_sql_migration_coverage.v1`
- Next step:
  `native_storage_operational_wiring`

## Implementation Tasks

1. Rename the service file to
   `server/src/services/policyNativeSqlMigrationCoverage.mjs`.
2. Rename the focused test to
   `server/src/__tests__/services/policyNativeSqlMigrationCoverage.test.mjs`.
3. Rename the architecture record to
   `docs/architecture/policy-native-sql-migration-coverage.md`.
4. Move exported constants and helpers to durable names.
5. Move the payload version to
   `policy.native_sql_migration_coverage.v1`.
6. Replace `nextPhase` with `nextStep`.
7. Update roadmap, native-schema handoff, changelog, and production-name
   inventory evidence.

## Security Boundary

- No database tables are created by this module.
- No migrations are executed by this module.
- No SQL files are modified by this module.
- No policies are converted.
- No legacy writes are disabled.
- No schema mutations are performed during validation.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyNativeSchemaContract|policyNativeSqlMigrationCoverage|policyBuilderPhase8BackupRestoreSafety|policyBuilderPhase8ExplicitConversionWorkflow|policyBuilderPhase8NativeStorageTestReset|policyBuilderProductionNameInventory" --no-coverage --runInBand
npm run lint:docs
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
```

## Next Step

Native Storage Operational Wiring should receive the next module cutover because
the SQL migration verifier now has durable product-domain naming and the next
remaining risk is the backup/restore plus post-upgrade flow that consumes
native storage coverage.
