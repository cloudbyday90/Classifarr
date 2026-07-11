# Policy Runtime Operator Intent Boundary

## Status

Implemented for runtime evidence projection.

## Problem

The runtime evidence adapter has its own normalized projection because it must
combine runtime profile, history, RAG, metadata, routing, and freshness facts.
Its operator-intent mapping still called the generic policy evidence projector
directly, bypassing the shared input gate and evidence fingerprint.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends validating untrusted structured input early and using allowlists.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side validation of security-relevant workflow state.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  identifies trust boundaries and workflow-bypass opportunities as review
  targets.
- [NIST SP 800-218 SSDF](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure-development verification as part of routine delivery.

## Recommendation

Keep the specialized runtime projection, but route only its operator-declared
intent through `buildBoundedPolicyEvidenceProjection`. Store a sanitized
operator-intent boundary context containing status, ready flag, stable risk
IDs, and the generic projection fingerprint.

When the boundary is ready, map its generic operator-intent entries into the
runtime projection. When it rejects input, add no operator-intent entries and
emit one stable warning. Continue evaluating independent runtime profile,
history, RAG, metadata, routing, and freshness evidence.

Bind this sanitized context into the runtime projection fingerprint and trace
attributes. The runtime audit rejects a missing or malformed ready context and
rejects any operator-intent entry attached after a blocked context.

## Pros And Cons

Pros:

- Removes the final non-boundary direct call to the generic evidence projector.
- Preserves independent runtime evidence when operator intent is malformed.
- Makes the operator-intent handoff tamper-evident in runtime provenance.
- Does not force the specialized runtime model into the library rebuild shape.

Cons:

- Invalid operator intent is omitted from the current runtime decision rather
  than causing all runtime evidence to fail.
- The runtime evidence fingerprint changes when the operator-intent boundary
  status changes, as it should for provenance accuracy.

## Final Recommendation Stack

- `server/src/services/policyEvidenceBoundary.mjs`
- `server/src/services/policyRuntimeEvidenceProjection.mjs`
- `server/src/services/policyRuntimeEvidenceFingerprint.mjs`
- `server/src/__tests__/services/policyRuntimeEvidenceProjection.test.mjs`

## Outcome

The runtime projection now combines two explicit concerns:

```text
bounded operator intent + specialized normalized runtime evidence
  -> fingerprinted runtime evidence projection
```

An invalid operator-intent payload cannot create runtime hard limits, avoids,
or routing evidence, and cannot be silently reattached after validation.
