# Policy Candidate Adjudication Design

## Status

Implemented on 2026-08-30. This design adds an advisory comparison path for a
small, policy-owned destination set. It does not change policy thresholds,
configuration, learning, or routing authority.

## Problem

`prompt_select` means the policy engine found viable destinations but did not
establish a unique one. Before this design, Classifarr correctly generated an
operator question and did not call AI. That preserved authority, but it left
useful existing evidence—observed library profiles and prior confirmed
classifications—unavailable as a bounded advisory comparison.

The design must not turn a model's internal reasoning or free-form response
into routing authority. It also must account for existing library content
without sending the entire library or unrestricted historical data to a
provider.

## Official Research Basis

Research was performed against official sources available on the requested
August 2026 baseline:

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented human-AI roles, controls, and ongoing measurement.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  identifies governance, content provenance, privacy, and human oversight as
  generative-AI risk-management concerns.
- [OWASP LLM06: Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)
  recommends minimizing model permissions and independently mediating actions.
- [OWASP API3: Broken Object Property Level Authorization](https://owasp.org/API-Security/editions/2023/en/0xa3-broken-object-property-level-authorization/)
  supports explicit allow-lists and server-side enforcement of returned data.

## Options Considered

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Continue abstaining for every `prompt_select` | Smallest surface and strongest privacy default. | Does not use bounded library and historical evidence to help an operator choose. | Rejected for eligible two-to-three-candidate cases. |
| Allow generic AI to choose any library | Simple prompt implementation. | A model can expand the policy set, increase disclosure, and create confusing non-authoritative proposals. | Rejected. |
| Bounded candidate adjudication | Uses relevant library profiles and RAG facts, constrains selection to policy candidates, preserves human confirmation. | Adds a small provider contract and advisory status surface. | Adopted. |

## Adopted Architecture

```text
Policy engine: prompt_select
        |
        v
Build 2–3 active, same-type ranked candidates (server only)
        |
        v
Build bounded evidence packet from profiles + relevant RAG facts
        |
        +-- trusted-local Ollama: bounded distributions and up to 3 titles/candidate
        |
        +-- remote provider: availability, item-count band, match count, similarity
        v
AI advisory proposal restricted to candidate numbers
        |
        v
Validate selected ID against the original contract; discard rationale/confidence
        |
        v
Server-owned operator decision question; routing remains blocked
```

### Admission Rules

The new `adjudicate` mode runs only when all of the following hold:

1. The current policy result is `prompt_select`.
2. The policy ranking yields at least two active destination libraries of the
   item media type.
3. At most the first three ranked eligible candidates are included.

Manual outcomes, malformed rankings, inactive destinations, one-candidate
results, and provider failures continue to use the existing operator-review
path. The design neither replaces strict candidate-bound verification nor
loosens that capability check.

### Evidence and RAG Scope

Library profiles represent observed content in the configured libraries and
are used as bounded aggregate facts. RAG today retrieves previous confirmed
Classifarr classifications, not a vector index of every media-server item. The
adjudication packet therefore labels its retrieval facts as *similar confirmed
classifications* and never claims complete-library semantic recall.

Remote providers do not receive RAG titles or profile distributions. They
receive only each candidate's availability, item-count band, matching-history
count, and top similarity. An Ollama provider receives the bounded profile
distributions and at most three relevant historical titles per candidate only
when its configured endpoint is syntactically provable as local: `ollama`,
`localhost`, loopback, private IPv4, or private/link-local IPv6. The check is
DNS-free; arbitrary hostnames and public addresses receive the remote-safe
projection. Prompt text explicitly treats all metadata and retrieved content as
untrusted evidence, never as instructions.

### Authority and Retention Boundaries

- The policy engine chooses the candidate set; the provider cannot add one.
- The provider response must map to a candidate library ID in the original
  server contract.
- Model confidence and free-form reason are discarded.
- Every adjudication result remains `needs_clarification: true`; the existing
  routing guard generates an operator question.
- Persistence permits only version, fixed status, candidate count, and a
  validated proposed destination. It rejects raw provider output, thinking,
  prompts, item evidence, and arbitrary fields.

## Final Recommendation Stack

1. Use deterministic policy ranking to bound AI comparison to two or three
   eligible destinations.
2. Use library-profile aggregates and candidate-scoped historical retrieval as
   advisory evidence, with stricter minimization for remote providers.
3. Treat model output as validated proposal data, not explanation, confidence,
   or authority.
4. Require the existing operator destination decision for every adjudication.
5. Next, build a separately governed index of current media-server library
   items if whole-library semantic retrieval is desired.
