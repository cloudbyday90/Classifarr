# Policy Evidence Envelope Provenance

## Status

Implemented July 2026.

## Scope

This record hardens the Phase 6R.1 library evidence handoff. It does not alter
database queries, provider behavior, learning, routing, policy persistence, or
the policy-builder UI.

## Problem

Library evidence collectors deliberately emit bounded facts rather than
self-asserted source or authority identifiers. The policy evidence envelope
assigns those identifiers based on the input section that receives each
collector result.

That assignment was correct but implicit: the envelope exposed only per-section
counts. A future change could let the envelope's local section labels drift from
the shared input-gate provenance contract without an audit failure.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant values server-side and documenting
  invariants. The envelope derives provenance from the server-owned input
  section contract rather than trusting collector payloads.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends least privilege, validation at the correct enforcement point, and
  tests for authorization logic. Collectors retain the least authority needed:
  they provide facts, while the envelope owns provenance assignment and audit.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined interfaces and verification practices. The contract is
  explicit, sanitized, versioned through the existing envelope, and covered by
  regression tests.

## Decision

Use the existing `policyEvidenceInputGate` section definitions as the single
source of truth for envelope section provenance.

For each persisted collector section, the envelope now returns only:

```text
sourceId
authoritySourceId
```

alongside its existing count summary. These identifiers are static contract data
and do not include item labels, provider payloads, titles, answer text, or
operator identity.

The envelope audit compares every returned provenance entry with the shared
input-section contract. Any missing, relabeled, or mismatched entry produces
`source_provenance_mismatch` and prevents the envelope audit from passing.

## Implementation

- `server/src/services/policyEvidenceEnvelope.mjs`
  - derives section IDs from the shared input-gate identifiers;
  - creates a sanitized `sourceProvenance` map from the input-gate contract;
  - audits each returned source and authority pair against that map.
- `server/src/__tests__/services/policyEvidenceEnvelope.test.mjs`
  - verifies persisted outcome and metadata provenance;
  - verifies that tampering with a returned authority identifier fails the
    envelope audit.

## Pros And Cons

### Pros

- Removes duplicate authoritative section identifiers from the envelope.
- Makes collector-to-projection lineage visible without exposing raw facts.
- Fails closed when a returned provenance map drifts or is tampered with.
- Keeps collectors small, read-only, and unable to claim policy authority.

### Cons

- Adds a compact provenance map to the envelope result.
- Future collector sections must be added to the shared input-gate contract
  before they can be aggregated.

## Final Recommendation Stack

1. Keep collector output fact-only and source-specific.
2. Use the shared input-gate section contract as the sole source of provenance.
3. Expose sanitized source and authority identifiers at the envelope boundary.
4. Audit that map before downstream evidence, intent, or readiness code relies
   on the handoff.

## Verification

```text
server/src/__tests__/services/policyEvidenceEnvelope.test.mjs
server/src/__tests__/services/policyLibraryEvidenceLoader.test.mjs
server/src/__tests__/services/policyEvidenceBoundary.test.mjs
```

The focused tests verify the source mapping, a tampered provenance failure, and
the downstream bounded handoff.
