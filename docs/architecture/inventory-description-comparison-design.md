# Inventory Description Comparison — Design

Status: implementation design, 11 September 2026; unreleased.

## Decision

Use the inventory sampler introduced by `1e31e23a` to run a paired
description-only reranking experiment. Freeze the same sampled identities,
libraries and retrieved neighbors before inference. Re-embed both each query
description and each neighbor description with the configured local Ollama
model. Compare library rankings against the stored-vector baseline.

This measures representation sensitivity within a fixed neighbor pool. It is
not full-corpus retrieval, correctness evaluation, autonomous learning, or proof
that historical classification labels alone caused a change. Stored vectors
have unverified input text and model revision. Fresh description-only text also
differs from the historical formatter in fields other than library labels.

## Alternatives and recommendation stack

| Option | Advantages | Limitations | Decision |
| --- | --- | --- | --- |
| Re-embed only incoming items | Lowest compute | Compares differently formatted query and neighbor representations | Reject |
| Re-embed queries and the same neighbors | Bounded local compute; paired candidate sets; actual descriptions | Cannot recover useful neighbors omitted by the baseline | Implement |
| Re-embed the entire inventory | Measures retrieval changes across all items | Much larger compute and indexing lifecycle | Next experiment after this result |
| Change routing thresholds now | Immediate reduction in reviews | No independent accuracy evidence | Reject |

Recommended stack: existing read-only sampler → versioned description-only
projection → pinned local embedding batches → exact in-memory cosine ranking →
aggregate paired report. No new browser controls or manual declarations.

## Comparison contract

- Snapshot collection completes and its transaction closes before inference.
  Keep the full-cohort exclusions enforced by the sampler. Reject any cohort
  identity that appears as a neighbor before sending text to the provider.
- Use only normalized synopsis text, capped at 1,000 Unicode code points.
  Exclude titles, genres, library names, policy text, prior labels and arbitrary
  metadata fields from the embedding request. Count shortened descriptions.
- Missing query descriptions, missing stored representations, model mismatch
  and fewer than two description-bearing candidate libraries are explicit
  exclusions. Missing neighbor descriptions are removed from both conditions,
  not only from the fresh condition. Preserve the original sampled denominator.
- Require the same provider, model family/tag and dimensions as the baseline.
  Recheck the local model digest after inference. The historic digest is not
  known: matching the current model name does not prove historic revision parity.
- Deduplicate identical normalized text in memory; cap the experiment at 512
  unique descriptions, eight texts per batch and a ten-minute inference budget.
  Reject oversized input before inference rather than silently changing the
  sample. Disable provider truncation and reject inconsistent/invalid vectors.
- Report paired coverage, winner changes, ties and agreement with observed
  membership. Do not call these metrics accuracy or routing confidence.

## Secure local inference boundary

Read only the configured embedding fields, not cloud credentials. Permit a
saved, syntactically trusted local Ollama endpoint and an installed embedding
model; reject remote/cloud models, redirects, mismatched response models and
model drift. Reuse existing endpoint-trust, bounded-response and vector
validation utilities. Do not pull models, call cloud fallbacks, retry failed
inference automatically, save vectors, change settings or issue routing actions.

Requests have a timeout and a decoded-response byte limit. The configured local
endpoint remains a trust boundary: a malicious local service could lie about
its execution. Model metadata checks are not cryptographic remote attestation.
Private descriptions and vectors live only in memory. CLI output contains
aggregate counts and representation identifiers, not media or library content.

## Official research and date boundary

Official URLs were discovered through web/MCP search and read on 11 September
2026 for the requested August 2026 baseline. Living pages are not verified
historical August snapshots. No September-only feature is required.

- [Ollama embeddings API](https://docs.ollama.com/api/embed) supports batched
  input and explicit truncation control. Batch bounded text and use
  `truncate: false` so context overflow is not silently accepted.
- [Ollama model inventory](https://docs.ollama.com/api/tags) exposes model
  digests. Check installed-model identity before and after the experiment.
- [Sentence Transformers semantic search](https://www.sbert.net/examples/sentence_transformer/applications/semantic-search/README.html)
  distinguishes symmetric and asymmetric search. This experiment compares
  synopsis to synopsis with the same text representation on both sides.
- [Mixedbread's model card](https://huggingface.co/mixedbread-ai/mxbai-embed-large-v1)
  describes a retrieval-query instruction. That asymmetric search condition
  is distinct from this symmetric synopsis comparison and should be evaluated
  separately, not mixed into one side of the current comparison.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  motivates provenance, poisoned-content boundaries and preventing retrieved
  material from granting downstream authority. Descriptions remain data.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against overly chatty status announcements. This offline experiment
  adds no dashboard card; a future UI should show one concise result with
  optional detail instead of exposing diagnostic terminology by default.

## Verification

Test paired filtering, deduplication, budgets, model/dimension changes, ties,
privacy and failure cleanup. Test the HTTP adapter with actual loopback HTTP
responses, including redirects, oversized responses and malformed vectors.
Extend the existing pgvector integration fixture for representation provenance.
Run the comparison on the configured local provider only after verifying that
it is local and non-cloud. Document real measurements separately from tests.
