# Source-description paired evaluation: design

Status: Unreleased design, September 24, 2026. Implementation results belong in
[the separate outcome document](source-description-paired-evaluation-outcome.md).

## Decision and scope

Compare TMDB-linked training evidence against TMDB-linked plus source-anchored
training evidence on one private, read-only inventory snapshot. Target 300
distinct held-out movie/TV groups across arbitrary active libraries and both
query identity strata. Music remains excluded. No library names or genres are
hardcoded as destinations.

Reuse the existing description benchmark's cosine ranking, learned metadata
profiles, candidate preservation, cached vectors, and operator-feedback reader.
This is a retrieval/shortlist ablation, not a new classifier, release comparison,
AI-generation benchmark, or automatic approval mechanism.

## Leakage and measurement boundary

Known typed TMDB, IMDb, TVDB, scoped source anchors, and exact normalized
description copies form transitive exclusion groups. These are conservative
holdout relationships, not permission to merge or repair provider identities.
Conflicting-description rows participate in grouping even if they cannot train.
Three grouped folds are fixed on the shared source-aware snapshot before the
arms separate. A query's entire group stays out of its training fold in both
arms; groups with explicit feedback stay out of every training fold. Sample
selection is deterministic and stratified by movie/TV,
observed library membership, and source-only/TMDB-linked identity. At most one
query per group is selected. Unambiguous corrected identities are prioritized
within each stratum, followed by seeded ordering, so naturally recorded labels
are used without dropping whole library/media strata. Unknown aliases cannot be
detected by this protocol.

The same queries, vectors, candidate libraries, and ranking implementation are
used in both arms; only admitted training documents differ. Source-only queries
remain queries in the TMDB-only arm, never training examples. Corrected
destinations do not enter ranking or learned-profile fitting. Conflicting
feedback within a group cannot supply a quality label.

Report coverage and candidate changes for every paired case. Report candidate
recall and leading-proposal mismatch only for unambiguous explicit corrections;
inventory placement is never ground truth. Existing feedback identifies TMDB
items, so source-only quality labels remain unavailable. Empty denominators
produce null rates. Review rate, wrong automatic routing, independent blind
accuracy, and promotion eligibility remain unmeasured/false. Corrections are a
selected operational cohort, not a representative random accuracy sample.

Grouped folds retain scarce source-only examples as training evidence for other
independent query groups. A single global sample holdout would discard all three
source-only examples found locally, making the treatment needlessly empty. Report
source-only training counts per fold so this limitation stays visible.

Incomplete vector cache or cohort shortages must be visible. Do not silently
drop unindexed source descriptions, fetch paid inference, create labels, change
thresholds, or fill missing slots with duplicate cases.

## Safety and architecture

- Extend the existing private correction CLI with a source-pair mode; no new API,
  Command Center card, scheduler, acknowledgement, dependency, or migration.
- Use bounded ESM services for grouping, scoring/reporting, and snapshot capture.
- Reuse the dedicated read-only database runtime, repeatable-read transaction,
  timeouts, source-conflict guards, and model-fingerprinted vector cache.
- Inspect only the configured trusted local embedding model. Never generate,
  embed, pull models, refresh inventory, or write user data in this evaluation.
- Export aggregate counts and whole-snapshot fingerprints, not titles, library
  names, descriptions, source anchors, per-item hashes, tokens, or raw failures.
- Keep existing routing, approval calibration, and ordinary benchmarks unchanged.

## Official research and tradeoffs

Sources discovered with online search and read on September 24, 2026:

- [NIST AI RMF: validity and reliability](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
  supports representative testing and disaggregated results. Apply this by
  separating coverage from quality and reporting movie/TV and identity strata.
- [scikit-learn: grouped cross-validation](https://scikit-learn.org/dev/modules/cross_validation.html)
  describes keeping related observations out of opposite sides of a split.
  Apply the principle with local deterministic group holdouts; do not introduce
  Python or scikit-learn. This linked page is development documentation, not a
  dependency/version recommendation.
- [PostgreSQL: transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
  documents a stable repeatable-read snapshot. Both arms consume that same
  snapshot rather than observing separate changing inventories.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  recommends provenance, quality information, and sensitivity-aware sharing.
  Apply those principles to versioned aggregate reports and documented limits;
  this does not claim RDF conformance or UI accessibility changes.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Same-snapshot cached pair | Cheap, reproducible, isolates evidence admission | Requires complete matching cache; not full routing | Implement |
| Blindly score existing placement | Many apparent labels | Circular accuracy and reinforcement risk | Reject |
| New hosted evaluator/AI calls | Could evaluate generated decisions | Cost, privacy, extra moving parts | Defer |
| Immediately loosen approval | Fewer confirmations | No safety evidence for source-only calibration | Reject |

Recommendation stack: bounded snapshot → transitive holdout → paired existing
retrieval/profile scorer → stratified coverage and correction metrics → later
source-aware outcome capture and full decision evaluation. No release or local
container update is part of this change.
