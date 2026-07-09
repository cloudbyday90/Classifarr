# Policy Compatibility Deletion Execution Plan Artifact Module Cutover

## Intent

This cutover removes temporary phase-coded naming from the execution-plan
artifact generator while preserving the existing compatibility deletion planning
behavior.

The renamed module remains a read-only artifact generator. It accepts explicit
operator/CI evidence and emits the nested deletion execution plan consumed by
storage-closure final-removal audit and controlled-removal tooling.

## Official-Source Research

- NIST SSDF supports risk-based secure development practices with durable
  evidence. Renaming the artifact to its product purpose keeps the evidence
  understandable after roadmap phases are retired.
- NIST SP 800-128 emphasizes security-focused configuration management. The
  artifact keeps planning and approval separate from actual repository mutation.
- OWASP Logging guidance recommends verified event/evidence handling and no
  unwanted side effects. The renamed artifact keeps explicit validation and
  side-effect rejection.
- Node.js ESM `node:fs` APIs remain the supported local tooling surface. The
  generator stays a bounded command, so synchronous JSON reads and writes are
  acceptable.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Rename The Public Contract

Use `policyCompatibilityDeletionExecutionPlanArtifact` for the service, focused
tests, builder export, validator export, and package-script runner.

Pros:

- aligns the artifact with compatibility deletion instead of roadmap chronology,
- keeps imports discoverable by product intent,
- avoids phase labels in production/evidence contracts.

Cons:

- requires coordinated reference updates across validation, docs, tests, and
  runners.

### Keep Behavior Stable

The cutover should not change input validation, nested-plan construction,
blocked-plan diagnostics, side-effect rejection, or artifact writing behavior.

Pros:

- keeps review focused on contract naming,
- preserves existing deletion-readiness safety,
- avoids changing storage-closure semantics during a naming cutover.

Cons:

- any deeper execution-plan simplification remains separate future work.

### Preserve Read-Only Execution

The generator should continue to emit JSON only. It should not delete files,
archive files, mutate storage, or run Git.

Pros:

- keeps artifact generation safe in local and CI runs,
- supports repeatable verification,
- keeps destructive compatibility removal in explicit controlled-removal steps.

Cons:

- operators still need the controlled-removal flow to apply approved manifest
  changes.

## Final Recommendation Stack

1. Rename the execution-plan artifact service, test, script, runner, payload
   version, builder export, and validator export to compatibility deletion
   terminology.
2. Update closure requirement and validation evidence maps to require the new
   paths.
3. Update roadmap, design records, handoff docs, and changelog references.
4. Preserve the existing read-only artifact behavior and focused tests.
5. Validate both direct command help and package runner help.

## Implementation Outcome

Implemented:

- `policyCompatibilityDeletionExecutionPlanArtifact.mjs`
- `policyCompatibilityDeletionExecutionPlanArtifact.test.mjs`
- `generate-policy-compatibility-deletion-execution-plan-artifact.mjs`
- `policy:compatibility-deletion-execution-plan-artifact`
- `policy.compatibility_deletion_execution_plan_artifact.v1`
- validation-evidence markdown coverage for this cutover record

The cutover keeps execution-plan artifact generation product-domain named and
leaves controlled removal batch artifact naming as the next remaining
phase-coded artifact surface.

## Next Step

Proceed with the controlled removal batch artifact module naming cutover.
