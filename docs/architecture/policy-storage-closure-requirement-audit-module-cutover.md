# Policy Storage Closure Requirement Audit Module Cutover

## Intent

Replace the phase-coded completion audit module identity with a durable
policy-storage closure requirement audit name while preserving the existing
completion proof behavior.

This cutover keeps the audit read-only and current-state based. It changes the
module identity, CLI, npm runner, payload version, exported names, and public
evidence fields so the storage closure layer does not depend on temporary
implementation-phase naming.

## Official-Source Research

- NIST SSDF describes secure software development as repeatable lifecycle
  practices. Durable closure audit naming keeps the verification control useful
  after the implementation phase is complete.
- NIST SP 800-128 recommends controlled change management with traceable
  configuration evidence. The cutover updates code, tests, docs, runners,
  validation references, and roadmap references together.
- OWASP Logging Cheat Sheet recommends structured, consistent, bounded event
  records. The audit now emits storage-closure fields such as `componentId`,
  `sourceRoadmapComponentPrefix`, and `stepId` instead of phase-specific payload
  fields.
- Git `mv` documents explicit repository move handling. The implementation uses
  tracked renames and stale-reference scans to avoid leaving compatibility
  wrappers behind.

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

### Remove Phase-Coded Public Names

The service, focused test, CLI, npm runner, version string, constants, builder,
validator, and operator messages should use policy-storage closure requirement
names.

Pros:

- avoids production dependency on temporary implementation labels,
- makes CLI and JSON output understandable after the roadmap phase ends,
- prevents wrapper modules whose only job is compatibility naming.

Cons:

- downstream validation and roadmap references must be updated in the same
  change.

### Emit Component-Oriented Evidence

The cutover should replace public `phaseId` and missing-phase fields with
component-oriented fields. Historical roadmap IDs remain source data only.

Pros:

- makes the output durable and domain-specific,
- keeps future storage closure checks independent from old roadmap labels,
- makes missing evidence easier to present to operators.

Cons:

- tests must be updated to assert the new payload shape.

### Keep Legacy Source Parsing Local

Until the older evidence-map services are cut over, this audit can parse
historical roadmap labels locally and normalize them into component IDs.

Pros:

- avoids expanding this task into unrelated evidence-map refactors,
- prevents stale public output fields,
- keeps the migration path incremental.

Cons:

- the upstream current-evidence collector still needs its own naming cutover.

## Final Recommendation Stack

1. Rename the service to `policyStorageClosureRequirementAudit.mjs`.
2. Rename the focused test to `policyStorageClosureRequirementAudit.test.mjs`.
3. Rename the CLI to `run-policy-storage-closure-requirement-audit.mjs`.
4. Rename the design doc to `policy-storage-closure-requirement-audit.md`.
5. Expose `npm run policy:storage-closure-requirement-audit`.
6. Replace phase-coded versioning, constants, builders, and validators with
   policy-storage closure requirement names.
7. Replace public `phaseId`/missing-phase fields with component-oriented
   fields.
8. Preserve behavior for current-closure validation, component artifact
   coverage, roadmap coverage, changelog coverage, side-effect rejection, and
   complete/blocked final decisions.

## Implementation Outcome

Implemented:

- Renamed the service, test, CLI, and design doc to policy-storage closure
  requirement names.
- Replaced payload versioning with
  `policy.storage_closure_requirement_audit.v1`.
- Replaced exported constants, builder, and validator names with durable
  policy-storage names.
- Replaced final decision output with
  `stepId: policy_storage_closure_requirements_complete`.
- Replaced public missing-evidence fields with component-oriented names.
- Updated validation evidence, roadmap, changelog, npm runner, and docs
  references to the durable audit name.

## Next Step

Proceed with **Validation Evidence Generator module naming cutover** so the
remaining validation command surface can stop naming this closure chain after an
implementation phase.
