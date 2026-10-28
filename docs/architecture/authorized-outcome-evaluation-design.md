# Authorized outcome evaluation design

Date: 2026-10-28. Status: scope agreed through the repository grill-me workflow;
implemented with prospective snapshots and explicit historical gaps.
The previous [classification outcome](purpose-authority-consistency-outcome.md)
identified this as the next measurement refactor.

## Established gap

Authorized source-event receipts are compact replay guards. They preserve the
classification/destination/source event and authorization result, but not frozen
typed identity, original classifier decision or confirmation/change action.
A command fingerprint cannot reconstruct those missing values. The previous
read-only installation audit found eleven such receipts and zero legacy feedback
or correction labels. These counts describe that snapshot, not current accuracy.

Previously, `inventoryOutcomeLabels.mjs` and
`destinationOutcomeEvaluationRepository.mjs` did not read these receipts.
Adding a join to current history would substitute
mutable state for event-time evidence. Manual corrections already create both
an authorized receipt and a durable correction snapshot, so a naive union would
also duplicate coverage and consume row budgets twice.

## Agreed boundary

Capture a small, versioned evaluation snapshot when a new authorized operator
outcome commits. Bind it to the immutable receipt and server-owned locked state:
typed identity, selected destination, observation time, explicit action kind and
validated original decision context where available. Exclude titles, free text,
actors, credentials and metadata from the retained projection.

The approved event population is successful explicit destination confirmations
and changes, reported as separate cohorts. Manual `outcome_only` decisions are
eligible without granting learning authority. Automatic, failed and unresolved
outcomes are excluded. Existing runtime receipt producers retain their learning
admission requirements; this change does not add another receipt producer.

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

## Implemented components

- `authorizedOutcomeEvaluationCapture.mjs` captures in the existing receipt/effect
  transaction, after admission and effects. Manual action proof checks the exact
  correction event, destination and authorized actor; runtime proof checks the
  validated resolution and fingerprint. Capture failures roll back the command.
- `classificationOutcomeIdentity.mjs` shares the existing correction identity
  rules. A source-only identity requires the exact locked inventory pointer and
  consistent type/title/year; title matching cannot manufacture identity or
  transfer an observation to a later TMDb identity.
- `runtimeOutcomeEvaluationTime.mjs` stamps new resolutions with PostgreSQL's
  transaction clock in server-owned `evaluation_observed_at`. Replays do not
  refresh it. Later tier aliases retain that time; missing, future or expired
  timestamps yield a gap while existing learning behavior continues. Neither
  mutable history timestamps nor host-clock fallback can refresh old evidence.
- `authorizedOutcomeEvaluationQuery.mjs` supplies one shared read-only projection,
  verifies receipt/event/destination/time bindings and performs canonical event
  deduplication before intake caps. Equivalent runtime tier aliases count once;
  conflicting representations remain available for conflict rejection.
- `authorizedOutcomeEvaluationSnapshot.mjs` validates the private versioned row
  contract and normalizes aliases. Both intake seams use it. Original decision
  context is independently bound to typed identity; changing the current history
  method does not erase a valid frozen original decision.

The new migration creates `policy_authorized_outcome_evaluation_snapshots` with
an update-rejecting trigger, strict bounded fields, receipt/destination deletion
cascades and indexes for expiry, event lookup and the eligible receipt window.
There is no classification-history foreign key. Snapshot deletion/pruning leaves
immutable replay guards intact, and replay cannot recreate deleted evidence.
The existing maintenance pass prunes at most 1,000 expired snapshots per run;
read-time expiry applies even if maintenance is delayed. Portable backup content
is unchanged; replace-restore clears local receipts and cascades local snapshots.

Shared inventory labels retain unavailable-target contradictions until grouping
rejects conflicts. Missing snapshots consume the processing budget but cannot
become labels or eligible observations. Reports add aggregate missing-snapshot,
confirmation and correction counts. Saved-decision reports also retain separate
per-decision agreement summaries and media breakdowns for each authorized action
kind, after all-source conflict checks. Decisions containing both kinds are
counted separately and excluded from both action-specific rates. Confirmations
carry an explicit suggestion-bias limitation; agreement is not independent truth.
Saved-decision report fingerprints include
the computation revision, so incompatible stored results are recomputed. Public
source-pair projections and label-free scoring inputs retain their contracts.

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
| Prospective event-bound snapshots | Trustworthy identity/action provenance | Older receipts remain unevaluable | Implemented |
| Join historical receipts to current history | Immediate apparent label coverage | Mutable identity/action reconstruction and leakage | Reject |
| Put expiring payload on receipt | Fewer tables | Requires weakening immutable replay guard | Reject |
| Treat every receipt as an independent correction | More apparent labels | Duplicates, suggestion bias and wrong denominator | Reject |
| Generalize learning from new quality labels | Potential ranking changes | Confuses measurement with consent and authority | Exclude |

Recommended stack: atomic bounded capture, strict private projection, event
deduplication, existing conflict/holdout reducers, aggregate provenance and gap
counts. Existing one-item routing consent remains unchanged.

## Verification

Synthetic disposable PostgreSQL fixtures cover atomic capture/rollback,
source-event replay, expiry, history deletion, destination removal, inactive and
wrong-type targets, typed identity and original decision drift. Extended existing
reader tests cover cross-source deduplication, conflicts independent of row order,
combined caps, distinct confirmation/change cohorts and outcome-only decisions.
They verify fingerprints change with evidence, labels remain outside scoring
inputs, and correction coverage cannot become independent accuracy evidence. The
[outcome](authorized-outcome-evaluation-outcome.md) records executed checks and
limits. No live writes, provider calls, release or deployment are included.
