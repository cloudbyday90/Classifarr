# Policy Builder Phase 8R Execution Plan Artifact Exporter

## Intent

Policy storage closure final-removal audit requires a concrete Phase 8R.15
execution-plan JSON artifact. The execution-plan artifact exporter creates that
JSON from explicit input evidence and the existing Phase 8R.15 execution-plan
contract.

The exporter does not generate deletion readiness by assumption. It requires
caller-supplied evidence for:

- compatibility deletion readiness,
- deletion gate plan,
- replacement evidence,
- rollback stance,
- support stance,
- manifest approval,
- approving actor.

The exporter writes only JSON evidence. It does not delete files, archive files,
mutate storage, run Git, or perform compatibility-path removal.

## Official-Source Research

- NIST SP 800-218 SSDF treats artifacts as evidence of secure development
  practices and recommends preserving verification material. This exporter
  turns execution-plan readiness into a structured artifact before removal.
- OWASP SAMM Verification focuses on checking artifacts produced during
  software development. This exporter keeps the deletion plan inspectable
  before later deletion gates consume it.
- SLSA artifact verification guidance emphasizes that provenance and artifacts
  are only useful when inspected. This exporter emits a bounded wrapper artifact
  and nested execution-plan JSON that later tools can inspect.
- Node.js file-system APIs are available through ESM and support synchronous
  local tooling operations. The exporter uses bounded synchronous reads/writes
  because it is a short-lived local/CI evidence generator, not request-path
  runtime code.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- OWASP SAMM Verification:
  <https://owaspsamm.org/model/verification/>
- SLSA verifying artifacts:
  <https://slsa.dev/spec/v1.0/verifying-artifacts>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Require Explicit Input Evidence

The exporter should require an input JSON file rather than constructing a ready
manifest from broad repository scans.

Pros:

- prevents accidental approval fabrication,
- keeps readiness evidence owned by the caller,
- makes missing rollback, support, or approval stance visible.

Cons:

- operators or CI must preserve the input evidence artifact.

### Write The Nested Execution Plan Separately

The script should write the nested Phase 8R.15 execution plan to the path that
later tools expect, while optionally writing the wrapper artifact for audit.

Pros:

- keeps policy storage closure final-removal-audit input simple,
- preserves richer generation metadata when desired,
- avoids changing the existing Phase 8R.15 execution-plan contract or the
  policy storage closure final-removal audit contract.

Cons:

- produces two related JSON shapes when `--artifact-output` is used.

### Block By Default When The Plan Is Not Ready

The exporter should fail non-zero unless the generated execution plan is ready,
with an explicit diagnostic override for blocked artifacts.

Pros:

- avoids feeding blocked plans into removal tooling,
- still supports diagnostic artifact generation when needed,
- keeps deletion readiness conservative.

Cons:

- blocked plans require `--allow-blocked` for troubleshooting output.

## Final Recommendation Stack

Use this stack for Phase 8R execution-plan artifact generation:

1. Require an explicit input evidence JSON file.
2. Build the nested Phase 8R.15 execution plan through
   `policyCompatibilityDeletionExecutionPlan.mjs`.
3. Wrap the plan with generated timestamp, readiness status, risks, validation,
   and no-side-effect evidence.
4. Refuse to write ready execution-plan output when readiness is blocked unless
   `--allow-blocked` is passed.
5. Write the nested execution-plan JSON for downstream storage-closure final
   audit tooling.
6. Optionally write the wrapper artifact for audit trails.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8ExecutionPlanArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-execution-plan.mjs`.
- Added root npm script `policy:phase8r:execution-plan`.
- Added focused tests for:
  - ready artifact generation,
  - blocked missing-approval evidence,
  - side-effect rejection,
  - artifact validation invariants.
- Added the execution-plan artifact suite and this design doc to the fixed
  policy storage closure validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:execution-plan -- \
  --input .tmp/phase8r/execution-plan-input.json \
  --output .tmp/phase8r/execution-plan.json \
  --artifact-output .tmp/phase8r/execution-plan-artifact.json
```

Then pass the generated execution plan into the storage-closure final-removal
audit exporter:

```bash
npm run --silent policy:storage-closure-final-removal-audit -- \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/final-removal-audit.json
```

## Next Step

Use the real Phase 8R.14 readiness, Phase 8R.7 deletion-gate plan, replacement
evidence, and approval metadata to generate `.tmp/phase8r/execution-plan.json`,
then continue the controlled 8R.17 through 8R.20 removal loop until the final
audit reports no remaining approved manifest paths.
