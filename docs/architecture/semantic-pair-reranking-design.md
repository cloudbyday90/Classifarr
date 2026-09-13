# Item-to-item semantic reranking: design

Date: 2026-09-13

## Decision and scope

Compare the incoming description directly with retrieved descriptions before
aggregating library evidence. The previous neighborhood experiment supported four
known conflicts but reduced broader placement agreement. Do not retune its weights
or use a higher displayed confidence to hide that result.

The installed local completion model is `gemma4:e4b`. The inspected application
client supports local generation, not a dedicated cross-encoder scoring endpoint.
Implement **LLM-based pair relevance grading**, explicitly not a trained
cross-encoder or calibrated confidence. Reuse the installed provider, bounded
transport and cached embeddings; do not download models or add dependencies.

## Fixed first implementation

1. Use the existing grouped description sample and global baseline. Preserve
   consensus and ambiguous leader cases without inference. Process only unique
   description/metadata disagreements; do not inspect observed placement to choose
   which cases get inference.
2. Include every same-media candidate library, bounded to eight libraries. Select
   three distinct, exclusive, non-held-out descriptions per candidate from the
   existing top 100 neighbors. If any candidate is sparse, preserve the baseline
   for the whole pool. Reuse the cached `synopsis_only_1000_codepoints.v1` text
   representation and explicitly report its inventory shortening count; this is
   not a full-synopsis experiment. Do not further clip input to fit a prompt.
   Reject oversized direct inputs. Never pad with duplicates or use shared copies
   as separate votes.
3. Send only the query media type, description and anonymously interleaved example
   descriptions. No library names, destination IDs, metadata fits, observed labels
   or cosine scores enter the prompt. Ask for one integer grade per example:
   0 unrelated/contradictory, 1 generic overlap, 2 similar central content and
   treatment, 3 close central-content match. Grades are ordinal judgments.
4. Score all examples twice, reversing their order on the second pass. Require
   a complete response to both passes; do not salvage missing grades or send
   repair prompts. Map the reversed results back before aggregation.
5. Each candidate needs at least two grades of 2 or 3; its sum must lead every
   alternative by at least two points in both passes, with the same winning
   candidate. Otherwise keep the baseline. This is a fixed pilot rule, not an
   empirically calibrated routing threshold. Never treat the grade as independent
   corroboration or authorize a route from it.

## Evaluation and stopping rules

Preflight both known 300-description cohorts without generation. Begin with a
bounded inference pilot on eligible disagreements, then a separate sample excluding
both prior cohorts. Report sampled, eligible, attempted and actually generated
counts separately; a 300-item preflight is not 300 AI evaluations. Preserve and
report consensus controls, missing pools, order-sensitive outcomes, gains, losses,
latency, token usage and invalid responses. Do not fit or tune against held-out
placements. Existing placements remain weak observations, never verified labels.

The first pilot must establish protocol reliability before increasing inference.
No live integration is included without supporting results. Source/model drift
invalidates the report; cancellation and provider errors retain baseline behavior.
No retry loop, cloud fallback or model pull is allowed. The two order passes are
explicit planned calls, not hidden retries.

## Official research and tradeoffs

Sources were discovered through online search and read on 2026-09-13.

| Approach | Benefit | Cost / limitation |
| --- | --- | --- |
| Current embedding retrieval | Cached, fast, library agnostic | Broad similarity can hide differences in treatment |
| Dedicated cross-encoder | Joint query/document relevance scoring | Requires compatible model/runtime and domain validation; not installed through this change |
| Local LLM pair grading | Uses the current provider and compares actual descriptions | Slower, ordinal and position-sensitive; test with reversed order and strict parsing |
| More metadata reweighting | Cheap inference | Two prior experiments regressed; do not repeat without a new hypothesis |

[Sentence Transformers' retrieve-and-rerank guide](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)
separates efficient candidate retrieval from joint query/document relevance
scoring. Its [model reference](https://www.sbert.net/docs/cross_encoder/pretrained_models.html)
also identifies the query/passage training setting; those results do not establish
performance for movie/TV descriptions. Our LLM grading method is a separate
application-specific experiment, not the documented cross-encoder implementation.

[Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs)
supports JSON schema constraints and recommends validating returned structures.
The [generate API](https://docs.ollama.com/api/generate) supplies completion/usage
information. Use temperature zero, a fixed seed, bounded context/output and strict
application-side validation. Structural validity alone does not prove relevance.

## Security, accessibility and recommendation stack

[OWASP prompt-injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
explains why retrieved content remains untrusted even in RAG. Descriptions are data,
not instructions; the model receives no tools, credentials or routing capability.
Model and endpoint checks remain local-only. The response contract accepts only
the complete bounded grade array, not explanations, destinations or executable text.
Store neither prompts nor responses in public reports. Retain only aggregate
results and whole-snapshot fingerprints. No learning labels or database rows are
written by this experiment.

No settings, consent checkbox or additional UI panel is introduced. Existing SWR
behavior is unchanged. Any later status display must preserve focus and user
control over updates, following [W3C pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html).

Recommended stack: cached retrieval, bounded anonymous pair grading, deterministic
validation/order check, then existing baseline fallback. Measure unseen cases and
latency before deciding on live adoption or a dedicated local cross-encoder.
Record actual outcomes separately in `semantic-pair-reranking-outcome.md`.
No release or version bump is planned.
