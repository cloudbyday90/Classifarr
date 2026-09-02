# Independent Reference-Label Oracle Design

## Status

Implemented on the unreleased branch on 2026-09-02. This is an offline
evaluation component. It has no HTTP route, UI control, database write, AI,
RAG, policy, learning, retry, or media-routing authority.

## Problem

Classifarr's semantic readiness evaluation accepted an independently labelled
reference-set artifact, but also required every reference decision to equal the
synthetic fixture decision. That made the separate file prove only that its
labels had been copied correctly. It could not measure disagreement or detect a
semantic signal that performed poorly against independent reviewers.

An evaluation set needs two distinct properties:

1. A label must be bound to the exact redacted case it evaluates.
2. An independent reviewer must be free to reach a different decision.

Treating the second property as an error would make the evaluation circular.

## Selected Design

```text
redacted fixture cases
  + independently reviewed, content-free labels
  -> schema and provenance validation
  -> exact case-set and SHA-256 fingerprint binding
  -> independent decisions become the offline metric oracle
  -> aggregate readiness report
  -> human design review only; no runtime routing change
```

`policyCandidateSemanticReferenceSetArtifact.mjs` validates the label contract,
the declared protocol, the exact fixture fingerprint, known fixture IDs, and
exactly one label for every fixture. It no longer checks that a label's decision
matches the synthetic baseline.

`policyCandidateSemanticCounterEvidenceReadiness.mjs` selects the independent
reference decisions only after that artifact reports
`independently_labelled`. Synthetic or unavailable reference sets keep the
fixture baseline solely to produce a reproducible `not_ready` report. Invalid
or incomplete input fails closed as `invalid_evaluation`.

The readiness report remains aggregate-only. It emits neither individual
fixture IDs nor the independent decisions. Its outcome remains an input to a
future human design review, never a route decision.

## Why This Is the Right Boundary

NIST's AI RMF says measurement should use rigorous testing, uncertainty,
benchmarks, formal reporting, documented test sets and metrics, and independent
review where appropriate. A fingerprinted case set plus reviewers who can
disagree implements the minimum meaningful version of that separation without
exposing media, prompts, responses, or retrieval content. [NIST AI RMF
Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)

OWASP's current vector and embedding guidance calls for source authentication,
data validation, review when combining sources, access partitioning, and
immutable logging. The component follows that direction through strict
allow-listed contracts, a fixed fingerprint, bounded aggregate output, and no
new RAG/vector input or endpoint. [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)

There is intentionally no new product panel. The evidence is an offline study
artifact, while the existing UI keeps the primary action clear and progressive
disclosure holds secondary detail. This avoids adding live-status noise; W3C
notes that live updates can become too chatty and should be tested for an
appropriate feedback level. [W3C Understanding Status
Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
W3C's evaluation guidance also distinguishes an evaluation process from a tool
that merely generates a report—this component records repeatable inputs; it
does not claim to replace an independent review procedure. [W3C Conformance
Evaluation and Reports](https://www.w3.org/WAI/test-evaluate/conformance/)

## Alternatives

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Require label = synthetic fixture decision | Simple and reproducible. | Circular; cannot evaluate disagreement or error. | Reject. |
| Trust arbitrary independent labels without binding | Flexible for operators. | A label set could apply to different cases. | Reject. |
| Store title, description, library, prompts, or RAG packets with labels | Richer audit material. | Expands privacy, retention, injection, and access-control risk. | Reject. |
| Bind content-free independent labels to the exact fixture set and use them only offline | Meaningful metric oracle with minimal exposure. | Requires a real reviewer process outside the application. | Adopt. |

## Security Properties

- Schema validation rejects unknown fields, raw media text, policy content,
  prompts, model output, embeddings, reviewer identity, and retrieval context.
- SHA-256 binds labels to one immutable fixture document; one-to-one coverage
  rejects missing or duplicate case labels.
- The protocol identifier is an operational attestation, not proof of reviewer
  independence. Review-process access controls and evidence must be managed
  outside Classifarr.
- No new network, provider, vector store, database, or live item access is
  introduced.
- Invalid artifacts fail closed and independent labels never influence runtime
  classification or automatic routing.

## Recommendation Stack

1. Treat the independent label file as the offline measurement oracle only
   after exact fixture binding validates.
2. Keep current policy ownership and routing deterministic; use AI/RAG only as
   bounded advisory evidence.
3. Create a genuinely independent, double-blind, redacted 24+ case study that
   covers the required policy strata.
4. Evaluate aggregate precision, recall, abstention, false-positive rate, and
   coverage against those labels.
5. If the aggregate gate reaches human-review readiness, propose a separately
   approved frozen RAG/index/model study. Do not promote this result directly
   into routing authority.
