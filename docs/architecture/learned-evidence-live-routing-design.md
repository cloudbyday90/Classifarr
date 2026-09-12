# Learned-evidence live routing design

## Decision

Connect the existing learned-evidence review rule to live routing for ordinary
soft-evidence reviews. Keep policy scores unchanged. Use the existing short-lived,
in-process consensus receipt; neither model output nor a serialized result grants
routing permission. This follows the candidate-admission fix in `82120e4d`.

The earlier 300-item replay found 126 proposals that agreed with learned evidence
and passed the library-specific familiarity check. Agreement with existing
placements is not independent accuracy. Live freshness checks can reduce this
number further; this design does not promise a particular automatic-route rate.

## Alternatives and tradeoffs

| Option | Benefit | Cost or risk | Decision |
| --- | --- | --- | --- |
| Lower policy thresholds | Simple, fewer reviews | Weak evidence can authorize the wrong destination | Reject |
| Let model confidence authorize routing | Minimal user involvement | Self-reported confidence and injected text become authority | Reject |
| Fresh learned-evidence qualification | Library-agnostic, no score inflation or new setup | Bounded extra reads and conservative abstention | Select |
| Require confirmation for every learned match | No new automatic decisions | Keeps the user's central problem unresolved | Retain only for ambiguity or explicit restrictions |

## Qualification and boundaries

1. Capture provider configuration, active policy definitions and request identity
   before generation using a one-use private context.
2. Accept only the existing validated, local, non-fallback candidate proposal.
3. Compare the entire active, same-media policy-eligible pool, not just the three
   destinations sent to the model. Preserve hard constraints, missing constraint
   metadata, RAG opt-outs and unknown review reasons.
4. Require three distinct, unshared descriptions for the selected destination,
   all stronger than the other candidates' neighbors, and agreement from learned
   genre/studio/audience patterns. Require the model's supplied description
   evidence to match the fresh provider-safe projection.
   Also check exact query identity across the full pool, including destinations
   outside the model's shortlist; a competing existing placement retains review.
5. Require a familiar match against the selected library's own held-out baseline.
   Exclude the query identity, synopsis copies and cross-library shared groups.
   Reuse the evaluation splitter and numeric kernel; fit at most 256 reference
   and 128 calibration vectors. Sparse, incomplete or degenerate fits abstain.
6. Recheck policy outcome, definitions, destinations, description evidence and
   configuration before issuing the existing 60-second receipt. Errors retain
   the original review. Administrative confirmation requirements still win.

The baseline is an empirical novelty rank, not a probability of correctness.
No library names, hand-authored genre categories or per-library tuning are added.
No training cache, raw vectors, model reasoning or private snapshots are exposed
through APIs. Automatic placements remain excluded from trusted outcome labels.
Ordinary inventory membership remains observational evidence and can be wrong.

The preparation context expires after five minutes and is consumed once, even
on failure. Request, proposal and result mutations during asynchronous validation
cannot change the authorized destination. The two inventory snapshots each have
a 15-second retrieval deadline; each selected-library fit allows at most
100 million scalar comparison operations and yields between calibration rows.

## Efficiency and interface

Reuse the existing local generation, retrieval repository and receipt consumer.
Fit only the proposed destination, with bounded SQL, work and cancellation.
Do not add another AI call, acknowledgement checkbox or settings panel. Existing
successful routing and review surfaces remain in use; the server supplies a short
plain-language reason. A future Command Center summary should announce meaningful
state changes without moving focus or announcing every background poll.

## Official-source research

Sources were discovered through search and opened on 12 September 2026. The
versioned scikit-learn 1.5 guidance and December 2024 WCAG recommendation predate
the requested August 2026 cutoff; OWASP's cited risk entry is its 2025 edition.
Mutable supporting OWASP/W3C guidance is current retrieval, not a verified
August archive.

- Separate prediction scores from action decisions, and do not tune a decision
  threshold on training/test data reused for its assessment.
  [scikit-learn decision thresholds](https://scikit-learn.org/1.5/modules/classification_threshold.html)
- Treat retrieved descriptions as untrusted input, restrict model capabilities,
  and validate actions outside the model. Existing local proposal parsing remains
  unchanged; deterministic checks, not textual assurances, authorize routing.
  [OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/),
  [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
- Programmatically identify displayed status changes without unnecessary focus
  movement; avoid an excessively chatty interface. No new UI is needed for this
  backend component.
  [WCAG 2.2, December 2024 recommendation](https://www.w3.org/TR/2024/REC-WCAG22-20241212/),
  [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)

## Recommended stack

Existing ESM Node/Express services, PostgreSQL read-only snapshots and vector
cache, local Ollama embeddings/proposals, the shared deterministic comparison and
baseline kernel, and the existing consensus receipt and Vue status surfaces.
No new dependency, schema migration, release or model fine-tuning is required.
