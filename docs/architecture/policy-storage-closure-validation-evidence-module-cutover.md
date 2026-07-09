# Policy Storage Closure Validation Evidence Module Cutover

## Intent

This cutover removes production-facing Phase 8R naming from the validation
evidence generator and contract while preserving the same fixed validation
checks, bounded evidence payload, and storage closure handoff behavior.

The change is deliberately narrow: it renames the validation evidence module,
tests, CLI runner, npm script, docs, exported constants, version string, and
operator-facing messages. It does not change the validation command set,
checkpoint semantics, policy storage, or classification behavior.

## Official-Source Research

- NIST SSDF treats secure development practices as repeatable, reviewable
  activities. The validation contract should therefore have stable names that
  describe the durable policy-storage capability, not a temporary implementation
  phase.
- NIST SP 800-128 frames configuration changes as controlled changes with
  traceable evidence. The cutover keeps the validation command set fixed in
  source control and only changes naming boundaries.
- OWASP Logging Cheat Sheet recommends consistent event attributes and bounded
  operational data. The renamed contract preserves bounded status, exit code,
  duration, signal, timestamps, and failure message fields without storing full
  logs.
- Node.js documents `child_process.spawn` as the asynchronous child process API.
  The renamed CLI keeps fixed command specs, array arguments, and `shell: false`
  execution.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js child process API:
  <https://nodejs.org/api/child_process.html>

## Recommendations

### Use Durable Contract Names

Rename the service, constants, builders, version, tests, CLI, npm script, and
docs to policy storage closure validation names.

Pros:

- removes temporary phase language from production-facing validation contracts,
- makes downstream closure audits easier to understand,
- keeps future refactors scoped to durable policy-storage terminology.

Cons:

- callers using the old runner name must switch to the new npm script.

### Preserve Fixed Command Semantics

Keep the existing focused, lint, markdown, and full validation command set
unchanged while renaming the wrapper and payload contract.

Pros:

- avoids mixing rename risk with validation-scope changes,
- preserves closure readiness behavior,
- keeps existing tests meaningful.

Cons:

- remaining not-yet-cutover component names still appear inside focused test
  patterns until their own cutover tasks run.

### Keep Validation Separate From Closure Decisions

The validation generator should emit evidence only. Storage closure audit
services should decide whether that evidence is sufficient.

Pros:

- keeps command execution out of pure closure decision logic,
- lets CI and local workflows regenerate evidence independently,
- preserves deterministic audit behavior.

Cons:

- operators must provide validation evidence before final closure can pass.

## Final Recommendation Stack

1. Rename the contract to
   `server/src/services/policyStorageClosureValidationEvidence.mjs`.
2. Rename the focused tests to
   `server/src/__tests__/services/policyStorageClosureValidationEvidence.test.mjs`.
3. Rename the CLI to
   `scripts/generate-policy-storage-closure-validation-evidence.mjs`.
4. Expose the root runner as
   `npm run policy:storage-closure-validation-evidence`.
5. Emit version `policy.storage_closure_validation_evidence.v1`.
6. Keep command execution shell-free with fixed command specs and array
   arguments.
7. Preserve unknown-check and side-effect rejection.
8. Update roadmap, requirement-audit, changelog, and validation docs to point
   at the durable names.

## Implementation Outcome

Implemented:

- Renamed the validation evidence service, test suite, CLI script, design doc,
  root npm script, exported constants, builder, and payload version.
- Updated closure requirement audit artifact mappings to the durable validation
  evidence paths.
- Updated the validation evidence design note and roadmap references.
- Preserved the focused, lint, markdown, and full validation command set.
- Preserved bounded command metadata, failure metadata, unknown-check rejection,
  side-effect rejection, and no policy-storage mutation guarantees.

## Next Step

Proceed with **Completion Evidence Run module naming cutover** so the storage
closure evidence runner can stop exposing Phase 8R names in its public contract.
