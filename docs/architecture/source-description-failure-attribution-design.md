# Paired retrieval failure attribution: design

Status: Unreleased, September 24, 2026. Results belong in the separate
[outcome document](source-description-failure-attribution-outcome.md).

## Problem and decision

The previous increment completed saved batch monitoring. Return to the existing
300-case movie/TV comparison rather than adding another dashboard or permission
gate. Inspection of the local installation found zero correction events, zero
eligible feedback labels, and no deployed correction-outcome table. Those facts
prevent a correction-quality benchmark; observed placement is not ground truth.

The paired evaluator currently counts misses but does not distinguish an empty
training set, missing destination evidence, retrieval misses, or subsequent
shortlist/ranking changes. Add aggregate attribution to the existing evaluation
path so the next ranking change can target measured failures. Do not change the
scorer, training, sample selection, routing thresholds, or automatic authority.

## Measurement contract

Extract the existing metric accumulator into a small ESM service. Project only
candidate IDs and evidence availability from the already-computed, label-blind
scorer. Apply correction labels afterward. For each arm, partition the labeled
cases into exactly one outcome, in this order:

| Outcome | Observation |
| --- | --- |
| Leading match | The evidence-backed leading proposal matches the correction |
| No training evidence | No candidate has eligible training descriptions |
| Destination without training evidence | Other evidence exists, but none for the corrected destination |
| Anchor shortlist displacement | The destination was in the profile shortlist, but not the final shortlist |
| Profile shortlist displacement | It was in the description shortlist, but neither the profile nor final shortlist |
| Retrieval shortlist miss | It has training evidence, but is in none of the three shortlists |
| Shortlisted, not leading | It remains in the final shortlist, but another candidate leads |

Description-only, profile-fused, and anchor-preserved shortlists have at most
three candidates. Candidates without training evidence never count as hits.
Presentation rotation is not ranking: use the scorer's ordered candidates, not
the prompt's rotated order, to identify the leader. A proposal must belong to the
final evidence-backed shortlist; do not report an unshortlisted candidate as a
leading match. The categories describe observed divergence points, **not causal
proof**, executed routing errors, or independent accuracy.

Preserve existing paired gains/regressions and metrics. Add the same breakdown to
overall, movie/TV, source-only/TMDB-linked, and observed-library strata. Library
strata remain nonexclusive. Report `qualityStatus` separately from execution
status: `not_evaluated`, `no_correction_labels`, or `correction_cohort_measured`.
Use report version `source_description_pair_v2`. A complete unlabeled comparison
is coverage evidence, not a quality pass. Missing cache still withholds metrics;
zero quality denominators still produce null rates.

## Security and operational boundary

Keep the existing read-only repeatable snapshot, model-fingerprinted cache,
transitive identity/description holdouts, bounds, and music/conflict exclusions.
No new dependencies, schema, API, UI, logging of case content, provider calls, or
stored reports. Public documentation contains aggregates, not titles, source
identifiers, descriptions, actors, or credentials. Evaluation performs no model
generation or embedding and does not initiate backfill.

The user separately requested a local Compose no-cache rebuild after testing.
Retain the old image and a private database backup, build the tested committed
checkout, recreate the service with the existing mounts/configuration, and check
health. Ordinary startup migrations and background jobs may run. Do not create a
release, change routing settings, or delete persistent volumes. Rerun the existing
read-only evaluation after startup; do not manufacture correction outcomes.

## Official research and alternatives

Official sources discovered and checked online on September 24, 2026:

- [NIST AI RMF: validity and reliability](https://airc.nist.gov/airmf-resources/airmf/3-sec-characteristics/)
  supports realistic test populations, documented methodology, and disaggregated
  results. Separate correction-cohort evidence from general accuracy claims.
- [scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html)
  explains keeping related observations out of opposing training/test sets.
  Preserve the existing grouped holdouts; no Python dependency is introduced.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  recommends documenting provenance and data quality. Version the measurement
  contract and expose missing-label limitations. This is not a new UI or a claim
  of WCAG certification.
- [Docker Compose build](https://docs.docker.com/reference/cli/docker/compose/build/)
  defines `--no-cache`; [Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
  describes service recreation while preserving mounted volumes and health waits.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Attribute existing paired results | Cheap, deterministic, identifies the failing stage | Needs genuine labels; not causal proof | Implement |
| Tune ranking against current placement | Large apparent sample | Circular labels can reinforce mistakes | Reject |
| Add an LLM judge or new reranker now | More modeling options | Cost, privacy, and no measured failure to target yet | Defer |
| Add another readiness screen | Visible status | More user involvement without better ranking | Reject |

Recommendation stack: existing automatic outcome capture and description backfill
→ same-snapshot grouped evaluation → largest measured failure category → one
targeted scorer change → paired regression check. No automatic promotion or
confidence inflation follows from this report.
