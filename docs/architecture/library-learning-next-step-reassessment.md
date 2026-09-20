# Library learning: next-step reassessment

Date: 2026-09-20. Status: researched recommendation, not a deployed service.

Implementation follow-up: the [local cross-encoder outcome](local-cross-encoder-outcome.md)
records the dedicated scorer pilot and supersedes the next-step recommendation
below. It is not approved for live routing. The subsequent
[shared snapshot outcome](frozen-evaluation-snapshot-outcome.md) records the drift
reconciliation and current follow-up. This document preserves the original research.

## Why the next step must be different

The product goal is automatic understanding of actual library contents, not a
growing collection of review screens or purpose declarations. Recent experiments
have repeatedly varied the same small generative model or the same inventory
correlations. Better JSON and repeated votes cannot establish content correctness.

| Already evaluated | Finding | Do not repeat |
| --- | --- | --- |
| [Metadata recipe reranker](learned-evidence-reranker-outcome.md) | More placement-agreement losses than gains | Another global field-weight recipe |
| [Generative pair reranker](semantic-pair-reranking-outcome.md) | One gain and one TV loss on the unseen pilot | Rename chat grading as a dedicated reranker |
| [Independent fit](independent-inventory-fit-outcome.md) | More instability and cost than its control | More uncited ordinal grades |
| [Anonymous library comparison](leader-semantic-comparison-outcome.md) | 22 of 50 reordered decisions changed | Treat fixed seed or agreement as proof |

Multiple representatives, local communities and a linear vector classifier also
already have outcome documents. Recreating those components is not a new strategy.
Metadata provenance/backfill and organic profiles already exist; preserve them.

## Recommended next item: dedicated local content reranking

Build one reusable **ESM content-relevance adapter** for a purpose-trained
cross-encoder, initially in shadow mode. It scores the query and each retrieved
example jointly, rather than asking a chat model to select a numbered library.
Candidates and example groups continue to come from current inventory; there are
no hard-coded library names or genre destinations. The model supplies relevance,
not routing permission, an inferred library purpose, or calibrated confidence.

This is materially different from the existing `inventoryEvidenceReranker`
(metadata recipe selection) and `inventorySemanticPairComparison` (generative
grading). A cross-encoder has not been implemented by those experiments.

### Concrete technology choice

- Start with a pinned, private-network **Hugging Face Text Embeddings Inference
  (TEI)** service and its documented `/rerank` contract. Classifarr-owned code stays
  ESM; no new Python service or CommonJS wrapper. Verify actual endpoint/model
  capabilities, token limits and response indices before admission.
- Use **BAAI/bge-reranker-base** for the first compatibility/resource pilot: it is
  explicitly listed by TEI. It is an English/Chinese baseline, not a universal
  language solution and not a claim of being the newest or best model.
- Compare **BGE-reranker-v2-m3** only after verifying the chosen runtime/version,
  actual memory budget and corpus languages. Its documentation lists multilingual
  support, 568M parameters and a 2.27 GB model artifact; artifact size is not runtime
  RAM. Do not put it inside Classifarr's existing 2 GiB container by assumption.
- **Qwen3-Reranker-0.6B** is another instruction-aware multilingual candidate.
  Its documented example scores yes/no logits. Do not emulate it with a generated
  chat answer or assume the existing Ollama transport or TEI deployment supports it.
  Keep it an alternative, not a second model installed in the first milestone.

### Deliverable, safety and recovery

1. One capability-checked adapter with bounded batches, local endpoint restrictions,
   timeouts, cancellation, exact response-index coverage and finite-score checks.
   Use immutable image/model revisions and reviewed artifacts; no runtime model
   downloads, remote fallback, custom remote code, tools or provider-side learning.
2. Score provenance-clean examples across every eligible library, preserving
   media/identity boundaries and existing evidence budgets. Same-library size
   must not become extra votes. Keep ranking separate from destination selection.
3. Reuse the existing evaluation runner through a scoring strategy, not another
   standalone CLI/diagnostics subsystem. Freeze the evidence and comparison rule
   before looking at outputs. Record latency, memory, repeat and batch-order checks.
