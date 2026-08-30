# Policy Candidate Semantic Snapshot Adapter Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr now evaluates a narrow semantic signal without placing live RAG,
current-library contents, descriptions, model output, or a vector database on
the policy-decision path. The adapter reads only a committed, synthetic,
redacted snapshot and converts it into one existing evidence status. It is an
evaluation instrument, not a recommendation engine.

## Design

Three fixed artifacts are read from repository-owned paths:

1. the versioned, human-reviewed offline evidence corpus;
2. a versioned snapshot with one query vector plus one `leading` and one
   `alternative` candidate vector for every fixture; and
3. a versioned manifest with SHA-256 content addresses for the first two.

The service contracts require plain JSON objects, known fields, bounded IDs,
exactly four finite vector dimensions, exactly two unique candidate roles, and
at most 32 snapshots. Before scoring, the adapter verifies each content
address and requires a one-to-one match among corpus fixture ID, snapshot
fixture ID, and declared snapshot ID. Any failure produces no signals and no
metric evaluation.

The scorer uses fixed cosine-similarity minimum (0.82) and separation margin
(0.08). It emits only `supports_leading_candidate`,
`supports_alternative_candidate`, or `abstain`; scores and numeric embeddings
do not cross the scorer boundary. The offline evaluator replaces only its
semantic status with that output and reuses its existing three-way metrics.

```text
fixed corpus + fixed snapshot + fixed manifest
  -> contracts and content-address validation
  -> fixture/snapshot binding validation
  -> status-only semantic scorer
  -> existing offline metrics report

No provider, model, database, HTTP, current-library lookup, route, queue,
policy mutation, learning, retry, routing, or browser UI
```

## Research Basis

Research was performed on 2026-08-30 against official sources current as of
August 2026.

- NIST requires documented test sets, methods, metrics, deployment-relevant
  conditions, and monitoring in AI evaluation. This implementation documents
  the first three and explicitly excludes a production-readiness claim because
  the sample is synthetic and small. [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- W3C WCAG-EM 2.0 describes a reusable evaluation flow: define scope, select a
  representative sample, evaluate it, and report results. The adapter follows
  that reporting discipline; there is no new browser surface to which WCAG UI
  requirements apply. [W3C WCAG-EM 2.0](https://www.w3.org/TR/wcag-em-2/)
- OWASP identifies leakage, data poisoning, and cross-context conflict as
  embedding/RAG risks. The design avoids the live vector-store and exposes no
  raw vectors or retrieval text in its report. [OWASP LLM08](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
- OWASP recommends server-side validation at business-logic handoffs. Every
  document and every cross-artifact binding is validated before scoring.
  [OWASP WSTG-BUSL-01](https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Live RAG to pending review | Current context | Couples unmeasured content and prompt-injection risk to an operator path | Reject |
| Static hand-authored semantic status | Cheapest reproducible baseline | Does not exercise a retriever/scorer | Retain only as reviewed expectation |
| Pinned synthetic snapshot | Reproducible scoring, provenance, zero live-data access | Does not establish real-world retrieval quality | Adopt offline only |
| Live local vector store with redaction | Higher eventual fidelity | Needs artifact provenance, authorization, poisoning controls, and a larger corpus | Defer |

## Security and Accessibility

- All new runtime code is modular ESM and has no mutable singleton.
- The command has no input arguments; it cannot be pointed at a user-selected
  file or endpoint.
- Content-address and one-to-one binding failures fail closed.
- Reports omit raw vectors, similarity values, fixture names/tags, media,
  libraries, candidates, policies, providers, prompts, and responses.
- No UI changes are made. A future UI must expose evaluation scope, samples,
  limits, and status in a keyboard-accessible, programmatically labelled
  presentation consistent with W3C guidance.

## Final Recommendation Stack

1. Preserve this snapshot adapter as an offline-only gate.
2. Add a redaction-reviewed artifact generator only after a broader human
   corpus exists; require a new security review for any non-synthetic source.
3. Report cohort-specific precision, recall, abstention, calibration, and
   confidence intervals before proposing an operator-facing view.
4. Keep deterministic policy evidence and explicit operator confirmation as the
   only route authority unless a separate architecture decision changes that.
