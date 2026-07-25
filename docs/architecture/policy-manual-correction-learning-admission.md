# Policy Manual-Correction Learning Admission

## Status

Implemented as the first live runtime adapter for the Policy Learning Guard.

`POST /api/classification/corrections` now records the correction outcome,
evaluates a server-owned manual-correction learning decision, and writes an
exact-item memory only when that decision is admitted. A correction is never
turned into broad genre, studio, keyword, or pattern evidence automatically.

## Problem

The correction route previously performed two different actions as though they
had the same authority:

```text
operator corrects one item
  -> remember this exact item
  -> reinforce broad signals from that item's metadata
```

The first action is bounded by the exact item. The second generalizes a
one-item outcome into future behavior. That bypassed the learning guard and
could turn a single correction into an unintended rule.

The route also trusted a client-provided `corrected_by` value and did not
validate that the requested destination used the same media type as the
classification.

## Official Guidance Reviewed

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
  calls for trustworthiness considerations throughout an AI system's design,
  development, use, and evaluation. The admission boundary separates a known
  human outcome from the narrower question of whether it may affect future
  decisions.
- [NIST SP 800-218 Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
  recommends integrating secure development practices to reduce vulnerability
  root causes. A single server-owned admission point removes the route's
  duplicated learning logic and makes the policy explicit and testable.
- [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
  recommends early syntactic and semantic validation with allowlists. The
  route derives correction identity and destination details from server data,
  validates the target library and media type, and accepts only `movie` or
  `tv` exact-item memory.
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  distinguishes useful application event context from untrusted external data.
  The route logs bounded decision ids and reason codes, not titles, metadata,
  provider payloads, or caller-controlled actor text.

## Design

```text
authenticated correction request
  -> load classification and target library from the database
  -> validate target media type
  -> persist correction and final outcome
  -> manual-correction learning admission
  -> Policy Learning Guard
  -> exact-item memory write only when admitted
```

The pure admission service is
`server/src/services/policyManualCorrectionLearning.mjs`. It owns only these
decisions:

- a final outcome must be successfully recorded before learning is considered;
- a durable candidate must have a positive classification id, TMDB id,
  supported media type, and server-derived destination id and name;
- a valid correction is eligible only for `exact_item_memory`;
- no profile refresh, provider lookup, quota read, route attempt, or learning
  mutation occurs inside the service.

The route remains the persistence adapter. It invokes
`classificationEvidenceService.rememberExactMatch` only after the admission
audit passes. The legacy asynchronous pattern-reinforcement call was removed
from this correction path because it generalized a one-item outcome without an
explicit compatible or identity-evidence decision.

## Recommendations

1. Keep the final-outcome write and the learning decision separate. An outcome
   write failure must suppress learning, not be normalized into success.
2. Derive the actor from the authenticated request and the destination from the
   database. Do not use client-supplied audit identities or destination names.
3. Permit this live adapter to create exact-item memory only. Broader evidence
   needs a later explicit, bounded operator flow with its own provenance.
4. Fail closed for incomplete identifiers, unsupported media types, missing
   destinations, or unavailable outcome persistence while preserving the
   correction itself.
5. Log stable ids and reason codes only. Do not copy the classification title,
   metadata, provider output, or request payload into learning logs.

## Pros And Cons

Pros:

- Stops a single manual correction from silently becoming a broad policy rule.
- Preserves the useful, automatic exact-item correction behavior.
- Makes the authenticated actor and corrected destination server authoritative.
- Keeps a failed learning side effect from undoing a successful correction.
- Provides a reusable, side-effect-free service for the next runtime adapters.

Cons:

- Corrections with missing TMDB identity now remain outcome-only instead of
  creating a weak memory record.
- Existing broad pattern reinforcement no longer runs from this endpoint.
- Discord answers, pending-item resolutions, request choices, and routing
  outcomes still need their own runtime adapters; they must not reuse this
  correction-specific service.

## Final Recommendation Stack

1. `server/src/routes/classificationRouteCorrections.mjs` validates and records
   the authenticated manual correction.
2. `server/src/services/policyManualCorrectionLearning.mjs` turns trusted
   correction facts into a bounded exact-item admission result.
3. `server/src/services/policyLearningGuard.mjs` owns tier and eligibility
   semantics.
4. `server/src/services/policyFinalOutcomeNormalizer.mjs` preserves an
   explicitly unrecorded final outcome instead of implying success.
5. `server/src/services/classificationEvidenceService.mjs` persists exact-item
   memory only after admission.

## Verification

Focused tests cover admitted exact-item memory, missing exact-item identity,
failed outcome persistence, unsupported media types, and tampered
profile-refresh claims. The correction integration test verifies that the API
uses the authenticated actor, returns the bounded admission result, preserves
exact-item learning, and rejects cross-media-type destinations.

## Next Step

Proceed with **Phase 7R.5, Discord pending-answer learning admission**. It
should normalize a persisted resolved pending item into its own bounded event,
require the existing question-reduction fingerprint chain, and permit only the
learning tier explicitly selected by the normalized server question. It must
not reuse the manual-correction shortcut or infer broad evidence from answer
text.
