# Policy Storage Completion Checkpoint Module Cutover

## Intent

This cutover removes phase-coded production names from the storage completion
checkpoint service, artifact exporter, CLI runner, tests, and design docs while
preserving checkpoint behavior.

The durable production names are:

- `policyStorageCompletionCheckpoint.mjs`
- `policyStorageCompletionCheckpointArtifact.mjs`
- `policy.storage_completion_checkpoint.v5`
- `policy.storage_completion_checkpoint_artifact.v6`
- `npm run policy:storage-completion-checkpoint`

## Official-Source Research

- NIST SP 800-128 treats configuration changes as controlled, traceable
  security-relevant work. Renaming production modules needs focused tests,
  validation evidence, and clear downstream reference updates.
- NIST SSDF recommends maintaining secure development practices throughout the
  SDLC. This cutover keeps the checkpoint deterministic, validated, and
  side-effect-free while changing its public names.
- OWASP Logging guidance supports clear event meaning and accountability. The
  checkpoint should emit semantic `nextStep` evidence rather than stale
  phase-number handoffs.
- Git `mv` supports explicit tracked file moves. Using tracked moves keeps
  review history clear for renamed production modules and scripts.

Sources:

- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

1. Rename modules, tests, docs, and CLI runner to policy storage names.
2. Rename constants, builders, validators, and payload versions to semantic
   storage names.
3. Replace `nextPhase.phaseId` with `nextStep.stepId`.
4. Keep side-effect guards unchanged.
5. Update downstream evidence maps, closure readout imports, and validation
   command specs.
6. Run focused contract tests plus docs/name-inventory gates before commit.

## Pros And Cons

Pros:

- removes irrelevant phase naming from production checkpoint APIs,
- keeps the checkpoint reusable after the migration roadmap is complete,
- preserves behavior while improving operator-facing language,
- keeps downstream closure tooling wired to durable names.

Cons:

- downstream modules still using phase-coded names need separate follow-up
  cutovers,
- roadmap evidence still carries migration-era identifiers until the broader
  evidence-run contract is renamed.

## Final Recommendation Stack

Use a narrow cutover:

1. Move the checkpoint files with tracked Git renames.
2. Rename public exports and payload versions.
3. Patch runtime messages and `nextStep`.
4. Update downstream imports and scripts.
5. Update design docs and changelog.
6. Validate with focused tests, CLI help, docs lint, production-name inventory,
   and diff checks.

## Implementation Outcome

Implemented:

- Renamed the core checkpoint module and focused test.
- Renamed the wrapper artifact module and focused test.
- Renamed the CLI exporter to
  `scripts/generate-policy-storage-completion-checkpoint.mjs`.
- Renamed the root runner to `policy:storage-completion-checkpoint`.
- Updated version strings, constants, builders, validators, imports, and
  documentation references.
- Replaced production `nextPhase.phaseId` handoffs with semantic `nextStep`
  payloads.
- Bound the checkpoint to the full completion-audit artifact and made the
  checkpoint, exporter, and closure consumers asynchronous so artifact
  fingerprint and replay verification complete before closure status is read.
- Added a fingerprint-bound component scope map so repository implementation
  coverage cannot include active-installation compatibility-removal evidence.
  See [Policy Closure-Map Reconciliation](policy-closure-map-reconciliation.md).

Next:

- Add integrity verification to the current-state closure evidence artifact.
