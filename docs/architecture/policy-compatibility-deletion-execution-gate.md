# Policy Compatibility Deletion Execution Gate

## Intent

Policy compatibility deletion execution gate is the final pre-execution gate
before compatibility path deletion can move to a separate controlled deletion
step. It does not delete files, archive files, remove routes, remove tests,
mutate storage, write manifests, or run Git commands.

The gate verifies:

- a current v2 execution-plan artifact is ready, valid, and fingerprint-valid,
- its retained evidence-bundle summary is current and coherent with the
  artifact timestamp,
- timestamped preflight evidence names that exact fingerprint,
- worktree cleanliness, backup/restore, approval, final stances, and manifest
  verification are all current and have named actors,
- the preflight checks occurred after the bound artifact was generated.

## Official-Source Research

- SLSA verification guidance says consumers should verify artifact provenance
  before use. The gate recomputes and validates the plan-artifact fingerprint
  before it trusts preflight evidence.
- NIST SP 800-204D recommends verifiable CI/CD artifact provenance. The gate
  ties its final checks to the exact plan and evidence summary that will inform
  controlled removal.
- NIST IR 8397 supports automated verification to reduce inconsistent manual
  checks. Each required preflight record has a timestamp and named actor, and
  the service evaluates all records deterministically.
- OWASP's secure-code-review guidance recommends validating workflow state at
  each trust boundary. Consumers therefore validate that a serialized gate's
  status and risks are still derived from its retained artifact and preflight
  evidence rather than trusting its ready claim alone.
- NIST SSDF recommends integrating secure development practices into the
  lifecycle. The gate applies this with deterministic, focused evidence tests
  for altered preflight, execution-policy, and handoff data.

Sources:

- SLSA, Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- NIST SP 800-204D:
  <https://csrc.nist.gov/pubs/sp/800/204/d/final>
- NIST IR 8397:
  <https://csrc.nist.gov/pubs/ir/8397/final>
- OWASP Secure Code Review Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html>
- NIST SP 800-218, Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>

## Recommendations

### Keep The Gate Non-Destructive

The execution gate should approve or block a later controlled deletion step. It
should not perform deletion itself.

Pros:

- keeps destructive changes reviewable,
- gives tests a stable preflight contract,
- prevents hidden file, route, or storage mutation during evaluation.

Cons:

- deletion still requires a later execution step.

### Require A Bound Artifact Before Preflight

Deletion should not proceed from a raw execution plan and independent boolean
claims. The gate requires a fingerprint-valid v2 artifact, then requires every
preflight record to bind to that artifact fingerprint.

Pros:

- prevents detached preflight checks from authorizing another plan,
- detects manifest or evidence substitution,
- makes the final execution step auditable.

Cons:

- preflight must be regenerated whenever the artifact changes.

### Require Fresh Timestamped Records With Named Actors

The final gate requires fresh worktree, recovery, approval, stance, and
manifest records collected after artifact generation. Every record names the
actor who performed the check.

Pros:

- keeps recovery proof immediately ahead of deletion,
- makes missing or stale actors and timestamps fail closed,
- makes support behavior explicit before compatibility paths disappear.

Cons:

- more conservative than direct automated cleanup.

### Revalidate Serialized Gate Semantics

Any consumer that receives a serialized gate must recompute the artifact and
preflight risks at the gate's recorded observation time. The reported status,
risk IDs, non-destructive execution policy, and controlled-removal handoff must
match that evaluation; a ready claim by itself is never authority.

Pros:

- prevents a modified JSON gate from passing only because its envelope remains
  structurally valid,
- preserves the side-effect-free boundary at every consumer,
- makes the audit trail useful without treating it as a source of authority.

Cons:

- serialized gates are intentionally invalidated when their retained evidence
  is edited,
- consumers must retain the complete, bounded preflight summary.

## Final Recommendation Stack

Use this stack:

1. `policyCompatibilityDeletionExecutionPlanArtifact.mjs` creates a current v2
   artifact with a deterministic fingerprint.
2. `policyCompatibilityDeletionExecutionGate.mjs` validates the artifact and
   bound final worktree, recovery, approval, stance, and manifest records.
3. Every gate consumer revalidates that the serialized status, risks,
   non-destructive policy, and next step still derive from that retained
   evidence.
4. A later controlled deletion component may consume a ready gate output, but
   only that later step should perform file removal.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionExecutionGate.mjs`.
- Updated the contract to v2 with gate status IDs for:
  - ready for controlled deletion,
  - blocked by execution artifact,
  - blocked by preflight evidence,
  - blocked by worktree,
  - blocked by recovery evidence,
  - blocked by approval,
  - blocked by manifest verification.
- Requires a v2 fingerprint-valid execution-plan artifact and matching
  timestamped preflight evidence instead of raw readiness booleans.
- Rejects stale, future, pre-artifact, malformed, or actorless preflight
  records.
- Revalidates serialized gate risk and status derivation from retained artifact
  and preflight evidence; altered ready claims, execution policies, or handoff
  targets cannot validate.
- Added focused tests for artifact mutation, evidence binding, stale records,
  worktree, recovery, approval, stance, manifest, and side-effect blockers.
- The public `policy:controlled-compatibility-removal-batch` command is the
  intentional operator boundary for the gate. It consumes one v2
  execution-plan artifact and bound preflight input, serializes the evaluated
  gate as `executionGate` inside its batch artifact, and is covered by a
  public contract test. A second standalone gate writer would duplicate
  authority without providing a new workflow capability.

Not implemented in this component:

- no file deletion,
- no route removal,
- no test removal,
- no Git command execution,
- no manifest write,
- no storage mutation.

## Next Step

Proceed with **Controlled Compatibility Path Removal**. It must consume the
same evidence-bound artifact used by the ready gate, rather than independently
accepting a plan and a gate that could be from different evaluations.
