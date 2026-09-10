# Candidate Verification Abstention Adjudication Fallback

## Status

Implemented on 2026-09-10. This is an advisory classification-quality change.
It does not grant AI routing, policy, learning, retention, provider, or
configuration-write authority.

## Problem

`prompt_confirm` policy outcomes previously used a strict, candidate-bound AI
verification. That verifier is intentionally allowed to either confirm the
policy-selected library or abstain; it must not name an alternative library.
This is correct for a narrow verification contract, but it led to an unhelpful
operator experience when the policy's top suggestion was wrong: a model could
recognize that the item did not belong in the selected library, then the review
would still surface that same selected library without an AI-assisted
alternative.

The existing `prompt_select` path already has a safer tool for that job: a
bounded candidate adjudication. It compares only two or three policy-ranked,
active, same-media destinations and remains advisory.

## Research Basis

This design was checked against primary guidance current through the requested
August 2026 baseline:

- [NIST AI RMF: Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented, repeatable measurement and independent review rather
  than treating model output as an unqualified decision.
- [OWASP Secure AI Model Ops Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_AI_Model_Ops_Cheat_Sheet.html)
  recommends bounded inputs, validation, least privilege, and monitoring for
  AI systems.
- [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance-aware retrieval and treating retrieved material as
  untrusted input rather than decision authority.
- [W3C WCAG-EM Report Tool](https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/)
  frames accessible evaluation as scoped, representative, and reportable.
  The existing pending-decision surface therefore keeps the one actionable
  recommendation primary and leaves detailed evidence progressive rather than
  adding a new competing panel.
- [W3C Understanding Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports concise status updates that do not unexpectedly move focus. The
  existing candidate-adjudication presentation remains the status surface.

## Decision

For a `prompt_confirm` outcome, Classifarr first runs the existing strict
candidate-bound verification. If that result is `confirmed`, malformed, or any
candidate-integrity failure, the current behavior remains unchanged.

Only if all of the following are true does it make exactly one additional AI
call:

1. The strict path was selected by the deterministic policy engine.
2. The server can construct a valid contract containing two or three active,
   same-media, policy-ranked candidate libraries.
3. Strict verification either returned `abstained`, or no strict request could
   be sent because the configured provider lacks strict structured-output
   capability.

That call uses the existing `adjudicate` mode and receives only the server-owned
candidate list plus bounded RAG/current-library evidence. The result is reduced
to a validated proposal, remains `needs_clarification: true`, and flows through
the existing confirmation card. The original strict-verification status is
preserved for the audit/presentation projection.

```text
policy ranking (2–3 eligible candidates)
  -> strict verification of policy-selected candidate
       -> confirmed / invalid strict response: existing outcome
       -> abstained / strict capability unavailable:
            bounded advisory comparison of the same candidates
              -> operator confirms or selects another destination
```

## Options Considered

### Keep the strict abstention as the final answer

Pros: one request; strongest possible separation between verification and
selection.

Cons: leaves the known-bad policy candidate as the only AI-visible
recommendation, even when existing policy alternatives can be safely compared.

Decision: rejected for eligible 2–3-candidate reviews.

### Let strict verification return an alternative library

Pros: one provider request and a concise response.

Cons: changes a narrow confirmation contract into a selection contract and
makes the verifier's authority ambiguous.

Decision: rejected.

### Use unrestricted AI/RAG to choose any library after abstention

Pros: potentially wider recall.

Cons: expands the model-controlled destination set, permits profile and
retrieval noise to influence a routing recommendation, and is difficult to
evaluate independently.

Decision: rejected.

### Use the existing bounded candidate adjudication as a fallback

Pros: the policy engine retains the candidate set; RAG supplies contextual
evidence; local models unsupported by strict verification can still make an
advisory comparison; no automatic route or policy update is introduced.

Cons: an eligible abstention may incur one more AI request and still require an
operator decision; it cannot fix a policy candidate set that omits the right
library.

Decision: selected.

## Security And Authority Boundaries

- Candidate membership, maximum count, activity, and media type are validated
  on the server before either provider request.
- The fallback never runs after a strict contract violation, candidate mismatch,
  confirmed result, or invalid/insufficient candidate contract.
- Adjudication cannot add a library, route media, update a policy, learn from
  the result, retain raw reasoning, or expose raw retrieved/provider content.
- A fallback request failure preserves the original strict-verification outcome
  rather than turning a provider error into a more authoritative answer.
- Current-library and RAG evidence stays advisory. It does not become semantic
  proof merely because a library already contains similarly placed items.

## Final Recommendation Stack

1. Use candidate-bound verification to protect a policy-selected destination.
2. On the two permitted non-confirming outcomes, compare only the same
   server-owned two or three policy candidates through advisory adjudication.
3. Keep the decision card concise: show the resulting recommended destination
   and one action; keep detailed policy/RAG evidence behind the existing
   progressive disclosure controls.
4. Require an operator confirmation until independently labelled, held-out
   evaluation proves that a specific automatic-routing policy is safe.
5. Next, enable real semantic evaluation by recording declared policy intent
   and collecting independent labels; do not treat current library contents as
   ground truth.

## Implementation References

- Fallback gate:
  `server/src/services/classificationCandidateAdjudicationFallback.mjs`
- Bounded candidate contract:
  `server/src/services/policyCandidateAdjudicationContract.mjs`
- Runtime orchestration:
  `server/src/services/classificationPolicyPathService.mjs`
- Result reduction:
  `server/src/services/policyCandidateAdjudicationResult.mjs`
