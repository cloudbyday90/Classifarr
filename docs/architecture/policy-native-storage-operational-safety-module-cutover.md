# Policy Native Storage Operational Safety Module Cutover

Status: implemented July 4, 2026.

## Problem

The backup/restore and post-upgrade safety contract already protected native
policy intent storage from unsafe operational apply, but the production module,
focused test, contract version, and handoff still used phase-coded names. That
made a durable recovery-readiness verifier look like temporary roadmap
scaffolding.

## Official Guidance Reviewed

- [PostgreSQL `pg_dump`](https://www.postgresql.org/docs/current/app-pgdump.html)
  documents consistent logical exports and restore formats. The operational
  safety contract keeps native intent backup and restore coverage explicit.
- [PostgreSQL SQL dump backup guidance](https://www.postgresql.org/docs/current/backup-dump.html)
  describes dump/restore workflows. The contract keeps restore validation as a
  required proof, not an assumption.
- [PostgreSQL transaction documentation](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  plus [`BEGIN`](https://www.postgresql.org/docs/current/sql-begin.html) and
  [`ROLLBACK`](https://www.postgresql.org/docs/current/sql-rollback.html)
  define transaction boundaries and rollback behavior. The contract keeps apply
  mode blocked unless atomic conversion, rollback-on-failure, legacy-until-
  commit, and mixed-write prevention are all true.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  recommends contingency planning, recovery strategy, and testing. The
  contract keeps recovery readiness testable before native storage can become
  the default durable model.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign) emphasizes
  secure-by-default outcomes and transparent upgrade paths. The contract keeps
  dry-run and bounded operator-facing error IDs ahead of apply mode.

## Recommendations

1. Rename production code from roadmap wording to product-domain wording.
2. Move the public contract version from
   `phase8r.backup_restore_safety.v1` to
   `policy.native_storage_operational_safety.v1`.
3. Rename exported constants and helpers to
   `POLICY_NATIVE_STORAGE_OPERATIONAL_*`,
   `POLICY_NATIVE_STORAGE_OPERATOR_ERROR_IDS`,
   `buildPolicyNativeStorageOperationalSafetyPlan`,
   `validatePolicyNativeStorageOperationalSafetyPlan`, and
   `buildPolicyNativeStorageOperationalSafetyAudit`.
4. Replace the roadmap handoff with
   `nextStep.stepId = native_storage_test_reset`.
5. Preserve fail-closed behavior and side-effect-free validation.
6. Keep live backup/export and restore implementation references intact until
   that component receives its own cutover.

## Pros And Cons

Pros:

- Makes recovery readiness a durable native-storage verifier.
- Keeps backup/restore, schema parity, dry-run, transaction, and operator-error
  gates easy to reason about.
- Removes phase-coded production exports from direct test and evidence
  consumers.
- Keeps the contract side-effect-free and safe to run in tests or audits.

Cons:

- Live backup/restore wiring still carries phase-coded documentation and should
  be cut over separately.
- Post-upgrade dry-run and apply-gate services still carry phase-coded names.
- Some roadmap-history references remain intentionally historical.

## Final Recommendation Stack

- Service:
  `server/src/services/policyNativeStorageOperationalSafety.mjs`
- Focused test:
  `server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs`
- Active architecture record:
  `docs/architecture/policy-native-storage-operational-safety.md`
- Contract version:
  `policy.native_storage_operational_safety.v1`
- Next step:
  `native_storage_test_reset`

## Implementation Tasks

1. Rename the service file to
   `server/src/services/policyNativeStorageOperationalSafety.mjs`.
2. Rename the focused test to
   `server/src/__tests__/services/policyNativeStorageOperationalSafety.test.mjs`.
3. Rename the architecture record to
   `docs/architecture/policy-native-storage-operational-safety.md`.
4. Move exported constants and helpers to durable names.
5. Move the payload version to
   `policy.native_storage_operational_safety.v1`.
6. Replace `nextPhase` with `nextStep`.
7. Update roadmap, upstream SQL coverage handoff, changelog, and production-name
   inventory evidence.

## Security Boundary

- No backup is written by this module.
- No restore is applied by this module.
- No post-upgrade apply is run by this module.
- No schema is mutated by this module.
- No policy is converted by this module.
- No legacy write path is disabled by this module.

## Validation

Validation should include:

```text
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyNativeSchemaContract|policyNativeSqlMigrationCoverage|policyNativeStorageOperationalSafety|policyBuilderPhase8ExplicitConversionWorkflow|policyBuilderPhase8NativeStorageTestReset|policyBuilderProductionNameInventory" --no-coverage --runInBand
npm run lint:docs
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
```

## Next Step

Native Storage Test Reset should receive the next module cutover because it
directly consumes this operational safety contract and still carries
phase-coded production naming.
