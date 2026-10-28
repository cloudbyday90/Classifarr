# Authorized outcome evaluation design

Date: 2026-10-27. Status: investigation complete; historical evidence and event
eligibility decisions are awaiting the repository grill-me planning agreement.
The previous [classification outcome](purpose-authority-consistency-outcome.md)
identified this as the next measurement refactor.

## Established gap

Authorized source-event receipts are compact replay guards. They preserve the
classification/destination/source event and authorization result, but not frozen
typed identity, original classifier decision or confirmation/change action.
A command fingerprint cannot reconstruct those missing values. The previous
read-only installation audit found eleven such receipts and zero legacy feedback
or correction labels. These counts describe that snapshot, not current accuracy.

`inventoryOutcomeLabels.mjs` and `destinationOutcomeEvaluationRepository.mjs`
do not read these receipts. Adding a join to current history would substitute
mutable state for event-time evidence. Manual corrections already create both
an authorized receipt and a durable correction snapshot, so a naive union would
also duplicate coverage and consume row budgets twice.

## Recommended first boundary

Capture a small, versioned evaluation snapshot when a new authorized operator
outcome commits. Bind it to the immutable receipt and server-owned locked state:
typed identity, selected destination, observation time, explicit action kind and
validated original decision context where available. Exclude titles, free text,
actors, credentials and metadata from the retained projection.

Use a separate evidence table so the existing 30-day evaluation retention can
expire evidence without changing append-only receipt guards. Exact source-event
replay must not create or refresh a snapshot. No retrospective reconstruction
from current history; historical receipts without trustworthy frozen evidence
remain visible as missing evidence rather than evaluation labels.

Normalize receipt/snapshot bindings once in modular services. Deduplicate
overlapping manual-correction events before combined row caps. Adapt the result
into the two existing intake seams: identity-based inventory labels and frozen
original-decision outcomes. Preserve typed movie/TV identity, source-only identity
limits, repeatable read-only report snapshots, temporal screening, grouped
holdouts, label-free worker inputs and source-fingerprint drift detection.

Keep confirmation and destination-change cohorts separate. Authorization to
record a specific outcome must not require authorization to generalize learning.
Retain every contradictory observation needed for conflict rejection; do not
filter a contradictory unavailable target into an apparently correct label.
No new route, learning, policy, semantic-ranking or public accuracy authority is
created. Feedback dashboard denominators and independent reference cohorts stay
separate; prospective inventory and mutable semantic calibration readers are
follow-up seams.

## Research and alternatives

Official sources were discovered and retrieved through connected search/GitHub
MCP services on 2026-10-27. The following are engineering applications of that
guidance, not compliance certifications.

- [W3C PROV-O](https://www.w3.org/TR/prov-o/) distinguishes evidence entities,
  activities and derivation. Bind derived evaluation to the actual authorized
  event rather than a later state that happens to have the same classification ID.
- [PostgreSQL repeatable-read semantics](https://www.postgresql.org/docs/18/transaction-iso.html)
  provide a consistent report snapshot. Preserve caller-owned atomic write
  transactions and bounded read-only evaluation transactions.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  supports minimizing sensitive retained/output data. Private pseudonymous
  identity keys are not anonymous public evidence.
- [scikit-learn leakage guidance](https://scikit-learn.org/stable/common_pitfalls)
  motivates retaining grouped holdouts and label-free scoring inputs. The
  implementation remains ESM JavaScript with no new model framework dependency.

| Option | Benefit | Cost / risk | Recommendation |
| --- | --- | --- | --- |
| Prospective event-bound snapshots | Trustworthy identity/action provenance | Older receipts remain unevaluable | Implement after scope agreement |
| Join historical receipts to current history | Immediate apparent label coverage | Mutable identity/action reconstruction and leakage | Reject |
| Put expiring payload on receipt | Fewer tables | Requires weakening immutable replay guard | Reject |
| Treat every receipt as an independent correction | More apparent labels | Duplicates, suggestion bias and wrong denominator | Reject |
| Generalize learning from new quality labels | Potential ranking changes | Confuses measurement with consent and authority | Exclude |

Recommended stack: atomic bounded capture, strict private projection, event
deduplication, existing conflict/holdout reducers, aggregate provenance and gap
counts. Existing one-item routing consent remains unchanged.

## Verification plan

Use synthetic disposable PostgreSQL fixtures for atomic capture/rollback,
source-event replay, expiry, history deletion, destination removal, inactive and
wrong-type targets, typed identity and original decision drift. Extend existing
reader tests for cross-source deduplication, conflicts independent of row order,
combined caps, distinct confirmation/change cohorts and outcome-only decisions.
Verify fingerprints change with evidence, labels remain outside scoring inputs,
and correction coverage cannot become independent accuracy evidence. Follow with
server lint, types, applicable integration/coverage checks and redacted staged
secret checks. No live writes, provider calls, release or deployment are planned.
