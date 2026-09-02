# Outcome-Weighted Semantic Retrieval Design

## Decision

Classifarr will calibrate only the advisory, candidate-scoped semantic retrieval
signal with authenticated operator outcomes. It will not use ordinary library
contents as proof, modify a policy score, alter an automation threshold, edit a
policy, or route an item.

The semantic retriever remains bounded to the existing policy-owned candidate
libraries. A result becomes eligible for a small boost only if all of the
following are true:

1. The result is still a synchronized current-library item with the same media
   type and stable TMDb identity.
2. Its source classification has an append-only authorized-outcome receipt.
3. The receipt's destination matches that current library, has a `resolved` or
   `routed` final status, and was admitted to the existing `ready` learning
   boundary.
4. The semantic relevance is already at least 50/100.

The boost is capped at six points and at 100/100. It can change only ordering
inside the three bounded semantic items already returned for a policy-eligible
candidate. It cannot create a result, broaden a library set, or make a weak
match look semantically strong.

## Why this is the next component

The prior exact-item memory learns a confirmed placement for the same stable
item. That is the highest-confidence automatic learning case. This component
extends learning to *similar* items while retaining a strong boundary: a prior
confirmed outcome is a calibration signal, not a new routing rule. It directly
improves the advisory comparison that sees item descriptions and current library
content, which is the RAG value Classifarr needs for ambiguous destinations.

## Research and alternatives

NIST's Generative AI Profile recommends provenance mechanisms that let teams
trace the origin and history of inputs and outputs. OWASP's vector and embedding
guidance calls for authenticated, validated data sources and permission-aware
retrieval. WCAG 2.2 requires programmatically determinable status messages,
while W3C's guidance on automatic updates cautions against disruptive refreshes.

| Option | Pros | Cons |
| --- | --- | --- |
| Use all historic placements | Quickly produces many examples | Treats stale, accidental, or unreviewed placement as training evidence; unsafe |
| Let the LLM infer a library policy from descriptions | Flexible | Non-deterministic, opaque, vulnerable to retrieval poisoning, and bypasses policy boundaries |
| **Bound authenticated-outcome calibration** | Adds trustworthy semantic precedent, retains provenance, works automatically, and cannot route | Small effect until confirmed outcomes accumulate; remains advisory |
| Replace policy scoring with RAG similarity | Could reduce reviews sooner | Would make probabilistic retrieval authoritative and create unsafe misroutes |

## Recommendation stack

1. Keep deterministic policy selection and its confirmation/automatic-route
   thresholds authoritative.
2. Keep exact-item automatic memory for authenticated same-item outcomes.
3. Apply this small, provenance-gated semantic calibration only within the
   advisory candidate comparison.
4. Continue aggregate offline evaluation before considering any broader
   semantic authority; do not infer that a retrieval boost has earned it.
5. Present one concise, accessible status rather than expanding the pending
   review screen with raw evidence. Any future automatic status update must use
   an appropriate status role and must not steal focus.

## Security and privacy boundaries

- The receipt table is append-only and joins on server-owned identifiers only.
- The query is parameterized, candidate-scoped, media-type scoped, and reads no
  metadata descriptions, embeddings, receipt IDs, actor data, prompts, or model
  output into the result.
- Remote providers receive only bounded aggregate counts. Only a syntactically
  trusted local Ollama endpoint can receive already-bounded current-library item
  titles, as before.
- Read errors, absent embeddings, or absent receipts fail closed to the existing
  unavailable/no-calibration behavior.

## Sources

- [NIST AI 600-1: Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [OWASP LLM08:2025 Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- [W3C WCAG 2.2 — Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- [W3C Technique G76 — user control of automatic updates](https://www.w3.org/WAI/WCAG22/Techniques/general/G76)
