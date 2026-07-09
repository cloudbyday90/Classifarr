# Policy Builder Phase 8R Final Closure Readout

## Intent

Phase 8R.33 generates the final operator-facing Phase 8R closure decision from
the policy storage completion-checkpoint artifact.

The readout answers one question: can Phase 8R be treated as complete right
now? If not, it reports the blocking category:

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

- NIST SP 800-218 SSDF recommends integrating secure development practices
  across the SDLC. The closure readout applies this by refusing to claim
  completion unless the validation and checkpoint evidence already prove the
  phase complete.
- NIST SP 800-128 treats security-focused configuration management as controlled
  change plus integrity monitoring. The readout preserves a clear final control
  point after the checkpoint artifact is generated.
- OWASP API9:2023 Improper Inventory Management calls out risk from unmanaged
  or stale interfaces. The readout keeps stale compatibility inventory visible
  by mapping removal-audit failures to a distinct blocker.
- Git `status --porcelain` is documented as stable for scripts. The readout
  follows the same machine-readable contract principle, while keeping command
  execution outside the service.

Sources:

- NIST SP 800-218 Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- Git `status` documentation:
  <https://git-scm.com/docs/git-status>

## Recommendations

### Consume Only The Phase 8R.32 Artifact

The final readout should consume the checkpoint artifact instead of rebuilding
component, roadmap, validation, and changelog evidence.

Pros:

- keeps the final decision small and auditable,
- avoids duplicating checkpoint logic,
- creates a single release/operator handoff contract.

Cons:

- a stale or missing 8R.32 artifact blocks closure.

### Preserve Blocker Categories

The readout should map checkpoint failure categories directly to operator-facing
statuses.

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

Use this stack for Phase 8R.33:

1. Require a policy storage completion-checkpoint artifact.
2. Require the artifact to be complete and valid.
3. Require the nested policy storage checkpoint to be complete and valid.
4. Map blocked checkpoint states to component, roadmap, removal-audit,
   validation, or changelog blockers.
5. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes in the readout contract.
6. Emit a stable operator summary with the final decision and next action.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8FinalClosureReadout.mjs`.
- Added `generate-policy-builder-phase-8r-final-closure-readout.mjs`.
- Added root npm script `policy:phase8r:final-closure-readout`.
- Added focused tests for:
  - complete readout generation,
  - missing checkpoint artifact evidence,
  - component evidence blocker mapping,
  - roadmap, removal-audit, validation, and changelog blocker mapping,
  - forbidden side-effect rejection,
  - readout validation invariants.
- Added the final closure readout suite and this design doc to the fixed Phase
  8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:final-closure-readout -- \
  --checkpoint-artifact .tmp/phase8r/completion-checkpoint-artifact.json \
  --output .tmp/phase8r/final-closure-readout.json \
  --require-complete
```

## Next Step

Use the final closure readout to perform the Phase 8R completion audit against
the current repository evidence. If the readout is complete and all Phase 8R
requirements are proven by current artifacts, Phase 8R can be closed. If not,
continue with the exact blocker category reported by the readout.
