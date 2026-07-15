# Policy Compatibility Deletion Execution Plan Artifact

## Intent

The policy compatibility deletion execution-plan artifact creates the
machine-readable plan consumed by storage-closure final-removal audit and later
controlled-removal tooling.

The artifact generator turns explicit compatibility deletion evidence into:

- a nested compatibility deletion execution plan,
- wrapper metadata for audit trails,
- readiness status,
- bounded risk evidence,
- no-side-effect evidence.

The generator does not infer readiness from broad repository scans. It requires
caller-supplied evidence for deletion readiness, deletion gates, replacement
coverage, rollback stance, support stance, manifest approval, and approving
actor metadata.

## Official-Source Research

- NIST SSDF describes secure development as risk-based and evidence-backed. A
  deletion execution-plan artifact should therefore preserve explicit readiness
  and approval evidence instead of relying on a temporary roadmap phase name.
- NIST SP 800-128 focuses on security-conscious configuration management. The
  artifact keeps compatibility deletion planning separate from the actual
  repository mutation step, which supports controlled configuration change.
- OWASP Logging guidance recommends verified event handling and avoiding
  unwanted side effects. The artifact emits deterministic JSON and records
  side-effect flags so storage closure can reject accidental mutation claims.
- Node.js documents synchronous file-system APIs as blocking and immediately
  throwing exceptions. That tradeoff remains appropriate because this generator
  is a bounded local/CI evidence command, not request-path runtime code.

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

### Require Explicit Input Evidence

The generator should require an input JSON file instead of constructing a ready
manifest from broad repository scans.

Pros:

- prevents accidental approval fabrication,
- keeps readiness evidence owned by the caller,
- makes missing rollback, support, or approval stance visible.

Cons:

- operators or CI must preserve the input evidence artifact.

### Write The Nested Execution Plan Separately

The script may write the nested compatibility deletion execution plan for
diagnostics and earlier read-only consumers while writing the wrapper artifact
for final-removal audit authority.

Pros:

- supports diagnostic and earlier read-only plan consumers,
- preserves richer generation metadata when desired,
- avoids changing the existing deletion execution-plan contract.

Cons:

- produces two related JSON shapes when `--artifact-output` is used; the raw
  nested plan is not final-removal audit authority.

### Block By Default When The Plan Is Not Ready

The generator should fail non-zero unless the generated execution plan is ready,
with an explicit diagnostic override for blocked artifacts.

Pros:

- avoids feeding blocked plans into removal tooling,
- still supports diagnostic artifact generation when needed,
- keeps deletion readiness conservative.

Cons:

- blocked plans require `--allow-blocked` for troubleshooting output.

### Expose Durable Product-Domain Names

The service, script, version, runner, and tests should use compatibility
deletion execution-plan terminology instead of roadmap phase terminology.

Pros:

- keeps production and CI contracts meaningful after roadmap phases are retired,
- makes the artifact discoverable from its product purpose,
- reduces future naming debt.

Cons:

- requires coordinated updates across validation, requirement audit, roadmap,
  docs, and package scripts.

## Final Recommendation Stack

Use this stack for compatibility deletion execution-plan artifact generation:

1. Require an explicit compatibility deletion input evidence JSON file.
2. Build the nested deletion execution plan through
   `policyCompatibilityDeletionExecutionPlan.mjs`.
3. Wrap the plan with generated timestamp, readiness status, risks, validation,
   and no-side-effect evidence.
4. Refuse to write ready execution-plan output when readiness is blocked unless
   `--allow-blocked` is passed.
5. Optionally write the nested execution-plan JSON for diagnostic and earlier
   read-only consumers.
6. Write the fingerprint-valid wrapper artifact for downstream storage-closure
   final-removal audit tooling.
7. Expose durable compatibility deletion execution-plan artifact service,
   script, runner, version, test, and documentation names.

## Implementation Outcome

Implemented:

- Renamed the service to
  `server/src/services/policyCompatibilityDeletionExecutionPlanArtifact.mjs`.
- Renamed the generator to
  `scripts/generate-policy-compatibility-deletion-execution-plan-artifact.mjs`.
- Renamed the focused test suite to
  `server/src/__tests__/services/policyCompatibilityDeletionExecutionPlanArtifact.test.mjs`.
- Added the root runner
  `npm run policy:compatibility-deletion-execution-plan-artifact`.
- Replaced the phase-coded payload version with
  `policy.compatibility_deletion_execution_plan_artifact.v2` and a deterministic
  SHA-256 artifact fingerprint that binds the current plan and evidence
  summary.
- Updated storage-closure validation and requirement-audit evidence references
  to require the durable execution-plan artifact contract.
- Preserved explicit input requirements, blocked-plan diagnostics,
  side-effect rejection, nested-plan writing, and optional wrapper-artifact
  writing. The v2 wrapper is required by the execution gate, controlled batch
  artifact, and storage-closure final-removal audit; raw execution-plan JSON
  remains available for earlier read-only diagnostic tooling only.

Example:

```bash
npm run --silent policy:compatibility-deletion-execution-plan-artifact -- \
  --input .tmp/policy-storage/execution-plan-input.json \
  --output .tmp/policy-storage/execution-plan.json \
  --artifact-output .tmp/policy-storage/execution-plan-artifact.json
```

Then pass the generated execution-plan artifact into the storage-closure
final-removal audit:

```bash
npm run --silent policy:storage-closure-final-removal-audit -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/final-removal-audit.json
```

## Next Step

Collect preflight evidence bound to the v2 artifact fingerprint, then evaluate
the compatibility deletion execution gate. See
[Policy Compatibility Deletion Execution Artifact Fingerprint](policy-compatibility-deletion-execution-artifact-fingerprint.md).
