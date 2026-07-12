# Policy Declared Intent Command Fingerprint Provenance

## Status

Implemented as a final pre-persistence command invariant.

## Problem

The declared-intent command already required a browser-supplied proposal
fingerprint to match the opaque server-resolved proposal. That alone does not
prove that the proposal fingerprint still agrees with the verified evidence
handoff fingerprint that authorized the proposal.

Before native persistence exists, the command is the final server-owned review
artifact. It must preserve the evidence correlation handle from the verified
handoff without accepting another client-controlled fingerprint field.

## Official Guidance Reviewed

- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
  recommends server-side authorization state and a final control gate before a
  sensitive action. The command derives verified provenance only from the
  server-resolved proposal.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit state transitions and server-derived values. A command is
  ready only when proposal, verified handoff, and emitted command fingerprints
  agree.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined, testable security controls. Focused command and registry
  tests exercise the exact provenance relationship.

## Decision

The command input remains unchanged: it accepts only the opaque proposal
reference and user-visible proposal fingerprint. After resolving the
server-owned proposal, the command extracts the verified handoff fingerprint
from its carried handoff-audit summary.

The command requires:

```text
input proposal fingerprint
  == proposal provenance fingerprint
  == verified handoff fingerprint
  == emitted command verified handoff fingerprint
```

If the proposal and verified handoff fingerprints diverge, the command returns
the stable `proposal_not_ready` status with the
`verified_handoff_fingerprint_mismatch` risk. It does not disclose raw evidence
or allow the caller to override the verified value.

## Implementation

- `server/src/services/policyDeclaredIntentCommand.mjs` extracts verified
  handoff fingerprint provenance from the server-resolved proposal, rejects a
  mismatch, and carries the verified digest in ready command output.
- `server/src/__tests__/services/policyDeclaredIntentCommand.test.mjs` covers
  successful propagation, provenance divergence, and final result audit
  tampering.

## Pros And Cons

Pros:

- Creates one traceable correlation chain from evidence handoff to proposal to
  declared-intent command.
- Keeps the browser input surface unchanged and bounded.
- Gives the later native persistence transaction a verified provenance value to
  audit before it writes policy state.

Cons:

- Synthetic ready-proposal fixtures must include verified handoff provenance.
- The command remains an authorization artifact, not a persistence operation or
  an automatic policy decision.

## Final Recommendation Stack

1. Build and independently verify the bounded evidence handoff.
2. Create and register a proposal carrying the verified fingerprint summary.
3. Resolve the actor-bound opaque snapshot and require proposal/handoff
   fingerprint agreement.
4. Emit a command carrying the verified fingerprint for the later atomic
   persistence gate.

## Security Outcome

- No client-controlled field can replace the verified evidence fingerprint.
- A mismatched proposal is blocked before the command reaches persistence.
- The command exposes bounded IDs and digests only; it contains no raw evidence,
  provider payload, API key, quota state, or media title.

## Verification

- Focused command, registry, and proposal tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Define the native policy persistence gate as a single transaction that
revalidates this command, consumes the opaque reference, stores a versioned
native intent record, and records a rollback snapshot atomically.
