# Policy Controlled Removal Apply Artifact Module Cutover

## Intent

This cutover removes production-facing phase naming from the controlled removal
apply artifact wrapper and local generator command while preserving the same
adapter-driven apply behavior, audit shape, and side-effect restrictions.

Post-removal verification remains a separate task. This keeps the rename scoped
to the artifact wrapper and operator-facing apply command.

## Official-Source Research

- OWASP Logging Cheat Sheet guidance recommends event data with action, object,
  result, reason, and actor context and warns against logging too much or too
  little. The artifact wrapper remains bounded but keeps apply status, actor,
  counts, risks, and side effects.
- NIST SP 800-128 frames configuration management as security work. The cutover
  preserves evidence that the controlled change was explicit and bounded.
- NIST SSDF SP 800-218 recommends secure development practices integrated into
  the SDLC. Durable module and script names keep the production API meaningful
  after implementation phases are complete.
- Git `rm` documents tracked-path removal and dry-run behavior. The CLI still
  avoids Git commands and deletes only repo-relative files through the adapter
  when explicitly requested.

Sources:

- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- Git `rm` documentation:
  <https://git-scm.com/docs/git-rm>

## Recommendations

### Rename Service, Test, Script, And Root Runner Together

The artifact wrapper is operator-facing because it has an npm runner and a
generator script. Cut over all related names in one scoped change.

Pros:

- removes phase naming from the command users run,
- avoids mixed service/script vocabulary,
- keeps validation evidence paths current.

Cons:

- downstream documentation and validation evidence must be updated together.

### Keep Repo-Relative Adapter Guardrails

The CLI adapter should keep refusing absolute paths and paths escaping the repo.

Pros:

- prevents accidental deletion outside the repository,
- keeps local apply behavior deterministic,
- preserves the destructive boundary.

Cons:

- users must run the command from the repository root.

### Preserve Artifact Evidence Shape

The wrapper should continue recording apply summary, risks, side effects,
operator confirmation, and nested apply result.

Pros:

- keeps post-removal verification input stable,
- supports audit trails,
- avoids unnecessary downstream refactors.

Cons:

- the artifact still carries nested apply details.

## Final Recommendation Stack

1. Rename the artifact service, test, generator script, and npm runner.
2. Replace phase-coded constants, version, builder, and validator exports.
3. Update the generator to import durable deletion action constants.
4. Replace runtime `nextPhase` with semantic `nextStep`.
5. Preserve repo-relative deletion guardrails and side-effect validation.
6. Update roadmap, changelog, validation evidence, and completion audit paths.

## Implementation Outcome

Implemented:

- `policyBuilderPhase8ControlledRemovalApplyArtifact.mjs` became
  `policyControlledRemovalApplyArtifact.mjs`.
- `policyBuilderPhase8ControlledRemovalApplyArtifact.test.mjs` became
  `policyControlledRemovalApplyArtifact.test.mjs`.
- `generate-policy-builder-phase-8r-removal-apply.mjs` became
  `generate-policy-controlled-removal-apply.mjs`.
- `policy:phase8r:removal-apply` became `policy:controlled-removal-apply`.
- The contract exports now use `POLICY_CONTROLLED_REMOVAL_APPLY_ARTIFACT_*`,
  `buildPolicyControlledRemovalApplyArtifact`, and
  `validatePolicyControlledRemovalApplyArtifact`.
- Runtime output now emits
  `nextStep.stepId = post_removal_runtime_verification`.
- Validation evidence and completion audit references now point at the durable
  service, test, script, and design doc.

## Next Step

Proceed to **Compatibility Removal Completion Audit module naming cutover**.
