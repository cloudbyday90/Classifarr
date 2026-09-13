# Neighborhood-conditioned metadata matching: design

Date: 2026-09-13

## Problem and decision

The previous global recipe experiment regressed on both 300-item samples.
Library-wide metadata can also obscure smaller kinds of content inside a mixed
library. Test one fixed alternative: learn a local metadata profile from the
nearest distinct descriptions in each candidate library. No library-name rules,
new declarations, extra AI calls or live routing changes are part of this step.

## Predeclared algorithm and evaluation

1. Retain the current rank fusion when description and global metadata have the
   same unique leader. Retain it for tied leaders or non-positive metadata too.
2. For a disagreement, inspect at most the existing top 100 description neighbors
   per same-media library and select at most 20 with usable metadata. Require at
   least 10 distinct usable neighbors in **every** candidate; otherwise retain the
   baseline for the whole pool. These are fixed experimental limits, not tuned
   against the evaluation results.
3. Exclude every held-out description copy, shared-library descriptions, missing
   metadata, conflicting metadata copies and wrong-media memberships. Copies do
   not increase support. Resolve membership from the inventory, not candidate
   claims. Exclude the query before any neighborhood profile fitting.
4. Reuse the existing smoothed contrastive genre/studio/rating formula on that
   local training set, then reuse description/metadata reciprocal rank fusion.
   Keep the baseline if the local fields provide no positive candidate support.
   This is a new versioned signal, not a silent change to live v1 profile meaning.
5. Reuse the original 300 and non-overlapping additional 300 description groups,
   five held-out folds, movie/TV and library strata. Report gains, losses,
   unchanged consensus controls, sparse fallbacks and aggregate support. There
   is no recipe selection or inner parameter search in this mode.

These 600 descriptions were examined in previous experiments: they are regression
cohorts, not a newly untouched test set. Existing placement is a weak observation,
not verified accuracy. Positive results still need fresh unseen validation and a
focused check against the original metadata disagreements before live adoption.

## Research and alternatives

Official sources were located through online search and read on 2026-09-13.

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Whole-library profiles | Broad support; inexpensive cached model | Can flatten minority content; retain as baseline |
| Query-local profiles | Learns relevant subgroups organically; no name taxonomy | Sparse libraries and noisy neighbors; test with complete-pool fallback |
| Globally tune field weights | Simple inference | Previous held-out regressions; do not promote |
| Additional AI generation | Can compare nuanced descriptions | Extra latency and unverified judgments; not needed for this numeric experiment |

The [nearest-neighbor interface](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html)
describes bounded neighbor retrieval and excluding self-neighbors. Our local
profile design is an application-specific hypothesis, not a result established
by that documentation. The [leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
supports separating held-out examples before fitting any learned transformation.
[Reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
combines ranks without summing incomparable cosine and log-odds values; it loses
score magnitude, a limitation retained explicitly in this experiment.

## Security, efficiency and accessibility

Use pure ESM modules with bounded inventory indexing and query-local fitting.
Reuse cached vectors and the existing read-only benchmark snapshot. Recheck
source digests and model identity before reporting a valid result. Do not log
titles, descriptions, provider IDs, metadata terms or per-item hashes.

Neighborhood metadata and description retrieval are dependent evidence from the
same inventory, **not independent corroboration**. No policy threshold, route
receipt, trusted label, model prompt or live profile authorization is changed.
[OWASP's prompt-injection guidance](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
supports keeping retrieved content untrusted and validating outputs in code;
this component never executes text or sends it to a generation provider.

No additional settings or UI panels are introduced. Existing SWR behavior is
unchanged. Any future Command Center presentation should be concise and preserve
control over automatic visual updates, consistent with
[W3C pause, stop, hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide).

## Recommendation stack and outcome

Prefer cached description retrieval, bounded query-local metadata fitting,
existing rank fusion, grouped evaluation, then evidence-based live integration.
Keep sparse and ambiguous cases on the baseline. Document measured outcomes and
the next decision separately in `neighborhood-metadata-matching-outcome.md`.
No release, version bump or dependency addition is planned.
