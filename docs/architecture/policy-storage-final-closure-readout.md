# Policy Storage Final Closure Readout

## Intent

The policy storage final closure readout generates the final operator-facing
storage-migration closure decision from the policy storage
completion-checkpoint artifact.

The readout answers one question: can policy storage migration closure be
treated as complete right now? If not, it reports the blocking category:

- component evidence,
- roadmap evidence,
- compatibility-removal audit evidence,
- validation evidence,
- changelog evidence,
- artifact validation,
- side effects.

The service does not collect evidence, run commands, write files, write
manifests, mutate storage, or run Git. It only classifies a supplied
machine-readable checkpoint artifact into a stable completion decision.

## Official-Source Research

- NIST SSDF emphasizes secure development practices across the software
  lifecycle. The readout applies this by refusing to claim closure unless the
  checkpoint artifact and nested validation evidence already prove completion.
- NIST SP 800-128 frames secure configuration management as controlled,
  monitored change. The readout is the final control point after checkpoint
  evidence is generated; it classifies evidence without mutating it.
- SLSA artifact verification requires comparing provenance and expected values.
  The readout validates a versioned checkpoint-artifact fingerprint and
  replays retained evidence before it accepts an artifact status.
- OWASP input-validation guidance supports server-side allowlisting. The
  readout rejects wrappers that are historical, malformed, altered, or missing
  the bounded inputs required for replay.
- OWASP Logging guidance recommends logging security-relevant events with
  enough context for follow-up without exposing sensitive data. The readout
  keeps bounded blocker categories and risk metadata instead of full command
  logs or raw evidence dumps.
- Git `mv` documents explicit file moves. The module cutover uses mechanical
  moves plus focused tests so repository history remains inspectable.

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

### Verify Then Consume The Storage Checkpoint Artifact

The final readout should validate the current checkpoint wrapper fingerprint
and replay it from retained component, roadmap, completion-audit, validation,
changelog, and side-effect inputs before consuming the replayed artifact.

Pros:

- keeps the final decision small and auditable,
- detects altered or self-consistent forged artifact summaries,
- avoids trusting caller-controlled checkpoint status fields,
- creates a single release/operator handoff contract.

Cons:

- historical, stale, malformed, altered, or unreplayable checkpoint artifacts
  block closure and must be regenerated.

### Preserve Blocker Categories

The readout should map checkpoint failure categories directly to
operator-facing statuses.

Pros:

- tells operators what to fix next,
- avoids a generic "not complete" result,
- keeps completion evidence actionable.

Cons:

- callers must understand the bounded status IDs.

### Reject Side Effects

The readout should not write files, run commands, mutate storage, or run Git.

Pros:

- prevents the final completion decision from changing the evidence it audits,
- keeps the service deterministic and unit-testable,
- makes command execution explicit in outer workflows.

Cons:

- workflows need to write the JSON output outside the service boundary.

## Final Recommendation Stack

Use this stack for policy storage final closure readout:

1. Require a current policy storage completion-checkpoint artifact.
2. Require a valid versioned fingerprint and bounded provenance.
3. Require retained inputs and exact deterministic artifact replay.
4. Use only the replayed artifact for the final decision.
5. Require the artifact and nested policy storage checkpoint to be complete
   and valid.
6. Map blocked checkpoint states to component, roadmap, removal-audit,
   validation, or changelog blockers.
7. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes in the readout contract.
8. Emit a stable operator summary with the final decision and next action.
9. Emit semantic `nextStep.stepId = policy_storage_closure_complete` when
   storage closure evidence is complete.

## Implementation Outcome

Implemented:

- Added `policyStorageFinalClosureReadout.mjs`.
- Added `generate-policy-storage-final-closure-readout.mjs`.
- Added root npm script `policy:storage-final-closure-readout`.
- Added focused tests for:
  - complete readout generation,
  - missing checkpoint artifact evidence,
  - component evidence blocker mapping,
  - roadmap, removal-audit, validation, and changelog blocker mapping,
  - forbidden side-effect rejection,
  - readout validation invariants,
  - semantic `nextStep` handoff.
- Added the final closure readout suite and this design doc to the fixed
  validation evidence command set.
- Added a checkpoint-artifact integrity boundary that fingerprint-validates and
  deterministically replays version 4 checkpoint artifacts before the readout
  uses them. Missing, altered, historical, non-replayable, or replay-divergent
  wrapper evidence now fails closed with artifact-validation status.
- Added public CLI verification for complete artifacts, tamper rejection with
  no output by default, and explicitly allowed blocked diagnostics.

Example:

```bash
npm run --silent policy:storage-final-closure-readout -- \
  --checkpoint-artifact .tmp/phase8r/completion-checkpoint-artifact.json \
  --output .tmp/phase8r/final-closure-readout.json \
  --require-complete
```

## Next Step

Use the final closure readout to perform the policy storage current closure audit
against current storage evidence. If the readout is complete and all storage
requirements are proven by current artifacts, the policy storage current closure
audit can proceed. If not, continue with the exact blocker category reported by
the readout.
