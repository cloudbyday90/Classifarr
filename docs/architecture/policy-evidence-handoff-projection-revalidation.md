# Policy Evidence Handoff Projection Revalidation

## Status

Implemented as a hardening change to the existing evidence handoff verifier.

## Problem

The evidence boundary records a projection audit when it creates a handoff.
The handoff verifier previously checked that recorded result, but did not
independently rerun the projection audit against the projection it received.
A mutated handoff could therefore retain a successful recorded audit while its
current projection no longer satisfied structural invariants.

Creating another snapshot or verifier service would duplicate the existing
handoff verifier. The correct boundary is to strengthen that verifier in place.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived security-relevant values and explicit workflow
  invariants. The verifier re-derives projection validity from the received
  object instead of trusting a carried audit flag.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic validation before application processing. Projection
  validity is recomputed before intent can consume the handoff.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined, testable security controls. The verifier exposes a stable
  nested audit summary and has focused regression coverage.

## Decision

Keep `policyEvidenceHandoffVerifier.mjs` as the one complete library-evidence
handoff verifier. For every ready candidate handoff, it now independently runs
`buildPolicyEvidenceProjectionAudit(projection)` in addition to validating the
boundary audit, fingerprint, quality, envelope, loader, and static engine.

The verifier emits `projection_audit_failed` when the recomputed audit fails.
It returns only the nested audit's `ok`, issue count, and risk IDs; it does not
copy evidence entries or raw audit messages into the verifier handoff summary.

## Implementation

- `server/src/services/policyEvidenceHandoffVerifier.mjs` accepts an injectable
  projection-audit dependency, reruns it against the received projection, and
  includes its sanitized summary in the final audit result.
- `server/src/__tests__/services/policyEvidenceHandoffVerifier.test.mjs`
  verifies that a fresh projection-audit failure blocks a ready handoff even
  when the carried boundary audit remains successful.

## Pros And Cons

Pros:

- Closes the trust gap between a recorded boundary audit and the projection
  actually handed to intent.
- Reuses an existing server-owned verifier instead of introducing an overlapping
  snapshot abstraction.
- Protects all established entry invariants: source authority, canonical fields,
  bucket ownership, deduplication, and canonical order.

Cons:

- Repeats bounded pure validation during complete handoff verification.
- A handoff altered after boundary construction now fails rather than attempting
  automatic recovery; callers must rebuild it from trusted evidence.

## Final Recommendation Stack

1. Build and audit the projection at the input boundary.
2. Generate its summary, quality, and correlation fingerprint.
3. Revalidate projection structure, fingerprint, and quality in the complete
   handoff verifier.
4. Permit intent inference only when every nested audit is current and passing.

## Security Outcome

- A carried `projectionAudit.ok` flag is not trusted as proof of current
  projection integrity.
- Structural tampering is blocked before intent processing.
- The verifier exposes only bounded risk IDs and counts, never raw evidence,
  titles, provider payloads, API keys, or quota state.

## Verification

- Focused handoff-verifier, boundary, and evidence-engine tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Apply the verified handoff contract to the library intent proposal service so
that no proposal path can consume a raw or only partially audited evidence
projection.
