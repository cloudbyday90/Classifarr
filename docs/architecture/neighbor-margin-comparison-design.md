# Library-calibrated neighbor comparison: design

## Decision

Evaluate alternatives to the weakest-selected-example veto without changing live
routing. The previous commit `322e2a27` correctly reduced synopsis-query work but
left three retained smoke cases in review. One was blocked by neighbor overlap;
that observation alone cannot prove the veto is wrong.

Add one zero-generation mode to the existing inventory benchmark. Reuse its
seeded, library-stratified sample, description-group folds, pinned vector snapshot
and source exclusions. Do not create a new evaluator UI, configuration panel,
corpus store or training-approval workflow.

## Paired protocol

The proposed destination for each case is the highest full-corpus top-three
description mean, with ties retained as review. It is not the observed placement
and is not an AI proposal. Compare the current full-corpus neighbor/shared-copy
veto with three arms using the same bounded reference sets:

1. Strict reference separation: selected minimum exceeds every rival maximum.
2. Mean reference separation: selected top-three mean exceeds all rival means.
3. Empirical margin support: mean separation also exceeds a training-derived
   rival-tail threshold and is not in the selected library's lower margin tail.

This isolates the neighbor check, not the whole live decision. AI agreement,
metadata agreement, restrictions, familiarity and fresh routing receipts are not
evaluated by these arms. Neighbor-support counts are not automatic-route counts
or proven reductions in necessary reviews. Keep the full-corpus selected-example
shared-copy veto in every arm, including the bounded-reference comparisons.

For library L, margin is its mean minus the strongest other same-media library's
mean. Calculate calibration margins on exclusive, non-test description groups.
Use at most 64 reference and 32 calibration groups per library, with 20 of each
required for calibrated support. Reuse the existing deterministic disjoint split,
then cap it; never tune sample caps or thresholds against test outcomes.

The threshold is the maximum of zero and each rival's upper 5% calibration-tail
order statistic (`ceil((n + 1) * .95) - 1`). Selected-library lower-tail support
uses `(1 + count(calibration margin <= query margin)) / (n + 1) > .05`.
Ties do not count as a positive margin. Sparse/degenerate calibration or an
incomplete same-media pool cannot grant calibrated support. Report these states
instead of dropping the difficult library. These are exploratory empirical
placement distributions, not calibrated correctness probabilities or a conformal
coverage guarantee.

Keep both full-corpus and strict-reference baselines: changing reference sampling
can change results independently of changing the veto. Report paired gains and
losses for the same proposed destination, by movie/TV and anonymous library
stratum. Existing placements are weak observations, not independent truth labels.

## Alternatives and recommendation

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep strict veto unexamined | Conservative and simple | A single overlapping rival can retain review | Keep live; measure offline |
| Replace with mean alone | Less sensitive to one low selected example | Could accept broad or misplaced clusters | Comparison arm only |
| Empirical cross-library margins | Learns relative separation from each library without names | Sparse libraries, extra fitting work, weak-label limits | Implement evaluation |
| Immediately promote a tuned threshold | Fewer reviews if tuned to this cohort | Test leakage and unverified routing risk | Reject |
| Ask users to describe every library | Explicit labels | High involvement, contrary to organic discovery | Not required here |

## Security and implementation

Use modular ESM numeric fitting, snapshot-scoped orchestration and aggregate
reporting. Reuse existing corpus validation, typed identity checks, duplicate
grouping and copied vector ownership. Hold out query/copy groups from both split
halves, compare all same-media libraries, bound model count and dot-product work,
and discard interrupted fits. Cap retained model vectors at 20 million numeric
components across all folds, even when sparse fits skip calibration arithmetic.
No network or persistence belongs in the kernel.

The benchmark may inspect the configured local embedding representation but
must not embed, generate, pull models, route media or write learned state. Reject
incompatible CLI modes before loading runtime. Reports contain aggregate counts,
not titles, descriptions, item/library identifiers, vectors or private errors.
No routing receipt or live resolver imports the new component.

## Official research, current through the verification date

Sources were identified with search/MCP and opened on 12 September 2026 local
time. This is guidance verified during September, not a claim about the remainder
of the month or an archived snapshot of mutable pages.

- [Scikit-learn: common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)
  documents train/test leakage and why preprocessing/model decisions must not
  learn from the test set. We apply those principles in ESM; no Python dependency
  is introduced. Group boundaries include duplicated descriptions.
- [NIST Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
  emphasizes pre-deployment evaluation and contextual risk measurement. Observed
  placement agreement and review counts do not establish correctness or justify
  promoting an unvalidated model into routing authority.
- [OWASP LLM08:2025](https://genai.owasp.org/llmrisk/llm082025-vector-and-embedding-weaknesses/)
  highlights poisoning, source integrity and access-aware retrieval. Existing
  misplaced clusters can bias learned distributions; independent checks remain.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against overly chatty updates. This offline component adds no screen
  density or new announcements; the current accessible review UI is unchanged.

Final stack: PostgreSQL/pgvector snapshot, local pinned embeddings, grouped
reference/calibration/test separation, bounded ESM fitting, aggregate paired
evaluation, and unchanged fresh live routing authorization. Record measured
results, limitations and the next decision in the separate
[outcome document](neighbor-margin-comparison-outcome.md).
