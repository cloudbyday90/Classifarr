# Policy Storage Current Closure Audit Module Cutover

## Intent

Replace the phase-coded current closure audit module identity with a
durable policy-storage current closure audit name while preserving the existing
audit behavior.

This is a naming and contract-boundary cutover, not a new scoring model. The
service still composes current repository evidence, compatibility-removal
completion-audit evidence, validation evidence, the storage completion
checkpoint artifact, and the storage final closure readout.

## Official-Source Research

- NIST SSDF frames secure software work as repeatable practices across the
  development lifecycle. Durable module names make the closure control easier
  to reuse after the implementation phase is complete.
- NIST SP 800-128 treats configuration changes as controlled changes with
  traceable integrity evidence. The cutover updates code, tests, docs, runners,
  and roadmap references together.
- OWASP Logging Cheat Sheet recommends consistent event attributes and avoiding
  ambiguous records. The audit now emits `policy.storage_current_closure_audit.v2`
  and `nextStep` semantics instead of phase-specific runtime identifiers.
- Git `mv` documents explicit index-aware file moves. The implementation uses
  repository moves and stale-reference sweeps so old filenames do not remain as
  compatibility debt.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Keep The Audit Pure And Read-Only

The renamed service should continue to read repository evidence and supplied
artifacts only. It should not run Git, run tests, write manifests, mutate
storage, or generate validation evidence.

Pros:

- keeps closure evidence reproducible,
- keeps the service safe to run during release and local verification,
- lets tests inject repository reads without shelling out.

Cons:

- callers must generate validation and completion artifacts first.

### Use Durable Contract Names

The service, test, CLI, npm runner, version string, constants, and `nextStep`
payload should use policy-storage names instead of implementation-phase names.

Pros:

- removes production dependency on phase labels,
- makes downstream final audit inputs easier to understand,
- prevents another wrapper layer whose only purpose is naming compatibility.

Cons:

- downstream tests and docs must be updated in the same change.

### Preserve Historical Phase IDs Only In Roadmap Evidence

The policy storage closure requirement audit still inventories the roadmap
sequence, so historical component IDs can remain as planning evidence. They
should not define the storage closure module identity.

Pros:

- keeps the completion sequence auditable,
- avoids rewriting historical roadmap structure prematurely,
- separates planning metadata from production module contracts.

Cons:

- phase labels remain visible in the roadmap until the larger closure sequence
  is retired.

## Final Recommendation Stack

1. Rename the service, test, design doc, CLI script, and npm runner to
   policy-storage current closure names.
2. Replace phase-coded exported constants, versioning, and builder/validator
   names with durable policy-storage identifiers.
3. Replace phase-coded `nextPhase` output with semantic `nextStep` output.
4. Update final-requirement audit dependencies to consume the renamed current
   closure audit contract.
5. Update validation evidence and roadmap references to the new filenames and
   root runner.
6. Keep behavior unchanged: missing artifacts, incomplete validation, incomplete
   completion-audit evidence, invalid nested artifacts, and forbidden side
   effects still block completion.

## Implementation Outcome

Implemented:

- Renamed the service to `policyStorageCurrentClosureAudit.mjs`.
- Renamed the focused test to `policyStorageCurrentClosureAudit.test.mjs`.
- Renamed the CLI script to `run-policy-storage-current-closure-audit.mjs`.
- Renamed the design doc to `policy-storage-current-closure-audit.md`.
- Exposed `npm run policy:storage-current-closure-audit`.
- Replaced the payload version with `policy.storage_current_closure_audit.v2`.
- Added retained closure inputs, a bounded SHA-256 fingerprint, and pure
  deterministic replay verification before downstream closure consumption.
- Replaced phase-coded builder, validator, status, and risk exports with
  durable policy-storage names.
- Replaced `nextPhase.phaseId` with `nextStep.stepId`.
- Updated storage closure requirement, validation-evidence, roadmap, and changelog
  references to the durable module names.

## Next Step

Proceed with **Storage Closure Requirement Audit module naming cutover** so the
last storage-closure audit layer can consume durable current-closure evidence
without phase-coded module identity.
