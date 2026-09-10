# Manual Policy Candidate Adjudication Design

Status: implemented, unreleased. Research and the local Compose assessment were
completed on 10 September 2026.

## Problem

A `manual` policy outcome previously stopped the AI path, even when the policy
engine had already produced two or three active, same-media candidate
libraries. This made the bounded current-library RAG comparison unavailable at
the precise point where it can be most useful: the deterministic evidence is
too weak to make a recommendation.

The local Compose assessment demonstrates the practical impact. All active
library-purpose rules were profile-derived. The `Comedy and Standup` profile
included Documentary and Drama because those titles happen to be in the
library; that observation is not an assertion that a documentary belongs
there. A low-confidence *Deep Water* decision consequently remained manual
and never asked the existing candidate-bound AI/RAG path to compare the
policy-ranked alternatives.

## Decision

Allow a `manual` result to invoke the existing `adjudicate` mode only when the
same bounded candidate contract is valid:

1. The policy ranking contains two or three active, same-media destinations.
2. The contract is constructed server-side from that ranking; the provider
   cannot add a destination or increase the candidate limit.
3. `decisionDiagnostics.requires_manual_review` is not set. Explicit safety
   holds still suppress every AI call.
4. The provider receives the existing minimized candidate packet, including
   bounded current-library retrieval facts when available.
5. A valid model selection becomes an advisory recommendation only. The item
   stays `needs_clarification: true` and the existing operator confirmation is
   required before routing.

```text
weak manual policy ranking (2–3 eligible destinations)
  -> server validates bounded candidate contract
  -> one advisory AI/RAG comparison
  -> concise proposed destination in the existing review card
  -> operator confirms or chooses another destination

hard manual-review safeguard / fewer than two candidates
  -> no provider call
  -> existing manual decision
```

This changes neither automatic-routing thresholds nor policy learning. It
makes the current AI/RAG component useful for a review decision instead of
making a weak profile observation authoritative.

## Research basis

- [NIST AI RMF Playbook — Measure](https://airc.nist.gov/docs/AI_RMF_Playbook.pdf)
  calls for measurement in conditions similar to expected use and warns that
  data quality and representativeness affect AI risk. The change therefore
  keeps this as an advisory, measurable decision aid rather than turning a
  one-off comparison into automatic routing.
- [OWASP LLM08:2025 — Vector and Embedding Weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  identifies unauthorized access, leakage, and manipulation risks in RAG.
  Candidate ownership, stable current-inventory joins, minimized evidence,
  and no raw-retrieval persistence remain mandatory.
- [W3C WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/)
  specifies an accessible show/hide control with keyboard operation and
  `aria-expanded`. The existing review surface keeps the recommendation and
  action visible while retaining policy and retrieval detail in progressive
  disclosure instead of adding another dense card.
- [W3C WCAG 2.2 Labels or Instructions](https://www.w3.org/TR/WCAG22/#labels-or-instructions)
  requires clear input labels and instructions. The unchanged confirmation
  action retains a named destination and an explicit explanation that the AI
  recommendation has not routed the item.

## Options considered

| Option | Benefits | Costs and risks | Decision |
| --- | --- | --- | --- |
| Keep manual outcomes fully AI-free | Simplest execution path | Discards the existing bounded RAG comparison exactly when deterministic evidence is weak | Reject |
| Ask a provider to choose from every library | May improve recall | Broadens data exposure and lets a probabilistic component choose the candidate set | Reject |
| Automatically route an AI choice | Fewer clicks | No independently labelled evaluation supports this authority; a profile can be circular evidence | Reject |
| Compare only the existing two or three policy candidates and require confirmation | Uses available context while preserving deterministic ownership and human routing authority | One bounded provider call and an advisory recommendation can still abstain | Adopt |

## Security and authority boundaries

- The policy engine owns the candidate ranking, library activity check, media
  type check, and maximum candidate count.
- Existing RAG protections continue to exclude the incoming item's own
  historical identity and never expose embeddings, descriptions, raw provider
  output, or model reasoning in persisted decision data.
- A hard manual-review diagnostic, malformed candidate contract, missing
  second candidate, provider failure, or rejected response leaves the item in
  the existing review path.
- The provider cannot route media, alter a policy, write learning evidence,
  change a threshold, create a library, or influence a different item.

## Recommendation stack

1. Use bounded candidate adjudication for manual decisions with a safe,
   server-owned two-to-three-library comparison set.
2. Keep all hard manual-review safety holds provider-free.
3. Keep the existing concise review action primary and evidence behind the
   current disclosure controls.
4. Make library purpose easy to declare and retain; profile observations are
   useful context, not semantic truth.
5. Build an independently labelled evaluation set before considering any
   automatic-routing authority for semantic evidence or model output.

## Non-goals

This work does not create a broad library search, generate embeddings, alter
policy scores, change confidence thresholds, persist model thinking, capture a
study corpus, auto-declare library purpose, learn from the recommendation, or
route media automatically.
