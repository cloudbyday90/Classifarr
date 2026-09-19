# Adaptive content-group discovery

## Intent and boundary

Protocol frozen September 19, 2026, before local inventory measurement. Follow-up
to [semantic group comparison](group-semantic-comparison-outcome.md): discover
group count from content geometry rather than library names or the current
size-based maximum of eight. This iteration implements a read-only, zero-inference
comparison, not a new routing policy or another settings panel.

The previous comparator produced nine extra decisions, only two agreeing with
placement. Placement is not a verified label. Broad groups are a hypothesis worth
testing, not an established explanation for those decisions.

## Official research and alternatives

URLs were discovered through search and read on September 19, 2026.

- [Sentence Transformers clustering](https://www.sbert.net/examples/sentence_transformer/applications/clustering/)
  distinguishes fixed-count k-means from threshold-based hierarchical/community
  discovery. More groups can capture finer themes, but thresholds change the result.
- [scikit-learn bisecting comparison](https://scikit-learn.org/1.8/auto_examples/cluster/plot_bisect_kmeans.html)
  illustrates hierarchical refinement rather than rebuilding unrelated partitions
  for every group count. Our spherical, validation-gated implementation is not
  scikit-learn's estimator and introduces no Python dependency.
- [scikit-learn leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
  requires fitting without evaluation examples. Development documentation informs
  methodology only; no development-version dependency is added.
- [Silhouette documentation](https://scikit-learn.org/dev/modules/generated/sklearn.metrics.silhouette_score.html)
  defines a pairwise-distance metric. We use explicitly named centroid and
  representative similarities instead, avoiding quadratic pairwise storage and
  not mislabelling them as silhouette or accuracy.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports bounded, sanitized diagnostics without secrets or source payloads.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  advises accessible, non-interrupting status feedback and warns about excessive
  announcements. This backend-only change adds no controls, alerts or polling.
  Existing SWR behavior is unchanged; no new accessibility conformance is claimed.

| Option | Advantage | Cost / risk | Decision |
| --- | --- | --- | --- |
| Raise eight to a larger fixed count | Small implementation | Still ignores content; can fragment small libraries | Reject |
| Full pairwise communities / density clustering | Variable shapes and group count | Memory, threshold and outlier-handling complexity | Later comparison |
| Bounded validation-gated bisection | Automatic count, linear-size memory, interpretable stops | Greedy hierarchy; rare themes may stay inside broad parents | Evaluate now |
| Extra LLM grading | Rich semantic comparison | Prior weak results, latency, untrusted text | Keep offline |

## Frozen algorithm

Each library supplies only distinct, exclusive, normalized cached vectors and
private hashes. Names, genres, media type, source IDs and descriptions do not enter
the fitter. The surrounding scope still enforces movie/TV separation. All copies
of an outer held-out description are removed before either arm is fitted.

Start with one group. Consider the highest-loss unresolved group first. For each
candidate node, reserve a deterministic hash-ranked 20% (at least two) internal
validation subset. Fit two spherical centers using two deterministic starts,
at most 32 passes per start, selecting the converged training fit with least loss.
Accept a split only if each child has at least three fitting examples and one
validation example, and mean cosine loss improves by at least 10% on BOTH fitting
and validation subsets. Zero-loss, unsupported, non-converged or unhelpful splits
retain their parent intact. Recompute final centers from all node members after
acceptance. Internal validation is reused adaptively and is not the outer test.

Limits: 32 final groups per library, depth six, at most 63 attempted nodes,
10,000 distinct vectors and eight million components. These are safety ceilings,
not target group counts. Cooperative cancellation and the CLI deadline apply.
Tiny libraries and degenerate zero-mean groups remain explicit/unassigned, never
silently removed as competitors. Splits cannot discard members. Small-group
coverage is reported separately; remaining in a broad group is not proof of a
rare theme being understood.

## Measurement and security

Reuse the existing three disjoint 300-description cohorts and five grouped folds.
The control is the current converged selected partition. Report per-fold/library
group count, support ranges, weighted cohesion, lower-tail cohesion, three-example
representation similarity, and same-media held-out nearest-group comparisons.
Preserve absent/sparse competitors as abstentions. Report placement agreement only,
with independent labels zero, accuracy null and live promotion disabled.

Reject malformed vectors, duplicate hashes, inconsistent scope, missing cached
vectors and excessive work. Source digests and embedding identity must match after
the run; changed sources invalidate results. There are no embedding writes, model
downloads, generation calls, routing writes, schema changes or dependency changes.
Only aggregate numeric diagnostics and anonymous strata leave the evaluator.

Do not retune thresholds after seeing the three cohorts. Outcome documentation
must distinguish geometric improvements, preservation of small groups, runtime
cost and actual correctness (which this unlabeled inventory cannot establish).

## Recommendation stack

Validated inventory → automatic metadata/cache recovery → bounded adaptive group
discovery → held-out quality comparison → existing retrieval/routing safeguards.
Measure representation quality before considering any runtime cache integration.

Measured decision: [adaptive content-group outcome](adaptive-content-groups-outcome.md).
