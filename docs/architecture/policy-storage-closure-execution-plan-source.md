# Policy Storage Closure Execution-Plan Source

## Intent

The policy storage closure final-removal audit takes its deletion manifest only
from the approved compatibility deletion execution-plan artifact. A raw nested
execution-plan JSON file can support diagnostics and earlier read-only tooling,
but it cannot define the scope of a final-removal audit.

The source resolver is a pure server service. Before exposing a manifest to the
audit, it requires a current, ready, fingerprint-valid artifact and verifies
the nested plan's readiness, manifest approval, approver metadata, entry count,
entry readiness, unique paths, and canonical repository-relative path scope.
It performs no file access, source scan, storage mutation, Git command, or
shell command execution.

## Official-Source Research

- SLSA verification guidance says consumers should compare artifacts with
  expected provenance and reject unrecognized external parameters. The final
  audit therefore accepts one explicit artifact shape rather than an arbitrary
  plan-shaped JSON object.
- SLSA provenance guidance recommends minimizing externally controlled
  parameters and using a single verified configuration artifact where possible.
  Binding manifest scope to the approved wrapper follows that recommendation.
- NIST SSDF includes protecting software components from tampering and
  collecting provenance data as secure development practices. The resolver
  retains bounded artifact identity while rejecting malformed scope.
- Node's path API documents that `path.resolve()` normalizes path segments and
  can resolve an absolute segment independently of its base. The resolver
  rejects absolute, traversal, non-canonical, and duplicate manifest paths
  before the generator can call `existsSync` or the reference scanner.

Sources:

- [SLSA: Verifying artifacts](https://slsa.dev/spec/v1.2/verifying-artifacts)
- [SLSA: Provenance](https://slsa.dev/spec/v1.0/provenance)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)
- [Node.js path API](https://nodejs.org/api/path.html)

## Options

### Continue Accepting Raw Nested Plans

Pros:

- simpler command-line input,
- retains compatibility with older local artifacts.

Cons:

- a caller can substitute a plausible but unapproved manifest,
- no wrapper fingerprint or approval evidence binds the scope,
- unsafe paths can reach filesystem checks.

### Check Only The Wrapper Fingerprint

Pros:

- detects ordinary in-transit changes,
- retains the approved artifact as the source.

Cons:

- does not establish that the artifact is ready or approved,
- does not reject unsafe, duplicate, or incomplete manifest entries,
- cannot stop a re-fingerprinted malformed artifact from widening scan scope.

### Require A Ready Artifact And Validate Its Bounded Manifest

Pros:

- makes the approved wrapper the sole manifest authority,
- rejects raw, legacy, altered, unready, unsafe, duplicate, and unapproved
  sources before filesystem access,
- keeps the resolver deterministic and side-effect-free,
- produces bounded diagnostics suitable for local and CI use.

Cons:

- callers must retain the wrapper artifact output,
- unsigned local fingerprints establish content integrity, not independent
  cross-host authenticity.

## Final Recommendation Stack

1. Require `policy.compatibility_deletion_execution_plan_artifact.v3` as the
   only final-removal manifest source.
2. Require ready status, successful artifact and nested-plan validation, and a
   valid deterministic SHA-256 fingerprint.
3. Require approved manifest metadata, a non-empty approver, matching entry
   count, and ready entries.
4. Accept only canonical, unique repository-relative paths; reject absolute,
   traversal, drive-qualified, and non-canonical paths before filesystem work.
5. Expose the verified nested plan only when all checks pass; otherwise supply
   no manifest paths to the audit.
6. Keep artifact reading, path existence checks, and source scans in the
   generator, outside the pure resolver.
7. For cross-host or release-bound authenticity, verify signed CI provenance
   from a configured trusted builder. The local SHA-256 fingerprint alone does
   not provide that trust boundary.

## Implementation Outcome

Implemented:

- `policyStorageClosureExecutionPlanSource.mjs` resolves the only accepted
  manifest source for final-removal audit generation.
- `policyStorageClosurePathStateEvidence.mjs` binds every checkout observation
  to the resolved artifact fingerprint, while the v3 final audit blocks with
  `blocked_by_execution_plan_artifact` before it can consume any snapshot from
  an invalid source.
- `generate-policy-storage-closure-final-removal-audit.mjs` now requires
  `--execution-plan-artifact` and rejects invalid sources before scanning or
  writing output.
- Focused tests cover valid artifact acceptance, raw-plan rejection,
  fingerprint mismatch, re-fingerprinted traversal and duplicate path
  rejection, and the final audit's fail-closed behavior.

## Next Step

Continue Phase 8R.25 by binding the verified checkout path-state snapshot to
next-batch authorization, so the bounded removal loop retains the same approved
manifest source through its authorization decision.
