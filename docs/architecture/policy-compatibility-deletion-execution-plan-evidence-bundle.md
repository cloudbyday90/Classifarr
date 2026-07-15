# Policy Compatibility Deletion Execution-Plan Evidence Bundle

## Intent

Compatibility deletion execution planning needs one current observation of the
enabled-policy conversion state, runtime cutover, deletion gates, and readiness
report. Supplying those artifacts separately makes it possible to combine valid
but differently timed inputs into a plan that is no longer current.

This component provides a versioned, read-only evidence bundle. It collects the
database-backed enabled-policy inventory and constructs the runtime-cutover,
deletion-gate, and deletion-readiness evidence under one bounded observation
window. It does not approve a manifest, delete a file, change storage, remove a
route, remove a test, or run a Git command.

## Official-Source Research

- NIST SSDF calls for secure development practices that can be integrated into
  each SDLC implementation. A current, coherent evidence bundle makes the
  deletion-plan input a repeatable, testable change-control activity instead of
  a collection of manually reconciled reports.
- NIST SP 800-53 CM-4 identifies impact analysis as a configuration-management
  control, while its continuous-monitoring guidance emphasizes specific,
  measurable, actionable, relevant, and timely information. The bundle uses a
  bounded freshness window and verifies that its sources agree on the observed
  conversion count.
- SLSA's verification guidance requires provenance to be checked against known
  expectations and recommends rejecting unrecognized parameters. The bundle
  follows the same fail-closed principle: an unknown contract version, invalid
  timestamp, stale evidence, or divergent source count blocks planning.

Sources:

- NIST Secure Software Development Framework, SP 800-218:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SP 800-53 Rev. 5.1, Configuration Management and Continuous Monitoring:
  <https://csrc.nist.gov/CSRC/media/Projects/risk-management/800-53%20Downloads/800-53r5/SP_800-53_v5_1-derived-OSCAL.pdf>
- SLSA, Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>

## Recommendations

### Build One Bundle At Planning Time

Collect the current enabled-policy inventory and derive the deletion gate's
conversion count from that same inventory. Construct the runtime-cutover and
readiness reports using the same timestamp.

Pros:

- prevents a supplied zero conversion count from bypassing current database
  state,
- gives every execution-plan input one identifiable observation window,
- preserves the existing modular contracts instead of duplicating their logic.

Cons:

- a bundle must be regenerated when planning is delayed,
- runtime-cutover samples and safety confirmations remain explicit inputs.

### Enforce Bounded Freshness And Coherence

Accept evidence only when each source has a valid timestamp, is no older than
five minutes, and was created within thirty seconds of the bundle timestamp.
Future timestamps, missing timestamps, and divergent collection windows block
planning.

Pros:

- turns "current" into an enforceable contract,
- detects stale or mixed input artifacts before a deletion plan is generated,
- keeps the threshold conservative without allowing callers to enlarge it.

Cons:

- slow or interrupted operator workflows need to recollect evidence,
- timestamps depend on reasonably synchronized system clocks.

### Make The Artifact Generator Consume The Bundle

The execution-plan artifact generator must use the bundle's readiness and gate
plan. It must not accept separately supplied readiness or gate objects.

Pros:

- prevents the runtime command from bypassing the orchestration boundary,
- retains existing plan-manifest and approval checks,
- leaves the resulting plan side-effect-free.

Cons:

- existing manual artifact input files must add an evidence bundle,
- a bundle that is intentionally blocked can produce only diagnostic output.

## Final Recommendation Stack

1. `policyCompatibilityDeletionCurrentInventory.mjs` reads enabled-policy
   authority metadata from the current database.
2. `policyNativeRuntimeCutoverVerification.mjs` verifies converted and
   unconverted runtime behavior without changing policy state.
3. `policyCompatibilityDeletionGates.mjs` derives the deletion categories and
   uses the measured inventory conversion count.
4. `policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs` binds those
   inputs and deletion readiness to a five-minute, thirty-second-coherence
   observation window.
5. `policyCompatibilityDeletionExecutionPlanArtifact.mjs` consumes the ready
   bundle and creates only the reviewable execution-plan artifact.
6. A later execution gate must still verify fresh backup/restore evidence,
   worktree state, and final operator approval before any deletion can occur.

## Implementation Outcome

Implemented:

- Added `policyCompatibilityDeletionExecutionPlanEvidenceBundle.mjs` with
  versioned status and risk vocabularies.
- Added a read-only loader that queries current enabled-policy authority and
  derives the deletion-gate conversion count from that result.
- Added five-minute source-age and thirty-second source-coherence checks.
- Added source-contract, count-consistency, readiness, risk-count, and
  side-effect validation.
- Added `npm run policy:compatibility-deletion-execution-plan-evidence` to
  generate the evidence bundle from current database state and explicit
  cutover/gate/safety input.
- Updated the execution-plan artifact to require a ready, valid evidence bundle
  and to construct its plan only from the bundle's readiness and gate output.
- Added focused coverage for ready, stale, mismatched, count-divergent,
  loader-derived, validation, and artifact-missing-bundle cases.

Not implemented in this component:

- no compatibility-path deletion,
- no storage mutation,
- no manifest approval or execution,
- no backup/restore verification beyond the explicit readiness input,
- no Git or filesystem mutation other than the CLI's explicitly requested JSON
  output path.

## Operational Execution Boundary

The execution-plan evidence command is repository or CI maintenance tooling,
not a production application endpoint. The production image deliberately copies
only shared `scripts/lib` modules; it does not ship the source-tree generator
entry points or the complete source checkout that the closure scan must inspect.

Run the command from a version-matched reviewed checkout or a controlled
maintenance runner that has an explicit connection to the target database. Do
not copy an unreviewed generator into a running application container to work
around that boundary. The read-only evidence collection should use the least
privileged database access that can read the required policy inventory; later
approval and controlled file-application steps remain separate, named-actor
operations.

## Next Step

Proceed with the existing **Compatibility Path Deletion Execution Gate**. It
should consume a ready current evidence bundle through the execution-plan
artifact and independently recheck the final worktree, backup/restore, and
approval conditions immediately before any controlled removal batch is allowed.
