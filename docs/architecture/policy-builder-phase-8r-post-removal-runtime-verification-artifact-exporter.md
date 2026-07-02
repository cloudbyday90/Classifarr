# Policy Builder Phase 8R Post-Removal Runtime Verification Artifact Exporter

## Intent

Phase 8R.29 generates a machine-readable Phase 8R.19 post-removal runtime
verification artifact from:

- a Phase 8R.18 apply-result JSON,
- import/reference scan evidence,
- focused runtime/import check evidence,
- focused and full validation evidence.

This component does not remove files, scan source itself, mutate storage, or run
Git. It turns explicit evidence into a verification artifact that can authorize
only the next bounded compatibility-removal batch.

## Official-Source Research

- Git `grep` documents source searching as a way to inspect tracked content.
  This component consumes explicit reference-scan evidence instead of assuming
  removed paths are no longer used.
- NIST SSDF recommends verification and evidence as part of secure software
  development. This component requires apply, reference, runtime, and validation
  proof before cleanup can continue.
- OWASP API9:2023 Improper Inventory Management warns that stale unmanaged
  surfaces expand attack surface. This component keeps removal progress tied to
  inventory and verified absence of references.
- Node.js file-system APIs provide ESM-compatible JSON reads/writes for local
  tooling. The exporter uses bounded file I/O for evidence artifacts only.

Sources:

- Git `grep` documentation:
  <https://git-scm.com/docs/git-grep>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP API9:2023 Improper Inventory Management:
  <https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Consume Apply Evidence, Do Not Infer It

The exporter should require Phase 8R.18 apply-result JSON so it can verify the
exact paths that were removed and the apply result count.

Pros:

- prevents verification of the wrong path set,
- keeps runtime checks tied to the reviewed removal batch,
- makes failed or partial apply evidence block the next batch.

Cons:

- operators must preserve the apply-result artifact.

### Require Reference And Runtime Evidence

The verifier should require completed import/reference scan evidence for every
removed path and at least one focused runtime/import check.

Pros:

- catches stale imports before more paths are removed,
- keeps verification evidence specific to the removal batch,
- prevents broad full-suite success from hiding a missing reference scan.

Cons:

- separate scan/check tooling must produce input evidence.

### Require Focused And Full Validation Evidence

The verifier should require both focused checks and full validation evidence so
the next batch is not authorized from narrow checks alone.

Pros:

- protects local runtime behavior and broader regressions,
- gives Phase 8R.20 authorization a single verified artifact to consume,
- keeps validation evidence auditable.

Cons:

- verification cannot pass until full validation output is available.

## Final Recommendation Stack

Use this stack for Phase 8R post-removal runtime verification:

1. Require Phase 8R.18 apply-result JSON.
2. Require completed import/reference scan evidence for every applied path.
3. Block if any removed path is still referenced.
4. Require focused runtime/import check evidence.
5. Require focused and full validation evidence.
6. Reject storage mutation and Git-command side effects.
7. Write nested Phase 8R.19 verification JSON for Phase 8R.20 authorization.
8. Optionally write a wrapper artifact for audit trails.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8PostRemovalRuntimeVerificationArtifact.mjs`.
- Added `generate-policy-builder-phase-8r-post-removal-verification.mjs`.
- Added root npm script `policy:phase8r:post-removal-verification`.
- Added focused tests for:
  - verified post-removal runtime artifact generation,
  - blocked removed-path reference evidence,
  - blocked runtime check evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.
- Added the post-removal verification artifact suite and this design doc to the
  fixed Phase 8R validation evidence command set.

Example:

```bash
npm run --silent policy:phase8r:post-removal-verification -- \
  --apply-result .tmp/phase8r/removal-apply.json \
  --input .tmp/phase8r/post-removal-verification-input.json \
  --output .tmp/phase8r/post-removal-verification.json \
  --artifact-output .tmp/phase8r/post-removal-verification-artifact.json
```

## Next Step

Use the generated Phase 8R.19 verification JSON as the input for Phase 8R.20
next compatibility removal batch authorization. That authorizer should compare
verified removed paths against the approved manifest and permit only the next
small batch.
