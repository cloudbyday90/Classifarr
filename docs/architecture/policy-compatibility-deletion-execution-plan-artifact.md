# Policy Compatibility Deletion Execution Plan Artifact

## Intent

The policy compatibility deletion execution-plan artifact creates the
fingerprint-valid wrapper consumed by storage-closure final-removal audit and
later controlled-removal tooling. Its nested execution plan is available only
for diagnostics and earlier read-only consumers.

The artifact generator turns explicit compatibility deletion evidence into:

- a nested compatibility deletion execution plan for diagnostics,
- a fingerprint-valid wrapper artifact for final-removal authority,
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
- SLSA verification guidance recommends comparing an artifact against expected
  provenance and rejecting unexpected inputs. The public generator therefore
  distinguishes its fingerprint-valid wrapper artifact, which storage closure
  may consume, from the nested plan JSON, which is diagnostic only.
- NIST SP 800-204D recommends supply-chain controls in CI/CD pipelines. The
  command boundary is tested with ready and blocked evidence so the published
  JSON behavior is as constrained as the service contract.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>
- SLSA artifact verification:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST SP 800-204D:
  <https://csrc.nist.gov/pubs/sp/800/204/d/final>

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

### Verify The Public Exporter Boundary

The public Node command should be tested with the JSON files that an operator
or CI job actually supplies and receives. A ready invocation must write a
fingerprint-valid wrapper artifact that the downstream storage-closure source
resolver accepts. The nested plan output remains diagnostic and must not be
accepted as the authority artifact.

Blocked input must write neither output by default. The command may emit a
bounded blocked diagnostic only when `--allow-blocked` is explicitly supplied;
that diagnostic must remain non-authoritative.

Pros:

- proves the CLI preserves the producer-to-consumer artifact boundary,
- prevents a raw nested plan or incomplete evidence from becoming
  storage-closure authority,
- confirms blocked diagnostics require an explicit operator or CI choice.

Cons:

- process-level checks are slower than direct service tests,
- fixture input needs maintenance as evidence-bundle contracts evolve.

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
7. Verify the public exporter produces authoritative ready output and refuses
   blocked output unless diagnostic export is explicitly enabled.
8. Expose durable compatibility deletion execution-plan artifact service,
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
  `policy.compatibility_deletion_execution_plan_artifact.v3` and a deterministic
  SHA-256 artifact fingerprint that binds the current plan and evidence
  summary, including exact named test-scope fields when present.
- Updated storage-closure validation and requirement-audit evidence references
  to require the durable execution-plan artifact contract.
- Preserved explicit input requirements, blocked-plan diagnostics,
  side-effect rejection, nested-plan writing, and optional wrapper-artifact
  writing. The v3 wrapper is required by the execution gate, controlled batch
  artifact, and storage-closure final-removal audit; raw execution-plan JSON
  remains available for earlier read-only diagnostic tooling only.
- Added a process-level generator suite at
  `server/src/__tests__/scripts/generatePolicyCompatibilityDeletionExecutionPlanArtifact.test.mjs`.
  It proves the public command writes a ready wrapper artifact accepted by the
  downstream storage-closure source resolver, rejects the nested raw plan as
  authority, writes nothing for blocked input by default, and writes a bounded
  non-authoritative blocked diagnostic only with `--allow-blocked`.

Example:

```bash
npm run --silent policy:compatibility-deletion-execution-plan-artifact -- \
  --input .tmp/policy-storage/execution-plan-input.json \
  --output .tmp/policy-storage/execution-plan.json \
  --artifact-output .tmp/policy-storage/execution-plan-artifact.json
```

Capture a replayable checkout snapshot for that exact generated artifact before
the storage-closure final-removal audit:

```bash
npm run --silent policy:storage-closure-path-state-evidence -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --output .tmp/policy-storage/path-state-evidence.json
```

Then pass the generated execution-plan artifact and its snapshot into the
storage-closure final-removal audit together with the existing reviewed
authorization inputs:

```bash
npm run --silent policy:storage-closure-final-removal-audit -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --path-state-evidence .tmp/policy-storage/path-state-evidence.json \
  --next-batch-authorization-artifact \
    .tmp/policy-storage/next-batch-authorization-artifact.json \
  --review-artifact-fingerprint "$REVIEW_ARTIFACT_FINGERPRINT" \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/final-removal-audit.json
```

## Next Step

Collect preflight evidence bound to the current artifact fingerprint, then evaluate
the compatibility deletion execution gate. See
[Policy Compatibility Deletion Execution Artifact Fingerprint](policy-compatibility-deletion-execution-artifact-fingerprint.md).
