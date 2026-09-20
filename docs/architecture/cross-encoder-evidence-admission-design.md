# Cross-encoder evidence admission design

Date: 2026-09-20. Scope: the existing read-only inventory evaluation, not live
routing. The [outcome](cross-encoder-evidence-admission-outcome.md) records results.

## Root cause and decision

The previous 20-item smoke reported two `evidence_unavailable` exclusions. A
read-only reproduction with the same seed and sample fingerprint found one movie
and one TV case. Both had metadata and five ranked policies, but their policy
action was `auto_classify`. The authoritative adjudication pool intentionally
returned no candidates: this comparison path evaluates reviewable decisions.

The scorer's blanket validation catch converted that intentional boundary into
an apparent data failure. Backfilling those two cases cannot fix the diagnosis.
The existing policy decision is not proof of correctness; it simply explains why
this particular experiment did not compare the case. No media was routed by it.

## Implementation

Reuse `buildPolicyCandidateAdjudicationContract` before preparing a scorer plan.
A small ESM admission module distinguishes policy exclusions from evidence
failures, and a bounded collector publishes fixed codes and movie/TV/unknown
counts. It does not retain titles, identities, library names, descriptions,
provider errors or source records.

The shared semantic validator retains its validation conditions, normalization,
plan representation and fingerprints. Typed errors add fixed reasons while
preserving its established broad error messages. When multiple checks fail, the
first applicable reason is reported; diagnostics are not an exhaustive audit.
The cross-encoder's two-example minimum remains distinct from the semantic
validator's one-example minimum. Unknown validation failures fail closed with a
generic code, never an exception body.

`crossEncoderComparison.excluded` now uses specific reason keys instead of the
blanket `evidence_unavailable`. `exclusionDiagnostics` adds count, category,
`nextStep` and media breakdown for each observed reason. Existing totals,
selection budgets, placement metrics and scoring behavior are unchanged. There
is no REST/UI contract change or new configuration.

## Recovery boundary

| Diagnosis | Disposition | Why |
| --- | --- | --- |
| Automatic policy decision | `not_needed` | Not admitted to this comparison; not a data repair request |
| Other non-reviewable or insufficient policy scope | `inspect_policy_scope` | Do not invent additional destinations |
| Missing metadata/description, retrieval unavailable, incomplete index coverage | `check_existing_readiness` | A symptom alone cannot establish scheduler eligibility |
| Missing or fewer than two eligible examples | `check_fold_eligibility` | Holdout/provenance exclusions can legitimately remove examples |
| Shared, duplicate or query-copy examples | `preserve_exclusion` | Repair must not bypass leakage controls |
| Invalid snapshot, scope, counts or evidence contract | `inspect_contract` | Do not disguise a programming/integrity error as a data gap |
| Retention budget | `reduce_run_size` | More metadata cannot fix resource limits |

These are diagnostic dispositions, **not scheduled recovery states**. There is no
new queue, automatic retry, database write or promise that a backfill will help.
For a demonstrated live observation gap, reuse `inventoryObservationReadiness`,
`inventoryGroupReadiness` and `inventoryNeighborhoodRecovery`: they already fence
identity/description changes and prioritize eligible work in the existing queue.
Unknown readiness is not permission to enqueue, and no benchmark may enqueue
repairs or reinsert held-out/retained-decision examples into training.

## Official research, accessed September 20, 2026

URLs were discovered through search/navigation and opened, not synthesized.
These are current mutable documents, not archived September snapshots.

- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  supports provenance checks, bounded evidence and stage-specific failure handling.
  Application: keep validation authoritative and diagnostic output content-free;
  do not expand retrieval scope as a repair.
- [scikit-learn common pitfalls](https://scikit-learn.org/dev/common_pitfalls.html)
  explains why training/test separation must precede learned preprocessing. This
  is the official development documentation, not a new project dependency.
  Application: distinguish intentionally excluded examples from missing data.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  describes programmatically exposed feedback without moving focus. Application:
  retain concise status semantics for any future UI consumer, not another modal
  or acknowledgement. This backend-only change makes no UI conformance claim.

## Alternatives and recommendation stack

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Retry/backfill every excluded item | Simple apparent automation | Misdiagnoses policy exclusions and risks loops; reject |
| Bypass admission or weaken example guards | More cases reach inference | Changes the experiment and admits unsafe evidence; reject |
| Typed reasons plus existing policy admission | Explains the cause with no model or write cost | More report codes for consumers; selected |
| Build another recovery service or UI | New controls | Duplicates existing machinery and adds user work; reject |

Final stack: validated sync and organic enrichment → existing eligibility-aware
recovery → provenance-clean fold evidence → policy admission → typed evidence
diagnosis → optional isolated scoring. Keep current routing authority unchanged.
