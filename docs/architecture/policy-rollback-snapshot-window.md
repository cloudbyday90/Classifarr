# Policy Rollback Snapshot And Reversion Window

Status: implemented as the durable policy rollback snapshot and reversion-window contract.

## Problem

Native-intent conversion needs a safe way to reverse a policy migration without
preserving the old preset/custom-signal model forever. Rollback must be possible
during a short support window, but the snapshot cannot become a second durable
policy authority.

## Official Guidance Reviewed

- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final)
  provides practical contingency planning and recovery guidance. The rollback
  snapshot window applies this by requiring a restore manifest before conversion and by making
  recovery criteria explicit instead of relying on ad hoc manual repair.
- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
  distinguishes backup approaches and stresses understanding assumptions around
  valuable data. The rollback snapshot window keeps policy rollback snapshots scoped to policy
  conversion, while full database backup/restore remains the broader disaster
  recovery path.
- [OWASP Top 10 A09: Security Logging and Monitoring Failures](https://owasp.org/Top10/2021/A09_2021-Security_Logging_and_Monitoring_Failures/)
  recommends auditable trails for high-value transactions with integrity
  controls. The rollback snapshot window records bounded actor, reason, restore path, expiry, and
  post-window metadata for native policy conversion and reversion decisions.
- [OWASP AI Agent Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html)
  recommends separating decision-making from execution, binding approvals to the
  exact action, using expiry, and enforcing retention/deletion policies for
  high-impact automated actions. The rollback snapshot window keeps the rollback contract
  side-effect-free and blocks ordinary reads or unrelated saves from reverting.
- [NIST Privacy Framework](https://www.nist.gov/privacy-framework) frames
  privacy and data management as enterprise risk management. The rollback snapshot window applies
  that principle by retaining only minimal audit metadata after the rollback
  window and deleting bulky legacy payload snapshots.

## Recommendations

1. **Capture a complete restore manifest before conversion.**
   Snapshot manifests must cover preset attachments, weights, thresholds,
   `customSignals`, routing/mapping references, actor, and reason before native
   intent becomes active.

2. **Keep snapshot reports redacted.**
   The restore payload may be required for server-side reversal, but operator
   reports and API summaries must not expose raw legacy JSON or custom-signal
   payloads.

3. **Bound the rollback window.**
   The default rollback window is 14 days and validation allows only one to
   thirty days. Revert is blocked after expiry.

4. **Delete bulky payloads after expiry.**
   Post-window retention keeps only minimal audit metadata: policy, intent,
   snapshot version, created/expiry/restored timestamps, actor, reason, restore
   path, and payload digest.

5. **Keep planning separate from execution.**
   The rollback snapshot window produces a rollback/revert/retention plan and validation output.
   Later storage work can write the plan transactionally, but this component
   performs no writes, deletes, or restores.

6. **Redact operator identifiers and free-form reasons from plan reports.**
   The report exposes actor source, actor presence, reason code, and reason
   presence only. The durable snapshot payload may retain protected audit data
   for the later transaction, but report projections must not expose it.

## Pros And Cons

Pros:

- Native conversion can be reversed during a defined support window.
- Rollback snapshots cannot silently become permanent legacy policy storage.
- The restore manifest names every section needed to rebuild the pre-conversion
  policy behavior.
- Ordinary reads and unrelated saves cannot trigger rollback.
- Retention behavior is documented and test-covered before SQL write code is
  introduced.

Cons:

- This slice does not yet write the rollback table.
- Full restore execution still belongs to a later transactional persistence
  task.
- The service intentionally reports summaries rather than raw payloads, so
  debugging requires server-side restore tooling instead of UI-visible JSON.

## Final Recommendation Stack

- Server rollback-window service:
  `server/src/services/policyRollbackSnapshotWindow.mjs`
- Test coverage:
  `server/src/__tests__/services/policyRollbackSnapshotWindow.test.mjs`
- Existing schema boundary:
  `server/src/services/policyNativeSchemaContract.mjs`
- Shared conversion actor-source vocabulary:
  `server/src/services/policyConversionActorSources.mjs`

## Implemented Contract

The rollback service exports:

- rollback status IDs,
- rollback reason IDs,
- required payload section IDs,
- post-window retention action IDs,
- audit risk IDs,
- a rollback snapshot window builder,
- a validator,
- an audit helper.

Rollback window output includes:

```text
version
statusId
policyId
intentId
evaluatedAt
snapshot
revert
retention
sideEffects
reasons
validation
nextStep
```

Required snapshot sections:

- `preset_attachments`
- `weights`
- `thresholds`
- `custom_signals`
- `routing_mapping_references`
- `migration_actor`
- `migration_reason`

Security and retention behavior:

- raw legacy payloads are suppressed from reports,
- actor IDs and free-form migration reasons are suppressed from reports,
- rollback snapshots have an expiry,
- revert is eligible only during the window,
- approved actor sources are manual operator, post-upgrade apply, test fixture,
  and maintainer migration tool,
- ordinary policy reads and unrelated saves are blocked,
- bulky payload retention after expiry is invalid,
- planning output is side-effect-free.

## Security Outcome

- Rollback cannot be triggered by normal reads or incidental policy saves.
- Revert eligibility is tied to a bounded window and approved actor source.
- Reports avoid raw legacy JSON exposure while preserving restore manifest
  completeness.
- Post-window retention keeps only support/compliance metadata and requires
  bulky payload deletion.
- Validation rejects missing restore sections, unbounded snapshots, permanent
  alternate storage, raw payload exposure, missing actor/reason data, and
  side effects.

## Next Step

Proceed to **Legacy Write Path Shutdown**. With bounded rollback behavior
defined, converted policies can next block accidental drift back into legacy
preset/custom-signal write paths.
