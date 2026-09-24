# Operator-corrected policy replay — design

## Purpose and boundary

The mixed-library upgrade canary verifies backfill and profile mechanics, not
classification quality. Classifarr already has explicit operator corrections
and a private fresh-policy replay, but the replay samples inventory placements
and reports placement agreement instead of correction outcomes. This change
joins those paths for an opt-in, read-only diagnostic. It does **not** claim to
be the complete live classifier or a comparison to a prior release.

Run `node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs
--size=100 --folds=3` from the repository root for a no-generation preflight.
Use the direct Node entry point when passing options: npm 12 can reject
forwarded unknown flags before the script runs. `--generate-cases=N` explicitly
enables up to `N` local Ollama adjudication calls; the default is zero. The
same bounded seed, case, fold, context and time validation as the existing
description benchmark applies. The command prints only aggregate JSON and a
generic error if it cannot complete.

## Design decisions

1. Capture active policies, inventory/description vectors, and the existing
   explicit-feedback/correction query in **one** PostgreSQL repeatable-read,
   read-only transaction. Fingerprint correction rows with the snapshot so a
   changed label invalidates the evaluation. The dedicated process also sets
   read-only defaults and suppresses content/file logging before loading
   application modules.
2. Use only non-conflicting typed movie/TV corrections with valid active
   destinations and eligible inventory descriptions. A correction may precede
   the corresponding media move; inventory membership is not treated as the
   label. The query fetches no title, reason or free-text feedback.
3. Select correction cases from the full inventory corpus, but keep the full
   corpus available for fold-local training. Hold out **every** copy of each
   selected description hash, including copies under other typed identities.
   No feedback rows are passed to policy evaluation, retrieval or prompt
   preparation.
4. Reuse the production policy scorer, decision projection, bounded shortlist
   and local adjudication reducer. As in the existing safe replay, disable
   history and learned patterns and remove inferred-profile policy rules;
   direct source assignment, exact inventory identity, historical RAG and
   other live side effects remain unavailable. No routing, receipt, question,
   learning write, or provider fallback is allowed.
5. Report aggregate movie and TV policy-leader agreement, hypothetical
   auto-decision agreement, AI proposal agreement, abstentions, failed calls,
   and paired changes. The paired baseline is the *same run's deterministic
   policy leader*, not a prior-release artifact. Keep `accuracy: null`,
   `fullPipelineAccuracy: null`, and promotion disabled. Do not reuse the
   inventory-placement proxy fields or per-library small-cell summaries in
   this correction report.

## Alternatives and tradeoffs

| Option | Benefit | Limitation |
| --- | --- | --- |
| Treat current library placement as truth | Large automatic sample | Placements can be duplicates, stale, or wrong; not an independent label. |
| Call the live classification endpoint for corrected cases | Exercises more of production | May create receipts, provider calls, route decisions, or learning side effects; can leak corrected identities into the result. |
| Correction-only fresh-policy replay (selected) | Existing operator evidence, no re-labeling, fold-local training, bounded read-only path | Omits live history/source shortcuts; corrections may be suggestion-biased and current policy intent may already reflect prior feedback. |
| Full isolated prior-release versus current paired replay | Stronger before/after evidence | Needs a frozen baseline artifact, two isolated runtimes, policy provenance screening, and an adequately sized independent cohort. |

## Recommended stack and next gate

Keep this sequence: immutable read-only snapshot → conflict-checked operator
corrections → grouped identity/description holdout → safe policy/AI replay →
aggregate movie/TV comparison → explicit `not full pipeline` and `no
promotion` flags. Then build a release-paired evaluator using a frozen
prior-release runtime and a provenance-screened correction set. A future
automatic-routing change should additionally require blinded, representative
labels that were not used to author or learn policy, with errors and
abstentions measured separately.

## Official sources checked in September 2026

- [NIST AI RMF Measure](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented test sets, metrics, limitations and conditions similar
  to deployment. This motivates a report that does not relabel a partial
  replay as full-pipeline accuracy.
- [scikit-learn grouped cross-validation](https://scikit-learn.org/stable/modules/cross_validation.html#cross-validation-iterators-for-grouped-data)
  requires related samples to remain on one side of a training/test split.
  Our description-hash grouping implements the same separation principle,
  not scikit-learn itself.
- [PostgreSQL 18 client transaction defaults](https://www.postgresql.org/docs/18/runtime-config-client.html)
  documents read-only transactions; the snapshot adds repeatable-read
  isolation and tight statement/lock/idle timeouts.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages/)
  concerns browser status updates. This change adds no UI; any future Command
  Center presentation should be concise, programmatically announced and
  non-interruptive, with diagnostic details on demand.
