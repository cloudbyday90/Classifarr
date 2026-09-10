# Automatic Private Cohort-Capture Handoff — Outcome

## Implemented outcome

Classifarr now turns the existing automatic eligibility-audit result into a compact,
aggregate-only `private_cohort_capture_ready` readiness state when a current complete audit
has the complete balanced frame needed by the existing controlled capture workflow.

The change is ESM-only and modular:

- `heldOutSemanticStudyCohortPlanner.mjs` exports the existing fixed target calculation so
  readiness and planning cannot silently diverge.
- `heldOutSemanticStudyCohortCaptureReadiness.mjs` is a new pure, side-effect-free validator.
- The measured-blocker service and closed server/browser readiness contracts project only
  the boolean state.
- The Command Center and detailed policy page explain the status in plain language without
  adding a button or crowding normal classification review.

## What it does not do

It does not automatically run a capture, retain a reviewer packet, select library items,
call a model or embedding provider, use RAG, generate labels, train/learn, tune policy, or
route content. A ready handoff is a prerequisite indicator—not a semantic evaluation result
or a routing authorization.

## Verification

Automated coverage verifies that:

- a complete, internally consistent 7-by-4 aggregate is ready;
- short, truncated, malformed, stale, inconsistent, and incomplete audit states fail closed;
- server and client projections require the readiness boolean to agree with the measured
  blocker;
- the two UI views describe the ready state and expose no action controls; and
- existing states preserve the no-identity/no-routing boundary.

Local Compose verification remains useful for checking the live status. A development
database with fewer than seven eligible cases in any stratum correctly remains in a waiting
state; it is not evidence that the new gate has failed.

## Recommendation stack

1. Keep aggregate-only automatic readiness as the default.
2. Keep private capture explicitly controlled and short-lived, producing only the existing
   redacted review artifact when the protected workflow is intentionally started.
3. Preserve independent human labels and adjudication before any semantic-quality claim.
4. Only after a protected, independently reviewed evaluation demonstrates stable benefit,
   consider a separately governed advisory AI/RAG enhancement. Never use this handoff to
   bypass deterministic routing safeguards.

## Next high-value item

Build a bounded, privacy-preserving **semantic evaluation results summary** after an
independently labeled reference set exists. It should report aggregate disagreement and
calibration outcomes by documented stratum, with confidence intervals and explicit data
coverage, while remaining advisory and incapable of changing a routing decision. This is
the first point at which the platform can measure whether metadata and RAG actually improve
placement instead of merely asserting that a study frame is available.
