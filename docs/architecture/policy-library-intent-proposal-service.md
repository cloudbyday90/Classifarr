# Policy Library Intent Proposal Service

## Status

Implemented as the server-owned boundary for creating a proposed destination
intent from a library's verified evidence handoff.

## Problem

The evidence loader can safely assemble observed library facts, but observed
facts must not silently become destination policy. Conversely, a caller's
declared intent must not bypass provenance, quality, or fingerprint checks. A
library-derived proposal needs one small, explicit handoff that preserves both
kinds of authority.

The service loads evidence only through the server-owned loader and complete
handoff audit. A result that claims readiness must retain the passing handoff
audit alongside its intent audit and fingerprint provenance.

## Design

```text
declared operator intent + cached library evidence
  -> shared evidence input gate and fingerprinted envelope
  -> complete handoff audit
  -> bounded intent reducer
  -> proposed intent or stable blocked result
```

`policyLibraryIntentProposalService.mjs` owns this sequence. It uses the
existing library evidence loader exactly once, verifies the raw handoff with
`buildPolicyEvidenceHandoffAudit`, then supplies only the bounded evidence
boundary to `buildPolicyIntentDraftFromBoundedEvidence`.

The service returns a proposed intent, a label-free evidence provenance summary,
and stable status/risk IDs. It does not expose collector record arrays. Intent
labels are intentionally present only inside the proposal because they are the
operator-facing policy meaning being reviewed.

## Official Guidance Reviewed

- [NIST AI RMF 1.0](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf)
  emphasizes governance and documented risk management. The service retains a
  deterministic fingerprint and generated quality assessment with each
  proposal, rather than treating inferred policy as untraceable output.
- [NIST AI Resource Center](https://airc.nist.gov/) describes current AI RMF
  guidance and documentation practices. The design keeps observed evidence,
  declared operator intent, and later learning decisions as separate stages.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allowlist validation before application processing.
  Declared intent enters through the existing server-owned evidence input gate,
  not through a client-built projection.
- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends explicit workflow invariants and server-derived security-relevant
  state. The service verifies the handoff before inference and blocks reordered
  or incomplete workflow states.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls for validation and workflow-integrity review. Focused tests cover a
  valid proposal, insufficient evidence, malformed handoff, and sanitized
  dependency failure.

## Recommendations

1. Keep proposal creation separate from policy persistence, learning, profile
   refresh, provider activity, and routing.
2. Carry declared operator intent through the shared input gate, projection,
   quality assessment, and fingerprint instead of treating it as a side channel.
3. Require complete handoff verification before calling the bounded intent
   reducer.
4. Require ready proposal results to retain a passing complete handoff audit;
   result consumers must not trust a ready status alone.
5. Preserve only source counts, quality, fingerprint, and trace provenance
   outside the proposed intent; do not return raw collector records.
6. Block insufficient identity evidence rather than guessing a destination.
7. Treat the next task as command-contract hardening, not automatic policy
   persistence.

## Pros And Cons

Pros:

- Gives library-derived proposals one enforceable server-side entry point.
- Prevents direct reducer callers from skipping loader, audit, fingerprint, or
  quality checks.
- Prevents a later-mutated proposal from claiming ready status without the
  verified handoff that authorized it.
- Keeps declared intent distinct from observed evidence while correlating both
  with one fingerprint.
- Fails closed without exposing dependency error text or collector records.
- Preserves the automated path: a clear declared destination can become a
  proposal without adding diagnostic UI panels.

Cons:

- It adds an orchestration service around existing pure reducers.
- A proposal stays blocked until the evidence quality contract has identity.
- It intentionally does not save a policy or convert any legacy configuration.

## Final Recommendation Stack

1. `policyEvidenceInputGate.mjs` validates the accepted evidence input shape.
2. `policyLibraryEvidenceLoader.mjs` performs bounded profile-first reads.
3. `policyEvidenceHandoffVerifier.mjs` supplies the reusable raw-handoff audit.
4. `policyLibraryIntentProposalService.mjs` verifies the handoff and invokes
   the bounded intent reducer.
5. `policyIntentEngine.mjs` constructs an explainable proposed intent.
6. A later command contract validates an authorized operator save separately.

## Security Outcome

- No caller can submit a prebuilt evidence projection to the proposal service.
- Declared intent is subjected to the existing server-side evidence input gate.
- Handoff audit, fingerprint, quality, and intent audit must pass before ready.
- A ready result must retain its successful handoff-audit summary; no later
  consumer can treat the status alone as authorization.
- Unexpected loader or reducer failures return generic stable errors.
- The service performs no live media-server/provider lookup, quota read,
  profile refresh, route attempt, storage write, or learning mutation.
- Blocked results cannot advertise a downstream next step.

## Implementation Outcome

The public service method is:

```text
proposeLibraryIntent({ libraryId, operatorIntent, getProfile, now, maximumAgeMs })
```

Its result contains:

```text
statusId
evidenceProvenance
handoffAudit
intentAudit
intent
sideEffects
nextStep
```

`intent` is present only for `ready`. A structurally sound handoff with
insufficient identity returns `blocked_by_evidence_quality`; a malformed or
tampered handoff returns `blocked_by_evidence_handoff`.

## Next Step

Build the declared-intent command contract: a server-owned, allowlisted command
that binds an authenticated operator's explicit changes to the proposal
fingerprint before any persistence path is introduced.
