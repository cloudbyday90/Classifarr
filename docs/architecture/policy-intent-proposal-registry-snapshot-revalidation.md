# Policy Intent Proposal Registry Snapshot Revalidation

## Status

Implemented as an opaque-registry integrity invariant.

## Problem

The registry snapshots a verified ready proposal under an actor-bound opaque
reference. Defensive cloning prevents mutation through the original caller, but
registration-time validation alone is not sufficient proof that the stored
snapshot remains valid at every later resolution or consumption decision.

The declared-intent command is a sensitive transition. It must not consume a
stored proposal whose ready state, library ID, or verified evidence fingerprint
no longer agrees with the registry entry.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends rechecking resource ownership and authorization at each action.
  The registry revalidates both actor ownership and the stored proposal contract
  for resolve and consume operations.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived workflow state, explicit transitions, and one-time
  controls. The registry treats an invalid stored snapshot as unavailable and
  removes it before it could reach command processing.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined, testable controls. The same ready-proposal validator runs at
  registration, resolution, and consumption, with focused regression coverage.

## Decision

Keep the existing opaque entry shape and its single stored proposal snapshot.
Before a registry entry is resolved or consumed, rerun the established ready
proposal validator against `entry.proposal`. Require the result's library ID and
verified proposal fingerprint to match the entry metadata captured at
registration.

If revalidation fails, delete the entry and return the same generic unavailable
outcome already used for missing or inaccessible opaque references. The registry
does not disclose whether expiration, ownership, or a proposal-contract check
caused the unavailability.

## Implementation

- `server/src/services/policyIntentProposalRegistry.mjs` adds a private stored
  proposal-currentness check using the existing ready-proposal validator.
- Resolution and one-time consumption invoke that check after actor ownership
  and expiry validation and before returning or consuming a clone.
- `server/src/__tests__/services/policyIntentProposalRegistry.test.mjs` verifies
  that the proposal audit runs at registration, resolution, and consumption.

## Pros And Cons

Pros:

- Reuses the established proposal audit rather than duplicating fingerprint or
  handoff rules in the registry.
- Ensures the actor-bound capability remains tied to the verified evidence
  fingerprint that authorized it.
- Fails closed and preserves opaque-reference non-disclosure behavior.

Cons:

- Resolve and consume repeat a bounded pure proposal audit.
- Invalid stored snapshots are discarded and require regeneration; there is no
  automatic recovery of a potentially inconsistent review artifact.

## Final Recommendation Stack

1. Create a verified ready proposal from the server-owned evidence workflow.
2. Register a cloned, actor-bound, short-lived opaque snapshot with its verified
   fingerprint and library ID.
3. Revalidate the stored proposal, fingerprint, ownership, and expiry before
   every resolve or consume transition.
4. Let the declared-intent command use only the currently valid server-owned
   snapshot.

## Security Outcome

- A stored capability cannot outlive divergence from its verified evidence
  handoff or proposal contract.
- Actor ownership, expiry, fingerprint binding, and one-time consumption are
  rechecked server-side.
- Failure messages reveal no evidence records, proposal data, fingerprints, or
  internal integrity reason.

## Verification

- Focused registry, declared-intent command, and proposal-service tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Add a final command-result audit requirement that carries and compares the
verified proposal handoff fingerprint, so command consumers cannot rely solely
on the opaque proposal fingerprint at the final pre-persistence boundary.
