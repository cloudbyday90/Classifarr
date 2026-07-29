# Policy Migration Preview Contract

## Status

Implemented for Phase 6R.6 Task 6R.6.1.

The migration preview is a small, server-owned comparison contract. It compares
sanitized legacy outcomes with generated native-intent outcomes for a bounded
set of representative classifications. It is not a browser control, route, or
policy-authoring surface, and it cannot apply a replacement, create rollback
data, write learning, route media, or delete legacy code.

## Problem

The old impact and replay panels coupled migration proof to a large policy
builder surface. That made migration safety look like a normal operator task
and allowed an empty comparison set to be misread as behavioral parity.

Migration safety needs a narrow precondition instead:

```text
valid legacy baseline
  + generated native-intent outcome
  + bounded representative comparison
  + explicit insufficient-coverage state
  + rollback gates outside the comparator
```

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side syntactic and semantic validation, allowlists, and
  minimum/maximum bounds. The contract normalizes only supported comparison
  fields, limits emitted differences, rejects ambiguous aliases at the verifier
  boundary, and treats a missing legacy baseline as unusable.
- [Microsoft Azure Well-Architected safe deployment practices](https://learn.microsoft.com/en-us/azure/well-architected/operational-excellence/safe-deployments)
  recommends predeployment checks, health signals, controlled exposure, and
  rollback/roll-forward plans. The preview is a pre-cutover behavioral check;
  it never performs the cutover and is paired with the existing rollback plan.
- [Microsoft secure development lifecycle guidance](https://learn.microsoft.com/en-us/azure/well-architected/security/secure-development-lifecycle)
  recommends progressive exposure and safe rollback. The contract makes
  insufficient evidence a blocking state rather than inferring safety from an
  absent or malformed comparison.

## Options Considered

### 1. Retain comparison logic in the migration verifier

Pros:

- No new module.
- No near-term call-site change.

Cons:

- Couples pure comparison logic to acceptance, rollback, deletion, tracing,
  and fingerprint responsibilities.
- Makes the bounded preview difficult to test or reuse independently.
- Previously allowed an empty set to reach the no-difference status.

### 2. Add a browser migration-preview panel

Pros:

- Can make individual samples visible during development.

Cons:

- Reintroduces a normal-workflow control contrary to the destination-first,
  automated policy model.
- Browser state is not an authority boundary.
- Creates unnecessary UI/API maintenance and exposes migration mechanics to
  operators.

### 3. Extract a server-only migration preview contract

Pros:

- Keeps comparison deterministic, bounded, testable, and reusable.
- Separates comparison from proposal acceptance, rollback, and deletion.
- Makes empty or unusable baselines explicitly insufficient.
- Keeps raw provider, prompt, embedding, and replay data out of the result.

Cons:

- Requires a later server-side adapter to select real representative samples.
- Adds an explicit contract to the deletion plan and verifier report.

## Final Recommendation Stack

1. Build representative classifications only on the server.
2. Require each counted classification to contain a usable legacy baseline and
   generated native-intent outcome.
3. Report `insufficient_representative_coverage` when no usable classification
   is available; never report no differences by default.
4. Allow only the five migration-relevant difference types: destination,
   newly blocked, newly review-required, route readiness, and confidence.
5. Cap emitted differences at 100 globally and 25 by default; publish aggregate
   counts when results are truncated.
6. Suppress raw payloads, prompts, embeddings, and provider data from both the
   preview and verifier output.
7. Keep proposal acceptance, rollback snapshots, deletion criteria, and all
   writes in separate server contracts.
8. Require the preview contract in the migration/deletion plan before any
   legacy artifact can be considered for removal.

## Implementation Outcome

`server/src/services/policyMigrationPreviewContract.mjs` now provides:

- a versioned, server-owned contract declaration;
- normalization for first-class `legacyOutcome` and `generatedIntentOutcome`
  fields, with temporary aliases for existing verifier callers;
- bounded comparison and sanitized difference output;
- aggregate coverage and truncation summaries;
- a validation routine that rejects unsupported statuses/types, raw payloads,
  unbounded output, inconsistent coverage status, normal-workflow exposure,
  and side effects.

`policyMigrationVerifierRollback.mjs` consumes the contract while retaining
acceptance, rollback, sample fingerprint, trace, and deletion responsibilities.
It accepts exactly one sample input name: the new
`representativeClassifications` contract field or the compatibility
`legacyComparisonSamples` field. Supplying both is rejected.

`policyMigrationDeletionPath.mjs` embeds and validates the preview contract.
It also classifies the creation-only browser profile-refresh component and its
utility as delete-after-migration targets; they remain outside the normal
workflow and will not be removed until later cutover gates pass.

## Security Outcome

- No HTTP endpoint or browser control was added.
- No live provider call, quota read, or media-server action occurs.
- No raw comparison payload can be emitted.
- Malformed or incomplete inputs cannot claim parity.
- The preview is comparison-only and has an all-false side-effect contract.
- Deletion remains blocked by accepted rebuild, rollback, storage-stability,
  retention, and checklist contracts outside this module.

## Verification

Focused server tests cover:

- contract declaration and validation;
- matching outcomes;
- empty and unusable representative inputs;
- bounded and sanitized differences;
- verifier compatibility and ambiguous-alias rejection;
- deletion-plan enforcement of the contract.

## Next Task

Phase 6R.6 Task 6R.6.2: implement a server-only representative-classification
source adapter. It must select a deterministic, bounded set from persisted
classification and legacy-policy records, carry compact source provenance, and
perform no provider, browser, routing, or write action.
