# Policy Library Intent Proposal Fingerprint Provenance

## Status

Implemented as a verified-handoff provenance invariant.

## Problem

The complete evidence handoff audit verifies a projection fingerprint, while the
library intent proposal exposes a fingerprint provenance summary for later
operator and command workflows. If the proposal copies the summary directly
from the raw handoff without binding it to the audit result, later mutation can
leave a proposal with a valid-looking but unverified correlation handle.

The solution must not add a second fingerprinting subsystem or accept a caller
provided correlation value. The established evidence handoff audit is the
authoritative verifier.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends re-deriving security-relevant state on the server and enforcing
  explicit workflow prerequisites. The proposal consumes the fingerprint summary
  produced by the verified handoff audit instead of trusting a parallel field.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic validation before further processing. A ready proposal
  must prove that its exposed fingerprint equals verified handoff provenance.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined and testable secure-development controls. The binding is
  expressed through focused handoff, proposal, and registry regression tests.

## Decision

`buildPolicyEvidenceHandoffAudit` now returns a sanitized
`projectionFingerprint` summary after it independently validates the received
projection and fingerprint. It includes only version, algorithm, digest,
provenance, and trace attributes.

The proposal service derives its exposed `evidenceProvenance.projectionFingerprint`
from that audited summary. Before intent reduction, it requires the raw boundary
fingerprint and audited summary to agree. Its result audit requires the exposed
proposal fingerprint and carried handoff-audit fingerprint to agree.

Any mismatch is rejected with `evidence_handoff_fingerprint_mismatch`.

## Implementation

- `server/src/services/policyEvidenceHandoffVerifier.mjs` emits a sanitized
  verified projection-fingerprint summary in the complete handoff audit.
- `server/src/services/policyLibraryIntentProposalService.mjs` derives proposal
  provenance from that summary and blocks absent or mismatched verified
  fingerprints before intent inference.
- Focused handoff verifier, proposal service, and proposal registry tests cover
  successful propagation and later fingerprint divergence.

## Pros And Cons

Pros:

- Keeps one verified source of truth for the evidence correlation handle.
- Prevents a ready proposal from carrying fingerprint provenance unrelated to
  the evidence that was audited.
- Reuses existing server-owned fingerprint and handoff contracts.

Cons:

- Ready proposals now require the complete handoff audit to include its
  fingerprint summary; incomplete synthetic fixtures must model that contract.
- The digest binds evidence provenance, not operator authorization or policy
  persistence. Those remain separate later workflow concerns.

## Final Recommendation Stack

1. Build, canonicalize, and audit the bounded evidence projection.
2. Generate and validate its fingerprint inside the evidence boundary.
3. Independently revalidate projection and fingerprint in the complete handoff
   audit, then expose its sanitized fingerprint summary.
4. Derive proposal provenance from that summary and require a match before a
   proposal claims readiness.

## Security Outcome

- A caller cannot substitute a different evidence correlation handle into a
  ready library intent proposal.
- Handoff, proposal, and registry contracts share one verified fingerprint.
- The summary excludes evidence labels, media titles, provider payloads, API
  keys, and quota state.

## Verification

- Focused handoff-verifier, proposal-service, and proposal-registry tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Harden the opaque proposal registry to preserve and revalidate the verified
handoff fingerprint alongside its existing actor-bound reference before a
declared-intent command consumes the proposal.
