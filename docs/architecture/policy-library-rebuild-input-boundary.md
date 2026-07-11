# Policy Library Rebuild Input Boundary

## Status

Implemented for library-derived policy rebuild proposals.

## Problem

The rebuild proposal previously read guarded outcomes directly and extracted
provenance through several fallback fields. It also accepted a separate raw
learning decision for readiness. A partially formed or integration-specific
object could therefore influence rebuild evidence or readiness despite not
being a validated request-time learning decision.

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends server-side workflow state, validation of each transition, and
  server re-derivation of security-relevant values.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early server-side allowlists with syntactic and semantic checks.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls out workflow integrity and state-transition validation.
- [OpenTelemetry Naming](https://opentelemetry.io/docs/specs/semconv/general/naming/)
  supports stable, precise names for bounded contract and trace fields.

## Recommendation

Use three focused contracts:

1. `buildPolicyGuardedOutcomeProjectionFromRequestTimeDecisions` validates
   request-time decisions and projects only bounded rebuild evidence.
2. `buildPolicyLibraryPolicyRebuildProposalFromRuntimeInput` owns raw input
   composition and cannot accept a supplied projection.
3. `buildPolicyLibraryPolicyRebuildProposalFromGuardedOutcomeProjection`
   accepts a valid projection and rejects raw guarded outcomes or a raw learning
   decision.

Invalid request-time decisions are omitted from projection evidence and retained
only as bounded rejection counts and reason identifiers. The rebuild readiness
input is derived from that projection; it cannot be overridden by a separate
integration payload.

## Pros And Cons

Pros:

- Stops raw decision fields from becoming alternative rebuild authorities.
- Keeps only validated evidence fingerprints, request-proof fingerprints,
  learning state, and final-outcome state.
- Preserves safe diagnostics for rejected handoffs without retaining raw
  question, automation, or provider payloads.
- Makes migration verification consume the same explicit raw-input adapter.

Cons:

- Callers must choose the runtime adapter or construct a valid projection.
- Rejected request-time decisions cannot contribute partial compatibility
  signals, even when some fields appear plausible.

## Final Recommendation Stack

- Guarded-outcome projection:
  `server/src/services/policyGuardedOutcomeProjection.mjs`
- Library rebuild reducer and runtime adapter:
  `server/src/services/policyLibraryPolicyRebuild.mjs`
- Request-time decision dependency:
  `server/src/services/policyRequestTimeLearning.mjs`
- Focused tests:
  `server/src/__tests__/services/policyGuardedOutcomeProjection.test.mjs` and
  `server/src/__tests__/services/policyLibraryPolicyRebuild.test.mjs`

## Outcome

```text
raw request-time decisions
  -> validated guarded-outcome projection
  -> library-derived rebuild proposal

existing valid guarded-outcome projection
  -> library-derived rebuild proposal
```

The rebuild proposal no longer reads raw guarded outcomes or a separately
supplied learning decision.
