# Policy Storage Closure Requirement Audit

## Intent

The policy storage closure requirement audit proves that every mapped storage
closure component has current implementation evidence before the closure
sequence is treated as complete.

The audit consumes a generated v3 policy storage current closure audit, first
validates its fingerprint and deterministic replay, then checks
the current checkout for each mapped component's design/outcome document,
service/script/route/migration/wiring evidence, focused test evidence, and
roadmap component section and work-sequence entry. It separately requires one
durable Native Policy Intent Storage outcome under `Unreleased`; release notes
must describe the shipped result rather than repeat every internal component.

The service is read-only. It reads repository files through injected file
accessors, consumes supplied evidence, and does not run tests, run Git, write
files, mutate storage, or write manifests.

## Official-Source Research

- NIST SSDF frames secure software work as repeatable practices across the
  software development lifecycle. The audit uses explicit current-state
  implementation, validation, and documentation evidence before a completion
  claim is accepted.
- NIST SP 800-128 frames security-focused configuration management as controlled
  change with traceable integrity evidence. The audit keeps roadmap, changelog,
  docs, contracts, tests, and closure-artifact evidence separate so drift is
  visible.
- OWASP Logging Cheat Sheet recommends consistent, attributable, bounded event
  records. The audit emits structured status, risk, summary, and final-decision
  fields instead of embedding raw command logs or ambiguous prose.
- OWASP Input Validation Cheat Sheet recommends server-side syntactic and
  semantic validation with allow-listed values. The public command validates
  its explicit artifact input before the audit evaluates any status field.
- SLSA artifact verification requires provenance to be checked against known
  expectations and to fail for unrecognized parameters. The audit verifies the
  current-closure fingerprint and replay before it accepts the artifact as
  closure evidence. This is local integrity verification, not a substitute for
  signed provenance or a trusted build identity.
- Git `mv` documents explicit repository rename handling. The module cutover
  uses durable filenames and stale-reference scans so old phase-coded module
  names do not remain as compatibility debt.

Sources:

- NIST Secure Software Development Framework project:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- OWASP Input Validation Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html>
- SLSA Build: Verifying Artifacts:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>
- Git `mv` documentation:
  <https://git-scm.com/docs/git-mv>

## Recommendations

### Keep The Audit Side-Effect-Free

The closure requirement audit should only read repository files and supplied
evidence. Validation generation, Git checks, and command execution should remain
outside the pure decision service.

Pros:

- safe to run during release, upgrade, and local verification workflows,
- deterministic and easy to test with injected file readers,
- prevents the audit from changing the evidence it evaluates.

Cons:

- callers must generate current-closure and validation evidence first.

### Use Component-Oriented Evidence

The audit should expose storage closure component IDs instead of phase IDs in
its public payload. Historical roadmap labels can be parsed as source data, but
the emitted contract should use `componentId` and `missing*ComponentIds`.

Pros:

- keeps production payloads durable after the implementation phase is complete,
- avoids coupling future closure checks to temporary phase naming,
- makes the audit easier for operators to understand.

Cons:

- roadmap parsing still needs to understand historical `8R.*` labels until the
  roadmap itself is retired or migrated.

### Preserve Separate Evidence Classes

Roadmap coverage, changelog coverage, file presence, current closure status, and
side-effect checks should remain separate risk classes.

Pros:

- identifies the exact missing proof instead of returning a generic failure,
- prevents docs or changelog drift from being masked by passing tests,
- supports focused remediation.

Cons:

- completion can block on non-code evidence even when runtime tests pass.

### Verify The Closure Artifact Before Reading Its Status

The requirement audit must consume a current closure artifact only after the
artifact fingerprint is valid, its retained inputs are present, and deterministic
replay recreates the exact artifact. It must use the replayed audit rather than
the caller-supplied status summary.

Pros:

- prevents altered, stale, or detached closure summaries from satisfying the
  final gate,
- makes the downstream decision reproduce the same current-state evidence,
- preserves clear integrity risks without running repository commands.

