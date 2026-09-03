# Current-Inventory Semantic Study Snapshot Design

## Status

Implemented on 2026-09-03. This is an offline-study preparation component. It
does not change live classification, policy scores, candidate membership, AI
invocation, learning, retry behavior, or routing.

## Problem

Classifarr's bounded current-library semantic retriever already compares an
incoming title and synopsis with descriptions of current items in only the
policy-owned candidate libraries. The earlier offline study format, however,
contained synthetic vectors. That is useful for contract testing but cannot
measure the real retrieval path that should challenge an obviously unsuitable
library, such as a disaster documentary in a comedy collection.

The study needs to capture the real comparison without turning its current
inventory into normal application telemetry or a new provider payload.

## Selected Design

```text
policy-owned two-to-three candidate contract
  + existing bounded current-library semantic retrieval
  -> leading candidate relevance + strongest alternative relevance
  -> redacted, fingerprint-bindable study snapshot
  -> fixed offline study signal
  -> independent-label readiness gate and frozen-study preflight
  -> human study review only
```

`policyCandidateCurrentInventorySemanticStudySnapshot.mjs` reduces one
already-completed retrieval to seven fixed fields:

- opaque fixture and snapshot identifiers;
- the policy-owned candidate count;
- retrieval availability; and
- bounded relevance for the policy leader and its strongest alternative.

The reducer uses the existing candidate contract only in memory to identify
the leader and strongest alternative. It discards every library ID, item ID,
title, year, description, prompt, embedding, provider value, and model
response. An unavailable retrieval retains no relevance value and maps to an
offline abstention.

The versioned document contract limits a study to 32 snapshots and binds it to
the current server-owned semantic-retrieval protocol. The adapter then accepts
this document alongside the existing synthetic format. It exposes only the
three pre-existing fixed study signal IDs to the evaluator; relevance values
do not appear in the readiness report or frozen-study preflight output.

The fixed 82 relevance / 8-point margin is a test protocol copied in scale
from the existing synthetic snapshot scorer. It is **not** a policy threshold,
model instruction, confidence score, or routing rule. Independent labels and
the existing precision, recall, abstention, false-positive, and representative
strata checks remain the authority for deciding whether a human review of a
future policy change is warranted.

## Security and Privacy Boundaries

- Capture accepts only a valid server-owned two-or-three-candidate contract
  and a result from the current retrieval protocol.
- The serialized study document has a strict allow-list. Content-bearing
  fields, library identities, model fields, prompts, vectors, and arbitrary
  instructions fail validation.
- Snapshot, snapshot-set, and fixture identifiers use fixed opaque prefixes
  with 16–64 hexadecimal characters. They cannot carry a media or library
  title.
- The normal classification path does not persist the snapshot. An authorized
  study owner may place an explicitly selected redacted document in a
  separately controlled packet, bind it with the existing SHA-256 manifest,
  and delete the packet at study expiry.
- A malformed, swapped, unknown-version, or unbound document fails closed in
  the existing adapter and preflight.
- The output cannot initiate AI/RAG calls, tune an embedding provider, write
  data, learn from a media item, change policy, retry, or route media.

## Research Basis

The sources below were retrieved from their official publishers on 2026-09-03
for the requested August 2026 baseline.

- NIST's AI RMF says its measurement results should be used for risk
  monitoring and response, while human-oversight processes should be defined,
  assessed, and documented. A measured, fixed study signal is therefore more
  appropriate than silently allowing similarity to change a route. [NIST AI
  RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- OWASP identifies RAG/vector risks including data leakage, cross-context
  conflicts, inversion, and poisoning. Candidate scoping, strict schemas,
  content minimization, and exact document binding keep a study snapshot from
  becoming a new catalog export. [OWASP LLM08:2025 Vector and Embedding
  Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- W3C WCAG-EM 2.0 calls for defined scope, a representative sample,
  evaluation, and documented results. The snapshot gives the existing
  independent-label process a reproducible representation of the exact signal
  it is evaluating; it does not substitute an automated measurement for the
  human study. [WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)

## Options Considered

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Continue synthetic embeddings only | Smallest existing test fixture. | Cannot evaluate the real current-library retrieval that operators expect Classifarr to use. | Reject. |
| Persist titles, descriptions, vectors, and full RAG packets during ordinary classification | Richest possible benchmark. | Creates a large retention, access-control, prompt-injection, and data-leakage surface. | Reject. |
| Let current semantic relevance demote a policy candidate now | Addresses a visible bad suggestion quickly. | The current corpus has not demonstrated safe precision/recall and would turn a probabilistic signal into policy authority. | Reject. |
| Capture only leader/strongest-alternative relevance for an explicit, bound study | Tests real library semantics while keeping routine operations and study reports content-free. | Requires an authorized study owner and independent labels before the result can support any design review. | Adopt. |

## Final Recommendation Stack

1. Use this snapshot format for the next 24–32 independently reviewed cases,
   including documentary, reality, broad-policy, and genre-overlap cases.
2. Keep current retrieval candidate-bound and keep the scored snapshot outside
   ordinary persistence and browser APIs.
3. Run the existing readiness gate and frozen-study preflight against one
   unchanged model/retrieval cohort.
4. If the study meets its conservative error profile, design a separately
   reviewed semantic counter-evidence change that can send a broad-policy
   result to candidate comparison or review—not automatic routing.
5. Do not treat the protocol score as model confidence or reuse it to alter a
   user's current score thresholds.
