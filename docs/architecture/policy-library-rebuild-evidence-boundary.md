# Policy Library Rebuild Evidence Boundary

## Status

Implemented for library-derived rebuild proposals.

## Problem

The rebuild service normalized library inputs but constructed its evidence
projection directly. That skipped the shared evidence input gate, collection
bounds, projection audit, and fingerprinting contract that now protects normal
policy intent inference.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side validation as early as possible and allowlisting for
  structured input.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side workflow states and validating each
  transition so a caller cannot skip prerequisites.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  specifically calls for review of trust boundaries, workflow-bypass
  opportunities, resource limits, and error handling.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure-development verification into normal delivery.

## Recommendation

Build a small allow-listed evidence envelope from the rebuild's normalized
inputs. Send only `libraryProfile`, `operatorIntent`, and `profileFreshness`
through `buildBoundedPolicyEvidenceProjection`.

For a ready boundary, retain existing pure evidence-to-intent and readiness
reduction. Attach a sanitized boundary context containing only status, count,
stable risk IDs, and the ready projection fingerprint.

For a rejected boundary, return a side-effect-free rebuild proposal with
`blocked_by_evidence_boundary`, no projection, no intent, and no readiness.
The proposal preserves operator acceptance and rollback gates, a bounded trace,
and a generic warning without exposing rejected values or error text.

## Pros And Cons

Pros:

- Rebuild proposals use the same input gate, cardinality bound, audit, and
  fingerprint contract as other evidence consumers.
- Invalid data cannot fall back to an unverified projection path.
- A structured blocked result is safe for callers and migration verification.
- Boundary provenance is audit-friendly without retaining raw source values.

Cons:

- A malformed nested source value now stops rebuild proposal generation instead
  of being silently omitted.
- The rebuild contract has one additional explicit blocked status for consumers
  to handle.

## Final Recommendation Stack

- `server/src/services/policyEvidenceBoundary.mjs`
- `server/src/services/policyLibraryPolicyRebuild.mjs`
- `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`
- `docs/architecture/policy-library-policy-rebuild.md`

## Outcome

Library rebuild now has one evidence path:

```text
normalized rebuild inputs
  -> allow-listed rebuild evidence envelope
  -> bounded evidence projection
  -> ready proposal or boundary-blocked proposal
```

The audit accepts a blocked proposal only when it retains a failed sanitized
boundary context and has no derived projection, intent, or readiness contract.
