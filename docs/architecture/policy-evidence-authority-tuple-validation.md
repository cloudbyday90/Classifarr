# Policy Evidence Authority Tuple Validation

## Status

Implemented July 2026.

## Scope

This record hardens the Phase 6R evidence and intent boundary. It does not add
storage, provider calls, learning, routing, or policy-builder controls.

## Problem

An evidence entry already carried three related identifiers:

```text
evidence bucket
evidence source
authority source
```

The bucket contract and source contract were individually validated, but a
known authority could be relabeled onto a different known source after initial
construction. For example, media-server profile evidence could be changed to
use the operator-declared authority identifier. The intent reducer previously
treated either operator identifier as enough to mark an entry
operator-declared.

That would blur observed evidence and explicit operator intent. It is a
business-logic integrity issue, not a request-shape or presentation concern.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists and early validation. The evidence engine
  therefore validates the complete identifier relationship before an entry is
  admitted or audited.
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating permissions on every request and using trusted server
  data for authorization decisions. The intent engine now derives declared
  status from both trusted source and authority identifiers.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  calls for explicit workflow invariants and tests for sequence or state
  manipulation. A source-authority pair is now a tested invariant at each
  reduction boundary.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined security requirements and verification throughout the
  lifecycle. The contract is represented in modular server services and
  regression tests rather than relying on UI behavior.

## Decision

Treat an evidence provenance tuple as valid only when all of the following are
true:

1. The evidence bucket exists.
2. The evidence source exists and is allowed by that bucket.
3. The authority source exists, is allowed by that bucket, and is allowed by
   that evidence source.

An entry is `operatorDeclared` only when both identifiers are the
operator-declared values:

```text
sourceId = operator_declared_intent
authoritySourceId = operator_declared_intent
```

Matching only one identifier is insufficient.

## Implementation

- `server/src/services/policyEvidenceEngine.mjs`
  - rejects incompatible source-authority pairs when building evidence;
  - audits constructed or tampered projection entries against the source
    contract.
- `server/src/services/policyIntentEngine.mjs`
  - validates bucket, source, and authority compatibility for every reduced
    intent entry;
  - requires both operator identifiers before marking an intent entry as
    operator-declared.
- Focused regression coverage proves that relabeled media-server evidence is
  rejected by the projection audit and cannot be promoted to declared intent.

## Pros And Cons

### Pros

- Preserves the distinction between observed evidence and operator authority.
- Rejects tampering at both projection and intent-reduction boundaries.
- Requires no new data model, migration, provider call, or UI interaction.
- Keeps hard-limit and avoid semantics deterministic and explainable.

### Cons

- Manually constructed fixtures and future adapters must include a valid source
  identifier as well as a valid authority identifier.
- Invalid drafts now surface additional audit findings instead of silently
  continuing with a misleading declared-intent label.

## Final Recommendation Stack

1. Keep source-to-authority allowlists in the evidence-source contract.
2. Validate the full bucket-source-authority tuple at every server reduction
   boundary.
3. Derive operator-declared state from the full tuple, never a single label.
4. Retain focused tampering tests as a required regression guard.

## Verification

```text
server/src/__tests__/services/policyEvidenceEngine.test.mjs
server/src/__tests__/services/policyIntentEngine.test.mjs
```

The focused server suite verifies projection rejection and intent-reduction
rejection for a known-but-incompatible source-authority pair.
