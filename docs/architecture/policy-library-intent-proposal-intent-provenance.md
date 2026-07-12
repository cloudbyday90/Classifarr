# Policy Library Intent Proposal Intent Provenance

## Status

Implemented as a server-side proposal continuity invariant.

## Problem

A verified library evidence handoff authorizes only the exact bounded evidence
projection it audited. The proposal service already required that handoff's
fingerprint to agree with its outward evidence-provenance summary. It did not
independently prove that the bounded intent result and emitted intent still
carried that same fingerprint.

Without this check, a faulty or substituted reducer result could appear ready
while its reviewed intent could no longer be correlated to the handoff that
authorized proposal creation.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side re-derivation of security-relevant values and explicit
  workflow state transitions. The service compares each server-derived
  provenance field before emitting ready state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic validation as well as structural validation. A valid
  fingerprint string is insufficient when it does not agree with the verified
  handoff it represents.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports testable secure-development practices. Focused tests cover both
  injected reducer drift and later result mutation.

## Decision

A ready library intent proposal must satisfy this server-owned invariant:

```text
verified handoff fingerprint
  == proposal evidence-provenance fingerprint
  == bounded intent-result fingerprint
  == emitted intent evidence-boundary fingerprint
```

The proposal service rejects a ready-looking intent result when any required
fingerprint is missing or differs. The stable result is
`blocked_by_intent_audit` with the
`intent_evidence_fingerprint_mismatch` risk. The proposal audit independently
detects later mutation of a ready result.

## Implementation

- `server/src/services/policyLibraryIntentProposalService.mjs` checks the
  bounded intent-result and emitted-intent fingerprints against the verified
  handoff before returning a ready proposal.
- `server/src/__tests__/services/policyLibraryIntentProposalService.test.mjs`
  covers reducer-result drift and post-result mutation.
- `server/src/__tests__/services/policyIntentProposalRegistry.test.mjs` models
  full verified ready-proposal provenance in its registry fixtures.

## Pros And Cons

Pros:

- Preserves one auditable evidence-to-intent correlation chain.
- Fails closed before opaque proposal registration and declared-intent command
  review.
- Keeps raw evidence, provider payloads, and client-controlled provenance out
  of the contract.

Cons:

- Ready proposal fixtures and alternate reducer implementations must include
  the bounded intent provenance expected by production.
- The check deliberately blocks an otherwise usable draft when its evidence
  lineage cannot be proven.

## Final Recommendation Stack

1. Verify cached library evidence and its complete handoff audit.
2. Require matching handoff and outward proposal provenance fingerprints.
3. Require matching bounded intent-result and emitted-intent fingerprints.
4. Register only the fully verified proposal as a short-lived actor-scoped
   review capability.
5. Require command-level fingerprint agreement before later atomic persistence.

## Security Outcome

- No client field can select or replace the verified evidence fingerprint.
- A substituted reducer output cannot become a ready proposal.
- Later mutation is detectable through the proposal audit.
- The service remains free of provider calls, quota reads, routing, learning,
  and policy-storage writes.

## Verification

- Focused proposal, registry, declared-intent command, and intent-engine tests
  cover the continuity chain.
- Full server tests, documentation lint, security lint, test lint, and the
  durable production naming audit are required before release.

## Next Step

Continue the intent-engine work by auditing pure projection reducer callers.
Runtime and rebuild paths must use a verified handoff contract rather than
treating a structurally shaped projection as normal workflow authority.
