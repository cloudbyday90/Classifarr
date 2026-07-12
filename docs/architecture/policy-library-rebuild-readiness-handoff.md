# Policy Library Rebuild Readiness Handoff

## Status

Implemented as the side-effect-free handoff between a verified library intent
result and the shared policy automation readiness boundary.

## Problem

Library rebuilds are not request-time classification events. They may consume
bounded evidence from guarded outcomes, but they must not fabricate a
request-time learning result merely to call the existing readiness wrapper.

Before this handoff, the rebuild contract had verified evidence and intent, but
its readiness composition still needed an explicit, bounded representation of
what guarded outcomes permit. Reusing a raw learning payload would let a caller
smuggle request-specific state into a library-wide proposal. Reimplementing
readiness would create a second source of truth for automation decisions.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-owned workflow state, explicit state transitions, and
  server re-derivation of security-relevant values. The handoff derives a
  server-only decision from verified contracts instead of accepting a caller
  supplied learning result.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends semantic allowlist validation in addition to structural checks.
  The handoff verifies version, quality, SHA-256 fingerprint provenance,
  guarded-outcome projection validity, and explicit no-write state.
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports verifiable secure-development practices. Focused tests exercise the
  verified chain and mutation failures instead of relying on a UI path.

## Recommendation

Use one small adapter rather than a new readiness engine or a fabricated
learning event:

```text
bounded evidence
  -> bounded intent
  -> guarded-outcome projection
  -> rebuild readiness handoff (no writes)
  -> bounded readiness wrapper
  -> review-only rebuild proposal
```

The adapter emits a derived decision only when bounded intent provenance and
quality pass and the guarded-outcome projection validates. It has no provider,
database, routing, learning, or policy-storage side effects.

## Decision

`policyLibraryRebuildReadinessHandoff.mjs` owns the bridge contract:

- contract: `policy.library_rebuild_readiness_handoff.v1`;
- derived decision: `policy.library_rebuild_readiness_summary.v1`;
- source: verified bounded intent plus guarded-outcome projection only;
- decision semantics: `outcome_only`, `policy_edit_required`, or `blocked`;
- side effects: explicitly false for learning, routing, and policy storage;
- failure: no decision or next step, only stable status and risk identifiers.

`policyLibraryPolicyRebuild.mjs` passes that handoff to
`buildPolicyAutomationReadinessFromBoundedContracts`. The existing readiness
engine remains the one authority that evaluates readiness, quality agreement,
routing, profile freshness, and hard-limit state.

Every ready rebuild proposal now carries a sanitized readiness-boundary summary
whose evidence, intent, and handoff fingerprints must match. A failed handoff
or readiness wrapper returns `blocked_by_readiness_boundary` with no derived
projection, intent, or readiness payload.

## Pros And Cons

Pros:

- Reuses the existing bounded readiness authority.
- Does not misrepresent a library rebuild as a request-time learning event.
- Keeps guarded outcomes useful while preserving their validation boundary.
- Makes provenance and no-write guarantees auditable.
- Fails closed before a partial rebuild proposal can reach review.

Cons:

- Adds one explicit adapter and boundary state to maintain.
- A blocked readiness handoff intentionally gives the operator less detail than
  a complete proposal; stable risk IDs are retained for diagnostics.
- The generic readiness wrapper still needs a follow-up source-admission rule
  so only approved bounded-decision contracts can reach it.

## Final Recommendation Stack

1. Accept only a successful bounded intent result with passing audits.
2. Require matching SHA-256 evidence fingerprints and quality snapshots.
3. Validate the guarded-outcome projection before deriving any decision.
4. Emit only a no-write derived decision, never a fabricated request event.
5. Delegate readiness evaluation to the shared bounded readiness wrapper.
6. Retain sanitized readiness provenance on a successful rebuild proposal.
7. On failure, return a failed boundary state with no derived proposal
   contracts.
8. Follow with an allowlisted bounded-decision source contract at the readiness
   wrapper.

## Security And Data Handling

- No raw guarded outcomes, question text, media titles, provider payloads,
  prompts, quotas, or error text are emitted by the handoff.
- The adapter does not call providers, refresh profiles, route media, write
  learning, or mutate policy storage.
- Missing, mismatched, or insufficient intent provenance blocks the handoff.
- Invalid guarded outcomes block the handoff.
- A blocked handoff cannot retain a derived decision or next step.
- Side-effect fields must be present and false, not merely omitted.
- Rebuild validation rejects missing, invalid, or mismatched readiness-boundary
  provenance and rejects derived contracts on a readiness-boundary block.

## Implemented Files

- Handoff contract:
  `server/src/services/policyLibraryRebuildReadinessHandoff.mjs`
- Rebuild integration:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Shared readiness authority:
  `server/src/services/policyAutomationReadinessEngine.mjs`
- Handoff tests:
  `server/src/__tests__/services/policyLibraryRebuildReadinessHandoff.test.mjs`
- Rebuild integration tests:
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`

## Verification

Focused tests verify:

- verified bounded evidence, intent, handoff, and readiness compose;
- the handoff exposes no raw identity labels;
- fingerprint or quality drift blocks the handoff;
- invalid guarded outcomes block the handoff;
- blocked handoffs cannot retain decisions or next steps;
- omitted or true side-effect fields fail audit;
- rebuild proposals retain matching readiness provenance; and
- missing or tampered readiness provenance fails rebuild validation.

## Next Step

Add bounded-decision source admission to the shared readiness wrapper so it
accepts only the standard learning guard and this rebuild-specific no-write
handoff.
