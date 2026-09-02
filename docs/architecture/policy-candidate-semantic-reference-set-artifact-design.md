# Semantic Reference-Set Artifact Design

## Status

Implemented on the unreleased branch on 2026-09-02. This component is
offline-only and has no routing, policy, AI, RAG, learning, retry, database,
or HTTP authority.

## Problem

The existing semantic counter-evidence gate evaluates an eight-case synthetic
fixture. Its reference decisions make the evaluator reproducible, but they do
not establish that a decision came from reviewers who were independent of the
policy result, AI response, or semantic proposal. A larger corpus could meet
the numeric coverage thresholds while silently reusing the answer it is
supposed to test.

The next useful component is not another pending-review card. It is a small,
verifiable boundary that makes reference-label provenance explicit before the
existing readiness gate can say that a corpus is ready for human design review.

## Selected Design

```text
redacted fixture document + separately prepared reference-label document
  -> strict, content-free contract validation
  -> SHA-256 binding to the exact fixture document
  -> content-free reference-set artifact
  -> existing semantic counter-evidence readiness gate
  -> not_ready until independent double-blind labels are present
```

`policyCandidateSemanticReferenceSetContract.mjs` owns the complete input
allow-list. A label contains only a fixture identifier, the final reference
decision, consensus status, and reviewer count. The document contains only a
bounded reference-set identifier, a fixed protocol identifier, a fixture
content address, and labels. It has no free-text field and rejects title,
description, library, media ID, policy, prompt, provider, model, response,
embedding, reviewer identity, or raw RAG context.

`policyCandidateSemanticReferenceSetArtifact.mjs` validates the fixture and
reference documents separately, checks the SHA-256 binding, and confirms a
one-to-one label coverage for every fixture. The binding establishes that the
labels apply to this exact fixture set; it deliberately does **not** require a
reviewer decision to repeat the fixture's synthetic baseline. Its returned
artifact contains only fixed status, validation counts, opaque content
addresses, and aggregate decision/consensus counts. It never echoes fixture
IDs or input content.

The independent double-blind protocol identifier is a required operational
attestation, not cryptographic proof of reviewer independence. The system can
enforce a content-free format and exact binding; study owners must still ensure
that reviewers do not see the policy result, model proposal, or retrieval
output and must retain any reviewer-access evidence outside this artifact.

The existing readiness evaluator accepts an optional reference-set document.
It now behaves as follows:

| Reference-set state | Readiness behavior |
| --- | --- |
| Absent | Valid `not_ready` result with `independent_reference_set_unavailable`. |
| Bound synthetic example | Valid `not_ready` result with the same blocker. |
| Bound independent double-blind document | Uses the independent decisions as the offline metric oracle and may reach `ready_for_human_review` only if all existing coverage and error thresholds also pass. |
| Malformed or mismatched document | `invalid_evaluation`; no readiness result is trusted. |

The checked-in example is deliberately marked `synthetic_example.v1`. It
exercises the generator but is never represented as independently reviewed
evidence.

## Local Workflow

The committed command validates the synthetic example and prints only its
content-free artifact:

```text
npm run test:offline:policy-candidate-semantic-reference-set-artifact
```

For a real study, an authorized maintainer prepares a redacted fixture document
and a separate label document in the checkout, then runs:

```text
node scripts/generate-policy-candidate-semantic-reference-set-artifact.mjs \
  --fixture-file path/to/redacted-fixtures.json \
  --reference-set-file path/to/independent-reference-labels.json
```

Both paths must be project-relative `.json` files and remain inside the
checkout. The command reads input only, writes no file, makes no network or
provider call, and emits the content-free artifact to standard output. Raw
study material must stay out of version control and should be handled under a
separate retention and access procedure.

To bind a real label document into the existing readiness report, invoke its
fixed-path CLI directly with the same project-relative label file:

```text
node scripts/run-policy-candidate-semantic-counter-evidence-readiness-evaluation.mjs \
  --reference-set-file path/to/independent-reference-labels.json
```

