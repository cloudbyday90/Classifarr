# Local content-community discovery design

## Purpose and boundary

September 19, 2026. The preceding adaptive splitter accepted no splits on the
local inventory. This component tests a different hypothesis: small, mutually
similar neighborhoods can expose themes without first splitting a whole library.
It is offline evaluation, not a replacement routing model. No policy, confidence,
library configuration, background recovery, UI or database writes are added.

## Frozen protocol

Before measuring a fresh cohort, freeze `inventory_local_communities_v1`:

1. Remove every copy of each outer-fold held-out description before discovery.
   Require a complete cache and verify the embedding identity and source again
   after evaluation. No embedding or generation requests are permitted.
2. Discover across all libraries, separately for each media type. The generic
   fitter receives only normalized vectors and private description hashes; no
   title, library name, genre, placement label or raw description is a feature.
3. Compute exact top-16 positive cosine neighbors per point. Stream pairs once;
   retain only bounded neighbor lists, not a dense distance matrix. Set each
   point's local threshold to the upper median of its retained neighbor scores.
4. Keep an edge only when it is reciprocal and passes both local thresholds.
   Form deterministic greedy cliques anchored at each point: every added member
   must connect to all current members. This prevents a single bridge from joining
   unrelated neighborhoods. It is not maximal-clique enumeration.
5. Sort proposals by size, cohesion, then private hash. Remove already assigned
   members, keep groups with at least three remaining descriptions, and summarize
   their center and three representatives. Groups do not overlap; unsupported
   items stay explicitly unassigned. The local cap can fragment large themes.
6. Only after discovery, measure library participation. Shared descriptions count
   once in discovery and are reported separately, not as independent library
   votes. A library projection needs three exclusive descriptions; every library
   remains a candidate even if it has no supported group.
7. Compare current groups and local-community geometry. The community arm also
   abstains when its nearest training item is shared, unassigned, tied or outside
   a supported library projection. Report raw geometry separately so this guard's
   effect is visible. These are diagnostics, not calibrated routing decisions.

The parameters are a bounded experimental hypothesis, not published optimal
values. Do not tune them on this cohort. Use 300 previously unseen descriptions,
five folds, seed `classifarr-profile-20260912`, excluding prior cohorts of
`300,300,100,100,300,300`. Earlier samples may remain training context.

## Quality and safety

Measure assigned/unassigned and shared counts, support distributions, member/center
and nearest-representative similarity, smallest-control-group retention, movie/TV
and library slices, abstentions, changed destinations and placement disagreement.
For this many small groups, omit all-other-center margins in both arms rather
than introducing another quadratic pass. Explicitly mark them unmeasured.
Existing placement is not ground truth; accuracy remains null. Higher cohesion
among fewer retained items is not an unconditional quality improvement.

Bound input at 10,000 vectors, eight million components and 40 billion pairwise
components per fit; preflight the entire evaluation at 400 billion components.
Use cooperative cancellation/deadlines and progress between folds. No provider,
database or network dependency enters the graph fitter. Output aggregate counts
and private fingerprints only; keep inventory reports under ignored `.tmp/`.
Do not disable scheduled self-healing to obtain a clean measurement. If source
data changes, invalidate the report and rerun only after it settles.

## Official sources and trade-offs

URLs discovered through web search and opened September 19, 2026:

- [Sentence Transformers clustering](https://sbert.net/examples/sentence_transformer/applications/clustering/README.html)
  describes local communities and configurable size/similarity thresholds. This
  implementation is a custom ESM experiment, not that library's algorithm.
- [scikit-learn nearest neighbors](https://scikit-learn.org/stable/modules/neighbors.html)
  explains exact search's dimensional/work costs. Bounded exact search gives a
  reproducible reference; it is not a production-scale indexing strategy.
- [Maier, Hein and von Luxburg's neighborhood-graph research](https://arxiv.org/abs/0912.3408)
  distinguishes mutual and symmetric graphs and shows parameter choice matters.
  It does not establish that 16 neighbors is optimal for this inventory.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  supports fitting only on training data and keeping evaluation data separate.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports restricted diagnostics and excluding credentials and sensitive payloads.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  favors programmatically exposed updates without taking focus. No new UI is
  warranted for an unvalidated model; preserve existing SWR and accessible status
  behavior. A future promoted summary must remain concise and non-interrupting.

| Option | Benefit | Limitation |
| --- | --- | --- |
| Current runtime groups | Proven operational contract | Eight-group ceiling |
| Adaptive whole-library splits | Bounded and retains all items | Measured loss of detail; not promoted |
| Local reciprocal communities | Library-agnostic, small-theme discovery | Can fragment themes and leave many outliers |
| Approximate neighbor index now | Better scaling potential | Adds recall/configuration uncertainty before reference quality is known |

Recommendation: keep runtime unchanged, implement and measure bounded local
communities, then decide from the outcome. Final stack: validated inventory and
automatic recovery → cached descriptions/vectors → content-only communities →
observed library participation → held-out evaluation → existing routing safeguards.
This is retrieval representation learning, not training or fine-tuning an LLM.
