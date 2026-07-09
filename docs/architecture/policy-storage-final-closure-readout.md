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
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Consume Only The Storage Checkpoint Artifact

The final readout should consume the policy storage completion-checkpoint
artifact instead of rebuilding component, roadmap, validation, and changelog
evidence.

Pros:

- keeps the final decision small and auditable,
- avoids duplicating checkpoint logic,
- creates a single release/operator handoff contract.

Cons:

- a stale or missing checkpoint artifact blocks closure.

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

1. Require a policy storage completion-checkpoint artifact.
2. Require the artifact to be complete and valid.
3. Require the nested policy storage checkpoint to be complete and valid.
4. Map blocked checkpoint states to component, roadmap, removal-audit,
   validation, or changelog blockers.
5. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes in the readout contract.
6. Emit a stable operator summary with the final decision and next action.
7. Emit semantic `nextStep.stepId = policy_storage_closure_complete` when
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

Example:

```bash
npm run --silent policy:storage-final-closure-readout -- \
  --checkpoint-artifact .tmp/phase8r/completion-checkpoint-artifact.json \
  --output .tmp/phase8r/final-closure-readout.json \
  --require-complete
```

## Next Step

Use the final closure readout to perform the current repository closure audit
against current storage evidence. If the readout is complete and all storage
requirements are proven by current artifacts, the current repository closure
audit can proceed. If not, continue with the exact blocker category reported by
the readout.
