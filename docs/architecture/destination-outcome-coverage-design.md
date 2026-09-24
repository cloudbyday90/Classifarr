# Confirmation retention and intake coverage: design

Status: Unreleased, September 24, 2026. Verification is recorded separately in
[the outcome document](destination-outcome-coverage-outcome.md).

## Decision

The preceding increment preserves original decisions with corrections, but a
correction-only cohort cannot describe successful decisions or label coverage.
Reuse two existing ledgers: explicit feedback source receipts and classification
intake receipts. Do not introduce a new dashboard, approval, training job or model
call. Movie/TV support is library-name agnostic; music remains outside evaluation.

Retain a bounded, versioned outcome snapshot with each new feedback receipt in
the same transaction. Derive it from the locked history row and validated selected
library, never caller-supplied scores, the current policy leader or silence. A
completed original decision matching that explicit selection is confirmation;
a different selection is disagreement. Resolving a deferred decision is not a
successful automatic classification. Preserve original missing-context status.

Add the original decision context to the existing intake upsert. Preserve it
through terminal queue updates and cleanup, but never carry one classification's
capture onto another classification ID. The receipt remains diagnostic and
best-effort; missing evidence must remain visible, not block classification.

## Measurement contract

Extend the existing private `--saved-decisions` report, versioning the contract
for mixed explicit outcomes. Read corrections, feedback snapshots and intake in
one read-only repeatable transaction. Bound the complete outcome cohort and the
intake cohort separately at 5,000 rows; overflow fails rather than publishing
partial rates. Do not require a configured AI provider or cached vectors.

Keep two measures distinct:

- Labeled-cohort agreement: original completed decisions versus genuine explicit
  selections. Include corrections and confirmations; exclude ambiguous evidence.
- Intake label coverage: unique classifier decision IDs with usable labels divided
  by unique valid classifier decision IDs in retained queue receipts. Match exact
  original captures, not just media identity. Separate absent, unusable and
  conflicting evidence. Do not divide all feedback by all queue tasks.

Show queue states and missing captures separately. Queued, failed and untyped
receipts are operational counts, not movie/TV decisions or correctness labels.
Duplicate receipts cannot increase the unique-decision denominator. Direct
non-queue decisions may appear in the outcome cohort but not the queue coverage
denominator. These are decision events, not unique media items. Both cohorts are
retention-limited; neither metric claims whole-platform or executed-route accuracy.
Each intake receipt describes its last linked classification, not every attempt
ever made by that task. Preserve its first valid capture for the same linked ID.
Queue-link reconciliation can recover a missing link, but cannot invent a missing
original capture. Such receipts stay in the missing-context count. Conflicting or
invalid captures with known lineage exclude that decision regardless of row order.

## Retention and safety

Feedback snapshots expire after 30 days, including query-time expiry. Maintenance
clears only the snapshot in bounded batches; it must preserve the original replay
tombstone and never recreate feedback after expiry/deletion. Existing intake
retention remains 30 days. No historical label reconstruction or new authority.
No actor, title, library name, prompt, provider payload or credential in snapshots
or report output. Validate exact shapes, typed identities and positive IDs.
Nullable additive columns permit old writers; update the fresh-install schema.
Feedback snapshots require a valid typed TMDB identity. Source-only outcomes remain
available through the existing source-anchored correction writer; a feedback row
without that identity does not become a synthetic confirmation. The existing public
intake read projection does not expose either new snapshot field.
The private report contract becomes `destination_outcomes.v2`; consumers must use
`labeledCohortAgreementRate` instead of the correction-only
`correctedCohortAgreementRate`. `labeledDecisionsWithoutCapturedIntake` means no
usable captured queue decision, not necessarily that the decision bypassed a queue.

## Research and alternatives

Official sources discovered and read on September 24, 2026:

- [NIST AI RMF Core](https://airc.nist.gov/airmf-resources/airmf/5-sec-core/)
  calls for documented measurement limitations and integration of operator
  feedback into evaluation. Report selection bias and unknown outcomes explicitly.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/)
  recommends provenance, data quality and version information. Preserve exact
  event linkage and version the changed measurement contract. No UI is changed;
  this is not a WCAG-conformance claim.
- [PostgreSQL 18 INSERT](https://www.postgresql.org/docs/18/sql-insert.html)
  documents conflict handling and returned inserted/updated rows. Keep feedback
  replay protection and snapshot persistence inside the existing transaction.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Extend existing receipts | Automatic, bounded, cleanup-safe; no new user steps | Prospective evidence; queue-only coverage denominator | Implement |
| Infer success from no correction | Large apparent positive cohort | Unsupported labels and misleading accuracy | Reject |
| Store raw evidence indefinitely | Rich debugging | Privacy and storage exposure; unnecessary for these metrics | Reject |
| Add a new evaluation/approval screen | Visible workflow | More operator burden without independent evidence | Reject |

Recommendation stack: original decision → explicit outcome receipt → exact intake
coverage → per-state/movie/TV failure attribution → one measured regression fix.
Do not promote policies, lower safety thresholds or replay routing from this report.
