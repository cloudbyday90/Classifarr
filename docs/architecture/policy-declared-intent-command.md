# Policy Declared Intent Command

## Status

Implemented as the server-owned command boundary between a verified library
intent proposal and a future native policy persistence adapter.

## Problem

A browser must not be able to submit a fabricated proposal, choose its own
operator identity, alter a proposal after review, or convert observed evidence
directly into persisted policy. Existing policy writes are legacy bridge paths;
there is not yet a native proposal registry or native intent store that can
safely accept the new command.

The command boundary therefore accepts only a proposal reference and expected
fingerprint. A server-supplied resolver retrieves the proposal, and the service
validates the current authenticated administrator context, resolved proposal
state, exact proposal and verified-handoff fingerprint provenance, allowlisted
declared intent fields, and strict hard-limit confirmation.

## Design

```text
authenticated administrator + proposal reference + expected fingerprint
  -> server-owned proposal resolver
  -> ready proposal and exact proposal/verified-handoff fingerprint validation
  -> allowlisted declared-intent and hard-limit confirmation validation
  -> persistence-free declared intent command
  -> later native policy persistence gate
```

The command service does not call a provider, read quotas, refresh a library,
route media, create learning, or write policy storage.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends deny-by-default authorization and validating permissions on every
  request. The command requires an authenticated administrator supplied by the
  server-side caller before proposal resolution.
- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
  requires object-level authorization for each referenced object. The browser
  supplies only an opaque proposal reference; the resolver receives the trusted
  actor context and owns proposal access scoping.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side authorization of significant data, sequential state
  transitions, and protection against post-review modification. The exact
  proposal fingerprint and explicit hard-limit confirmation bind the command to
  the reviewed proposal state.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlists. The command accepts only known declared
  intent fields and bounded string lists.

## Recommendations

1. Resolve proposals server-side; never accept a client-built proposal or
   evidence projection.
2. Pass the authenticated principal from middleware or another trusted adapter,
   never from a request body's claimed user or role.
3. Require an exact proposal fingerprint and invalidate the command when the
   underlying proposal changes.
4. Require the proposal fingerprint to match the verified evidence-handoff
   fingerprint carried by the server-owned proposal.
5. Allowlist declared-intent fields and bound list counts and string lengths.
6. Require at least one declared destination identity because this is a complete
   command envelope, not a partial patch.
7. Require explicit confirmation whenever hard limits are present.
8. Keep this command separate from legacy writes, native storage, and learning
   until each owns its dedicated contract.

## Pros And Cons

Pros:

- Prevents client-created evidence or proposal state from authorizing intent.
- Binds the operator action to the exact reviewed and independently verified
  evidence provenance.
- Makes hard-limit acknowledgement explicit and testable.
- Provides a clean future seam for native persistence without changing legacy
  bridge behavior now.

Cons:

- A route cannot use the command until a server-owned proposal registry or
  native store can resolve proposal references safely.
- It intentionally adds no policy write capability in this component.
- A changed proposal requires the operator to review and submit again.

## Final Recommendation Stack

1. `policyLibraryIntentProposalService.mjs` creates verified proposals.
2. A future proposal registry resolves references in an actor-scoped context.
3. `policyDeclaredIntentCommand.mjs` validates the actor, proposal/verified
   handoff fingerprint agreement, confirmation, and allowlisted declared
   intent.
4. A future native storage adapter consumes only ready command envelopes.
5. The learning guard remains independent from policy persistence.

## Security Outcome

- The command cannot accept a prebuilt proposal or evidence projection.
- The actor must be an authenticated administrator; unauthorized callers are
  rejected before resolver access.
- Unknown fields, unbounded values, malformed fingerprints, stale or mismatched
  proposal and verified-handoff fingerprints, and unconfirmed hard limits fail
  closed.
- Resolver failures return generic stable results without error text.
- The audit detects fingerprint/library mismatch, missing hard-limit
  confirmation, unsafe side effects, and blocked results with next steps.

## Implemented Contract

```text
submitDeclaredIntentCommand({
  proposalReference,
  proposalFingerprint,
  declaredIntent,
  confirmedFields,
  actor
})
```

Ready commands contain only the proposal reference/fingerprint, verified
handoff fingerprint, library ID, trusted actor ID and role, operator-declared
intent, confirmations, and operator-declared authority source. They are
proposals for later storage, not storage operations.

## Follow-On

The server-owned proposal registry is implemented in
[Policy Intent Proposal Registry](policy-intent-proposal-registry.md). It
creates short-lived actor-scoped references from verified proposals, resolves
them only for their owner, and exposes a fingerprint-bound one-time consumption
primitive. Native policy persistence remains blocked until it can atomically
consume that reference and write a native intent version.

The command's verified evidence-handoff provenance is specified in
[Policy Declared Intent Command Fingerprint Provenance](policy-declared-intent-command-fingerprint-provenance.md).
