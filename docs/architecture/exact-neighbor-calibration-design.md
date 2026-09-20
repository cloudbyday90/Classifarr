# Exact-neighbor calibration design

## Decision and scope

The reference-coverage experiment found that fixed reference samples missed most
nearest descriptions. Add an offline comparison using every eligible description
in each same-media library. Use the same exact top-three mean retrieval rule for
calibration and held-out queries. Do not change live routing, thresholds, provider
configuration, dependencies, UI, or releases.

## Architecture and safeguards

- Reuse the private, validated embedding snapshot and provenance-clean outer folds.
- Retain the existing deterministic first 32 calibration description groups per
  library. Exclude the whole outer fold and each calibration query's own description
  group from references. Shared-library groups remain excluded; sparse rivals stay
  in scope and prevent acceptance.
- Cache only immutable pairwise cosine values, never selected neighbors or fitted
  decisions across folds. Reapply fold membership before reading cached values.
  A value is computed only when its reference is admitted. This allows exact
  retrieval without repeatedly multiplying the same vectors in different folds.
- Bound the cache to four million Float64 values (32 MB of scalar storage), 512
  query rows, two billion newly computed vector components, and twenty fold models.
  Retain existing snapshot, admission, cancellation, time, and source-drift gates.
  Preflight each uncached fit against remaining scalar and computation capacity;
  enforce those limits again during execution. Yield during scans. Resource
  exhaustion fails the experiment, not into a weaker
  fallback. No full corpus-by-corpus distance matrix is allocated.
- Keep familiar/unusual calibration, empirical tail, unique-winner requirement,
  and all policy vetoes unchanged. A distinct exact-neighbor version requires
  explicit admission by the evaluation-only acceptance path.
- Report aggregate resource use and paired placement agreement. Library contents
  are weak labels, not verified correctness; no claim of calibrated probability,
  conformal coverage, unseen-content rejection, or live routing permission follows.

## Alternatives and recommendation stack

| Option | Advantage | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Fixed 64 references | Low, predictable cost | Misses most true neighbors in the measured corpus | Keep as control |
| Representative references | Covers more regions | Previous run showed no additional accepted gains | Keep comparison |
| Exact eligible references with bounded scalar reuse | Tests whether missing evidence is the bottleneck; no approximation error | More CPU and memory; still weak labels | Implement offline |
| Approximate vector index | Potential scaling benefit | Adds recall/error and index-lifecycle variables before establishing a useful target | Defer |

Recommended order: validated snapshot → provenance-clean grouped folds → exact
neighbor calibration → unchanged familiarity and policy safeguards → paired local
evaluation → independent-label and unseen-content checks before live consideration.

## Official research checked on 2026-09-20

URLs were discovered with web search and opened, not guessed. These are current
guidance checked in September 2026, not a frozen historical standards archive.

- [scikit-learn nearest-neighbor API](https://scikit-learn.org/stable/modules/generated/sklearn.neighbors.NearestNeighbors.html)
  documents brute-force exact search. We implement bounded ESM arithmetic using the
  existing normalized representation; no Python dependency is introduced.
- [scikit-learn common pitfalls](https://scikit-learn.org/dev/common_pitfalls.html)
  explains consistent transformations and separating fitting from held-out data.
- [scikit-learn grouped validation](https://blog.scikit-learn.org/updates/update-on-metadata-routing/)
  explains keeping related samples together. Description hashes define our groups.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends provenance, integrity checks, retrieval isolation, and downstream
  policy enforcement. Cached similarities grant no routing authority.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  warns against overly chatty announcements. This experiment adds no screen,
  acknowledgement, alert, or user task; future UI should summarize outcomes.

See [implementation outcome](exact-neighbor-calibration-outcome.md) for results.
