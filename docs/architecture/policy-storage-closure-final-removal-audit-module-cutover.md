# Policy Storage Closure Final Removal Audit Module Cutover

## Intent

This cutover removes temporary phase-coded names from the final removal audit
module while preserving the underlying storage-closure evidence behavior.

The final audit remains the read-only proof step that checks approved deletion
manifest paths, product/runtime references, and validation evidence before the
storage closure evidence run can claim completion.

## Official-Source Research

- NIST SSDF recommends risk-based secure development with traceable practices
  and evidence. Durable product-domain module names make evidence artifacts
  understandable after a roadmap phase is complete.
- NIST SP 800-128 emphasizes controlled configuration change and monitoring of
  current configuration state. The renamed module keeps that current-state check
  intact while removing temporary sequencing language from its contract.
- OWASP Logging guidance recommends consistent fields, verification, and no
  unwanted side effects. The cutover keeps the JSON shape explicit and keeps
  generation read-only.
- Node.js ESM `node:fs` APIs are the supported runtime surface for this
  generator. The command remains a bounded local/CI tool, so synchronous
  filesystem reads are acceptable and easy to reason about.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>

## Recommendations

### Rename The Public Contract

Use `policyStorageClosureFinalRemovalAudit` for the service, focused tests,
builder export, and package-script runner.

Pros:

- aligns the module with storage closure instead of roadmap chronology,
- keeps imports discoverable by product intent,
- reduces future cleanup when phase labels are retired.

Cons:

- requires coordinated reference updates across validation, docs, tests, and
  runners.

### Keep Behavior Stable

The cutover should not change path-state derivation, reference scanning,
validation gating, remaining-inventory reporting, or completion semantics.

Pros:

- avoids changing storage-closure behavior during a naming cutover,
- keeps focused test coverage meaningful,
- narrows review to contract naming and docs.

Cons:

- deeper scanner improvements must remain separate future work.

### Preserve Read-Only Execution

The generator should continue to emit JSON only. It should not delete files,
archive files, mutate storage, or run Git.

Pros:

- keeps audit generation safe in local and CI runs,
- supports repeatable verification,
- keeps destructive compatibility removal in explicit controlled-removal steps.

Cons:

- operators must run the controlled-removal flow separately when inventory
  remains.

## Final Recommendation Stack

1. Rename the final removal audit service, test, script, runner, payload
   version, and builder export to storage-closure terminology.
2. Update closure requirement and validation evidence maps to require the new
   paths.
3. Update roadmap, design records, handoff docs, and changelog references.
4. Preserve the existing read-only final audit behavior and focused tests.
5. Validate both direct command help and package runner help.

## Implementation Outcome

Implemented:

- `policyStorageClosureFinalRemovalAudit.mjs`
- `policyStorageClosureFinalRemovalAudit.test.mjs`
- `generate-policy-storage-closure-final-removal-audit.mjs`
- `policy:storage-closure-final-removal-audit`
- `policy.storage_closure_final_removal_audit.v1`
- validation-evidence markdown coverage for this cutover record

The cutover keeps the final audit as a storage-closure evidence artifact and
leaves execution-plan artifact naming as the next remaining phase-coded input
surface.

## Next Step

Proceed with the execution-plan artifact exporter module naming cutover.
