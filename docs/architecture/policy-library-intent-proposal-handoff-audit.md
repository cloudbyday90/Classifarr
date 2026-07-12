# Policy Library Intent Proposal Handoff Audit

## Status

Implemented as a ready-result invariant for the library intent proposal service.

## Problem

The proposal service already loads library evidence through the server-owned
loader and independently runs the complete handoff audit. It does not allow a
caller to provide a raw projection. Its result audit, however, previously did
not require the carried `handoffAudit` summary to remain successful when a
result claimed `ready`.

That left an integrity gap for later consumers or tests that receive a proposal
object after it has been constructed: a proposal could look ready through its
intent audit and fingerprint provenance while no longer proving that its
evidence handoff was valid.

## Official Guidance Reviewed

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
  recommends validating authorization and related state at every request or
  decision point. The proposal result rechecks its carried handoff state before
  it can claim readiness.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-derived workflow state and explicit transition invariants.
  A ready proposal is valid only after a passing verified-evidence transition.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined and testable secure-development controls. The invariant is a
  focused result-audit rule with a regression test.

## Decision

Keep the existing proposal intake architecture:

```text
server-owned evidence loader
  -> complete handoff audit
  -> bounded intent draft
  -> library intent proposal
```

Do not add an alternative raw-evidence input or another verifier. Instead,
require every proposal that declares `ok: true` to include a successful
`handoffAudit`. A mismatch produces the existing stable
`evidence_handoff_invalid` risk.

## Implementation

- `server/src/services/policyLibraryIntentProposalService.mjs` now rejects a
  ready result whose `handoffAudit.ok` is not `true`.
- `server/src/__tests__/services/policyLibraryIntentProposalService.test.mjs`
  mutates the carried audit of a real ready result and verifies that the result
  audit rejects it.

## Pros And Cons

Pros:

- Preserves the existing single loader and verifier path.
- Prevents later consumers from treating a weakened or fabricated proposal as
  ready.
- Keeps the check pure, deterministic, and free of provider or storage side
  effects.

Cons:

- It validates the returned proposal contract; it does not persist policy
  changes or replace the separate learning and readiness decisions.
- A caller with an altered result must rebuild it from the server-owned evidence
  flow instead of attempting recovery in place.

## Final Recommendation Stack

1. Load evidence only through the server-owned library evidence loader.
2. Require the complete handoff verifier/audit before intent generation.
3. Require a ready proposal to retain a passing handoff-audit summary, intent
   audit, and fingerprint provenance.
4. Keep policy persistence, learning, refresh, and routing outside proposal
   construction.

## Security Outcome

- A raw caller-supplied projection cannot reach proposal construction.
- A proposal cannot claim readiness after its verified handoff state has been
  weakened.
- The audit exposes stable IDs and booleans only; it does not add raw evidence,
  media titles, provider payloads, API keys, or quota state.

## Verification

- Focused library-intent-proposal, evidence-handoff-verifier, and intent-engine
  tests pass.
- The full server suite, documentation lint, security lint, test lint, and
  production naming audit are required before release.

## Next Step

Harden the intent proposal provenance contract so the projection fingerprint in
the proposal must agree with the verified handoff audit's fingerprint summary,
not merely be present.