Cons:

- artifact verification requires an asynchronous, pure replay step,
- legacy v1 current-closure artifacts are intentionally not accepted,
- an actor able to alter every retained input and recompute the unsigned
  fingerprint requires an external trusted-execution or attestation boundary.

### Verify The Public Artifact Chain Outside The Catalog

The public current-closure and requirement-audit commands should be run in
sequence against an isolated mapped checkout. The proof must show that a
complete current-closure artifact produces a complete requirement audit, an
altered input writes no final audit by default, and a requirement-only missing
artifact produces output only with explicit diagnostic allowance.

This command proof belongs to the fixed closure-validation catalog, rather than
the requirement-component catalog evaluated by the audit. That preserves an
independent check instead of allowing the audit to self-certify its own test.

Pros:

- verifies the real public command sequence and file-write policy,
- detects drift between current-closure provenance and requirement-audit input,
- keeps altered or incomplete closure evidence fail-closed.

Cons:

- requires temporary mapped-checkout fixtures,
- repeats a small amount of pure service coverage at the command boundary.

## Final Recommendation Stack

1. Use `policyStorageClosureRequirementAudit.mjs` as the pure decision service.
2. Use `run-policy-storage-closure-requirement-audit.mjs` as the CLI wrapper.
3. Expose `npm run policy:storage-closure-requirement-audit`.
4. Emit `policy.storage_closure_requirement_audit.v3` only after replayed
   current-closure evidence has a matching selected-checkout content fingerprint.
5. Use component-oriented payload fields:
   `componentId`, `componentCatalog`,
   `missingSequenceComponentIds`, `missingImplementationStatusComponentIds`,
   and `missingComponentIds`.
6. Require a complete, fingerprint-valid, replay-verified policy storage
   current closure audit.
7. Require mapped design, contract/wiring, and test evidence for every closure
   component.
8. Require roadmap coverage for every closure component and the durable
   Unreleased storage outcome note.
9. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes inside the service.
10. Verify the public current-closure to requirement-audit sequence in an
    isolated mapped checkout and register the proof in fixed validation evidence.

## Implementation Outcome

Implemented:

- Added `policyStorageClosureRequirementAudit.mjs`.
- Reused `policyStorageReleaseNoteCoverage.mjs` so one durable Unreleased
  storage outcome proves release-note coverage without requiring component
  labels in the changelog.
- Added `run-policy-storage-closure-requirement-audit.mjs`.
- Added root npm script `policy:storage-closure-requirement-audit`.
- Added focused tests for:
  - complete closure requirement audit generation,
  - incomplete current closure evidence blocking,
  - missing mapped artifact blocking,
  - missing roadmap coverage blocking,
  - missing changelog coverage blocking,
  - forbidden side-effect rejection,
  - validation invariants.
- Added component-oriented evidence extraction for roadmap coverage and
  outcome-oriented evidence extraction for the Unreleased storage note.
- Replaced phase-coded payload versioning, constants, builders, validators, and
  operator messages with durable policy-storage names.
- Updated the requirement audit to v2. It now rejects missing, malformed,
  altered, or non-replayable current-closure audit artifacts before evaluating
  their completion status, then relies only on the replayed artifact.
- Added a public command-chain test that generates a real current-closure
  artifact in an isolated mapped checkout before invoking the requirement audit.
  It verifies coherent complete output, fail-closed altered input, and explicit
  blocked diagnostics for requirement-only missing evidence.

Example:

```bash
npm run --silent policy:storage-closure-requirement-audit -- \
  --current-closure-audit .tmp/policy-storage/current-closure-audit.json \
  --output .tmp/policy-storage/closure-requirement-audit.json \
  --require-complete
```

## Next Step

Reconcile the roadmap work sequence with every mapped storage-closure component,
then run the requirement audit with current closure evidence. If it blocks,
resolve the reported component, roadmap, or validation evidence rather than
expanding release notes into an implementation diary.
