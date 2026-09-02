# Frozen Semantic-Adjudication Cohort Design

Status: Implemented (unreleased)

Date: 2026-09-01

## Decision

Classifarr already uses a bounded AI comparison when a policy produces two or
three eligible destinations. The comparison can include semantic similarity to
descriptions of current items in those destinations, but aggregate monitoring
previously mixed outcomes from different models and semantic-retrieval
protocols. That made an apparent agreement rate impossible to interpret as a
single proposal evaluation.

This component creates the first automatic semantic-adjudication workbench
slice. At classification time, it stores a server-generated opaque fingerprint
of the specific candidate-comparison proposal. Statistics then evaluates only
the newest fingerprint cohort against a later validated operator destination.
It is an observational workbench, not an automatic-learning or routing path.

No acknowledgement is required: this slice stores no new raw media text or
library context. It uses existing operator decisions and the already persisted
classification metadata boundary.

## Scope and data boundary

```text
bounded policy candidate set + provider authority + semantic protocol status
  -> canonical server-only proposal descriptor
  -> SHA-256 opaque cohort fingerprint in existing classification metadata
  -> fixed completed-day aggregate selecting newest cohort only
  -> compact, auto-refreshing Statistics disclosure
  -> human evaluation hypothesis only
```

The canonical descriptor contains only:

- candidate-adjudication contract version and candidate count;
- provider authority contract version, provider type, model, effective mode,
  and server-enforced-structure capability; and
- semantic-retrieval protocol version.

Semantic-retrieval availability is deliberately an observed count inside the
cohort, not a fingerprint input. A temporary retrieval failure must not make a
new model/protocol baseline or hide the availability signal being evaluated.

The hash is the only part persisted in `candidate_adjudication`; the aggregate
response does not return the hash or any part of the descriptor. The descriptor
excludes item metadata, titles, descriptions, library and policy identifiers,
provider host, credentials, prompts, model output, vectors, similarity values,
and actor identity.

The report chooses the cohort with the newest completed observation in the
existing completed UTC-day window. It returns only bounded counts: comparisons,
proposals, abstentions, rejected responses, later resolved/consistent operator
choices, semantic-context availability, and the number of different opaque
cohorts observed. Twelve resolved proposals in the newest cohort make it
`ready_for_human_review`; this is a Classifarr review floor, not a statistical
significance claim or an industry threshold.

The reference decision is the later server-validated operator destination. It
is useful operational evidence but is not an independent ground-truth label,
and it must not be mistaken for a correctness rate.

## Authority and safety invariants

1. The fingerprint is server-generated; a browser, model response, or request
   cannot choose it.
2. An absent or malformed AI authority yields no fingerprint and therefore no
   frozen cohort. Monitoring fails closed rather than assigning the event to a
   guessed configuration.
3. The aggregate query has fixed paths and parameters, selects no identity or
   text column, and emits no cohort identifier.
4. No model, RAG call, embedding operation, historical read, configuration
   write, policy change, retry, learning operation, or routing action is
   introduced.
5. A cohort status can never grant policy-change or automatic-routing
   eligibility.

## Accessibility and hands-off behavior

The workbench is a collapsed native disclosure inside existing Candidate
Retrieval Monitoring, not another Settings card. Its contents load with the
existing page and refresh on the existing five-minute interval. The compact
summary explains the current state first; details are keyboard-operable and do
not add a button, acknowledgement, manual refresh, model selector, or routing
control.

This follows W3C guidance to provide labelled controls, concise feedback, and
status information without moving focus. The existing page-level polite status
region announces background refresh results. [W3C Forms Tutorial](https://www.w3.org/WAI/tutorials/forms/)
and [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
provide the relevant accessibility guidance.

## Research basis

Research was refreshed on 2026-09-01 using official sources applicable to the
requested August 2026 baseline.

- NIST's Generative AI Profile calls for lifecycle measurement, evaluation,
  documentation, and human oversight that match the deployment context. A
  configuration-bounded cohort prevents an observation from pretending to
  describe a changing model/retrieval setup. [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- OWASP identifies data leakage, cross-context exposure, poisoning, and weak
  access boundaries as RAG/vector risks. The workbench therefore reuses only
  an opaque server fingerprint and aggregate counts instead of retaining a
  retrieval packet, description, vector, or prompt. [OWASP LLM08: Vector and
  Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- OWASP API Security recommends keeping an explicit inventory of exposed API
  behavior. This work reuses one authenticated aggregate endpoint rather than
  adding an item-selection or data-export endpoint. [OWASP API9:2023 Improper
  Inventory Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/)
- W3C WCAG 2.2 requires programmatically determinable status feedback. The
  new state uses fixed client presentation and stays behind a native disclosure
  so it is concise by default. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)

## Options considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Continue one aggregate across all model and retrieval configurations | No new persistence field | Mixes incompatible observations and makes an agreement rate misleading | Reject |
| Persist raw prompts, descriptions, and RAG packets automatically | Highest apparent detail | Expands privacy, retention, prompt-injection, and access-control scope | Reject |
| Require an administrator acknowledgement before any aggregate telemetry | Strong visible consent | Adds friction without protecting new raw content; the component stores none | Reject |
| Automatically group existing outcomes by opaque proposal fingerprint | Separates changing proposals, needs no operator setup, reuses validated outcomes | Remains observational; it cannot reproduce the full semantic context | Adopt |

## Final recommendation stack

1. Use the automatic frozen cohort to ensure AI/RAG outcome observations are
   configuration-comparable before interpreting them.
2. Treat later operator alignment as a review hypothesis, never as correctness
   or routing authority.
3. When a cohort reaches its 12 resolved-proposal floor, design a separately
   approved reference-set study with explicit independent labels before making
   any semantic change operational.
4. If raw descriptions, library context, or retrieval packets are ever needed
   for that later study, introduce a separate retention, authorization,
   redaction, audit, and deletion design first.

## Non-goals

- This is not a full frozen RAG snapshot: it does not prove unchanged index
  contents, embeddings, or library inventory.
- This is not an automated benchmark, a model score, a configuration
  recommendation, or a learning system.
- This does not change an existing policy score, candidate set, AI call,
  threshold, retry, route, or operator workflow.
