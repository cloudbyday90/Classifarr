# Policy Storage Closure Final Removal Audit

## Intent

The policy storage closure final removal audit creates the machine-readable
evidence that proves an approved compatibility-removal manifest has reached a
safe terminal state.

The audit is intentionally read-only. It consumes:

- an approved compatibility deletion execution-plan artifact as its only
  manifest source,
- a fingerprint-valid next-batch authorization artifact with embedded runtime
  evidence,
- the applied removal-review artifact fingerprint,
- fingerprint-valid, replay-verified current checkout path-state evidence,
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
- SLSA recommends verifying artifacts against expected provenance and rejecting
  unrecognized external parameters. The audit therefore validates one
  versioned artifact contract before it accepts any manifest path.

Sources:

- NIST Secure Software Development Framework:
  <https://csrc.nist.gov/projects/ssdf>
- NIST SP 800-128:
  <https://csrc.nist.gov/pubs/sp/800/128/upd1/final>
- OWASP Logging Cheat Sheet:
  <https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html>
- Node.js file system API:
  <https://nodejs.org/api/fs.html>
- SLSA artifact verification:
  <https://slsa.dev/spec/v1.2/verifying-artifacts>

## Recommendations

### Require An Approved Execution-Plan Artifact

The generator should require the ready, fingerprint-valid compatibility
deletion execution-plan artifact rather than accepting a raw nested plan or
inventing a manifest from broad searches. Its manifest must retain approval and
approver metadata, matching ready entries, and canonical repository-relative
paths before the generator checks the checkout.

Pros:

- keeps the audit tied to approved deletion intent,
- prevents a plan-shaped JSON file from becoming deletion scope,
- rejects traversal, absolute, duplicate, and non-canonical paths before any
  filesystem work,
- prevents broad accidental source inventory from becoming deletion scope,
- makes missing manifest evidence explicit.

Cons:

- callers must preserve or regenerate the wrapper artifact rather than only
  its nested plan.

### Consume A Replay-Verified Checkout Snapshot

The path-state collector should inspect each approved manifest path once and
write a fingerprinted evidence artifact. The final-removal audit should consume
only the verified replayed snapshot, then report its existing paths as remaining
inventory.

Pros:

- prevents false completion claims and live-read drift,
- gives the next removal batch an exact remaining list,
- makes the evidence runner reflect a retained repository observation.

Cons:

- path existence alone does not prove no references remain,
- a snapshot must be regenerated after checkout changes.

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

### Verify The Public Generator As One Artifact Chain

The generator should have an end-to-end contract test that invokes the public
Node command against a temporary checkout. The test should pass the ready
execution-plan artifact, replay-verified checkout snapshot, next-batch
authorization artifact with retained runtime evidence, review fingerprint, and
validation evidence through the same JSON file boundary used by operators.

It should prove a complete path and fail closed when either a live product
reference remains or the checkout snapshot belongs to another plan artifact.

Pros:

- proves the CLI composes the artifact chain, current-source scanner, and
  completion audit instead of merely testing them independently,
- exercises the external JSON boundary without any real repository, storage,
  Git, or deletion side effect,
- keeps an altered or cross-artifact input from quietly producing a complete
  closure result.

Cons:

- process-level tests take longer than direct service tests,
- fixture artifacts must remain current with the versioned contracts.

## Final Recommendation Stack

Use this stack for final removal audit evidence:

1. Require a ready, fingerprint-valid compatibility deletion execution-plan
   artifact JSON file.
2. Validate the nested plan and expose only its approved, canonical, unique,
   repository-relative manifest paths.
3. Capture current checkout path state for each manifest path in a fingerprinted
   evidence artifact, then replay it before the audit uses it.
4. Revalidate the supplied next-batch authorization artifact, its embedded
   runtime evidence, its path-state evidence, and its applied removal-review
   fingerprint. Require its retained execution-plan artifact fingerprint to
   equal the final audit's approved source.
5. Compare the authorized removed and remaining path sets with the current
   checkout before reporting any status.
6. Scan product/runtime source roots for exact manifest path references while
   excluding tests and named compatibility-removal control-plane evidence
   services only.
7. Compose the existing policy compatibility removal completion audit.
8. Emit the audit JSON without mutating source, storage, Git, or manifests.
9. Exercise the public generator against both complete and adversarial artifact
   chains, including a live source reference and cross-artifact snapshot.
10. Expose the contract through durable storage-closure service, script, runner,
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
- Updated the payload version to
  `policy.storage_closure_final_removal_audit.v3`.
- Updated storage-closure validation and requirement-audit evidence references
  to require the durable final removal audit contract.
- Requires `policy.storage_closure_path_state_evidence.v1`, replays its
  retained approved artifact and observations, and blocks when it is missing,
  altered, non-captured, stale-source, or cross-artifact.
- Preserved remaining-inventory reporting, completion proof when paths are
  gone, final-scan blockers, and missing-validation blockers.
- Requires a fingerprint-valid next-batch authorization artifact and its
  applied removal-review fingerprint instead of synthesizing authorization from
  checkout state. Its retained execution-plan artifact fingerprint must equal
  the final audit's source, and its runtime removals must agree with its
  replay-verified checkout snapshot.
- Compares the artifact's removed and remaining path sets with the current
  checkout before a storage-closure result can be reported.
- Rejects raw nested plans, invalid or unready artifacts, bad fingerprints,
  incomplete approvals, and unsafe or duplicate manifest paths before it can
  inspect checkout paths or source references.
- Added a process-level generator suite at
  `server/src/__tests__/scripts/generatePolicyStorageClosureFinalRemovalAudit.test.mjs`.
  It runs the public JSON command against a temporary checkout, proves a
  complete replay-verified chain, and blocks both a live runtime import and a
  path-state snapshot from another execution-plan artifact. The test confirms
  the audit reports no deletion, storage, route, test, manifest, or Git side
  effects.

Example:

```bash
npm run --silent policy:storage-closure-final-removal-audit -- \
  --execution-plan-artifact .tmp/policy-storage/execution-plan-artifact.json \
  --path-state-evidence .tmp/policy-storage/path-state-evidence.json \
  --next-batch-authorization-artifact \
    .tmp/policy-storage/next-batch-authorization-artifact.json \
  --review-artifact-fingerprint "$REVIEW_ARTIFACT_FINGERPRINT" \
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

Keep the generated final-removal audit as an input to the current storage
closure evidence run. Before a real compatibility-removal cutover, regenerate
every artifact from the target checkout and require the public generator to
complete with no remaining path or reference evidence.
