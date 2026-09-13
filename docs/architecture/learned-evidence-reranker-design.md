# Learned evidence reranker: design

Date: 2026-09-13

## Problem and scope

The focused library comparison left six metadata/description disagreements.
Genre, studio and audience-rating fields can point toward different libraries;
a large relative-fit value is not a probability or proof of library purpose.
Removing one field globally can harm other libraries. The next component learns
how to combine these signals from inventory, without library-name rules or new
user declarations. It is initially an offline ranking experiment, not permission
to route media or weaken the existing independent-evidence checks.

## Recommendation stack

1. Retain the current metadata formula and expose its numeric field contributions
   through a small pure module. Distinguish unavailable evidence from a real zero.
2. Compare the current description/metadata rank fusion with four fixed recipes:
   balanced description/three-field fusion, description-led fusion,
   description-only, and description/genre/studio fusion. Rank fusion avoids
   adding incomparable cosine similarities and log-odds directly.
3. Select a recipe independently for movies and TV using a bounded, library-balanced
   inner sample. Score by mean per-library placement agreement; ties retain the
   existing recipe. Sparse or unrepresented training libraries retain it too.
4. Evaluate on outer grouped hold-outs. Exclude every copy of each outer held-out
   description before inner sampling, learning profiles or retrieving neighbors.
   Inner validation descriptions are likewise excluded from their own evidence.
5. Report gains and losses, including cases where description and metadata already
   agree. Require a separate decision before any live integration.

The fixed recipe order is baseline, balanced (3:1:1:1), description-led (6:1:1:1),
description-only (1:0:0:0), then no-rating (2:1:1:0), in description/genre/studio/
rating order. Missing metadata channels are omitted for all candidates if any
candidate lacks that channel; they are not counted as negative evidence.
Equal channel values share a rank. No new threshold search is performed.

## Research and tradeoffs

Sources were discovered through online search and read on 2026-09-13.

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Drop a metadata field everywhere | Simple | Can discard useful library-specific patterns |
| Raise confidence or bypass disagreement | Fewer prompts immediately | Hides uncertainty; no demonstrated matching improvement |
| [Reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion) with learned recipe selection | Combines differently scaled evidence; deterministic and inexpensive at inference | Discards score magnitude; selection needs held-out evaluation |
| Add more AI calls | Can reconsider semantic distinctions | Extra latency/cost; does not establish correctness |

Use separate training/validation/test boundaries when selecting parameters, as
explained by scikit-learn's
[nested cross-validation example](https://scikit-learn.org/1.5/auto_examples/model_selection/plot_nested_cross_validation_iris.html)
and [leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html).
Field ablation is diagnostic rather than causal importance: correlated features
can complicate interpretation, as discussed in the official
[feature-importance guide](https://scikit-learn.org/stable/modules/permutation_importance.html).
Existing placements remain weak observations, not independently verified labels.

## Security, accessibility and efficiency

The existing local benchmark CLI supplies a read-only, bounded inventory snapshot
and cached vectors. This mode performs zero generation calls and writes no
database rows, training labels, policies or route receipts. Recheck snapshot
digests and embedding identity after evaluation; invalidate results on change.
Only aggregate counts, recipe IDs and whole-snapshot fingerprints are public.
No titles, descriptions, provider IDs, learned terms or per-item hashes are logged.
Malformed candidate evidence is rejected, not coerced into a ranking.

Retrieved text is untrusted data, consistent with
[OWASP prompt-injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/).
The numeric reranker does not execute it or send it to an additional provider.
Identity, media-type restrictions and live review requirements are unchanged.

No additional settings, acknowledgements or diagnostics panels are introduced.
Existing SWR refresh behavior remains unchanged. If results later appear in the
Command Center, keep them concise and retain user control over changing content,
following [W3C pause/stop/hide guidance](https://www.w3.org/WAI/WCAG21/Understanding/pause-stop-hide.html).

## Outcome

Record measured results, regressions, validation and the next decision separately
in `learned-evidence-reranker-outcome.md`. No release or version bump is planned.
