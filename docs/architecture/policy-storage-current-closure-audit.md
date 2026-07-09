# Policy Storage Current Closure Audit

## Intent

The policy storage current closure audit verifies the current checkout against
the policy-storage closure chain before a final completion claim is made.

It consumes:

- the current repository files for mapped closure artifact inventory,
- the current roadmap,
- the current changelog,
- an explicit compatibility-removal completion-audit artifact,
- explicit validation evidence.

It then builds:

- the existing current evidence run,
- a policy storage completion-checkpoint artifact,
- a policy storage final closure readout,
- a single policy storage current closure audit JSON.

The service reads repository files but does not run tests, run Git, write files,
write manifests, mutate storage, or infer missing removal evidence.

## Official-Source Research

- NIST SSDF frames secure software work as defined practices across the SDLC.
  The audit preserves validation and implementation evidence as explicit inputs
  before a completion claim is made.
- NIST SP 800-128 frames security-focused configuration management as controlled
  change with integrity monitoring. The audit inspects current configuration
  artifacts, roadmap evidence, and changelog coverage instead of relying on
  historical intent.
- OWASP Logging Cheat Sheet recommends consistent, attributable, bounded event
  records. The audit emits structured status, risk, validation, and next-step
  fields rather than raw logs or ambiguous prose.
- Git `mv` documents move handling as an explicit index operation. The module
  cutover keeps durable file names and references synchronized instead of
  leaving stale compatibility wrappers.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Reuse Existing Closure Contracts

The current closure audit should compose the current evidence run, policy
storage completion-checkpoint artifact, and policy storage final closure readout
instead of adding another scoring model.

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

Use this stack for the policy storage current closure audit:

1. Read current mapped closure artifact inventory.
2. Read the current roadmap evidence.
3. Read the current changelog evidence.
4. Require a complete and valid compatibility-removal completion-audit artifact.
5. Require focused, lint, markdown, and full validation evidence to pass.
6. Build the current evidence run.
7. Build the policy storage completion-checkpoint artifact from current
   evidence.
8. Build the policy storage final closure readout.
9. Emit complete only when all three layers complete.
10. Reject file writes, storage mutation, command execution, Git commands, and
    manifest writes.

## Implementation Outcome

Implemented:

- Added `policyStorageCurrentClosureAudit.mjs`.
- Added `run-policy-storage-current-closure-audit.mjs`.
- Added root npm script `policy:storage-current-closure-audit`.
- Added focused tests for:
  - complete policy storage current closure audit generation,
  - missing mapped repository artifact blocking,
  - missing validation evidence blocking,
  - incomplete completion-audit artifact blocking,
  - forbidden side-effect rejection,
  - audit validation invariants.
- Added the policy storage current closure audit suite and this design doc to
  the fixed validation evidence command set.

Example:

```bash
npm run --silent policy:storage-current-closure-audit -- \
  --completion-audit-artifact .tmp/policy-storage/completion-audit-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/current-closure-audit.json \
  --checkpoint-artifact-output .tmp/policy-storage/current-checkpoint-artifact.json \
  --final-readout-output .tmp/policy-storage/current-final-readout.json \
  --require-complete
```

## Next Step

Run the policy storage current closure audit with real compatibility-removal
completion-audit and validation evidence. If it completes, perform the final
requirement-by-requirement goal completion audit before marking the closure
sequence complete. If it blocks, continue with the exact blocker category in the
audit summary.
