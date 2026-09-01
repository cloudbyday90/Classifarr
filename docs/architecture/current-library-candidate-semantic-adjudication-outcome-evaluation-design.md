# Candidate Semantic-Adjudication Outcome Evaluation Design

Status: Implemented (unreleased)

Date: 2026-09-01

## Decision

Classifarr already performs a bounded candidate comparison when policy produces
two or three eligible destinations. For a trusted local provider, that
comparison can include similarity to descriptions of current items in those
same libraries. Until now, aggregate monitoring could show AI/operator
agreement, but it could not distinguish a comparison where that semantic
context was available from one where it was unavailable.

This component adds that distinction to the existing **Candidate Retrieval
Monitoring** report. It measures observed, human-resolved outcomes without
retaining a new corpus or changing an item's live decision.

## Boundary

```text
existing classification-history metadata
  -> fixed JSON-path aggregate counts in a completed UTC-day window
  -> pure semantic-context outcome projection
  -> existing authenticated monitoring endpoint
  -> automatically refreshed, progressively disclosed Statistics view
```

The query reads only the already-persisted, allow-listed candidate-adjudication
status, semantic-context status, proposed-destination comparison, and final
destination comparison. It returns counts only. It does not select, return, or
retain a title, description, media identifier, library name or ID, prompt,
model/provider identifier, raw response, embedding, or actor identity.

The projection has three fixed semantic-context buckets:

| Bucket | Meaning |
| --- | --- |
| `available` | The bounded comparison completed with candidate-scoped semantic similarity to current-library descriptions. |
| `unavailable` | That semantic retrieval did not complete; the comparison used its remaining bounded evidence. |
| `not_recorded` | A legacy comparison did not retain a semantic-context status. It is shown separately rather than being treated as unavailable. |

For each bucket, Classifarr reports aggregate comparison, proposal, resolved
proposal, operator-aligned proposal, alternative-selection, and pending counts.
It also reports all comparison abstentions and contract-rejected responses.

Agreement means only that an operator later chose the proposal's destination.
It is not a correctness rate, a confidence score, a semantic-retrieval quality
claim, or permission to auto-route.

## Why this is the first semantic-evaluation slice

The requested human-approved semantic-adjudication workbench remains important:
it must evaluate a frozen proposal against an explicitly collected human
reference set. Creating it immediately would require a new, carefully governed
boundary for title, description, and library-context retention.

This lower-exposure first slice answers a prerequisite question using evidence
already generated in normal operation: does the current bounded semantic
context correlate with a different rate of operator alignment or abstention?
It gives a concrete basis for designing the larger workbench without treating
raw library context as a default telemetry feed.

## Research basis

Research was refreshed on 2026-09-01 using official sources applicable to the
requested August 2026 baseline.

- NIST AI RMF calls for documented, repeatable measurement, documented test
  sets and methods, and clearly defined human-AI oversight. The component is a
  traceable observation, not a deployment decision. [NIST AI RMF
  Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP identifies access control, cross-context leakage, data poisoning, and
  monitoring as RAG/vector concerns. The query therefore stays aggregate-only
  and does not introduce a new vector or content read. [OWASP LLM08: Vector
  and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- W3C WCAG 2.2 requires programmatically determinable status messages. The
  existing polite, atomic live region announces background refreshes without
  taking focus, and semantic detail remains behind a native disclosure.
  [WCAG 2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Status
  Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
- OWASP API3 recommends allow-listing writable/readable properties and
  schema-based response validation. The report has only server-owned fixed
  fields; the browser cannot request a case, library, model, or raw evidence.
  [OWASP API3:2023](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Grant semantic/RAG output routing authority after a few aligned outcomes | Faster automation | Agreement is not correctness; creates circular learning and unsafe escalation | Reject |
| Retain descriptions and RAG packets automatically for a new benchmark | More detailed analysis | Expands the privacy, injection, and retention boundary without a separate approval design | Reject |
| Aggregate all AI proposals together | Small change | Cannot tell whether semantic context was actually available | Reject |
| Stratify existing bounded candidate comparisons by semantic-context state | Privacy-bounded, immediately useful, repeatable, and operator-derived | Observational data can be sparse and confounded by model/configuration changes | Adopt |

## Accessibility and hands-off operation

The Statistics view loads the aggregate report on entry and refreshes it every
five minutes while open. A `role="status"`, `aria-live="polite"`, and
`aria-atomic="true"` region communicates the refresh result without moving
focus. The main card gives the few numbers needed to understand whether the AI
proposed, abstained, or produced an unusable response; the per-semantic-context
breakdown is behind one native `details` disclosure.

There is no acknowledgement, test, refresh, model-selection, or routing button
for this component. Normal classification remains hands-off; the metric is
collected from outcomes that operators already make for pending items.

## Recommendation stack

1. Watch proposal, abstention, response-rejection, and semantic-context
   aggregate counts across completed windows before altering any candidate
   comparison prompt or retrieval setting.
2. Treat a visible difference as a review hypothesis, not evidence that one
   semantic mode is correct or safe to route automatically.
3. Keep semantic retrieval candidate-bound and provider-scoped, with raw
   descriptions excluded from telemetry and aggregate reads.
4. Build the separate human-approved, frozen-proposal semantic workbench only
   after its raw-context retention, access control, reference-decision, and
   security design are independently approved.
