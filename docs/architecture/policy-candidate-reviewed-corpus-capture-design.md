# Redacted Reviewed-Corpus Capture Design

## Outcome sought

Classifarr needs better evidence for future RAG and AI evaluation without
turning a model response, library-name heuristic, or prior placement into a
live routing authority. The policy score shown to an operator remains a
deterministic safety score; it is not an AI-confidence score.

This design creates a future-only corpus of explicit operator outcomes. It
does not attempt to reuse or expose historic media records. A captured row can
later help evaluate whether a proposed retrieval or model change would improve
the decision process, but cannot alter policy scoring, AI/RAG input, learning,
or routing.

## Evidence and standards reviewed

- NIST's AI RMF Measure function calls for rigorous test, evaluation,
  validation, and verification; documented metrics and methods; representative
  evaluation; and monitoring. The capture is an evaluation input, not a live
  decision mechanism. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- NIST's playbook also calls for transparency/documentation and privacy-aware
  handling when dataset information is shared. The record contains only an
  allow-listed projection and its lifecycle is documented. [NIST AI RMF
  Playbook: Measure](https://airc.nist.gov/airmf-resources/playbook/measure/)
- OWASP identifies unauthorized access, cross-context leakage, data leakage,
  and poisoning as RAG/vector risks. The capture therefore has no media,
  library, destination, model, prompt, response, retrieval text, or embedding
  fields. [OWASP: Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- The existing settings status follows the WAI-ARIA disclosure and status
  patterns: concise current state first, with details only when requested, and
  polite atomic feedback when an administrator enables capture. [WAI-ARIA
  Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  and [WCAG Technique ARIA22](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA22.html)

## Design

### Admission boundary

An entry is eligible only when all of the following are true:

1. A signed, current runtime policy-question answer was validated by the
   server.
2. The answer produced the existing strict
   `policy_candidate_correction_outcome_attribution` projection.
3. The action came from a locally authenticated user with a numeric audit
   identity.
4. An administrator previously acknowledged the existing safeguards and
   selected a 7–90 day retention period.

The capture happens after the authoritative outcome write, within its existing
database transaction. Invalid attribution, non-auditable operator identity, or
missing acknowledgement fails closed and creates no record.

### Retained row

Each random, opaque capture ID has only:

- control configuration revision and expiry;
- score-margin band;
- operator selection outcome category;
- five fixed evidence-source state categories;
- numeric operator audit identity and timestamps.

It intentionally excludes source classification/history IDs, media titles,
years, external IDs, library or destination identities, policy text, provider
and model configuration, prompt/response content, retrieval text, and vectors.
The record is not available through a browser API.

### Retention and audit

The daily retention task deletes expired rows in small locked batches. A
minimal, append-only audit event is retained for capture and expiry. It carries
only the opaque capture ID, actor (for capture), configuration revision, and
timestamps. This establishes operator accountability without retaining media
data.

```text
validated operator answer
  -> strict outcome-attribution projection
  -> acknowledged safeguard control
  -> redacted future capture + append-only audit
  -> automatic expiry deletion
  -> later, separate offline RAG/AI evaluation
```

## Options considered

| Option | Pros | Cons |
| --- | --- | --- |
| Use full historic classification records | Richest semantic material | High exposure and poisoning risk; violates existing no-history boundary |
| Allow current model output to tune routing | Fast apparent feedback loop | Circular evaluation; unreliable local models could reinforce bad routing |
| Capture only future redacted operator outcomes | Independent human outcome signal, low retention footprint, reversible | Does not contain semantic labels or retrieval documents by itself |
| Use only aggregate metrics | Lowest data exposure | Cannot support case-level evaluation, stratification, or future adjudication |

## Final recommendation stack

1. Adopt this automatic, redacted, future-only capture boundary.
2. Keep the existing deterministic policy thresholds and mandatory operator
   review unchanged.
3. Use captured data only in offline evaluation reports with explicit
   acceptance criteria for retrieval/model changes.
4. Add a later, separately approved semantic-adjudication workflow if the
   evaluation needs title/description context; do not silently join it to this
   corpus or expose it to RAG.
5. Promote a RAG or AI change only after an independently reviewed evaluation
   demonstrates gains across representative strata and no material safety
   regression.

## Non-goals

- This is not automatic policy learning.
- This is not a model fine-tuning corpus.
- This does not make a local model, including a thinking model, authoritative.
- This does not change a score, a confidence threshold, a candidate, or a
  route.
