# Cross-fitted neighbor calibration: design

## Decision

Add a group-excluded, sample-efficient calibration arm to the existing read-only
neighbor benchmark. Preserve the four original arms and their inputs so changes
in sampling and decision rules remain distinguishable. This follows `236460f5`,
whose fixed disjoint split left both movie and TV pools uncalibrated because of
small libraries. No live routing, policy thresholds or user settings change here.

## Protocol fixed before measurement

Use the existing seeded 300-item, five-fold regression cohort, balanced across
movies, TV and library strata. Exclude the complete test fold from every reference
and calibration calculation. Collapse identical description hashes and exclude
same-media cross-library shared groups from training. Keep all same-media rivals;
library names, declared purposes and test placements do not train the model.
Copy grouping uses the existing normalized, length-bounded synopsis projection
and its exact hash. Case-only rewrites, paraphrases and other near-duplicates can
remain separate groups; no semantic deduplication guarantee is claimed.

For each library, reuse the existing deterministic exclusive-group ordering and
retain at most 65 groups. The first 32 groups, or all groups when fewer exist,
supply calibration observations. For each observation, remove its hash from
every reference pool **before** selecting up to 64 references. Score its top-three
cosine mean against each library and compare with the strongest rival mean.
No calibration observation can match itself or one of its identical copies.

Require at least 20 reference groups after exclusion and at least 20 calibration
observations in every library. Thus 21 exclusive non-test groups can qualify,
instead of requiring two disjoint sets of 20. This is a change to how examples
are reused, not a lower evidence-count requirement for an individual score.
For a new held-out query, use the first 64 reference groups without adding it.
Small-library calibration fits have one fewer reference than the query fit;
record this limitation and report minimum per-observation reference counts.

Keep the previous empirical upper rival-tail and lower positive-tail checks
unchanged: fixed 5% tails, positive contrastive margin, tie rejection and
degenerate-distribution rejection. Reuse the numeric scoring and tail-summary
implementation instead of duplicating it. Leave-one-group-out observations are
dependent; these empirical ranks are not correctness probabilities, confidence
intervals, conformal guarantees or a jackknife+ implementation.

With `--neighbor-calibration --neighbor-cross-fit`, compare three additional arms:
strict separation on cross-fit references, mean separation on those same
references, and calibrated separation. Reuse the same full-corpus proposal and
shared-copy veto in every arm. Compare old/new strict references separately from
mean/calibration changes. Report paired gains/losses only where both arms are
available, plus explicit coverage gains. Existing placements remain weak
observations rather than truth labels; neighbor support is not routing authority.

## Architecture and boundaries

- Extract shared numeric neighbor/tail helpers; preserve the original kernel's
  behavior with unit tests and exact aggregate baseline comparison.
- Add one bounded cross-fit kernel and one deterministic group-selection helper.
  Extend the existing snapshot-scoped session and benchmark, not live services.
- Keep copied vector ownership, typed query identity checks, held-group checks
  on cache hits, snapshot/version-bound keys and interrupted-fit eviction.
- Retain 20-model, 20-million-component and two-billion-component-operation
  session limits. Yield and check cancellation between calibration observations.
  Validate group counts, unique hashes and vector dimensions before arithmetic.
- Reuse the configured local cached embedding snapshot. No generation, embedding
  writes, network calls from numeric services, media routes or stored model changes.
- Reject incompatible CLI modes before loading runtime. Public output contains
  aggregate counts and anonymous strata, not private media text, identifiers or
  vectors. The additional mode needs no UI or operator acknowledgement.

## Official sources verified in September 2026

URLs were discovered through search/MCP and opened on 12 September 2026 local
time. Mutable sources were checked as available that day; this does not claim
knowledge of the rest of September.

- [Scikit-learn cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)
  explains sample reuse through cross-validation, grouped separation, computation
  costs and the need for a final test set. Apply the principles in ESM without
  introducing a Python runtime or claiming this regression cohort is pristine.
- [Scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  requires keeping test data out of fitted preprocessing and model decisions.
  Our outer description-group test folds remain excluded throughout inner fits.
- [Barber et al., Predictive inference with the jackknife+](https://arxiv.org/abs/1905.02928)
  distinguishes leave-one-out methods and their assumptions. Reusing observations
  alone does not confer its coverage guarantees on this empirical classifier.
- [OWASP vector and embedding weaknesses](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  describes poisoning and retrieval disclosure risks. Keep source exclusions and
  avoid treating existing placements or derived distributions as verified labels.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  warns against excessively chatty updates. This backend-only change adds no
  live announcements or dense settings controls; future status UI should remain
  concise and programmatically exposed.

## Alternatives, pros and cons

| Option | Advantage | Limitation | Recommendation |
| --- | --- | --- | --- |
| Keep disjoint 20+20 split | Simple independent sets | Excludes useful small libraries | Retain as comparison baseline |
| Lower minimum counts | Cheap coverage increase | Less evidence per score; post-hoc tuning risk | Do not use |
| Group-excluded cross-fitting | Learns from existing small-library contents | More computation, dependent observations | Implement offline comparison |
| Require more items or declarations | Can create larger or explicitly labeled inputs | Operator effort and distorted libraries | Not required |
| Immediately route on empirical ranks | Fewer manual decisions | No established correctness guarantee | Do not promote from this study |

Final stack: PostgreSQL/pgvector snapshot, pinned local embeddings, group-excluded
cross-fitting in modular ESM, bounded snapshot reuse, aggregate paired evaluation,
and unchanged fresh live authorization. Record measured coverage, disagreements
and the next component in the separate
[outcome document](cross-fitted-neighbor-calibration-outcome.md).
