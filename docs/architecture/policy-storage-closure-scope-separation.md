# Policy Storage Closure Scope Separation

## Intent

Policy-storage evidence has two valid but different conclusions:

1. **Repository implementation readiness**: whether the checked-out product
   implementation, contracts, documentation, and validation evidence are ready.
2. **Active-installation cutover**: whether one installed instance has completed
   its bounded native-intent and compatibility-removal evidence workflow.

An installation that has not completed a cutover must not cause Classifarr to
report that the repository implementation is incomplete. Conversely, a ready
repository must not authorize deletion, conversion, or automation for an
installation that lacks its own approved evidence.

## Official-Source Research

- NIST SP 800-218 frames secure software development as defined practices that
  produce verifiable software-development evidence. Repository readiness should
  therefore be evaluated from the checked-out source and its validation record,
  not an operator's application data.
- NIST SP 800-18 Rev. 2 distinguishes system-plan responsibilities within an
  authorization boundary. Active-installation state remains a distinct
  operational decision and must not be conflated with software implementation
  assurance.
- NIST supply-chain guidance treats integrity verification as a separate
  concern. The closure output binds both scope summaries into the replayable
  audit fingerprint, so a display-only field cannot change a closure claim.

Sources:

- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [NIST SP 800-18 Rev. 2](https://csrc.nist.gov/pubs/sp/800/18/r2/final)
- [NIST Cybersecurity Supply Chain Risk Management](https://csrc.nist.gov/Projects/cyber-supply-chain-risk-management/publications)

## Recommendations

### Model Both Scopes Explicitly

Every closure evidence surface should expose:

- `implementationReadiness` with `scope: repository`; and
- `instanceCutover` with `scope: active_installation`.

Pros:

- makes repository evidence independent of an operator database;
- gives support and release work a truthful source-readiness result;
- retains a fail-closed installation cutover gate.

Cons:

- consumers must distinguish a complete implementation from complete final
  closure;
- the fingerprinted audit schema must advance when these fields are added.

### Keep Final Closure Strict

Final storage closure remains complete only when both scopes are ready. A
pending active-installation cutover is reported as such, with a dedicated next
step, rather than being misclassified as missing repository implementation.

Pros:

- does not weaken deletion, rollback, or approval safeguards;
- avoids treating incomplete operational evidence as a product defect;
- keeps local application state out of repository-only validation.

Cons:

- an installation still needs its own evidence before legacy removal can
  proceed.

## Final Recommendation Stack

1. Build the two scope summaries from bounded checkpoint evidence only.
2. Keep repository readiness independent of database reads and media-server
   configuration.
3. Require active-installation evidence for final closure, never for the
   repository readiness conclusion.
4. Bind both summaries and their readiness state into the current-closure
   fingerprint and replay validation.
5. Keep all conversion, deletion, and rollback gates unchanged.
6. Return an explicit `policy_storage_instance_cutover` next step when the
   implementation is ready but the active installation is not.

## Implementation Outcome

Implemented:

- Added `policyStorageClosureScopes.mjs` as the shared, pure projection for
  repository implementation readiness and active-installation cutover.
- Reused that projection in the closure evidence run and final closure readout.
- Added top-level scope summaries to the current closure audit and final
  closure readout.
- Added `blocked_by_instance_cutover` to the current closure audit, so an
  otherwise-ready repository is not reported as blocked by generic current
  evidence.
- Added a dedicated operator decision and next step for pending active
  installation cutover.
- Advanced the current closure audit to v4 and its fingerprint to v2 so the
  explicit scope conclusions are integrity-bound and replay-verified.
- Added focused scope, current-audit, and final-readout coverage.

## Security Outcome

The scope projection contains only bounded readiness status, validation state,
risk counts, and risk identifiers. It does not expose database rows, server
addresses, media-library content, environment values, credentials, or deletion
manifest paths. A repository-ready result cannot bypass active-installation
approval, evidence, deletion, or rollback requirements.
