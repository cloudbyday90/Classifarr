# Policy Intent Conversion Workflow

## Status

Implemented as the durable side-effect-free workflow plan for converting legacy
policy projections into native policy intent storage.

This component does not write native records. It verifies that a conversion is
explicitly requested, authorized by an approved actor source, backed by a ready
candidate report, guarded by rollback planning, and safe to hand off to the
native runtime read path.

## Problem

Native policy intent conversion must not happen from ordinary policy reads,
unrelated policy saves, or implicit compatibility projection. Conversion changes
policy storage semantics, so Classifarr needs an explicit action boundary before
any later SQL writer can insert native rows, write migration events, or disable
legacy paths.

The old module name tied this durable product role to a temporary roadmap phase.
The canonical module is now:

`server/src/services/policyIntentConversionWorkflow.mjs`

## Official-Source Research

- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  document explicit grouped changes and rollback behavior. The workflow keeps
  native writes, migration events, and rollback snapshot requirements in one
  future transaction plan.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends integrating secure development practices into normal software
  delivery. This cutover preserves focused tests while renaming the component
  to its durable role.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  treats secure configuration management as a system lifecycle concern. The
  cutover updates service imports, tests, evidence metadata, roadmap, and
  changelog together.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes authorization and server-side enforcement. The workflow only
  accepts approved actor sources and rejects ordinary read/save flows.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  cautions against exposing unnecessary sensitive data. The workflow keeps
  rollback payloads redacted and does not expose raw legacy policy JSON.

## Recommendations

1. **Keep conversion explicit.**
   Conversion must require a selected policy set and an approved actor source:
   manual operator, post-upgrade apply, test fixture, or maintainer migration
   tooling.

2. **Keep the workflow side-effect-free.**
   This component should only plan conversion. It must not insert native rows,
   write rollback snapshots, write migration events, mutate policy storage, or
   delete compatibility paths.

3. **Require ready candidates.**
   A selected policy can only be ready when the policy intent migration
   candidate report marks it `ready_to_convert`.

4. **Require rollback and verifier evidence.**
   Ready steps must plan rollback snapshot creation. Behavior-sensitive
   policies require passing or operator-accepted migration verifier evidence.

5. **Use deterministic idempotency.**
   Conversion steps should carry stable idempotency keys so repeated explicit
   actions do not duplicate future native writes.

6. **Use semantic handoff metadata.**
   The workflow should emit `nextStep.stepId = native_runtime_read_path` rather
   than a temporary roadmap phase identifier.

## Pros And Cons

Pros:

- Prevents accidental conversion from normal product workflows.
- Gives conversion code a clear audit surface before storage writes exist.
- Preserves old active behavior until the future conversion transaction commits.
- Keeps rollback, migration event, native record planning, and idempotency tied
  together.
- Removes phase-coded runtime naming from the conversion workflow.

Cons:

- Does not write native rows; the eventual SQL writer remains a separate
  component.
- Behavior-sensitive policies require verifier input before they can be marked
  ready.
- Later storage components must still honor this plan transactionally.

## Final Recommendation Stack

- Workflow service:
  `server/src/services/policyIntentConversionWorkflow.mjs`
- Focused test:
  `server/src/__tests__/services/policyIntentConversionWorkflow.test.mjs`
- Candidate report input:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`
- Post-upgrade consumer:
  `server/src/services/policyPostUpgradeDryRun.mjs`
- Apply-gate consumer:
  `server/src/services/policyPostUpgradeApplyGate.mjs`
- Administrator apply boundary:
  `server/src/services/policyNativeIntentConversionOperatorAction.mjs`
- Storage-closure evidence:
  `server/src/services/policyStorageClosureEvidenceRun.mjs`

## Implementation Outcome

Implemented:

- Renamed the service, focused test, design doc, version string, constants,
  builder, audit builder, and validator to durable policy-intent conversion
  names.
- Updated post-upgrade dry-run and apply-gate consumers.
- Updated storage-closure evidence and native-storage test reset metadata.
- Replaced the workflow-local `nextPhase` handoff with
  `nextStep.stepId = native_runtime_read_path`.
- Replaced the conversion idempotency prefix with `policy-intent:convert`.
- Preserved approved actor source enforcement, ready-candidate checks,
  rollback planning, verifier gating, native record planning, migration event
  planning, idempotency validation, legacy behavior retention, and side-effect
  rejection.

## Security Outcome

- No persistent writes or provider calls were added.
- Ordinary read and unrelated save actor sources remain blocked.
- Rollback payloads remain redacted in the plan.
- Side effects are explicitly rejected by validation.
- Future native storage writes remain gated behind a separate explicit
  transaction boundary.

## Next Step

Use the administrator-only conversion preview and apply action documented in
[Policy Native Intent Conversion Operator Action](policy-native-intent-conversion-operator-action.md)
to convert selected current candidates. Then verify native runtime behavior
before compatibility-path removal work begins.
