# Learned-group semantic comparison: design

Date: 2026-09-19

## Decision before measurement

Evaluate whether a local model can distinguish overlapping **learned groups**,
not merely similar plots. The previous item-pair pilot had no net agreement gain;
the lexical group experiment recovered no additional cases. Current metadata gaps
do not explain most unavailable lexical contrasts. Keep both findings intact.

Extend the existing read-only, grouped candidate benchmark. Reuse installed local
inference and cached vectors, without new dependencies, downloads, schema changes,
UI panels, labels, routing permissions or confidence adjustments. This is an
LLM group-fit experiment, not a trained cross-encoder or verified learning outcome.

## Frozen protocol

1. Preserve the existing independent and candidate-local combined arms. Only
   `local_overlapping_examples` in the combined arm may request semantic analysis.
   Stable decisions and all other uncertainty reasons remain unchanged.
2. Fit groups using training folds only. Exclude every copy of each held-out
   description. Retain all same-media libraries; require two to eight candidates,
   validated memberships and at least three exclusive examples in every selected
   group. Shared and unassigned observations remain competition, not positive
   training labels. An unassigned nearest neighbor keeps the pool unresolved;
   veto query/shared near-copies at the existing 0.98 boundary.
3. Select the nearest group centroid in each library. Ties, absent groups and
   nonpositive matches abstain. Select its centroid-nearest actual member and
   two query-nearest other members. Each three-example set must be non-correlated
   at the same 0.98 boundary. Never replace missing rivals with another library.
4. Present anonymous, deterministically shuffled groups. Each includes the three
   descriptions and bounded inventory-observed genres/studio, explicitly treated
   as observations rather than declarations. Include the query description and
   the same metadata projection. Omit titles, IDs, names, paths, scores, counts,
   placement labels and generated summaries. Missing metadata remains unknown.
5. Ask for one ordinal fit grade per group: 0 incompatible/no support, 1 broad
   overlap, 2 supported recurring content/treatment, 3 strong consistent fit.
   A unique grade of at least 2 must beat every rival. Repeat with both group and
   example order reversed; require the same winner. Missing/weak/tied/order-sensitive
   responses keep the original abstention. Grades never become probabilities.
6. Explicitly budget at most 100 eligible cases per 300-item cohort, two planned
   calls per case. Preflight without inference first; inspect transport reliability
   with at most ten cases before extending. Use the same original/additional/fresh
   cohorts for paired results. Do not tune prompts, selection or acceptance against
   their outcomes. These are existing samples, not additional unseen items.

## Reliability and measurement

Reuse the local-only transport, installed-model digest checks, temperature zero,
seed 42, context bound, strict schema/grammar, bounded response reader and deadline.
Stop all later generation on protocol/provider errors; no repair prompts, retries
or cloud fallback. Preserve baseline metrics for unattempted cases. Fail closed on
source drift with the existing post-run snapshot verification.

Report actual attempts, calls, valid passes, tokens, latency, all abstention reasons,
movie/TV and library slices, nearest-example support slices, stable controls and
newly selected agreements/disagreements. Historical placement remains a weak
observation; independent labels are zero and accuracy is null. Selection of cases
or examples must never consult whether the baseline agrees with placement.

## Official research and tradeoffs

Sources discovered through search and read on September 19, 2026:

- [Sentence Transformers retrieve/rerank](https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html)
  separates efficient retrieval from joint relevance scoring. This motivates a
  second comparison stage, but does not prove this different LLM method works.
- [Hard-negative mining](https://www.sbert.net/docs/package_reference/util/hard_negatives.html)
  cautions against treating very similar items as negatives. Here rival library
  membership is never converted into a verified negative or a training label.
- [Ollama structured outputs](https://github.com/ollama/ollama/blob/main/docs/capabilities/structured-outputs.mdx)
  supports constrained schemas; deterministic application validation remains
  necessary and cannot establish semantic correctness.
- [Scikit-learn leakage guidance](https://scikit-learn.org/dev/common_pitfalls.html)
  supports training-only fitting. The accessed page is development documentation;
  no development dependency is introduced.
- [OWASP prompt-injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  treats retrieved text as an attack surface. JSON-encode observations, give the
  model no tools or write authority, strictly validate output and publish only
  aggregate diagnostics. Prompt instructions alone are not a security boundary.
- [W3C pause/stop/hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide)
  informs existing quiet SWR refresh controls. No new UI or automatic focus change
  is needed for this experiment; no new accessibility-conformance claim is made.

| Option | Pros | Cons / recommendation |
| --- | --- | --- |
| Repeat lexical weighting or item-pair grading | Already implemented | Prior results do not support another tuned rerun; reject |
| Group-fit comparison using installed local AI | Uses organic content groups; bounded; library-name agnostic | Ordinal, costly and potentially order-sensitive; evaluate first |
| Add a dedicated cross-encoder | Purpose-built joint scoring | New model/runtime and domain validation; defer |
| Enable inferred choices live immediately | Less review | Unmeasured wrong-route risk and circular labels; reject |

Final proposed stack: validated inventory and automatic recovery → cached vectors
and learned groups → bounded rival-group comparison → held-out evaluation → existing
routing authorization. Record the measured decision separately in the outcome MD.
