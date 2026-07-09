# Policy Builder Phase 8R Current Repository Closure Audit

## Intent

Phase 8R.34 audits the current checkout against the Phase 8R closure chain.

It consumes:

- the current repository files for mapped Phase 8R artifact inventory,
- the current roadmap,
- the current changelog,
- an explicit compatibility-removal completion-audit artifact,
- explicit Phase 8R validation evidence.

It then builds:

- the existing Phase 8R.23 current evidence run,
- a Phase 8R.32 completion-checkpoint artifact,
- a Phase 8R.33 final closure readout,
- a single current-repository closure audit JSON.

The service reads repository files but does not run tests, run Git, write files,
write manifests, mutate storage, or infer missing removal evidence.

## Official-Source Research

- NIST SP 800-218 SSDF recommends secure development practices across the SDLC.
  The current repository audit preserves validation evidence and implementation
  evidence as explicit inputs before a completion claim is made.
- NIST SP 800-128 frames security-focused configuration management as controlled
  change with integrity monitoring. The audit inspects current configuration
  artifacts, roadmap evidence, and changelog coverage instead of relying on
  historical intent.
- OWASP API9:2023 Improper Inventory Management identifies unmanaged or stale
  inventory as risk. The audit treats Phase 8R artifacts and compatibility
  removal evidence as inventory that must be present, complete, and current.
- Git `status --porcelain` is documented as script-stable output. The audit
  follows the same machine-readable evidence principle while leaving Git
  command execution outside the service.

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

### Reuse Existing Closure Contracts

The current repository audit should compose the Phase 8R.23 evidence run, 8R.32
checkpoint artifact, and 8R.33 final readout instead of adding another scoring
model.

Pros:

- keeps each closure layer single-purpose,
- prevents drift between current-state evidence and final operator readout,
- makes blockers traceable to existing artifacts.

Cons:

- incomplete upstream artifacts block the audit even when the current checkout
  appears structurally complete.

### Read Current Repository Files, But Do Not Execute Commands

The service should read roadmap, changelog, and mapped artifact paths. It should
not run validation, source scans, Git, or mutation commands.

Pros:

- keeps evidence collection deterministic and cheap,
- prevents the audit from changing the state it evaluates,
- allows test injection for repository reads.

Cons:

- validation evidence must be generated before calling this audit.

### Require Explicit Removal And Validation Artifacts

The audit should require a complete compatibility-removal completion-audit artifact and
complete validation evidence.

Pros:

- prevents current file presence from masking incomplete compatibility-removal
  proof,
- keeps final closure tied to the actual validation run,
- makes closure decisions reproducible.

Cons:

- stale or missing JSON artifacts block closure until regenerated.

## Final Recommendation Stack

Use this stack for Phase 8R.34:

1. Read current mapped Phase 8R artifact inventory.
2. Read the current Phase 8R roadmap evidence.
3. Read the current changelog evidence.
4. Require a complete and valid compatibility-removal completion-audit artifact.
5. Require focused, lint, markdown, and full validation evidence to pass.
6. Build the Phase 8R.23 evidence run.
7. Build the Phase 8R.32 checkpoint artifact from current evidence.
8. Build the Phase 8R.33 final closure readout.
9. Emit complete only when all three layers complete.
10. Reject file writes, storage mutation, command execution, Git commands, and
    manifest writes.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CurrentRepositoryClosureAudit.mjs`.
- Added `run-policy-builder-phase-8r-current-closure-audit.mjs`.
- Added root npm script `policy:phase8r:current-closure-audit`.
- Added focused tests for:
  - complete current-repository closure audit generation,
  - missing mapped repository artifact blocking,
  - missing validation evidence blocking,
  - incomplete completion-audit artifact blocking,
  - forbidden side-effect rejection,
  - audit validation invariants.
- Added the current repository closure audit suite and this design doc to the
  fixed Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:current-closure-audit -- \
  --completion-audit-artifact .tmp/phase8r/completion-audit-artifact.json \
  --validation-evidence .tmp/phase8r/validation-evidence.json \
  --output .tmp/phase8r/current-closure-audit.json \
  --checkpoint-artifact-output .tmp/phase8r/current-checkpoint-artifact.json \
  --final-readout-output .tmp/phase8r/current-final-readout.json \
  --require-complete
```

## Next Step

Run the current repository closure audit with real compatibility-removal
completion-audit and validation evidence. If it completes, perform the final
requirement-by-requirement goal completion audit before marking Phase 8R
complete. If it blocks, continue with the exact blocker category in the audit
summary.
