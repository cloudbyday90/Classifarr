# Organic library profile learning design

## Product direction

Learn each library's character from its contents without predefined library
names, genre-to-destination rules, or a requirement that an operator declare
purpose first. This supersedes the proposed declared-intent-first approach.
Existing hard constraints remain authoritative; learned profiles are content
evidence and must not silently rewrite policy or source metadata.

This component trains a small local statistical profile, not the language
model's weights. Each run discovers the current active libraries, rebuilds
profiles from current inventory, and compares the same metadata pattern across
competing libraries. It requires no labels or policy acknowledgement from users.

## Algorithm and lifecycle

Train on distinct description groups, excluding the entire held-out cohort and
copies before learning. A shared item contributes fractional membership across
its libraries, not independent duplicate votes. Conflicting metadata for a
description contributes no features. Keep movie and TV profiles separate.

Learn per-library genre, studio, and audience-rating frequencies plus the
same-media background frequencies. At query time compare each observed feature's
smoothed prevalence inside the library versus outside it. Average within fields;
downweight sparse profiles and rare features. Missing query fields or globally
unseen values are neutral. Negative evidence affects similarity, not eligibility.
Ratings describe audience fit, never genre or policy authority.

For an observed term, use `(count + 1) / (field observations + 2)` inside and
outside each library, then take the log ratio. Multiply by `global term count /
(global term count + 3)` and `library field observations / (observations + 20)`.
Average known terms within fields and usable fields equally. Universally observed
traits are neutral even when library sizes differ. These are fixed experimental
smoothing choices, not calibrated probabilities or learned user constraints.

Fuse positive profile rankings with synopsis rankings using the existing RRF
approach. Generic traits common to every library should have little contrastive
value. Library names are not features in the learned ranker. The existing AI
comparison still sees names; renaming invariance is claimed only for profiling
and candidate ranking, not for that downstream model.

Profiles are reconstructed in memory from every frozen snapshot, so deleted,
edited, or moved inventory is reflected on the next run. No stale profile table
or migration is needed. Production event-driven refresh and model promotion are
not part of this first benchmark consumer.

## Evaluation, security, and limitations

Training is bounded to 50,000 identity documents, 64 libraries, and 250,000
stored feature counters. Source metadata uses the existing bounded normalizer.
An exceeded budget aborts the run rather than silently dropping feature data.

The benchmark offers an explicit learned-profile mode, separate from pairwise
metadata matching. Model prompts, example budgets, saved local provider, and
output validation remain unchanged. Keep private profile features out of JSON
reports and bind observations and algorithm version into snapshot fingerprints.
Report coverage, training counts, and both recovered and newly missed candidates.

Measure the old 100-title regression cohort and a separately seeded 100-title
cohort without tuning to individual titles. Existing placements are weak labels;
inventory agreement is not accuracy. Profiles may learn existing mistakes or
biases. These limits motivate independent feedback and drift checks, not manual
declaration as a prerequisite for learning. No automatic metadata correction,
route, policy change, external provider, or new user-facing setting is introduced.

## Alternatives and recommendation stack

| Option | Benefit | Limitation | Decision |
| --- | --- | --- | --- |
| Manual purpose declaration first | Explicit preferences | Adds user work and blocks organic discovery | Not a prerequisite |
| Pairwise metadata similarity | Simple matching | Generic overlap can dominate | Retain comparison baseline |
| Contrastive learned library profiles | Learns what distinguishes arbitrary libraries | Observational bias and sparse data | Implement and evaluate |
| Fine-tune the language model now | Could adapt model behavior | Needs reliable labels, compute and model lifecycle | Defer |

Stack: current inventory → held-out local profile learning → synopsis/profile
comparison → regression and drift evaluation → automatic refresh/live integration
when supported by evidence. Explicit constraints remain separate throughout.

## Official sources and date boundary

Sources discovered through search September 12, 2026 are living documents, not
certified archived August 2026 snapshots.

- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls.html)
  supports fitting preprocessing and learned features only on training data.
- [Elastic reciprocal rank fusion](https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion)
  describes combining rankings with different relevance scales. No Elasticsearch
  dependency is added and no improvement is presumed from that documentation.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports maintaining provenance, bounded retrieval, and output enforcement.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  cautions against unnecessary interruptions. No additional UI is required here.
