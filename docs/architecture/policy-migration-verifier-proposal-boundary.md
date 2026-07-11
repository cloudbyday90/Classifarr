# Policy Migration Verifier Proposal Boundary

## Status

Implemented for migration verification and rollback planning.

## Problem

The migration verifier previously accepted any object carrying the rebuild
proposal version as its proposal. It then generated a report and recorded
proposal validation afterward. A version-shaped or partially trusted proposal
could therefore reach comparison, fingerprinting, and rollback-gate logic before
the verifier rejected it.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side workflow state, transition checks, and re-derivation
  of security-relevant values.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  recommends validating trust-boundary crossings and workflow integrity.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verified secure development practices that reduce defects before
  release.

## Recommendation

Use two focused entry points:

1. `buildPolicyMigrationVerifierReportFromRuntimeInput` owns raw rebuild-input
   composition and rejects a supplied rebuild proposal.
2. `buildPolicyMigrationVerifierReportFromRebuildProposal` requires a current,
   valid `policy.library_policy_rebuild.v1` proposal and rejects raw
   `proposalInput` fields.

The decision-only reducer validates the proposal before normalizing samples,
computing the sample-set fingerprint, or deriving application and deletion
gates. It continues to recompute validation during report validation so later
mutation cannot pass as a current proof.

## Pros And Cons

Pros:

- Prevents version-only or invalid proposals from shaping migration comparison.
- Makes the raw build path explicit and prevents adapter/reducer ambiguity.
- Preserves report-time validation as a defense against stale or mutated
  embedded proposals.
- Keeps rollback and deletion gates downstream of validated proposal state.

Cons:

- Callers must select either the raw runtime adapter or validated-proposal
  reducer.
- Invalid proposals fail immediately instead of producing a later-invalid
  report.

## Final Recommendation Stack

- Migration verifier reducer and runtime adapter:
  `server/src/services/policyMigrationVerifierRollback.mjs`
- Rebuild proposal dependency:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Focused tests:
  `server/src/__tests__/services/policyMigrationVerifierRollback.test.mjs`

## Outcome

```text
raw rebuild input
  -> validated library rebuild proposal
  -> migration verifier report

existing valid library rebuild proposal
  -> migration verifier report
```

Migration comparison, sample-set provenance, and rollback planning cannot begin
from a raw or invalid proposal.
