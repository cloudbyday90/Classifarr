# Policy Builder Phase 8R Native Storage Test Reset

Status: implemented as the ninth Phase 8R storage-migration component.

## Problem

Phase 8R now has contracts for native schema shape, migration candidate
reporting, explicit conversion, native runtime reads, rollback snapshots, legacy
write shutdown, deletion gates, and backup/restore/post-upgrade safety. The
test suite must now protect the final native-storage model instead of preserving
the transition model indefinitely.

The risk is subtle: legacy-preservation tests and old diagnostic preview/replay
tests can make the old builder behavior look permanent. Phase 8R.9 defines a
test reset contract that answers:

```text
Which tests prove native storage, which tests are only migration/rollback
compatibility, and which diagnostic tests must be deleted after gates pass?
```

This component does not delete or rewrite tests. It classifies the test
boundary and requires native SQL migration coverage to be proven explicitly.

## Official Guidance Reviewed

- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  and [NIST SP 800-218](https://nvlpubs.nist.gov/nistpubs/specialpublications/nist.sp.800-218.pdf)
  recommend integrating security practices and verification into the software
  lifecycle. Phase 8R.9 applies that by converting the native-storage test plan
  into an explicit, auditable coverage contract.
- [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
  emphasizes structured testing across development, deployment, and maintenance.
  Phase 8R.9 uses that principle to separate final native-storage coverage from
  migration-only compatibility tests.
- [PostgreSQL SQL dump guidance](https://www.postgresql.org/docs/current/backup-dump.html)
  notes that restore can be performed as a single transaction to avoid partial
  restore state. Phase 8R.9 therefore keeps backup/restore and transaction
  behavior as required native-storage test coverage.
- [CISA Secure by Design](https://www.cisa.gov/securebydesign) emphasizes secure
  defaults and transparent upgrade paths. Phase 8R.9 applies this by requiring
  native storage tests to prove upgrade and deletion gates before the legacy path
  is treated as removable.

## Recommendations

1. **Use an allow-listed native-storage coverage map.**
   Required coverage must include native SQL migration tests, native schema
   contract tests, dry-run candidate report tests, explicit conversion tests,
   native runtime read-path tests, rollback/reversion tests, converted-policy
   legacy write-blocking tests, backup/restore coverage tests, and deletion-gate
   tests.

2. **Do not infer SQL migration coverage from schema-contract tests.**
   The schema contract proves intended shape. It does not prove an actual SQL
   migration, fresh-install path, or upgraded-install path. Phase 8R.9 requires
   a real migration test path before reset readiness.

3. **Scope legacy-preservation tests narrowly.**
   Legacy payload preservation is allowed only for unconverted policy
   compatibility, rollback snapshot restore, or maintainer migration fixtures.
   It is not final product behavior for converted policies.

4. **Deletion-scope old diagnostic tests.**
   Impact preview and replay preview tests should not be final native-storage
   contract coverage. They can remain only as deletion-scoped migration
   material until Phase 8R deletion gates pass.

5. **Keep reset planning side-effect-free.**
   This component does not delete tests, rewrite tests, generate coverage files,
   or mutate schemas.

## Pros And Cons

Pros:

- Makes native-storage test coverage explicit.
- Prevents legacy-preservation tests from freezing the old model.
- Makes native SQL migration coverage a first-class reset gate.
- Keeps diagnostic preview/replay tests from becoming final product
  requirements.
- Gives the next implementation step a precise target.

Cons:

- Does not delete abandoned diagnostic tests yet.
- Still requires follow-up live backup/restore and post-upgrade wiring before
  native storage is operationally default.

## Final Recommendation Stack

- Server module:
  `server/src/services/policyBuilderPhase8NativeStorageTestReset.mjs`
- Test module:
  `server/src/__tests__/services/policyBuilderPhase8NativeStorageTestReset.test.mjs`
- Related safety contract:
  `server/src/services/policyBuilderPhase8BackupRestoreSafety.mjs`
- Documentation:
  `docs/architecture/policy-builder-phase-8r-native-storage-test-reset.md`
- Roadmap owner:
  Phase 8R.9 in
  `docs/architecture/policy-builder-intent-model-roadmap.md`

## Implemented Contract

The service exports:

- native-storage coverage IDs,
- allowed legacy test scope IDs,
- reset readiness status IDs,
- validation risk IDs,
- a test reset plan builder,
- a test reset validator,
- an audit summary builder.

Current inventory covers:

- native SQL migration tests,
- native schema contract tests,
- dry-run migration candidate report tests,
- explicit conversion workflow tests,
- native runtime read-path tests,
- rollback/reversion tests,
- legacy write-blocking tests,
- backup/restore operational safety tests,
- deletion-gate tests.

Current inventory treats `server/src/__tests__/migrations.test.mjs` as the
native SQL migration coverage owner. The schema contract remains separate from
SQL migration proof so future drift cannot be hidden by a passing contract-only
test.

A reset plan becomes `ready_for_native_storage_test_reset` only when:

- every required coverage ID has at least one evidence test path,
- legacy payload preservation tests use an allowed migration/rollback scope,
- abandoned diagnostic UI tests are deletion-scoped,
- deletion gates have not already passed while abandoned diagnostic tests remain,
- abandoned diagnostic tests are not marked as final native-storage contract
  coverage,
- this planning slice performs no test deletion, rewrite, generated coverage, or
  schema mutation side effects.

## Security Outcome

- Native-storage coverage is explicit and fail-closed.
- SQL migration coverage cannot be hand-waved by schema-contract tests.
- Legacy compatibility tests are restricted to migration/rollback boundaries.
- Abandoned diagnostic UI tests cannot become final native-storage authority.
- Deletion after gates pass is enforceable.
- The contract validates that Phase 8R.9 performs no destructive test or schema
  side effects.

## Next Step

Proceed to **Native Storage Operational Wiring**. That work should move the
Phase 8R backup/restore and post-upgrade safety contracts into live flows:
native table export/import, restore validation, post-upgrade dry-run reporting,
and atomic apply-mode conversion.
