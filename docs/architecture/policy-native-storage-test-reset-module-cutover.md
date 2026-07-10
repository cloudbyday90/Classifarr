# Policy Native Storage Test Reset Module Cutover

Status: implemented.

## Purpose

The native storage test reset component classifies which tests prove durable
native intent behavior, which tests are only migration or rollback
compatibility, and which abandoned diagnostic UI tests must stay
deletion-scoped. This cutover removes phase-coded service names and payload
fields from that contract so it can act as a durable storage boundary instead
of a temporary implementation artifact.

## Official Guidance Reviewed

- [Jest Setup and Teardown](https://jestjs.io/docs/setup-teardown) documents
  setup and cleanup lifecycles so tests can keep state isolated and avoid
  implicit cross-test dependencies.
- [Jest Configuration](https://jestjs.io/docs/configuration) documents
  automatic mock clearing controls that support repeatable test state.
- [PostgreSQL Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  and [PostgreSQL ROLLBACK](https://www.postgresql.org/docs/current/sql-rollback.html)
  define rollback behavior for discarding changes inside failed or aborted
  transaction paths.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating verification, review, and documented security
  practices into the development lifecycle.
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
  provides a structured security testing reference across development,
  deployment, maintenance, and reporting.

## Recommendations

1. Keep native storage test reset side-effect-free.
   The module may classify tests, produce reset readiness, and report blockers;
   it must not delete tests, rewrite tests, generate coverage, or mutate schema.

2. Use durable contract names for production payloads.
   Contract versions, export names, constants, and handoff fields should use
   native-storage domain terms rather than phase ids.

3. Require explicit native SQL migration coverage.
   Schema-shape tests cannot stand in for executable migration tests. Fresh
   install and upgrade paths need separate evidence.

4. Keep diagnostic preview and replay tests deletion-scoped.
   Abandoned diagnostic UI tests are migration cleanup material, not final
   native-storage behavior.

5. Hand off to one concrete operational risk.
   The next step should be backup and restore wiring before post-upgrade apply
   wiring, because backup parity is the recovery boundary for native storage.

## Pros And Cons

Pros:

- Removes temporary phase-coded identifiers from the storage reset contract.
- Keeps native coverage and migration-only compatibility evidence separated.
- Makes destructive reset behavior fail-closed.
- Gives the next storage component a specific operational handoff.

Cons:

- Existing adjacent Phase 8R components still contain phase-coded names until
  their own cutovers are completed.
- This cutover does not delete abandoned diagnostic tests; it only enforces
  deletion scope.

## Final Recommendation Stack

- Service:
  `server/src/services/policyNativeStorageTestReset.mjs`
- Focused tests:
  `server/src/__tests__/services/policyNativeStorageTestReset.test.mjs`
- Standing architecture record:
  `docs/architecture/policy-native-storage-test-reset.md`
- Roadmap:
  `docs/architecture/policy-builder-intent-model-roadmap.md`
- Next operational component:
  Native Backup And Restore Wiring

## Implementation Outcome

- Renamed `policyBuilderPhase8NativeStorageTestReset.mjs` to
  `policyNativeStorageTestReset.mjs`.
- Renamed the focused test file to `policyNativeStorageTestReset.test.mjs`.
- Renamed the standing architecture record to
  `policy-native-storage-test-reset.md`.
- Moved the contract version to `policy.native_storage_test_reset.v1`.
- Replaced `PHASE8R_NATIVE_STORAGE_TEST_*` exports with
  `POLICY_NATIVE_STORAGE_TEST_*`.
- Replaced `buildPolicyBuilderPhase8NativeStorageTestReset*` exports with
  `buildPolicyNativeStorageTestReset*`.
- Replaced `nextPhase.phaseId` with
  `nextStep.stepId = native_backup_restore_wiring`.
- Replaced diagnostic deletion markers with
  `deleteAfterNativeStorageGates`.
- Updated the policy storage closure evidence map to point at the durable
  service, test, and architecture paths.

## Security Outcome

- The reset contract remains side-effect-free.
- Native migration coverage remains explicit and required.
- Legacy payload preservation remains constrained to migration or rollback
  boundaries.
- Diagnostic UI test preservation remains deletion-scoped.
- The next handoff is operational recovery wiring, not broader storage cleanup.

## Validation

```powershell
cd server
node ../scripts/run-jest.mjs --testPathPatterns="policyNativeSchemaContract|policyNativeSqlMigrationCoverage|policyNativeStorageOperationalSafety|policyNativeStorageTestReset|policyIntentConversionWorkflow|policyBuilderProductionNameInventory" --no-coverage --runInBand
cd ..
npm run lint:docs
node scripts/generate-policy-builder-production-name-inventory.mjs --require-valid
git diff --check
```

## Next Step

Proceed to **Native Backup And Restore Wiring**. The next component should
remove phase-coded production naming from the backup/restore wiring boundary and
keep backup parity focused on native policy tables, child rows, IDs, and restore
validation.
