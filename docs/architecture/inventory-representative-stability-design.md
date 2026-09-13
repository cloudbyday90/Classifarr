# Representative learning: convergence and initialization stability

Date: 2026-09-13. Design fixed before local evaluation.

## Problem and decision

The previous group learner exhausted its 12-pass limit in 108 of 200 library/fold
fits. Increasing a displayed confidence score would not address this limitation.
Extend the existing offline learner with bounded multi-start fitting; retain the
v1 path as a reproducible control. No live routing, policy or UI behavior changes.

## Research and alternatives

Official sources were discovered and read through research tools on 2026-09-13:

- [scikit-learn KMeans](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html):
  initialization can affect local solutions; repeated starts use a training fit
  objective, and iteration limits do not establish convergence. Our normalized
  cosine implementation is not scikit-learn or an exact implementation of its
  Euclidean estimator. No Python dependency is added.
- [Adjusted Rand index reference](https://scikit-learn.org/1.5/modules/generated/sklearn.metrics.adjusted_rand_score.html):
  assignment comparisons should ignore arbitrary cluster numbering. Use this
  mathematical metric between training fits, not as a correctness score. This
  versioned reference documents the metric, not a recommended dependency version.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  preserve source integrity, retrieval scope and protection of derived vectors.
  Existing library placement remains an observation, not trusted ground truth.
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/): future status displays must be
  understandable and programmatically available without moving focus. This
  backend-only change adds no dense status panel; existing SWR remains unchanged.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Raise the single-start cap only | Small implementation and runtime cost | Cannot measure initialization sensitivity; insufficient alone |
| Bounded deterministic multi-start | Separates convergence from seed sensitivity without test-label selection | More CPU; recommended for this offline comparison |
| Unbounded retries until a desired answer | None that establishes correctness | Unbounded cost and answer-driven selection; reject |
| Change clustering family or model now | Could improve representation | Confounds this measured limitation; defer |

## Fixed protocol and modular boundaries

Reuse the normalized cached vectors, media-scoped membership index and exact
fold exclusions. Remove all held-out copies, shared memberships and unscoped
descriptions before initialization. Library names and held-out destinations are
not inputs to fitting. Keep the existing capacity heuristic (at most eight groups)
and minimum support of three; retain real examples, not generated topic labels.

The geometry module retains its 12-pass default. The stability service runs that
control plus three fits capped at 64 passes: the original mean-nearest first seed
and two fixed salted-hash choices from eligible training descriptions, each
followed by the existing farthest-first initialization. These are deterministic
perturbations, not statistical independent replications or k-means++.

Choose the converged fit with greatest average cosine to its assigned group's
normalized mean, across all training descriptions before minimum-support pruning.
Use start order for exact ties. If none converges, retain the best approximate fit
for diagnostics but never use it to change a comparison destination. Tiny or
zero-direction groups still cannot provide support. Report convergence, objective,
discard counts, passes, selected start and pairwise adjusted Rand agreement.

For each unique description/metadata disagreement, compare the three start models
and selected model using the existing rank fusion. A missing/ambiguous supported
pool, any unconverged same-media start, or different top destinations retains the
original baseline. Agreement here covers these four model views, not every
possible combination of library fits or future inventory drift. Consensus controls
remain unchanged. Report v1, selected-only and stability-filtered results separately.
No held-out membership is used to select a fit, tune a threshold or break a tie.

Use `--evidence-reranker --representative-groups --representative-stability` on the
existing CLI. Reject invalid combinations before loading runtime configuration.
The normal v1 mode keeps its work limit. The explicit stability mode admits at
most 80 billion estimated vector-component operations, counting all four fits,
assignment and mean updates, initialization and diagnostics. Preserve the 20
million vector-component memory limit, 50,000-document and 64-library limits,
wall-clock deadline and cooperative cancellation. This is an offline ceiling,
not permission to run four fits per incoming item.

## Evaluation and acceptance

Test synthetic convergence, bounded nonconvergence, label-permutation invariance,
training-only selection, input ordering, exclusions, cancellation, complete media
pools, fallback and redacted reports. Run backend regression and quality gates.
Use local Compose with PostgreSQL read-only execution, zero generation and source
verification. Replay prior cohorts as controls and reserve a new cohort excluding
all prior 800 descriptions. Do not disable source-drift checks; invalidated reports
are not successful results. Do not claim live accuracy or automatic routing gains.

The [outcome](inventory-representative-stability-outcome.md) will record measured
results and the next recommendation. No release, version bump, schema change,
provider dependency, extra user question or approval gate is included.
