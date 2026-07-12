# Policy Evidence Quality Contribution Trust

## Status

Implemented July 2026.

## Scope

This record hardens Phase 6R.1 evidence quality calculation. It does not add a
new score, data store, provider lookup, routing action, learning action, or
policy-builder control.

## Problem

Evidence quality previously read bucket counts from the projection summary and
used authority labels to identify observed or declared identity. A tampered
summary could therefore make quality appear to contain identity even when the
actual bucket did not. Likewise, an incompatible entry placed in the identity
bucket could contribute if it carried a familiar authority label.

The projection audit already rejected those malformed states. Quality should
not nevertheless treat them as positive evidence while that audit is being
evaluated or when the quality helper is used directly.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early syntactic and semantic validation with allowlists. Quality
  now derives positive signals from entries that pass the server-owned
  bucket-source-authority relationship, not summary claims.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side re-derivation of security-relevant values and explicit
  invariants. The engine recomputes trusted contributions from bucket entries
  rather than trusting the derived summary.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports security controls embedded in development practices. The quality
  contribution rule is modular, deterministic, and covered by regression tests.

## Decision

Evidence quality now follows these rules:

1. Count quality contributions from actual bucket entries, not summary counts.
2. Count an entry only when the evidence engine confirms its bucket, source,
   and authority combination is allowed.
3. Establish destination identity only from trusted observed or trusted
   operator-declared identity entries.
4. Preserve review and projection audits for malformed entries; they do not
   become silent positive quality signals.

The quality helper fails closed when a caller does not provide the trusted-entry
predicate. The evidence engine provides that predicate from its canonical
bucket and source contracts for normal production use.

## Implementation

- `server/src/services/policyEvidenceQuality.mjs`
  - derives counts from trusted bucket entries;
  - derives identity only from trusted entry contributions;
  - no longer uses a projection summary as a positive quality source.
- `server/src/services/policyEvidenceEngine.mjs`
  - provides the canonical bucket-source-authority contribution predicate for
    both generation and audit of quality.
- `server/src/services/policyEvidenceHandoffVerifier.mjs`
  - reuses the same predicate when it verifies a loaded library evidence
    handoff, so its quality audit cannot drift from the projection audit.
- `server/src/__tests__/services/policyEvidenceQuality.test.mjs`
  - verifies forged summary identity counts and metadata relabeled into the
    identity bucket cannot make quality sufficient.

## Pros And Cons

### Pros

- Prevents summary tampering from inflating quality or readiness.
- Prevents incompatible provenance from establishing destination identity.
- Keeps the existing coarse, explainable score instead of adding a new model.
- Reuses the policy evidence engine's authoritative contract rather than
  duplicating source-to-bucket rules.

### Cons

- Direct callers of the generic quality helper must supply the trusted-entry
  predicate; otherwise quality intentionally treats entries as untrusted.
- Malformed entries can make quality more conservative while projection audit
  reports the root cause.

## Final Recommendation Stack

1. Keep the evidence engine as the owner of bucket-source-authority validity.
2. Let quality consume only trusted entries from that engine.
3. Use the projection summary for observation and correlation, not to establish
   positive quality.
4. Retain projection audit and quality audit as separate defense-in-depth
   checks.

## Verification

```text
server/src/__tests__/services/policyEvidenceQuality.test.mjs
server/src/__tests__/services/policyEvidenceEngine.test.mjs
server/src/__tests__/services/policyEvidenceBoundary.test.mjs
server/src/__tests__/services/policyAutomationReadinessEngine.test.mjs
```

The focused tests verify that forged summary counts and incompatible identity
provenance cannot create usable evidence quality.
