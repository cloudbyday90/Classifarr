# Selective neighbor fallback: design

## Decision and reconciliation

On 13 September 2026, retain the strict learned-evidence review resolver as the
live default. Commit `8ed6c4cf` made cross-fitted calibration available for all
300 regression cases, but replacing strict support lost 76 cases while gaining
27. Evaluate only those newly supported description proposals with fresh local
AI and fold-local metadata. Do not select cases using their observed placement.

The experiment extends the existing fresh-policy evaluator with an explicit
`--neighbor-fallback` option. It preserves production parsing, candidate policy
constraints, local provider admission, grouped training, model identity checks,
snapshot verification, resource bounds and aggregate-only reporting. No new
database, endpoint, dependency, scheduler, acknowledgement or UI is needed.

## Fixed protocol before measurement

1. Reuse the 300-item, five-fold regression sample and seed
   `classifarr-profile-20260912`, covering movie and TV libraries.
2. Reuse the original full-corpus description proposal and shared-description
   veto. Cross-fit only the existing training fold; exclude the scored group
   before limiting references. Select a case only if strict support is absent
   and calibration supports that same unique proposal.
3. Prepare fresh policies and full-pool learned metadata using existing readers.
   Generate only for selected, adjudication-ready cases, within the explicit
   generation-case cap. One response feeds both review assessments.
4. Preserve every strict review success. Only a `neighbors_disagree` result may
   try the fallback. Require AI agreement with the preselected description
   proposal, complete matching candidate scope, available calibration and the
   original positive, uniquely leading learned-metadata fit.
5. Report proposal changes, remaining blockers and familiarity separately. A
   successful review assessment is not a route: the independent familiarity
   check and unchanged live identity, operator preference and receipt checks
   still matter. Frozen-snapshot freshness is reported, never inferred.

The experiment has no routing capability. Administrative confirmation settings
are not changed or assumed satisfied by this offline evaluator. Existing
placements are weak labels, not correctness judgments. This is a reused regression
cohort, not an untouched final test set. Exact normalized-description grouping
does not establish paraphrase or near-duplicate independence.

## Official research checked September 2026

URLs were discovered with search and read before implementation:

- [scikit-learn: common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html)
  explains train/test leakage, including preprocessing and feature selection.
  Learn metadata and neighbor distributions inside each training fold; keep
  placement labels out of proposal selection and inference.
- [OWASP: RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  recommends bounded context, validated outputs, policy enforcement, scoped
  caches and fail-closed behavior. Retrieved content and AI responses remain
  evidence, not executable instructions or routing authority.
- [W3C: status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains accessible status updates and warns against overly chatty feedback.
  Keep this measurement out of the operator interface; a future integration
  should reuse concise status presentation rather than add acknowledgement cards.

These sources support engineering controls, not this calibration's statistical
accuracy or a guarantee that it will reduce real reviews.

## Alternatives and recommendation stack

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Keep strict-only | No behavior or compute change | Leaves the measured overlap cases unresolved |
| Replace strict with calibration | Single neighbor rule | Discards 76 previously supported proposals in the prior cohort |
| Selective calibrated fallback | Preserves strict successes; spends inference on potential gains | Requires joint AI/metadata/familiarity evaluation; may yield no qualified gain |
| Relax metadata or safety requirements | More apparent resolutions | Can hide contradictory evidence; rejected |

Recommended stack: PostgreSQL/pgvector and pinned local embeddings, existing
strict matching first, snapshot-scoped cross-fit fallback second, then unchanged
AI, metadata, familiarity and fresh live authorization. Add no new singleton or
provider. Reuse existing ESM evaluation services and extract shared predicates
instead of duplicating the production review rule.

## Verification and outcome

Test strict parity, fallback scope and candidate binding, every retained veto,
metadata disagreement, missing calibration, bounded target selection, cancellation,
source/model drift, redaction and zero routing authority. Run the same local
Compose cohort with no concurrent heavy test/build load. Record actual calls and
remaining blockers in the separate
[outcome document](selective-neighbor-fallback-outcome.md).
