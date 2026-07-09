# Policy Post-Removal Runtime Verification Artifact Exporter

## Intent

The post-removal runtime verification artifact exporter generates a
machine-readable verification artifact from:

- controlled-removal apply-result JSON,
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
- Node.js file-system APIs support ES Module import syntax for bounded local
  file I/O. The exporter uses file reads/writes only for explicit evidence
  artifacts.

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

The exporter should require controlled-removal apply-result JSON so it can
verify the exact paths that were removed and the apply result count.

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
- gives next-batch authorization a single verified artifact to consume,
- keeps validation evidence auditable.

Cons:

- verification cannot pass until full validation output is available.

## Final Recommendation Stack

Use this stack for post-removal runtime verification artifact export:

1. Require controlled-removal apply-result JSON.
2. Require completed import/reference scan evidence for every applied path.
3. Block if any removed path is still referenced.
4. Require focused runtime/import check evidence.
5. Require focused and full validation evidence.
6. Reject storage mutation and Git-command side effects.
7. Write nested verification JSON for next-batch authorization.
8. Optionally write a wrapper artifact for audit trails.

## Implementation Outcome

Implemented:

- Renamed the artifact service to
  `policyPostRemovalRuntimeVerificationArtifact.mjs`.
- Renamed the generator to `generate-policy-post-removal-verification.mjs`.
- Renamed the root npm script to `policy:post-removal-verification`.
- Updated the contract version to
  `policy.post_removal_runtime_verification_artifact.v1`.
- Renamed exports to:
  - `POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_STATUS_IDS`,
  - `POLICY_POST_REMOVAL_RUNTIME_VERIFICATION_ARTIFACT_RISK_IDS`,
  - `buildPolicyPostRemovalRuntimeVerificationArtifact`,
  - `validatePolicyPostRemovalRuntimeVerificationArtifact`.
- Replaced runtime `nextPhase.phaseId` with semantic `nextStep.stepId`.
- Added focused tests for:
  - verified post-removal runtime artifact generation,
  - blocked removed-path reference evidence,
  - blocked runtime check evidence,
  - forbidden side-effect rejection,
  - artifact validation invariants.

Example:

```bash
npm run --silent policy:post-removal-verification -- \
  --apply-result .tmp/policy-removal/removal-apply.json \
  --input .tmp/policy-removal/post-removal-verification-input.json \
  --output .tmp/policy-removal/post-removal-verification.json \
  --artifact-output .tmp/policy-removal/post-removal-verification-artifact.json
```

## Next Step

Use the generated verification JSON as the input for
**Next Compatibility Removal Batch Authorization module naming cutover**. That
authorizer should compare verified removed paths against the approved manifest
and permit only the next small batch.
