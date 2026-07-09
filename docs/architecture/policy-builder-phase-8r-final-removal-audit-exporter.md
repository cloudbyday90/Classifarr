# Policy Builder Phase 8R Final Removal Audit Exporter

## Intent

Phase 8R closure requires machine-readable Phase 8R.21 compatibility-removal
audit evidence. The final-removal audit exporter creates that JSON from:

- a Phase 8R.15 execution-plan manifest,
- current checkout path state,
- source reference-scan evidence,
- optional validation evidence JSON.

The exporter does not delete files, archive files, mutate storage, run Git, or
claim completion while approved manifest paths still exist. It produces the
audit JSON consumed by `npm run policy:storage-closure-evidence`.

## Official-Source Research

- NIST SP 800-218 SSDF treats artifacts as evidence and recommends preserving
  verification records during secure development. The exporter turns removal
  state into a structured artifact instead of relying on a manual note.
- OWASP SAMM Verification focuses on checking and testing artifacts produced
  throughout development. The exporter verifies the final removal state against
  a concrete manifest.
- SLSA artifact verification guidance emphasizes that provenance only helps
  when inspected. The exporter inspects the manifest paths and emits the result
  for the policy storage closure evidence run.
- Node.js file-system APIs are available through ESM and support synchronous
  operations. The exporter uses bounded synchronous reads because it is a
  short-lived local/CI verification tool, not request-path runtime code.

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

### Require An Execution Plan

The exporter should require a Phase 8R.15 execution-plan JSON file rather than
inventing a manifest from broad searches.

Pros:

- keeps the audit tied to approved deletion intent,
- prevents broad accidental source inventory from becoming deletion scope,
- makes missing manifest evidence explicit.

Cons:

- callers must preserve or regenerate the execution-plan artifact.

### Derive Remaining Inventory From The Checkout

The exporter should inspect whether each manifest path still exists and report
those paths as remaining inventory.

Pros:

- prevents false completion claims,
- gives the next removal batch an exact remaining list,
- makes the evidence runner reflect the repository state.

Cons:

- path existence alone does not prove no references remain.

### Scan Source References Separately

The exporter should scan product/runtime source locations for exact manifest
path strings and feed those references into the Phase 8R.21 audit. Control-plane
inventory services, Phase audit services, and test files may intentionally
retain manifest path strings as evidence; those references should not be
treated as live product dependencies.

Pros:

- catches lingering imports or references after file removal,
- keeps docs/changelog references from blocking runtime closure,
- preserves bounded reference metadata.
- prevents deletion-manifest evidence from blocking its own completion audit.

Cons:

- exact-string scans do not replace focused runtime tests.
- tests still need to run separately because the product/runtime reference scan
  intentionally excludes test files.

## Final Recommendation Stack

Use this stack for Phase 8R final-removal audit evidence:

1. Require an explicit Phase 8R.15 execution-plan JSON file.
2. Read the approved manifest paths from that file.
3. Inspect current checkout path existence for each manifest path.
4. Build Phase 8R.20-compatible completion authorization evidence from current
   remaining/removed path state.
5. Build Phase 8R.19-compatible removal verification evidence for paths that no
   longer exist.
6. Scan product/runtime source roots for exact manifest path references while
   excluding tests and Phase 8R control-plane manifest/audit services.
7. Compose the existing Phase 8R.21 compatibility-removal completion audit.
8. Emit the audit JSON without mutating source, storage, Git, or manifests.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8FinalRemovalAuditEvidence.mjs`.
- Added `generate-policy-builder-phase-8r-final-removal-audit.mjs`.
- Added root npm script `policy:phase8r:final-removal-audit`.
- Added focused tests for:
  - path-state derivation,
  - remaining-inventory reporting,
  - complete audit evidence when paths are gone,
  - final-scan reference blockers,
  - missing-validation blockers.
- Hardened the reference scanner so Phase 8R control-plane services, legacy
  compatibility inventory, and test files do not count as product/runtime
  dependencies on removed manifest paths.

Example:

```bash
npm run --silent policy:phase8r:final-removal-audit -- \
  --execution-plan .tmp/phase8r/execution-plan.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/phase8r/final-removal-audit.json
```

Then pass the generated audit into the closure evidence run:

```bash
npm run --silent policy:storage-closure-evidence -- \
  --final-removal-audit .tmp/phase8r/final-removal-audit.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json
```

## Next Step

Generate or preserve the real Phase 8R.15 execution-plan JSON, run the
final-removal-audit exporter, and then rerun the policy storage closure evidence
checkpoint.
If the exporter reports remaining inventory, continue the controlled removal
loop rather than closing Phase 8R.
