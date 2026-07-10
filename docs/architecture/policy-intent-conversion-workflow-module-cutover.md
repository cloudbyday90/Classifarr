# Policy Intent Conversion Workflow Module Cutover

## Status

Implemented.

This cutover renames the explicit conversion workflow from temporary
phase-coded module naming to durable product-domain naming:

- Canonical service:
  `server/src/services/policyIntentConversionWorkflow.mjs`

The conversion planning behavior remains intact: explicit action only, approved
actor sources only, ready-candidate gating, rollback planning, verifier gating,
native record planning, migration event planning, idempotency, legacy behavior
retention, and side-effect rejection.

## Problem

The explicit conversion workflow is a durable safety boundary, not a temporary
roadmap artifact. Leaving phase-coded service names, constants, payload
versions, idempotency prefixes, and `nextPhase.phaseId` output in production
would make future maintenance harder and would keep obsolete planning language
inside runtime contracts.

## Official-Source Research

- [PostgreSQL transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html)
  document explicit transaction boundaries and rollback behavior. The workflow
  stays plan-only and preserves the future transaction requirements.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
  recommends secure practices throughout development. The cutover keeps focused
  tests around the renamed component.
- [NIST SP 800-128](https://csrc.nist.gov/pubs/sp/800/128/upd1/final)
  frames secure configuration management as lifecycle work. The rename updates
  imports, tests, docs, evidence metadata, roadmap, and changelog together.
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
  emphasizes server-side enforcement for authorization-sensitive workflows.
  Approved actor sources remain enforced server-side.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  warns against unnecessary sensitive-data exposure. Rollback payloads remain
  redacted and raw legacy policy JSON is not exposed by this workflow.

## Recommendations

1. **Use durable module vocabulary.**
   Rename the service to `policyIntentConversionWorkflow.mjs`.

2. **Rename public symbols.**
   Use `POLICY_INTENT_CONVERSION_*`,
   `buildPolicyIntentConversionWorkflow`,
   `buildPolicyIntentConversionWorkflowAudit`, and
   `validatePolicyIntentConversionWorkflow`.

3. **Use durable payload identity.**
   Emit `policy.intent_conversion_workflow.v1` and
   `policy-intent:convert:*` idempotency keys.

4. **Replace phase handoffs.**
   Emit `nextStep.stepId = native_runtime_read_path` instead of
   `nextPhase.phaseId`.

5. **Avoid compatibility aliases.**
   Do not keep the old phase-coded exports because they would preserve stale
   production surface area.

## Pros And Cons

Pros:

- Removes phase-coded vocabulary from conversion planning.
- Keeps explicit conversion authorization and rollback planning behavior stable.
- Updates consumers in one change, avoiding mixed runtime contracts.
- Gives the next component a semantic handoff target.

Cons:

- Native runtime read path remains the next phase-coded cleanup target.
- Historical roadmap context still uses phase IDs for planning only.

## Final Recommendation Stack

- Service:
  `server/src/services/policyIntentConversionWorkflow.mjs`
- Test:
  `server/src/__tests__/services/policyIntentConversionWorkflow.test.mjs`
- Candidate report input:
  `server/src/services/policyIntentMigrationCandidateReport.mjs`
- Post-upgrade dry-run consumer:
  `server/src/services/policyPostUpgradeDryRun.mjs`
- Apply-gate consumer:
  `server/src/services/policyPostUpgradeApplyGate.mjs`
- Storage closure evidence:
  `server/src/services/policyStorageClosureEvidenceRun.mjs`

## Implementation Outcome

Implemented:

- Renamed the service, focused test, design doc, version string, constants,
  builder, audit builder, validator, and imports to durable policy-intent
  conversion names.
- Replaced workflow-local `nextPhase.phaseId` output with semantic
  `nextStep.stepId = native_runtime_read_path`.
- Replaced the idempotency prefix with `policy-intent:convert`.
- Updated post-upgrade dry-run, apply gate, native-storage reset metadata,
  storage-closure evidence, roadmap references, changelog, and production-name
  inventory tests.

## Security Outcome

- No storage mutation or provider calls were added.
- Conversion remains plan-only.
- Ordinary read and unrelated save sources remain blocked.
- Rollback planning and migration-event planning remain required for ready
  conversion steps.
- Side-effect validation remains explicit.

## Next Step

Cut over the native runtime read path naming and remove its phase-coded
payload/version/handoff vocabulary.
