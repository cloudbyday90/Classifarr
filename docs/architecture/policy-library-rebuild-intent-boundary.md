# Policy Library Rebuild Intent Boundary

## Status

Implemented as the verified intent-inference boundary for library-derived
rebuild proposals.

## Problem

The rebuild path created a bounded evidence result, then directly called the
pure projection reducer and contract-only readiness reducer. The pure reducer
is useful for deterministic internal composition and focused tests, but it is
not a normal workflow authorization boundary: it does not prove the bounded
intent audit, evidence-fingerprint audit, or quality gate passed.

That allowed a rebuild proposal to derive intent and readiness from a
structurally shaped projection without retaining proof that the full intent
handoff was verified.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit server-side state transitions and server re-derivation of
  security-relevant values. Rebuild now consumes the verified bounded intent
  result rather than trusting a convenient intermediate projection.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  distinguishes semantic validation from shape validation. The intent boundary
  validates quality and fingerprint provenance, not merely a projection
  version.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports secure, testable software practices. Focused tests cover expected
  insufficient identity, failed-boundary output isolation, and later provenance
  mutation.

## Decision

Library rebuild now follows this sequence:

```text
allow-listed evidence input
  -> bounded evidence result
  -> bounded intent result
  -> verified no-write readiness handoff
  -> bounded readiness composition
  -> review-only rebuild proposal
```

For a normal proposal, the following values must agree:

```text
evidence-boundary fingerprint
  == intent-boundary fingerprint
  == emitted intent evidence-boundary fingerprint
```

If bounded intent quality is insufficient, rebuild returns
`needs_more_evidence` with a sanitized failed intent-boundary summary and no
projection, intent, or readiness payload. This is an expected operator action,
not an opaque technical failure. Other intent-boundary failures return
`blocked_by_intent_boundary` with the same no-derived-output rule.

## Implementation

- `server/src/services/policyLibraryPolicyRebuild.mjs` uses
  `buildPolicyIntentDraftFromBoundedEvidence` for normal rebuild workflows.
- It adds a bounded `intentBoundary` summary and trace attributes.
- Proposal validation rejects missing, invalid, or mismatched intent provenance
  and derived contracts attached to a failed intent boundary.
- `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs` covers
  the new expected insufficient-identity path, failed-boundary isolation, and
  provenance mutation.

## Pros And Cons

Pros:

- Removes a normal-workflow bypass around intent quality and fingerprint
  verification.
- Retains a simple operator action for expected missing identity evidence.
- Prevents a failed intent result from being converted into readiness or a
  reviewable policy draft.

Cons:

- Rebuild proposals with incomplete identity no longer retain an intermediate
  draft for debugging or display.
- Rebuild adds a small no-write adapter so the shared readiness wrapper can
  distinguish its derived guarded-outcome summary from a request-time event.

## Final Recommendation Stack

1. Build allow-listed, provider-free rebuild evidence.
2. Verify bounded evidence before intent inference.
3. Use the bounded intent result as the only normal rebuild intent source.
4. Preserve only sanitized evidence and intent-boundary metadata on failure.
5. Derive the no-write readiness handoff only after verified intent succeeds.
6. Let the shared bounded readiness wrapper make the final readiness decision.
7. Require operator acceptance and rollback before any future replacement.

## Security Outcome

- Direct pure intent reduction is no longer a normal rebuild workflow path.
- Failed intent inference cannot expose derived policy or readiness contracts.
- Provenance drift between evidence, intent boundary, and intent draft fails
  validation.
- No provider call, quota read, learning write, routing write, policy write, or
  automatic replacement was added.

## Verification

- Focused rebuild, readiness, and policy-engine completion tests pass.
- Full server tests, documentation lint, security lint, test lint, and the
  durable production-naming audit are required before release.

## Next Step

The verified handoff is implemented in
[Policy Library Rebuild Readiness Handoff](policy-library-rebuild-readiness-handoff.md).
Next, allowlist the bounded-decision contracts that the shared readiness wrapper
may consume.