## Security and Privacy Boundaries

- The input contracts reject unknown fields, including raw content and
  inherited JavaScript property names.
- The reference-set document is bounded to 32 labels, matching the evaluator's
  bounded fixture-document contract.
- SHA-256 binding prevents a label document from being applied to a modified or
  different fixture document.
- A single final label is required for each fixture. `unanimous` labels require
  at least two reviewers; `adjudicated` labels require at least three.
- Independent decisions are used only for offline measurement after the
  bounded artifact validates. They cannot change a policy score, initiate AI
  or RAG, learn from an item, retry a classification, or route media.
- The CLI accepts only relative JSON files below the checkout, resolves both
  the project root and selected file before reading, rejects a link whose real
  target leaves the checkout, and suppresses supplied paths in error output.
- The output intentionally omits input paths, title, description, library,
  media ID, policy, prompt, provider, model, response, vectors, reviewer
  identity, fixture ID, and per-case labels.
- The artifact has explicit false authority flags for AI invocation, learning,
  policy change, retry, and routing. It does not introduce a route, database
  table, background worker, or UI control.

## Research Basis

The sources below were checked from their official publishers for the requested
August 2026 best-practice baseline.

- NIST AI RMF describes lifecycle `GOVERN`, `MAP`, `MEASURE`, and `MANAGE`
  functions and its Generative AI Profile emphasizes documented evaluation,
  provenance, and human oversight. A separately bound reference set makes the
  test method auditable instead of treating a model or policy answer as ground
  truth. [NIST AI RMF](https://www.nist.gov/itl/ai-risk-management-framework)
  and [NIST AI 600-1 Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf).
- OWASP identifies RAG/vector threats including data poisoning, cross-context
  leakage, insecure access, and embedding exposure. Strict data minimization,
  fixed schemas, and no raw retrieval payload reduce the study artifact's
  exposure surface. [OWASP LLM08: Vector and Embedding
  Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/).
- OWASP API Security recommends explicit inventory and controlled exposure of
  APIs. Keeping the component as a local, read-only CLI rather than adding an
  item- or corpus-export endpoint prevents a new record-level API surface.
  [OWASP API9:2023: Improper Inventory
  Management](https://owasp.org/API-Security/editions/2023/en/0xa9-improper-inventory-management/).
- W3C WCAG 2.2 requires programmatically determinable status feedback. This
  component has no product UI; any later study UI should show one concise state
  first and place detailed provenance in a native disclosure rather than
  reproducing a busy diagnostic panel. [WCAG
  2.2](https://www.w3.org/TR/WCAG22/) and [Understanding Status
  Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html).

## Options Considered

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Trust labels embedded in the synthetic fixture | No additional workflow. | Cannot distinguish independent review from copied policy/model output. | Reject. |
| Automatically retain real titles, descriptions, and RAG packets | Richest benchmark material. | Adds retention, access-control, injection, and data-exposure scope before a study is approved. | Reject. |
| Add a settings acknowledgement before collecting any evidence | Visible consent step. | Adds friction but does not make a reference decision independent. | Reject. |
| Bind a separate redacted reference-set document to the fixture snapshot | Reproducible, content-minimized, and blocks accidental evidence circularity. | Operationally requires a real double-blind review procedure. | Adopt. |

## Final Recommendation Stack

1. Use candidate-bound current-library RAG and AI only as advisory evidence;
   keep deterministic candidate ownership and operator route confirmation.
2. Collect at least 24 redacted cases covering broad-policy, documentary,
   reality, and genre-overlap conditions through a genuinely independent,
   double-blind review procedure.
3. Bind those labels with this artifact and rerun the existing precision,
   recall, abstention, false-positive, and coverage gate.
4. If and only if the gate reports `ready_for_human_review`, review a separate
   frozen RAG/index-and-model study design with privacy, access, retention, and
   deletion controls.
5. Only after that review should Classifarr consider a narrow semantic
   counter-evidence change from broad `prompt_confirm` to candidate comparison;
   do not grant automatic routing authority.
