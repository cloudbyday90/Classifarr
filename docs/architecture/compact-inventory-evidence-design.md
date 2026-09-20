# Compact inventory evidence design

Date: 2026-09-19

## Decision and scope

Test a smaller, query-relevant selection of inventory descriptions before changing
live retrieval or routing. The preceding verified 100-case paired comparison used
223,278 input tokens for raw examples versus 415,966 with additional context. Its
order-sensitive cases increased from 24 to 37. These observations motivate an
experiment; they do not establish that extra context caused incorrect routing.

The existing read-only `--multi-scale-ai` experiment advances to protocol
`inventory_multi_scale_ai_v2`: raw nearest examples versus compact examples.
No new setting, acknowledgement, database migration or production route is added.
The previous protocol is reproducible from commit `26eec863`; reports from the two
protocols must not silently be pooled.

## Selection contract

A small pure ESM selector consumes at most nine already scope-validated examples
per candidate: the union of raw, broad and local retrieval. It normalizes existing
vectors and recomputes cosine relevance to the held-out query. It keeps at most
three examples, using a fixed relevance-weighted maximal marginal relevance
criterion: `0.8 * querySimilarity - 0.2 * max(0, maximumSelectedSimilarity)`.

The first selection is the strongest positive query match. Later selections must
have positive query similarity and positive marginal utility. Equal scores use
query similarity and then the content hash for deterministic tie-breaking. Exact
displayed-text duplicates and pairs with cosine similarity at least 0.95 are
excluded. Empty or underfilled packets remain empty or underfilled, not padded.
These constants are experimental selection parameters, not calibrated confidence
or proof of semantic equivalence. No parameter search on the evaluation cohort is
part of this change.

Both arms use the existing 600-code-point example projection and identical prompt
formatting. The raw arm, its candidate shortlist and query projection are unchanged.
The compact arm replaces the example list instead of appending another three
examples. Three is a count ceiling, not an exact token budget: actual input tokens
are measured and the existing complete-prompt budget remains enforced.

## Safety and reproducibility

- Validate every supplied evidence row before selection, including rows later
  discarded. Reject malformed vectors, missing descriptions, duplicate identities,
  shared membership and held-out evidence; do not repair ambiguity by guessing.
- Do not select using names, genres, observed destinations or expected answers.
  Movie/TV separation and grouped content-hash holdouts remain in place.
- Preserve the raw-similarity top-three candidate shortlist, anonymous candidates,
  both candidate orders, counterbalanced arm timing and the exact sample prefix.
- Keep model identity, consumed-source fingerprints, memory admission, cancellation,
  bounded inference, private-safe aggregate reporting and read-only snapshots.
- Synopses are untrusted data. Strict response parsing grants no tool or routing
  authority. No automatic retry of a failed generation or live promotion occurs.
- Existing placements remain a diagnostic, not independent ground truth. Report
  zero independent labels and unknown routing accuracy.

## Research and alternatives

Sources were discovered and opened through web tools on 2026-09-19. The original
[MMR paper](https://www.cs.cmu.edu/afs/cs/Web/People/jgc/publication/MMR_DiversityBased_Reranking_SIGIR_1998.pdf)
combines query relevance with novelty. It supports testing this selection family,
not these particular thresholds or a claim of better Classifarr routing.
[Lost in the Middle](https://aclanthology.org/2024.tacl-1.9/) measures position
sensitivity in its own retrieval and question-answering tasks; it supports retaining
order controls rather than assuming that a large context window solves selection.

[OWASP's RAG security guidance](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
recommends bounding untrusted retrieved context and validating model output.
Selection and deduplication are not prompt-injection defenses by themselves: this
experiment retains the data/instruction boundary, strict choice parser and absence
of downstream authority. It introduces no new remote provider or content logging.

| Option | Benefit | Cost / limitation | Recommendation |
| --- | --- | --- | --- |
| Append more representative examples | Broader observed coverage | Previous run cost more tokens and had more order sensitivity | Retain historical result, not the next default experiment |
| Raw nearest examples only | Small, simple comparison baseline | Can repeat nearly identical evidence | Preserve unchanged control |
| Bounded relevance/diversity selection | Uses existing vectors; no extra model calls; less redundant text | May remove useful similar examples; thresholds need evaluation | Implement as the paired experimental arm |
| Generated library summaries | Potentially concise | Additional inference, unsupported synthesis and refresh complexity | Defer until extractive evidence is measured |

## UI and final recommendation stack

This change has no UI surface. W3C's
[status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
supports accessible, non-focus-stealing feedback when status messages are shown;
it does not require another acknowledgement or dense explanation panel. Any future
Command Center presentation should summarize background health and expose details
on demand, without presenting this experiment as routing confidence.

1. Keep the existing safety, recovery and source-verification boundaries.
2. Compare compact selection with raw examples on the frozen movie/TV cohort.
3. Evaluate cost, order stability, abstention and per-library coverage together.
4. Require separate validation before production adoption; do not optimize for
   agreement with possibly incorrect existing placements.

Implementation and measured results belong in the separate
[outcome document](compact-inventory-evidence-outcome.md).
