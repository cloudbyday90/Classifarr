# Policy Storage Closure Final Removal Audit

## Intent

The policy storage closure final removal audit creates the machine-readable
evidence that proves an approved compatibility-removal manifest has reached a
safe terminal state.

The audit is intentionally read-only. It consumes:

- an approved compatibility deletion execution-plan artifact,
- current checkout path state,
- product/runtime source reference-scan evidence,
- optional policy storage closure validation evidence.

It does not delete files, archive files, mutate storage, run Git, or claim
completion while approved manifest paths still exist. The generated audit JSON
is consumed by `npm run policy:storage-closure-evidence`.

## Official-Source Research

- NIST SSDF frames secure software development as risk-based, evidence-backed,
  and outcome-oriented rather than checklist-only. The final removal audit fits
  that model by turning repository state, manifest state, and validation state
  into a durable artifact before storage closure is considered complete.
- NIST SP 800-128 describes security-focused configuration management as a
  process that benefits from controlled configuration change and current-state
  monitoring. The final audit therefore checks the actual checkout instead of
  trusting that an intended deletion happened.
- OWASP Logging guidance recommends consistent event fields, verification of
  logging mechanisms, and avoiding unwanted side effects. The audit uses a
  structured JSON contract with explicit status, path state, scan state,
  validation state, and completion status while remaining side-effect-free.
- Node.js documents synchronous file-system APIs as blocking and immediately
  throwing exceptions. That tradeoff is acceptable here because the generator is
  a bounded local/CI verification command, not request-path runtime code.

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

### Require An Explicit Deletion Execution Plan

The generator should require an approved compatibility deletion execution-plan
JSON file rather than inventing a manifest from broad searches.

Pros:

- keeps the audit tied to approved deletion intent,
- prevents broad accidental source inventory from becoming deletion scope,
- makes missing manifest evidence explicit.

Cons:

- callers must preserve or regenerate the execution-plan artifact.

### Derive Remaining Inventory From The Checkout

The generator should inspect whether each manifest path still exists and report
those paths as remaining inventory.

Pros:

- prevents false completion claims,
- gives the next removal batch an exact remaining list,
- makes the evidence runner reflect the repository state.

Cons:

- path existence alone does not prove no references remain.

### Scan Product References Separately

The generator should scan product/runtime source locations for exact manifest
path strings and feed those references into the final import/reference scan.
Named control-plane evidence services and tests may intentionally retain
manifest path strings as evidence; those references should not be treated as
live product dependencies. The scanner must not broadly exclude services by a
temporary implementation-name prefix.

Pros:

- catches lingering imports or runtime references after file removal,
- keeps docs, changelog, tests, and audit-control references from blocking
  runtime closure,
- preserves bounded reference metadata,
- prevents deletion-manifest evidence from blocking its own completion audit.

Cons:

- exact-string scans do not replace focused runtime tests,
- tests still need to run separately because the product/runtime reference scan
  intentionally excludes test files.

### Emit A Durable Storage-Closure Contract

The service, script, version, runner, and tests should use storage-closure
domain names instead of phase-coded implementation names.

Pros:

- keeps the audit reusable after roadmap phase labels change,
- makes closure evidence easier to discover from product concepts,
- avoids leaking temporary implementation sequencing into public contracts.

Cons:

- requires coordinated updates across validation, requirement audit, roadmap,
  docs, and package scripts.

## Final Recommendation Stack

Use this stack for final removal audit evidence:

1. Require an explicit compatibility deletion execution-plan JSON file.
2. Read approved manifest paths from that file.
3. Inspect current checkout path existence for each manifest path.
4. Build next-batch authorization evidence from current remaining/removed path
   state.
5. Build post-removal runtime verification evidence for paths that no longer
   exist.
6. Scan product/runtime source roots for exact manifest path references while
   excluding tests and named compatibility-removal control-plane evidence
   services only.
7. Compose the existing policy compatibility removal completion audit.
8. Emit the audit JSON without mutating source, storage, Git, or manifests.
9. Expose the contract through durable storage-closure service, script, runner,
   version, test, and documentation names.

## Implementation Outcome

Implemented:

- Renamed the service to
  `server/src/services/policyStorageClosureFinalRemovalAudit.mjs`.
- Renamed the generator to
  `scripts/generate-policy-storage-closure-final-removal-audit.mjs`.
- Renamed the focused test suite to
  `server/src/__tests__/services/policyStorageClosureFinalRemovalAudit.test.mjs`.
- Added the root runner
  `npm run policy:storage-closure-final-removal-audit`.
- Replaced the phase-coded payload version with
  `policy.storage_closure_final_removal_audit.v1`.
- Updated storage-closure validation and requirement-audit evidence references
  to require the durable final removal audit contract.
- Preserved path-state derivation, remaining-inventory reporting, completion
  proof when paths are gone, final-scan blockers, and missing-validation
  blockers.

Example:

```bash
npm run --silent policy:storage-closure-final-removal-audit -- \
  --execution-plan .tmp/policy-storage/execution-plan.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json \
  --output .tmp/policy-storage/final-removal-audit.json
```

Then pass the generated audit into the closure evidence run:

```bash
npm run --silent policy:storage-closure-evidence -- \
  --final-removal-audit .tmp/policy-storage/final-removal-audit.json \
  --validation-evidence .tmp/policy-storage/validation-evidence.json
```

## Next Step

Proceed with the controlled removal batch artifact module naming cutover so the
batch artifact produced from this execution plan is also exposed through
durable policy-domain naming.
