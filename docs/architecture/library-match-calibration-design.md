# Automatic library match baselines: design

## Goal and preceding finding

Learn what an ordinary description match looks like inside each library, without
library-name rules, purpose declarations or new settings. The preceding
learned-evidence resolver qualified 147 of 248 proposals, but only compared the
winner with alternatives. Being the closest destination does not establish that
an unfamiliar item belongs there.

This component adds an automatically fitted, per-library novelty baseline to the
existing fresh-policy evaluation. It does not enable live routing. The existing
metadata model, full-pool comparison and AI proposal remain unchanged, so the
same response can measure qualification before and after the novelty check.

## Alternatives and recommendation

| Option | Advantages | Limitations | Decision |
| --- | --- | --- | --- |
| One absolute cosine cutoff | Cheap and simple | Not portable across models or broad versus narrow libraries | Keep existing live baseline only |
| Per-library split empirical match distribution | Learns different library ranges; no extra inference or dependencies | Sparse libraries cannot support it; placement contamination and minority themes remain risks | Implement and measure |
| Local-density/LOF model | Can handle different densities within a library | More neighbor computation and tuning; high-dimensional reliability still needs evaluation | Consider if mixed-library failures justify it |
| Supervised probability calibration | Can estimate correctness on checked labels | Existing placements are not verified labels | Do not claim this from inventory alone |

Recommended stack: existing representation-pinned embeddings → grouped inventory
split → bounded per-library reference and calibration sets → empirical match
rank → existing learned metadata/full-pool/AI agreement → fresh server-side
routing checks only after a separate live integration is validated.

## Protocol fixed before the benchmark

- Exclude the complete outer test fold, including every copy of its description,
  before selecting reference or calibration items. Typed identities must be
  unique and consistent with their descriptions. Never use a test result to
  adjust this run's parameters.
- Collapse identical descriptions; exclude descriptions shared across same-media
  libraries from baseline fitting. Movie and TV models are separate. Names,
  purpose text and AI confidence do not participate.
- Deterministically order description groups with a versioned hash. Reserve
  one quarter for calibration, with a minimum of 20 and maximum of 128 groups;
  use at most 256 other groups as reference examples. Require at least 20
  references and 20 calibration groups **per library**. Report sparse libraries
  rather than borrowing counts from other libraries.
- Each calibration item and incoming query is scored by mean cosine similarity
  to its three nearest examples in the **same fixed reference set**. Reference
  and calibration sets are disjoint. This avoids comparing leave-one-out scores
  against a differently sized full reference corpus.
- Compute `(1 + calibration scores <= query score) / (calibration count + 1)`.
  A rank above 0.05 is inside the candidate baseline; otherwise it is unusual.
  Reject numerically collapsed calibration distributions. The 5% tail and sample
  limits are initial project choices, not a measured error guarantee. Rank is
  neither confidence nor a calibrated probability of correct placement.
- Cache models only inside an immutable snapshot session, keyed by media type
  and the complete held-out hash set. Representation, content, membership and
  fold changes require a new model. Bound memory, arithmetic work and cached
  folds; yield during fitting and respect cancellation.
- Preserve the preceding resolver as a paired baseline. Apply novelty only as
  an additional qualification filter. Never convert an AI abstention, explicit
  policy veto or unavailable baseline into authorization.

## Security, privacy and user experience

Reuse the dedicated read-only Compose evaluator, pinned model checks and source
revalidation. No new network endpoint, model call, database writer, routing
receipt, retained raw item record or dependency is introduced. Public reports
contain aggregate counts, not descriptions, library names or item identifiers.

Metadata/observed-trait refresh during preparation receives the same frozen-input
treatment already used during generation: keep evaluating the captured snapshot,
mark it as no longer current, and never promote it to live evidence. Configuration,
policy, library, vector or description changes still abort before inference or
invalidate a running experiment. No live revalidation rule is relaxed.

The process fits baselines automatically during evaluation; it is not a new
background production scheduler. Live refresh/integration is a subsequent step,
not something this benchmark should imply has shipped. No new UI panel or
acknowledgement is appropriate. A future live status should reuse the concise
Command Center surface and announce meaningful changes without moving focus.

## Official research and date boundary

URLs were discovered through search and opened on September 12, 2026. Versioned
scikit-learn 1.5 documentation predates the requested August 2026 baseline.
Mutable W3C and OWASP pages are current readings, not archived August snapshots.

- [scikit-learn novelty and outlier detection](https://scikit-learn.org/1.5/modules/outlier_detection.html)
  distinguishes contaminated training inventories from new unusual observations
  and warns against testing novelty models on training samples. This motivates
  separate fitting/calibration/test groups; it does not validate our specific
  empirical-rank rule or guarantee resistance to dense misplaced clusters.
- [scikit-learn common pitfalls](https://scikit-learn.org/1.5/common_pitfalls.html)
  recommends splitting before fitting transformations and avoiding test leakage.
  The held-out query cannot influence its library baseline, and embedding
  normalization is identical for reference, calibration and query vectors.
- [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html)
  supports treating retrieved text as untrusted data, validating responses and
  limiting authority. Novelty ranking adds no tools or privileges to the model.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  requires accessible notification of displayed status changes, not additional
  status panels; it also warns against overly chatty live regions.

## Validation and remaining uncertainty

Test separate movie/TV baselines, duplicates and shared descriptions, held-out
leakage, sparse and collapsed distributions, permutation invariance, stale
snapshot isolation, invalid vectors, bounded work, cancellation and privacy.
Run the unchanged 300-item cohort for paired comparison; it is a regression
cohort already inspected during earlier work, not a new independent accuracy
test. Report all libraries' baseline availability and all candidate states,
alongside qualification and observed-placement disagreement.

The one earlier placement disagreement was not saved as an item-level record.
Aggregate reports cannot identify it retrospectively. Any later case inspection
must use an explicit private diagnostic; do not guess its identity or call
existing inventory placement ground truth. Record actual results in the
[outcome document](library-match-calibration-outcome.md).

The completed follow-up diagnostic found an upstream candidate-admission issue:
inferred/advisory genre observations can exclude a library before its descriptions
are compared. The outcome therefore prioritizes repairing that distinction
before promoting familiarity scoring into live routing.
