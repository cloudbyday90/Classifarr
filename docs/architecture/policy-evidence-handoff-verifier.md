# Policy Evidence Handoff Verifier

## Status

Implemented as the durable verification boundary for the complete library
evidence handoff.

The verifier runs the server-owned library evidence loader and checks the loader
audit, static evidence-engine audit, envelope audit, boundary audit, projection
fingerprint, and generated quality assessment as one contract. It returns a
sanitized handoff summary with no collector record arrays or evidence labels.
It independently reruns the projection audit against the received projection;
the recorded boundary audit alone is not treated as proof of current integrity.
Its audit result also carries the sanitized fingerprint summary it independently
validated, so later bounded consumers can use verified provenance rather than a
parallel raw handoff field.

## Problem

Individual source collectors and the evidence envelope each have focused tests,
but that is insufficient to prove the complete handoff is safe for the intent
engine. A caller could receive a structurally malformed loader result, a stale
fingerprint, a mismatched quality assessment, or a failed static engine rule
even though a lower-level test passed in isolation.

The verifier defines the complete contract:

```text
library evidence loader
  -> loader audit
  -> source and envelope audits
  -> boundary, projection, fingerprint, and quality validation
  -> sanitized intent-engine handoff summary
```

## Official Guidance Reviewed

- [OWASP Business Logic Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends defining and testing workflow invariants rather than only happy
  paths. The verifier tests that every required audit and handoff stage is
  present before intent inference can proceed.
- [OWASP Secure Code Review Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Code_Review_Cheat_Sheet.html)
  calls for server-side validation, workflow integrity, and resource limits.
  The verifier accepts only the server-owned loader result and preserves the
  bounded source workflow.
- [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html)
  recommends generic handling for unexpected failures. Thrown loader failures
  become a stable verification failure without copied error text.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports defined security requirements and verification. The verifier records
  each nested audit as explicit, testable completion evidence.

## Recommendations

1. Verify the completed library evidence handoff as a unit, not only its
   component tests.
2. Require the loader and static evidence-engine audit before intent inference.
3. Revalidate the envelope boundary, projection, fingerprint, and quality assessment from
   the returned projection.
4. Derive downstream fingerprint provenance from the audit's verified
   fingerprint summary, not a parallel caller-controlled value.
5. Return summaries, status IDs, counts, audit risk IDs, quality, and
   fingerprint provenance only; do not copy evidence entries or labels.
6. Treat a valid but blocked handoff as structurally sound and operationally
   blocked, not as a corrupted contract.
6. Do not require an identity or an automation-ready quality state here. Intent
   and readiness components own those later decisions.

## Pros And Cons

Pros:

- Proves the full server-side workflow and nested audit chain.
- Detects projection, fingerprint, quality, audit, and side-effect drift before
  intent use.
- Separates contract validity from later policy/automation eligibility.
- Gives maintainers a sanitized completion signal without exposing evidence
  records.

Cons:

- Adds a verification layer in addition to focused component audits.
- A valid blocked handoff still cannot advance; callers must handle its stable
  blocked status.
- It does not infer intent, persist policy state, refresh profiles, or route
  media.

## Final Recommendation Stack

1. Source collectors read bounded persisted evidence.
2. `policyLibraryEvidenceLoader.mjs` composes the profile-first envelope.
3. `policyEvidenceHandoffVerifier.mjs` independently verifies the complete
   projection, audit, fingerprint, quality, and side-effect contract.
4. The intent engine consumes only a ready verified handoff.
5. The readiness engine later decides whether automation can proceed.

## Implementation Outcome

The verifier returns:

```text
statusId
audit
handoff summary
nextStep
```

The summary contains loader/envelope/boundary statuses, profile status, source
summaries, label-free quality, and fingerprint provenance. A blocked handoff has
no next step. A structurally invalid handoff produces a generic verification
failure with stable risk IDs.

## Security Outcome

- Verification uses the server-owned loader; clients cannot submit an evidence
  handoff.
- Nested loader, envelope, boundary, fingerprint, and quality audits are
  required for a ready result.
- Projection structure is independently re-audited from the received handoff;
  a carried boundary audit cannot authorize a later-mutated projection.
- Static evidence-engine policy rules are verified on every check.
- The sanitized fingerprint summary exposed to later consumers is the same
  correlation artifact independently validated by the handoff audit.
- Collector records and evidence labels are not copied into verifier output.
- Unexpected loader errors are sanitized.
- Claimed live lookup, provider quota, or storage-write side effects fail the
  checkpoint.

## Completion Criteria

The evidence engine is ready to hand off to the intent component when:

1. The profile-first loader returns a ready result.
2. Every source collector summary and audit passes.
3. The envelope and evidence boundary pass.
4. The projection audit, fingerprint, and quality assessment match the bounded
   projection.
5. The static evidence-engine audit passes.
6. The verifier returns `ready` with `intent_inference` as its next step.

This verifies contract integrity only. It does not claim that a destination has
enough identity evidence or is ready for automatic routing.

## Next Step

Begin the intent-engine component with a focused adapter that accepts only the
ready verified handoff, preserves its fingerprint/quality provenance, and does
not let the existing intent engine bypass the new library evidence workflow.
