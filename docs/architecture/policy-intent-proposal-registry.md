# Policy Intent Proposal Registry

## Status

Implemented as the short-lived server-owned capability store between verified
library intent proposals and the declared-intent command boundary. It is not a
policy store and is not wired to a route or persistence adapter in this slice.

## Problem

The declared-intent command must resolve a proposal that the browser cannot
invent, alter, or read across administrator accounts. Passing an entire
proposal back from the browser would allow evidence substitution. Retaining it
indefinitely would turn a review artifact into unbounded server state.

The registry therefore holds a defensive server-side snapshot of a verified
ready proposal and returns only an opaque reference, its evidence fingerprint,
library ID, and expiry metadata. It binds the reference to one authenticated
administrator and limits both total and per-administrator active entries.

## Design

```text
verified ready proposal + authenticated administrator
  -> clone and register in bounded server memory
  -> opaque 256-bit random reference + server-enforced expiry
  -> trusted command resolver verifies actor scope
  -> fingerprint-bound declared-intent command
  -> future native persistence transaction consumes reference exactly once
```

The registry has three intentionally separate operations:

1. `registerProposal` validates a ready audited proposal, snapshots it, and
   returns sanitized registration metadata.
2. `resolveProposal` requires the authenticated actor context; the narrower
   `resolveProposalForCommand` accepts the already-validated trusted principal
   supplied by `policyDeclaredIntentCommand.mjs`.
3. `consumeProposal` requires the same actor, reference, and exact fingerprint,
   then removes the record so it cannot be resolved or consumed again.

Before resolution or consumption, the registry reruns the existing ready
proposal audit against the stored snapshot and requires its library ID and
verified evidence fingerprint to match entry metadata. Invalid snapshots are
deleted and returned as unavailable without exposing the integrity reason.

`policyIntentProposalRegistry.mjs` owns the in-memory lifecycle only.
`policyIntentProposalRegistryContract.mjs` owns the immutable status vocabulary,
input normalization, result shaping, ready-proposal validation, and audit. This
keeps future durable storage adapters from duplicating the security contract.

References are generated with Node's `randomBytes(32)` and encoded using
`base64url`. The reference carries no identity, library, evidence, or policy
meaning. Every stored proposal and every resolved proposal is cloned, so caller
mutation cannot alter the registered review state.

## Official Guidance Reviewed

- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
  recommends opaque, meaningless identifiers from a CSPRNG and server-side
  enforcement of expiry. The registry uses 256 random bits and a ten-minute
  server-enforced default TTL.
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side transaction state, unique authorization credentials,
  limited validity, and a final control gate before execution. The registry
  stores the reviewed state server-side, binds it to its fingerprint, expires
  it, and offers a one-time consumption primitive for the later write gate.
- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
  requires authorization checks for every referenced object. The registry
  requires an exact actor ID match and returns an unavailable result for a
  missing or foreign reference.
- [Node.js Crypto documentation](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)
  specifies that `randomBytes` generates cryptographically strong
  pseudorandom data. It is the reference generator rather than a predictable
  identifier or counter.

## Recommendations

1. Keep proposal references opaque, random, short-lived, and actor-scoped.
2. Validate the existing proposal audit before registration and snapshot it to
   prevent time-of-check/time-of-use mutation.
3. Revalidate the stored proposal audit, library ID, and verified fingerprint at
   both resolution and consumption.
4. Use the fingerprint at both command creation and consumption.
5. Bound total and per-actor entry counts; fail closed instead of evicting an
   active reviewed proposal.
6. Return sanitized registration metadata only. Never return raw evidence,
   labels, prompts, provider payloads, or the stored proposal from registry
   result envelopes.
7. Keep registry consumption and the future native policy write in one durable
   persistence transaction. A future multi-process deployment must replace the
   in-memory capability record with a transactionally consumed server store.

## Pros And Cons

Pros:

- Prevents client-supplied proposal and evidence substitution.
- Makes the existing command resolver concrete without exposing a policy write.
- Prevents cross-administrator reference access and post-registration mutation.
- Limits memory use and replay lifetime while preserving a clear one-time
  acceptance primitive.

Cons:

- References are intentionally invalidated on application restart.
- A ten-minute review window can require regeneration for an inactive review.
- Native policy persistence still needs a durable, atomic consume-and-write
  record before it can be enabled in a multi-process deployment.

## Final Recommendation Stack

1. `policyLibraryIntentProposalService.mjs` creates the verified proposal.
2. `policyIntentProposalRegistry.mjs` creates an actor-bound opaque reference.
3. `policyDeclaredIntentCommand.mjs` turns the server-resolved snapshot into a
   validated declared-intent command.
4. A future native persistence adapter must atomically revalidate the command,
   consume the reference, and write the native intent version.
5. The learning guard remains separate: storing intent does not itself create
   durable learning.

## Security Outcome

- Registration requires an authenticated administrator and an audited ready
  proposal with a valid evidence fingerprint.
- Resolution and consumption enforce actor ownership server-side.
- Resolution and consumption revalidate stored proposal readiness and verified
  fingerprint provenance before returning or consuming the snapshot.
- Missing and foreign references produce the same unavailable result, reducing
  object enumeration disclosure.
- Expired references cannot resolve; expired entries are removed as they are
  encountered, and capacity is bounded without replacing active records.
- Consumption deletes the reference before returning success, so replay cannot
  resolve or consume it again.
- Registry result audits reject proposal/evidence disclosure and unsafe live,
  provider, storage, learning, or routing side effects.

## Verification

Focused tests cover ready-proposal validation, defensive snapshots, owner-only
resolution, command integration, server-side expiry, fingerprint mismatch,
one-time consumption, capacity limits, and tamper detection.

## Next Step

Begin the policy learning guard with a small final-outcome normalization
component. It should record what happened separately from whether that outcome
is eligible to change future destination evidence. Native persistence remains
blocked until it has an atomic durable consume-and-write transaction.
