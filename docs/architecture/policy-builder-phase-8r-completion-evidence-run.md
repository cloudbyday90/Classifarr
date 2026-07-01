# Policy Builder Phase 8R Completion Evidence Run

## Intent

Phase 8R.23 is the operational evidence run that consumes explicit repository
evidence and runs the Phase 8R.22 completion checkpoint against that evidence.
It exists because the checkpoint should stay deterministic and side-effect-free:
it should evaluate supplied proof, not discover files, execute commands, or
claim completion from narrative confidence.

This component normalizes current-state evidence for:

- Phase 8R design documents,
- service, route, migration, and backup/restore wiring contracts,
- focused test files,
- roadmap coverage,
- changelog coverage,
- final compatibility-removal audit output,
- focused, lint, markdown, and full validation results.

The evidence run blocks completion when the supplied artifact inventory is
empty, when any mapped artifact is missing, or when the Phase 8R.22 checkpoint
does not complete.

## Official-Source Research

- NIST SP 800-218 SSDF recommends secure development practices throughout the
  SDLC, including verification and evidence that security requirements are met.
  Phase 8R.23 applies this by requiring explicit component, test, documentation,
  and validation proof before closing the native-storage migration phase.
- NIST SP 800-128 frames security-focused configuration management around
  controlled change, integrity, and traceable configuration evidence. Phase
  8R.23 applies this by consuming an explicit artifact inventory instead of
  inferring state from a mutable working tree scan inside the service.
- OWASP SAMM treats verification and governance as repeatable assurance
  activities. Phase 8R.23 applies this by turning phase closure into a reusable
  evidence contract with actionable failure IDs.
- SLSA artifact verification guidance emphasizes inspecting provenance and
  artifact relationships before trusting them. Phase 8R.23 follows that model by
  mapping every Phase 8R component to known docs, code contracts, and tests
  before the checkpoint can pass.
- Node.js file-system documentation supports ESM access to synchronous,
  callback, and promise-based file operations. The current-state evidence
  collector uses bounded synchronous reads because it is a short-lived local/CI
  verification script, not request-path runtime code.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/pubs/sp/800/218/final>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP SAMM:
  <https://owasp.org/www-project-samm/>
- SLSA verifying artifacts:
  <https://slsa.dev/spec/v1.0/verifying-artifacts>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Require An Explicit Artifact Inventory

The evidence run should receive artifact paths from the caller instead of
scanning the filesystem itself.

Pros:

- keeps the service deterministic and easy to test,
- avoids hidden side effects and environment-specific file discovery,
- lets CI, local scripts, or future release tooling decide how evidence is
  gathered.

Cons:

- callers must provide a complete inventory.

### Map Artifacts By Phase ID

Every Phase 8R component should map to expected design docs, contracts, and
tests. Special wiring work, such as native backup/restore integration, should
map to the actual production modules rather than forcing artificial wrapper
files.

Pros:

- reports missing evidence by phase ID,
- supports components implemented through existing production modules,
- keeps the completion report aligned to the roadmap.

Cons:

- the map must be maintained when phase scope changes.

### Compose The Existing Checkpoint

Phase 8R.23 should normalize evidence, then delegate completion judgment to
Phase 8R.22.

Pros:

- avoids duplicating completion logic,
- preserves one source of truth for closure criteria,
- makes the evidence run an adapter around the checkpoint.

Cons:

- checkpoint failures must be inspected through nested evidence output.

### Reject Side Effects

The evidence run should not write files, mutate storage, run commands, or
execute Git. Validation output can be supplied by callers, but command execution
belongs outside the service boundary.

Pros:

- lowers risk in release and audit contexts,
- keeps unit tests deterministic,
- prevents a completion check from changing the evidence it evaluates.

Cons:

- requires separate orchestration to gather fresh validation results.

### Split Collection From Evaluation

The current-state collector may read repository files and gather artifact
presence, but the evidence-run evaluator should remain pure and accept evidence
as input.

Pros:

- keeps closure rules reusable in tests, CI, and release workflows,
- allows the collector to evolve without changing checkpoint semantics,
- makes it clear which layer reads files and which layer decides completion.

Cons:

- introduces one extra orchestration boundary.

## Final Recommendation Stack

Use this stack for Phase 8R.23:

1. Accept explicit artifact inventory grouped by service, route, migration,
   test, documentation, wiring, and other paths.
2. Normalize path separators so Windows and POSIX callers produce the same
   evidence.
3. Map Phase 8R.1 through Phase 8R.22 to expected artifacts.
4. Convert mapped artifact presence into component evidence for the Phase 8R.22
   checkpoint.
5. Compose the Phase 8R.22 checkpoint with roadmap, final-removal audit,
   validation, and changelog evidence.
6. Block completion when artifact inventory is empty, artifact coverage is
   missing, the checkpoint is incomplete, checkpoint validation fails, or any
   side effect is reported.
7. Provide a root script for local or CI execution that prints the current
   evidence run as JSON and can optionally fail when completion is required.

## Implementation Outcome

Implemented:

- Added `policyBuilderPhase8CompletionEvidenceRun.mjs`.
- Added `policyBuilderPhase8CurrentEvidenceCollector.mjs`.
- Added `scripts/run-policy-builder-phase-8r-evidence.mjs`.
- Added root npm script `policy:phase8r:evidence`.
- Added a Phase 8R artifact map from 8R.1 through 8R.22.
- Mapped Phase 8R.10 to the live backup/restore production modules:
  `backupService.mjs`, `backupRestore.mjs`, and `backupRestoreTables.mjs`.
- Added current-state artifact inventory collection from the repository
  checkout.
- Added roadmap evidence extraction from Phase 8R headings and work-sequence
  items.
- Added changelog evidence extraction from component labels.
- Added Windows path normalization for supplied artifact inventories.
- Added artifact inventory status and risk reporting.
- Composed the Phase 8R.22 completion checkpoint instead of duplicating closure
  rules.
- Added focused tests for:
  - complete evidence,
  - Windows path normalization,
  - missing inventory,
  - missing mapped artifacts,
  - roadmap and final-removal-audit blockers,
  - validation and changelog blockers,
  - mutated output validation and side-effect rejection.
  - current-state artifact collection,
  - roadmap/changelog extraction,
  - current-state completion and missing-validation blockers.

Not implemented in this component:

- no command execution,
- no storage mutation,
- no Git command execution,
- no changelog editing,
- no source deletion.

Current-state run:

- `node scripts/run-policy-builder-phase-8r-evidence.mjs` reports all mapped
  Phase 8R artifacts present in the current checkout.
- Validation evidence can now be generated with
  `npm run policy:phase8r:validation-evidence`.
- After supplying generated validation evidence, the run currently blocks Phase
  8R closure only because no machine-readable Phase 8R.21 final-removal-audit
  JSON was supplied.
- The expected closure invocation is:

```bash
node scripts/run-policy-builder-phase-8r-evidence.mjs \
  --final-removal-audit .tmp/phase8r/final-removal-audit.json \
  --validation-evidence .tmp/phase8r/validation-evidence.json \
  --require-complete
```

## Next Step

Generate machine-readable Phase 8R.21 final removal audit evidence, then run
the current-state evidence script with validation evidence and
`--require-complete`. If the evidence run reports complete, Phase 8R can be
closed; otherwise, continue with the exact missing phase, artifact, validation,
or changelog evidence reported by the run.
