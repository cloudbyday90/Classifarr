# Policy Candidate Evidence Offline Evaluation Design

Status: Implemented (unreleased)

Date: 2026-08-30

## Decision

Classifarr must not let a local model, RAG result, or similarity score alter a
policy decision simply because it appears plausible. The next useful step is a
small, human-reviewed, **offline-only** evaluation corpus. It compares three
fixed signals against an explicit reference decision:

1. deterministic candidate-set selection status;
2. exact cross-library identity/contrastive status; and
3. a proposed semantic-retrieval status.

The third signal now comes from a read-only, manifest-pinned synthetic and
redacted embedding snapshot. It is still strictly offline: no live embedding,
RAG, LLM, HTTP, database, current-library lookup, policy evaluation, queue,
or operator-facing route is called. That lets Classifarr measure the proposal
shape before a real semantic adapter gains any operational influence.

## Corpus and Contract

The committed corpus has eight intentionally bounded, non-runtime examples:

- a Katrina-like documentary ambiguity;
- a comedy-and-standup overlap;
- a clear documentary destination; and
- an inventory-unavailable documentary case;
- a declared-scope/semantic conflict;
- an alternative semantic overreach;
- a clear series destination; and
- a low-margin semantic uncertainty case.

Every fixture has a version, bounded ID/name/tags, one human-reviewed
reference decision (`admit`, `review`, or `abstain`), three allow-listed
observations, and a snapshot ID. The application validator and the machine-readable
[fixture schema](../schemas/policy-candidate-evidence-offline-evaluation-fixture-v1.schema.json)
reject unknown fields, duplicate IDs, invalid enum values, control characters,
and oversized documents. Raw provider output, prompts, titles, catalog rows,
library IDs, endpoint data, and credentials have no field in the contract.

The evaluator report exposes fixture IDs and fixed decision IDs only. It omits
fixture names/tags and declares this authority boundary in every result:

```json
{
  "scope": "offline_evaluation_only",
  "operatorWorkflowAdmission": false,
  "automaticActions": {
    "aiInvocation": false,
    "learning": false,
    "policyChange": false,
    "retry": false,
    "routing": false
  }
}
```

## Metrics

`review` is the safety-sensitive positive action: a missed review can turn an
ambiguous item into an unexamined admit/abstention. Each signal therefore
reports review precision, review recall, false-positive/negative counts,
abstention rate, non-abstaining coverage, and exact three-way agreement.
Undefined precision/recall is `null`, never presented as a manufactured zero
or success.

The eight-fixture output is a feasibility check, not a quality claim:

| Signal | Review precision | Review recall | Abstention | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Deterministic candidate scope | 100% | 50% | 25% | It misses two human-reviewed cases that need review. |
| Exact contrastive status | 100% | 50% | 37.5% | It correctly abstains under uncertainty but does not settle every review. |
| Snapshot semantic retrieval | 66.7% | 50% | 25% | It creates one unneeded review and misses two required reviews. |

## Architecture

```text
versioned JSON fixtures + redacted snapshot + SHA-256 manifest
  -> strict pure contract and manifest validators
  -> one-to-one fixture/snapshot binding + content-address verification
  -> status-only cosine scorer
  -> pure signal-to-decision mappings
  -> pure metrics reducer
  -> static JSON report

No route, provider, model, RAG, database, queue, policy mutation, or UI path
```

The public local command is deliberately fixed-path and argument-free:

```text
npm run test:offline:policy-candidate-evidence-evaluation
npm run test:offline:policy-candidate-semantic-snapshot-evaluation
```

It reads only the committed fixture document and returns a nonzero exit code
when validation fails. This is distinct from the opt-in live AI sweep, which
tests a configured local stack and has its own safety controls.

## Research Basis

Research was performed on 2026-08-30 against official sources current as of
August 2026.

- NIST's AI RMF Measure function calls for documented test sets, appropriate
  qualitative/quantitative metrics, and evaluation in deployment-relevant
  conditions. A versioned corpus and explicit metrics meet the first two needs;
  the corpus remains too small for the third, so it cannot authorize runtime
  use. [NIST AI RMF: Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
- NIST's Generative AI Profile frames evaluation, documentation, and risk
  controls as lifecycle activities rather than a one-off model assertion.
  [NIST AI 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- W3C advises defining an evaluation scope, representative sample, test method,
  and report. The corpus/version/report form those four artifacts, while the
  explicit abstention prevents an automated result from impersonating complete
  conformance. [W3C Evaluation Conformance Approaches](https://www.w3.org/WAI/test-evaluate/conformance/)
- W3C notes that automatic checks alone do not establish conformance and should
  be paired with human review. The human reference decision is therefore the
  oracle; the semantic signal is measured, not trusted. [W3C ACT Rules](https://www.w3.org/WAI/standards-guidelines/act/rules/)
- OWASP recommends validation at each business-logic handoff. The strict
  fixture boundary validates all inputs before mapping or metric calculation.
  [OWASP WSTG business-logic data validation](https://owasp.org/www-project-web-security-testing-guide/v42/4-Web_Application_Security_Testing/10-Business_Logic_Testing/01-Test_Business_Logic_Data_Validation)
- OWASP identifies vector and embedding data as a RAG attack surface, including
  leakage, poisoning, and context conflict. The adapter has no live vector-store
  access and never reports raw vectors. [OWASP LLM08: Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Send RAG/LLM evidence directly to pending-review UI | Fast feedback | Couples unmeasured probabilistic evidence to an operator decision; expands privacy and prompt-injection surface | Reject |
| Use live media/history records as the initial corpus | More realistic | Retains identities and current-system dependencies; results are hard to reproduce | Reject for foundation |
| Static fixtures with a semantic decision prefilled | Reproducible, no model/data access, clear metrics, tests the evaluation contract | Does not exercise a scorer | Retain as reviewed expectation |
| Read-only snapshot-pinned semantic adapter | Exercises deterministic semantic scoring with provenance and no live data access | Synthetic sample remains small and cannot model production retrieval | Adopt offline only |
| Connect the adapter to live RAG or review UI | More operational feedback | Treats unproven evidence as advice and expands the vector-data boundary | Reject |

## Security and Accessibility

- The ESM modules are pure and have no mutable singleton, route registration,
  provider configuration, or persistence dependency.
- Fixed signal mappings verify own allow-listed keys before lookup, so inherited
  JavaScript property names also fail closed.
- The static runner has no CLI parameters or external input path, so it cannot
  be redirected to an untrusted document by normal use.
- The snapshot runner has the same fixed-path behavior and fails closed when
  either content address or the one-to-one fixture/snapshot binding is wrong.
- Raw vectors remain confined to the committed synthetic fixture; reports
  contain only status IDs, aggregate metrics, versions, counts, and SHA-256 addresses.
- Invalid input produces only count/risk-ID metadata, never raw fixture data.
- No browser surface is added. W3C browser semantics such as status messages
  and accessible tables do not apply to this CLI/JSON artifact. If a future
  operator view is proposed, it must separately implement a native accessible
  report and distinguish automated metrics from human review.

## Final Recommendation Stack

1. Keep this evaluation offline and non-authoritative.
2. Expand the eight reviewed examples with independently reviewed edge,
   conflict, and abstention cases before considering a non-synthetic snapshot.
3. Keep any future snapshot redacted, versioned, content-addressed, and capable
   of emitting only the three status IDs; do not expose raw retrieval text or
   connect it to routing.
4. Require measured thresholds, documented corpus provenance, security review,
   and W3C-accessible operator design before any future UI or policy workflow
   can present semantic evidence.
