# Policy Candidate Evidence Card Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr will make the provenance and limitations of a pending policy
candidate visible before an operator confirms it. The server derives a compact
candidate-evidence card from evidence already retained with the pending
decision. It distinguishes:

1. An item identity anchor (media type plus a stable metadata identifier).
2. Declared-policy evidence.
3. Observed current-library profile evidence.
4. Similar-item retrieval evidence.
5. Confirmed-pattern or prior-confirmed-outcome evidence.

The card treats the current-library profile as contextual evidence. It can
support a candidate, but it cannot establish the item's semantic fit by
itself: an earlier placement, a title collision, or an over-broad profile can
otherwise reinforce a wrong policy outcome.

The card is a detector and explanation boundary, not an AI or routing feature.
It does not retrieve new data, inspect raw metadata, call a provider, alter a
score, select a candidate, change a policy, learn from an operator action, or
route media.

## Status Model

| Status | Conditions | Operator meaning |
| --- | --- | --- |
| `evidence_conflict` | Profile history differs, a deterministic constraint conflicts, or an existing negative-conflict calibration was retained | Do not treat the leading candidate as settled; compare the item identity and alternatives. |
| `counter_evidence_recommended` | An identity anchor and declared policy are present, but only contextual profile support is retained beyond that | A profile may reflect earlier placement. Separate corroboration is needed before confirmation. |
| `identity_anchor_incomplete` | A valid media type and stable identifier were not both retained | Title similarity must remain contextual; the decision has no safe identity anchor. |
| `evidence_unavailable` | No retained deterministic source supports the candidate | Review alternatives; the displayed score cannot explain semantic fit. |
| `corroborated` | Multiple retained sources support the candidate without a recorded conflict | Evidence is broader, but the item remains subject to the existing policy review and safety gates. |

The `counter_evidence_recommended` state is deliberately triggered by the
Katrina-like pattern visible in the operator screenshots: a specialized
declared policy plus observed contents, with no retained similar-item or
confirmed-outcome cross-check. It does not infer that the candidate is wrong;
it accurately reports that the retained evidence cannot independently verify
the semantic claim.

## Architecture

```text
persisted pending classification
  -> policy result and candidate diagnostics
    -> policyCandidateEvidenceCard.mjs
      -> fixed status plus five fixed source/state pairs
        -> runtime-question decision summary
          -> client allow-list normalizer
            -> fixed client copy and accessible evidence card
```

`policyCandidateEvidenceCard.mjs` is a pure ES module. It accepts a retained
classification, its leading candidate, and persisted metadata. It returns only
versioned, allow-listed source/state identifiers. It never returns title,
overview, genres, stable identifiers, policy terms, library identity, raw
retrieval text, provider information, prompts, model output, confidence, or
routing controls.

`policyCandidateEvidenceCardPresentation.js` is the browser trust boundary. It
requires exactly the five expected source identifiers, rejects unknown state or
status values, and maps the remaining values to fixed client-owned copy. The
component cannot render raw server text in the card.

## Research Basis

- NIST's AI RMF calls for testing and monitoring in the deployment context,
  documented uncertainty, and defined human oversight. A fixed evidence card
  provides an auditable basis for an operator review without transferring a
  routing decision to a model.
  [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- NIST's Generative AI Profile calls out data provenance, data quality,
  retrieval-augmented-generation approaches, and evaluation data as items that
  must be documented. The card records the availability and role of each
  evidence class, not an untraceable aggregate claim.
  [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- OWASP identifies prompt injection and vector/embedding weaknesses as risks
  in RAG systems. Retrieved text is therefore not made executable or directly
  rendered by this feature; the application uses fixed identifiers and
  application-owned text instead.
  [OWASP LLM01:2025 Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- W3C's status-message technique recommends a polite `role="status"` region
  with an explicit atomic announcement when status changes do not take focus.
  The card announces only its short summary and leaves the evidence list in
  normal reading order, avoiding an unnecessarily chatty live region.
  [W3C ARIA22 status messages](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22.html)

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Fixed candidate-evidence card | Explainable, no new storage, no provider call, and safe to test from retained decisions | Does not yet fetch missing semantic counter-evidence | Adopt |
| Ask AI to route every confirmation-band item | May create a quick semantic opinion | Adds probabilistic authority and can repeat a retrieval feedback loop | Reject |
| Render raw metadata and RAG passages | Offers detail | Exposes untrusted text, can confuse operators, and expands prompt-injection and privacy risk | Reject |
| Change policy scores or thresholds from the detector | Might reduce review volume | Makes incomplete evidence a hidden routing authority | Reject |
| Persist title-level RAG telemetry for every card | Supports investigation | Creates an unnecessary identity-bearing retention path | Reject |

## Security and Accessibility Boundaries

- The card is computed in memory from an already-authorized pending decision;
  it introduces no route, database query, migration, write, retry, or provider
  request.
- Only five source identifiers and five state/status identifiers cross the API
  boundary. Unknown values fail closed in the browser.
- No untrusted metadata or retrieval text is inserted into a prompt, template,
  browser DOM, log, or telemetry by this feature.
- The card has an accessible name and announces only a short fixed summary with
  `role="status"` and `aria-atomic="true"`. It does not move focus or make an
  operator action unavailable.

## Final Recommendation Stack

1. Use the candidate-evidence card to identify contextual-only and conflicting
   decisions before confirmation.
2. For a conflict or contextual-only item, verify the canonical source record
   before changing a policy or confirming an outlier.
3. Implement contrastive retrieval next: retrieve bounded supporting and
   contradicting evidence for the server-selected candidate set, filtered by
   stable identifier and media type.
4. Only then allow a strict, schema-validated local model to return the bounded
   advisory verdict `support`, `contradict`, or `insufficient`; it must not
   choose a destination or route media.
5. Add the Katrina cases as verified metadata fixtures before revisiting policy
   scores or automation thresholds.
