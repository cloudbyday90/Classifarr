# Policy Storage Closure Evidence Run Module Cutover

## Intent

This cutover removes production-facing phase-coded names from the storage
closure evidence runner and current-state collector while preserving the same
closure evidence behavior.

The change renames the service, collector, tests, CLI runner, npm script, docs,
exported constants, builders, payload versions, and public output fields. It
does not change checkpoint semantics, storage behavior, validation command
execution, or compatibility-removal audit requirements.

## Official-Source Research

- NIST SSDF recommends repeatable verification practices and evidence across
  secure development work. Durable contract names make that evidence reusable
  after implementation phases end.
- NIST SP 800-128 emphasizes traceable, controlled configuration changes. This
  cutover preserves the reviewed artifact map and checkpoint handoff while
  renaming the contract boundary.
- OWASP Logging Cheat Sheet recommends bounded and consistent operational data.
  The renamed contract keeps bounded status, risk, count, missing-path, and
  side-effect evidence.
- Node.js file-system documentation supports explicit repository file reads
  through `fs`. The collector keeps file reads isolated from the pure evidence
  evaluator.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Rename The Public Contract

Use storage-closure service, collector, runner, version, constant, and builder
names.

Pros:

- removes temporary phase labels from production code,
- makes the closure evidence boundary easier to reason about,
- aligns names with the storage closure checkpoint and current-closure audit.

Cons:

- old runner names must be replaced in docs and local workflows.

### Convert Public Fields To Component Semantics

Replace public `phaseId` evidence with `componentId` plus
`sourceRoadmapComponentId`, and replace `nextPhase` with `nextStep`.

Pros:

- eliminates phase-worded production output,
- keeps source roadmap compatibility explicit,
- matches existing storage checkpoint component semantics.

Cons:

- legacy roadmap IDs remain in the artifact map until the roadmap source itself
  is migrated.

### Preserve Read-Only Collection

Keep file reading inside the current-state collector and keep the evidence-run
service side-effect-free.

Pros:

- keeps tests deterministic,
- separates evidence discovery from closure decisions,
- avoids hidden storage, Git, command, or file-write behavior.

Cons:

- callers must still supply validation and final-removal audit JSON.

## Final Recommendation Stack

1. Rename `policyBuilderPhase8CompletionEvidenceRun.mjs` to
   `policyStorageClosureEvidenceRun.mjs`.
2. Rename `policyBuilderPhase8CurrentEvidenceCollector.mjs` to
   `policyStorageClosureCurrentEvidenceCollector.mjs`.
3. Rename the CLI to `run-policy-storage-closure-evidence.mjs`.
4. Expose `npm run policy:storage-closure-evidence`.
5. Rename focused tests to the new service and collector names.
6. Emit storage-closure versions and semantic `nextStep` evidence.
7. Update validation command specs, closure audits, roadmap, changelog, and
   handoff docs.

## Implementation Outcome

Implemented:

- Renamed the evidence-run service, current-state collector, tests, CLI script,
  npm runner, and design doc.
- Updated dependent current-closure, closure-requirement, and validation
  evidence services to use the durable names.
- Replaced public phase-worded evidence output with component-oriented fields.
- Preserved source roadmap ID normalization for existing `8R.*` roadmap content.
- Preserved side-effect rejection and current-state file-read isolation.

## Next Step

Proceed with **Execution Plan Artifact Exporter module naming cutover**.
