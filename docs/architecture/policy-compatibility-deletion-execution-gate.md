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
- a separately collected, fingerprint-valid preflight artifact binds checkout,
  manifest, and retained runtime-evidence observations to that exact plan,
- separately supplied operator evidence records recovery, approval, and final
  stances with fresh named-actor timestamps,
- machine observations and human decisions cannot substitute for one another.

## Official-Source Research

- SLSA verification guidance says consumers should verify artifact provenance
  before use and reject unrecognized parameters. The gate recomputes and
  validates both artifact bindings instead of trusting a caller-provided ready
  flag or unrecognized machine claim.
- NIST SP 800-204D recommends verifiable CI/CD artifact provenance. The gate
  ties its final checks to the exact plan and evidence summary that will inform
  controlled removal.
- NIST IR 8397 supports automated verification to reduce inconsistent manual
  checks. Each required preflight record has a timestamp and named actor, and
  the service evaluates all records deterministically.
- OWASP's CI/CD artifact-integrity guidance recommends validating integrity at
  each handoff. Consumers therefore validate that a serialized gate's status,
  risks, and derived preflight attestation still match its retained artifacts
  rather than trusting its ready claim alone.
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
- OWASP, Improper Artifact Integrity Validation:
  <https://owasp.org/www-project-top-10-ci-cd-security-risks/CICD-SEC-09-Improper-Artifact-Integrity-Validation>
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

### Separate Machine And Human Evidence

Deletion should not proceed from raw booleans or a combined evidence object.
The gate derives checkout and manifest continuity only from a full,
fingerprint-valid collector artifact bound to the current plan. It accepts only
recovery, approval, and stance records from separately bound operator evidence.

Pros:

- prevents a caller from presenting a clean-worktree or current-manifest claim
  without its collector provenance,
- prevents a machine observation from becoming a recovery or approval claim,
- detects cross-plan, altered, duplicate, stale, and post-observation evidence.

Cons:

- the collector must be rerun whenever the plan or checkout changes.

### Require Fresh Timestamped Operator Records With Named Actors

The final gate requires fresh recovery, approval, and stance records collected
after artifact generation. Every operator record names the actor who performed
the check; machine observations come from the preflight artifact instead.

Pros:

- keeps recovery proof and approval immediately ahead of deletion,
- makes missing or stale actors and timestamps fail closed,
- keeps human accountability explicit before compatibility paths disappear.

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
2. `policyCompatibilityDeletionPreflightEvidenceArtifact.mjs` collects and
   fingerprints checkout, manifest, and retained runtime-evidence facts.
3. `policyCompatibilityDeletionPreflightAttestation.mjs` revalidates the
   collected artifact against the current execution plan and derives only its
   machine-observed facts.
4. `policyCompatibilityDeletionExecutionGate.mjs` validates separately bound
   recovery, approval, and stance records, then combines them with the derived
   attestation without accepting caller-supplied machine claims.
5. Every gate consumer revalidates that the serialized status, risks,
   non-destructive policy, and next step still derive from retained evidence.
4. A later controlled deletion component may consume a ready gate output, but
   only that later step should perform file removal.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionExecutionGate.mjs`.
- Updated the contract to v3 with gate status IDs for:
  - ready for controlled deletion,
  - blocked by execution artifact,
  - blocked by preflight evidence,
  - blocked by worktree,
  - blocked by recovery evidence,
  - blocked by approval,
  - blocked by manifest verification.
- Requires a v2 fingerprint-valid execution-plan artifact, a full
  fingerprint-valid preflight evidence artifact, and separately bound
  timestamped operator evidence instead of raw readiness booleans.
- Derives checkout and manifest state only from the collector artifact;
  operator evidence containing worktree, manifest, or nested collector claims
  is rejected.
- Rejects stale, future, pre-artifact, cross-plan, altered, duplicate, or
  post-observation preflight evidence before batch assembly.
- Revalidates serialized gate risk and status derivation from retained artifact
  and preflight evidence; altered ready claims, execution policies, or handoff
  targets cannot validate.
- Added focused tests for artifact mutation, evidence binding, stale records,
  worktree, recovery, approval, stance, manifest, and side-effect blockers.
- The public `policy:controlled-compatibility-removal-batch` command is the
  intentional operator boundary for the gate. It consumes one v2
  execution-plan artifact, a separately collected preflight artifact, and
  bound operator evidence; it serializes the evaluated gate as `executionGate`
  inside its batch artifact and is covered by a public contract test. A second
  standalone gate writer would duplicate authority without providing a new
  workflow capability.

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