4. Cache by model revision, representation version and query/example content hashes.
   Coalesce work. SWR may refresh an unchanged valid key; a changed identity, source,
   representation or model must never reuse stale scores. On outage, retain the
   existing classification path and retry bounded background work after cooldown.
   No new acknowledgement or per-item retry task is required from the user.
5. Use existing genuinely confirmed outcomes/corrections where provenance proves
   them independent of the system's own proposal. Inventory placements remain
   noisy observations. Never train on Classifarr's automatic decisions as truth.
   Missing independent labels remains an explicit limitation, not a demand for
   the user to declare every library's purpose.

### A decision gate, not an endless tuning loop

Make one predeclared comparison on at least 100 eligible cases, balanced across
movie/TV and available library strata, with one disjoint confirmation cohort.
Report shortfalls rather than duplicating small libraries or claiming all sampled
descriptions received inference. Reuse frozen training/holdout exclusions.

Before any live adoption, require:

- Complete response/index validation, no identity leaks and bounded resource use.
- Same pair scores within a declared numeric tolerance across identical repeats
  and batch permutations; no destination flips caused solely by input ordering.
- No net loss of placement agreement in either media stratum on confirmation;
  report abstention/coverage as well. This is a regression screen, not accuracy.
- Where independent labels exist, report ranking relevance and destination outcomes
  separately. Insufficient labels cannot authorize automatic routing from scores.
- Simulated outage, restart, stale-cache and source-change recovery without user
  intervention or new routing authority. Measure actual p95 latency/RAM against
  a budget agreed before installing the model; do not promise faster execution.

If the scoring architecture fails these checks, **stop this model track**. Do not
respond with another prompt, lower threshold, extra voting pass or larger replay
of the same ambiguous descriptions. Use existing field/provenance diagnostics to
identify the concrete missing evidence or contradictory source records first.
If it passes, the next delivery is a bounded canary of improved retrieval with
automatic rollback—not yet another standalone benchmark screen.

## Alternatives and final recommendation stack

| Alternative | Benefit | Cost / recommendation |
| --- | --- | --- |
| More chat prompt variants | No new runtime | Repeats observed instability; stop after current result |
| Bigger generative model | May improve interpretation | More resources, same unproven target; not first |
| Dedicated cross-encoder | Pairwise relevance objective; no listwise choice grammar | New model/runtime and domain mismatch risk; selected bounded milestone |
| Fine-tune on current placements | Adapts to local classes | Reinforces existing mistakes without clean labels; defer |
| New vector database/framework | Broader tooling | Does not itself fix semantic judgments; retain current storage |

Final stack: existing validated sync and metadata self-healing → organic profiles
and clean description retrieval → dedicated local pair scorer → revision-keyed
SWR and automatic recovery → existing routing safeguards → independent feedback
evaluation. Keep the UI focused on genuine exceptions and one concise health/result
summary, not the internal research pipeline.

## Official research and limits

Sources were discovered with search and opened on 20 September 2026. They support
the architecture and compatibility facts, not promised Classifarr improvements.

- [Sentence Transformers retrieve and rerank](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)
  explains joint query/document scoring after efficient retrieval and its added cost.
- [TEI supported models and hardware](https://huggingface.co/docs/text-embeddings-inference/supported_models)
  lists supported rerankers and CPU/GPU deployment options.
- [TEI deployment and rerank API](https://github.com/huggingface/text-embeddings-inference)
  documents `/rerank` and pre-downloaded, air-gapped deployment.
- [BAAI base model card](https://huggingface.co/BAAI/bge-reranker-base)
  identifies the cross-encoder, language coverage and retrieval use case.
- [BGE reranker-v2 documentation](https://bge-model.com/bge/bge_reranker_v2.html)
  describes multilingual alternatives, artifact sizes and use-case evaluation.
- [Qwen3-Reranker-0.6B model card](https://huggingface.co/Qwen/Qwen3-Reranker-0.6B)
  describes instruction-aware reranking and logit-based scoring.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  informs provenance, cache isolation, bounded inputs and fail-closed handling.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  supports accessible, non-disruptive feedback rather than additional mandatory UI.

No new runtime, model, dependency or remote service was installed for this research.
The current implementation's outcome is documented separately in
[grounded comparison outcome](grounded-library-comparison-outcome.md).
