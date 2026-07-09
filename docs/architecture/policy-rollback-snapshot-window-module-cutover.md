# Policy Rollback Snapshot Window Module Cutover

Status: implemented.

## Intent

Cut the rollback snapshot and reversion-window component away from
implementation-phase naming so production code describes the durable rollback
contract. The behavior remains the same: plan a bounded restore manifest,
preserve only minimal post-window audit metadata, block ordinary reads or
unrelated saves from reverting, and perform no writes, deletes, or restores.

## Official Guidance Reviewed

- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  provides contingency planning and recovery guidance. The rollback component
  keeps recovery criteria explicit through a restore manifest and bounded
  reversion window.
- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
  stresses understanding backup assumptions for valuable data. The rollback
  snapshot stays scoped to policy conversion and does not replace full database
  backup and recovery.
- [OWASP Top 10 A09: Security Logging and Monitoring Failures](https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/)
  calls out missing logs for high-value transactions as a risk. The component
  retains bounded actor, reason, restore-path, expiry, and digest metadata.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  distinguishes audit/transaction trails from security event logs and cautions
  against unsafe collected data. The cutover keeps raw legacy payloads out of
  operator-facing reports.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework)
  frames privacy risk as an enterprise risk-management concern. The component
  deletes bulky rollback payloads after expiry and keeps only minimal support
  metadata.

## Recommendations

1. **Rename the module and focused test to durable rollback names.**
   Use `policyRollbackSnapshotWindow.mjs` and
   `policyRollbackSnapshotWindow.test.mjs`.

2. **Rename exported constants and helpers without changing rollback rules.**
   Use `POLICY_ROLLBACK_*`, `buildPolicyRollbackSnapshotWindow`,
   `validatePolicyRollbackSnapshotWindow`, and
   `buildPolicyRollbackSnapshotWindowAudit`.

3. **Remove phase-coded production payload values.**
   Replace the version, restore path, idempotency key, default reason code, and
   production handoff with durable policy rollback vocabulary.

4. **Keep rollback data minimized.**
   Reports remain summaries only. Raw legacy payload exposure stays invalid.
   Bulky payload retention after expiry stays invalid.

5. **Preserve side-effect-free planning.**
   The component continues to plan rollback, revert, and retention behavior
   without writing snapshots, restoring policies, deleting bulk payloads, or
   changing legacy rows.

## Pros And Cons

Pros:

- Production names now describe the lasting rollback responsibility.
- Runtime payload values no longer include temporary phase identifiers.
- Restore planning remains bounded, auditable, and side-effect-free.
- Tests still prove restore sections, retention cleanup, actor gating, and
  validation failures.
- Completion evidence and native-storage reset inventories now point at the
  durable service and test names.

Cons:

- Historical changelog and older phase documents still retain phase language for
  audit history.
- The conversion actor vocabulary still comes from the existing conversion
  workflow module until that component receives its own cutover.
- Persistence and execution remain separate later work; this component only
  plans and validates rollback behavior.

## Final Recommendation Stack

- Rollback snapshot service:
  `server/src/services/policyRollbackSnapshotWindow.mjs`
- Focused tests:
  `server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs`
- Architecture records:
  `docs/architecture/policy-rollback-snapshot-window.md` and this document
- Evidence map:
  `server/src/services/policyStorageClosureEvidenceRun.mjs`
- Native-storage reset inventory:
  `server/src/services/policyNativeStorageTestReset.mjs`
- Shared conversion actor vocabulary:
  `server/src/services/policyConversionActorSources.mjs`

## Implementation Outcome

- Renamed the service, focused test, and architecture record.
- Replaced phase-coded rollback version, constants, builders, validators, audit
  helper, restore path, idempotency key, and default reason code.
- Replaced production `nextPhase.phaseId` with
  `nextStep.stepId = legacy_write_path_shutdown`.
- Extracted shared conversion actor source IDs into
  `policyConversionActorSources.mjs` so rollback does not import phase-coded
  conversion workflow symbols.
- Updated completion evidence, storage reset, roadmap, and changelog references.
- Preserved rollback window bounds, required restore sections, actor gating,
  post-window cleanup, raw-payload suppression, and no-side-effect validation.

## Next High-Value Item

Continue with **Legacy Write Path Shutdown module naming cutover**. That
component directly follows rollback safety and still contains phase-coded
production service names, constants, tests, and `nextPhase` handoffs.
