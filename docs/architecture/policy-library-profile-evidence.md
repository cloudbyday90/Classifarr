# Policy Library Profile Evidence

## Status

Implemented as the observed-library adapter for the policy evidence engine.

This component translates an already persisted media-server library profile into
the bounded `libraryProfile` input expected by the policy evidence boundary. It
does not query a media server, call a metadata provider, infer policy intent,
write storage, or expose an operator-facing surface.

## Problem

The profile service stores useful observed distributions such as genres,
ratings, studios, and keywords. The policy evidence engine intentionally accepts
small candidate lists instead of a database-shaped profile. Without a dedicated
adapter, callers would either rebuild that mapping independently or pass
unbounded profile data into the engine.

The adapter closes that gap while keeping a critical product rule intact:
observed distributions can support compatibility, but broad genres or other
distribution values cannot define destination identity alone.

## Official Guidance Reviewed

- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends server-side allow-list validation, canonicalization, and bounded
  structured input. The adapter accepts only known distribution and observed
  absence fields, normalizes labels, validates percentages, and limits emitted
  records.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  advises recording only the information needed and protecting sensitive or
  unsafe event values. The adapter does not copy raw profile metadata,
  provider payloads, or timestamps into its evidence output.
- [NIST SP 800-218, Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  supports integrating security requirements and verification into normal
  development. The adapter is a pure, deterministic module with a tamper audit
  and focused contract tests.

## Recommendations

1. Use a single server-owned adapter from persisted profile distributions to
   policy evidence candidates.
2. Emit genre, rating, studio, and keyword distributions only as compatibility
   evidence. Do not use any distribution by itself as identity evidence.
3. Treat observed absence as a review-only outlier. It cannot create an avoid
   or hard-limit rule.
4. Bound each distribution family to five deterministic candidates and exclude
   invalid or empty values.
5. Feed the result through `policyEvidenceBoundary.mjs`; do not send raw
   profile records directly to downstream intent or readiness engines.

## Pros And Cons

Pros:

- Reuses the media server as the source of observed application.
- Makes profile-to-evidence conversion deterministic and testable without live
  TMDB or other provider calls.
- Prevents broad genre overlap from silently becoming destination identity.
- Keeps raw profile metadata and temporary provider state out of evidence
  contracts.
- Gives future runtime integration one reusable, audited translation point.

Cons:

- A profile distribution alone cannot fully describe a destination; operator
  intent and final outcomes still matter.
- Observed absences require review and cannot automate an exclusion.
- This is a pure adapter; a later runtime component must choose when to load a
  persisted profile and invoke it.

## Final Recommendation Stack

1. `policyLibraryProfileEvidence.mjs` adapts persisted profile distributions.
2. `policyEvidenceInputGate.mjs` validates the bounded public envelope.
3. `policyEvidenceBoundary.mjs` builds and audits the evidence projection.
4. `policyEvidenceEngine.mjs` supplies the immutable bucket and source rules.

## Implementation Outcome

The adapter accepts common persisted snake-case and client-facing camel-case
distribution field names. It emits a compact result with:

```text
version
libraryProfile.identityCandidates = []
libraryProfile.compatibilityCandidates[]
libraryProfile.outliers[]
summary
warnings
sideEffects
```

Compatibility candidates hold a stable signal key, normalized label, rounded
observed count when the profile item count is known, confidence derived from the
recorded percentage, and an observed-distribution reason ID. Observed absence
candidates are emitted only in `outliers` with a review-required reason ID.

The audit fails closed when a caller adds identity evidence, changes a candidate
reason contract, or claims provider, quota, or storage side effects.

## Security Outcome

- No network, provider quota, or storage operation occurs.
- Raw profile fields are not copied to the evidence result.
- Labels are canonicalized, stripped of control characters, and bounded.
- Only valid positive percentages create compatibility candidates.
- Identity, hard-limit, and avoid evidence cannot originate from profile
  distributions through this adapter.
- Existing evidence-boundary validation remains required before downstream
  consumption.

## Next Step

The server-owned cached-profile loader is now implemented in
`policyLibraryProfileEvidenceLoader.mjs`. The next component is a read-only
runtime evidence-envelope assembler that combines this bounded profile handoff
with persisted outcomes, corrections, answers, routing outcomes, and bounded
metadata evidence before passing one complete envelope to the same evidence
boundary.
