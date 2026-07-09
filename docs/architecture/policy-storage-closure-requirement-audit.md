# Policy Storage Closure Requirement Audit

## Intent

The policy storage closure requirement audit proves that every mapped storage
closure component has current implementation evidence before the closure
sequence is treated as complete.

The audit consumes a generated policy storage current closure audit, then checks
the current checkout for each mapped component's design/outcome document,
service/script/route/migration/wiring evidence, focused test evidence, roadmap
component section, work-sequence entry, and changelog coverage.

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

## Final Recommendation Stack

1. Use `policyStorageClosureRequirementAudit.mjs` as the pure decision service.
2. Use `run-policy-storage-closure-requirement-audit.mjs` as the CLI wrapper.
3. Expose `npm run policy:storage-closure-requirement-audit`.
4. Emit `policy.storage_closure_requirement_audit.v1`.
5. Use component-oriented payload fields:
   `componentId`, `sourceRoadmapComponentPrefix`,
   `missingSequenceComponentIds`, `missingImplementationStatusComponentIds`,
   and `missingComponentIds`.
6. Require a complete and valid policy storage current closure audit.
7. Require mapped design, contract/wiring, and test evidence for every closure
   component.
8. Require roadmap and changelog coverage for every closure component.
9. Reject file writes, storage mutation, Git commands, command execution, and
   manifest writes inside the service.

## Implementation Outcome

Implemented:

- Added `policyStorageClosureRequirementAudit.mjs`.
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
- Added component-oriented evidence extraction for roadmap and changelog
  coverage.
- Replaced phase-coded payload versioning, constants, builders, validators, and
  operator messages with durable policy-storage names.

Example:

```bash
npm run --silent policy:storage-closure-requirement-audit -- \
  --current-closure-audit .tmp/policy-storage/current-closure-audit.json \
  --output .tmp/policy-storage/closure-requirement-audit.json \
  --require-complete
```

## Next Step

Proceed with **Storage Closure Validation Evidence module naming cutover** so the
remaining validation command surface can reference durable storage-closure audit
names without phase-coded module identity.
