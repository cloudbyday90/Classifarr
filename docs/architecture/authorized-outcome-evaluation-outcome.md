# Authorized outcome evaluation investigation outcome

Date: 2026-10-27. Status: design researched; runtime implementation is pending
the [design's](authorized-outcome-evaluation-design.md) grill-me scope agreement.
No authorized-outcome capture, schema or evaluation behavior has changed.

## Findings

Two independent read-only source investigations and parent inspection agree:

- `policy_authorized_outcome_source_event_receipts` is an immutable idempotency
  boundary, not a frozen evaluation record. It lacks readable typed identity,
  original decision context and confirmation/change action provenance.
- The `operator_confirmation` source is used by both confirmation and destination
  change actions. Source name, learning tier and `ready` status cannot establish
  correction kind or classifier correctness.
- Manual corrections already create both durable correction snapshots and an
  authorized receipt for `classification_correction:<id>`. Deduplicate the event
  before row caps and coverage counts; later map grouping alone is insufficient.
- The shared inventory label intake reaches grouped calibration, source-pair and
  fresh/frozen policy evaluators. The saved-decision intake separately reaches
  original-decision agreement reporting. Those are the first two integration seams.
- Feedback dashboard statistics, independent reference cohorts, prospective
  inventory evaluation and mutable semantic calibration have different evidence
  populations. They require separate follow-up work.
- Existing readers differ on unavailable-target handling. Retain contradictions
  long enough to reject conflicts; a filtered invalid target must not improve a
  surviving label's apparent agreement.

The previous private installation snapshot contained eleven authorized receipts
and zero correction/feedback labels. This investigation made no new production
query and does not claim those counts are current. No private title, snapshot,
actor, metadata or credential is included in these documents.

## Recommended first implementation

Create prospective, atomic, minimal evaluation snapshots tied to the immutable
source-event receipt. Keep existing thirty-day evidence retention independent
from permanent replay guards. Preserve replay/rollback semantics, typed identity,
strict context validation, source fingerprints, conflict exclusion and grouped
holdouts. Use normalized event provenance once across the two intake seams.
Older receipts without trustworthy event-time evidence remain missing evidence.

The pending planning questions are whether to accept that historical exclusion,
and whether the first event cohort includes explicit confirmations separately
from destination changes, including outcome-only authorizations and excluding
automatic/failed/unresolved outcomes. No unanswered choice is treated as approval.

The [random PR outcome](actions-pr569-outcome.md) records the independent CI
maintenance completed while those decisions remain pending. No classifier
accuracy improvement, learning change or routing correction is claimed.
