# Policy Storage Completion Checkpoint Artifact Exporter

## Intent

The policy storage completion checkpoint artifact exporter generates a
machine-readable wrapper artifact for the policy storage completion checkpoint.

The artifact consumes explicit evidence:

- storage component evidence,
- storage roadmap evidence,
- compatibility-removal completion-audit artifact evidence,
- focused, lint, markdown, and full validation evidence,
- changelog evidence.

The component does not collect evidence, run commands, mutate storage, write
manifests, run Git, or infer missing proof. It packages the final checkpoint
result so completion claims can be handed to release or operator workflows with
a stable JSON contract.

## Official-Source Research

- NIST SSDF recommends secure software development practices across the SDLC.
  The completion checkpoint artifact preserves validation and implementation
  evidence as an explicit closure artifact instead of relying on narrative
  status.
- NIST SP 800-128 frames security-focused configuration management as
  controlled change with integrity monitoring. The artifact requires current
  roadmap, component, validation, changelog, and removal-loop closure evidence
  before storage migration is marked complete.
- SLSA artifact verification recommends validating artifact provenance against
  known expectations and rejecting unexpected values. The public generator
  verifies the retained completion-audit artifact together with the explicit
  component, roadmap, validation, and changelog evidence it will summarize.
- OWASP input validation recommends server-side allowlisting. The command
  accepts only the required JSON evidence inputs and blocks altered
  completion-audit, roadmap, and validation evidence before normal output is
  written.
- OWASP Logging guidance emphasizes event attributes that support
  accountability. The artifact preserves status, risk, and side-effect
  attributes for downstream closure readouts.
- Git `mv` documents file movement as a repository operation. This cutover
  keeps the artifact exporter, script, tests, and docs traceable through
  explicit tracked moves.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- SLSA Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Wrap The Existing Checkpoint Contract

The exporter should call `buildPolicyStorageCompletionCheckpoint` rather than
duplicate checkpoint scoring logic.

Pros:

- preserves a single checkpoint source of truth,
- reduces drift between docs, tests, and exported artifacts,
- keeps future checkpoint changes centralized.

Cons:

- the artifact can only be as complete as the explicit checkpoint inputs it
  receives.

### Require Completion-Audit Artifact Evidence

The exporter should consume the compatibility-removal completion-audit wrapper
artifact directly. The storage checkpoint validates its fingerprint and replays
the retained evidence before evaluating the nested audit.

Pros:

- prevents storage completion without compatibility-removal proof,
- keeps remaining-inventory states out of final completion,
- preserves the exact removal-loop artifact that justified closure.

Cons:

- operators must preserve and pass the completion-audit artifact, not only a
  freeform summary.

### Keep Collection And Execution Outside The Service

The service should not collect repository evidence, run tests, run scans, write
manifests, or run Git.

Pros:

- keeps the contract deterministic and unit-testable,
- makes side effects explicit at the CLI/workflow boundary,
- prevents a completion artifact from changing the state it is supposed to
  audit.

Cons:

- workflows need separate evidence-generation commands before calling this
  exporter.

### Verify The Public Checkpoint Evidence Chain

The public generator should be exercised with the same fingerprint-valid
completion-audit artifact, component evidence, roadmap evidence, validation
artifact, and changelog evidence that the final closure readout will consume.
A coherent chain writes a complete checkpoint and wrapper. Altered removal
proof, incomplete roadmap evidence, or altered validation evidence must fail
closed without output by default. Operators may write a blocked diagnostic only
with `--allow-blocked`.

Pros:

- catches JSON serialization and CLI file-boundary regressions that service
  tests cannot cover,
- confirms every explicit closure input remains part of the public contract,
- prevents a false completion artifact from reaching the final closure readout.

Cons:

- a shared fixture must maintain the current full component-evidence set.

## Final Recommendation Stack

Use this stack for the policy storage completion checkpoint artifact:

1. Require explicit storage component evidence.
2. Require explicit storage roadmap evidence.
3. Require a current, fingerprint-valid, replay-verified
   compatibility-removal completion-audit artifact.
4. Require focused, lint, markdown, and full validation evidence.
5. Require changelog evidence.
6. Reuse the policy storage completion checkpoint contract.
7. Emit the nested checkpoint JSON and wrapper artifact JSON.
8. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes inside the service contract.
9. Emit semantic `nextStep` evidence for the policy storage final closure
   readout.
10. Exercise the public generator with a coherent complete chain and fail
    closed without output for altered completion-audit, roadmap, or validation
    evidence unless a blocked diagnostic is explicitly requested.

## Implementation Outcome

Implemented:

- Renamed the artifact service to
  `policyStorageCompletionCheckpointArtifact.mjs`.
- Renamed the CLI exporter to
  `scripts/generate-policy-storage-completion-checkpoint.mjs`.
- Renamed the root npm script to `policy:storage-completion-checkpoint`.
- Renamed exported constants, builders, validators, and payload versioning to
  durable policy storage names.
- Replaced production `nextPhase.phaseId` output with semantic
  `nextStep.stepId = policy_storage_final_closure_readout`.
- Upgraded the exporter to await checkpoint verification so it never passes a
  detached nested completion audit into the storage checkpoint.
- Added focused tests for:
  - complete checkpoint artifact generation,
  - missing completion-audit artifact evidence,
  - incomplete completion-audit artifact evidence,
  - incomplete checkpoint evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added shared checkpoint-artifact input fixtures so service and public-command
  coverage use one fingerprint-valid evidence chain.
- Added a public generator test that verifies complete output,
  `--require-complete`, fail-closed altered completion-audit/roadmap/validation
  boundaries, and explicitly allowed blocked diagnostics.
- Added the checkpoint artifact suite and this design doc to the fixed policy
  storage closure validation evidence command set and current closure evidence
  inventory.

Example:

```bash
npm run --silent policy:storage-completion-checkpoint -- \
  --component-evidence .tmp/phase8r/component-evidence.json \
  --roadmap-evidence .tmp/phase8r/roadmap-evidence.json \
  --completion-audit-artifact .tmp/phase8r/completion-audit-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --changelog-evidence .tmp/phase8r/changelog-evidence.json \
  --output .tmp/phase8r/completion-checkpoint.json \
  --artifact-output .tmp/phase8r/completion-checkpoint-artifact.json
```

## Next Step

Use the generated policy storage completion checkpoint artifact as input for
the final closure readout. That readout should decide whether storage migration
can be marked complete or whether the remaining failure is component evidence,
roadmap evidence, completion-audit evidence, validation, or changelog coverage.
