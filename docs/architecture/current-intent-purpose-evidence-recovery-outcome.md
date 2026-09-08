# Current-Intent Purpose Evidence Recovery Outcome

Status: implemented on 2026-09-08. See the separate
[design](current-intent-purpose-evidence-recovery-design.md) for the research,
alternatives, and recommendation stack.

## Outcome

The aggregate policy-purpose inventory now accepts a current explicit native
purpose declaration when its durable normal lifecycle receipt identifies the
same current intent. An older profile-derived receipt remains excluded from
purpose authority but no longer permanently makes that policy ineligible.

The server reports a bounded
`currentIntentRetainedPurposeLifecycleReceiptPolicyCount`; the client validates
and presents the same aggregate-only count. The policy-purpose review is
`policy_purpose_coverage_review.v12`; the inventory is version 3; and the
lifecycle re-audit purpose adapter and source are version 3. The source-version
change produces a new aggregate fingerprint, so the existing passive scheduler
can re-evaluate actual qualifying evidence without an operator-triggered audit.

## Boundaries preserved

This is a recovery of passive evidence availability, not semantic correctness.
It does not infer purpose from a library or configuration, expose policy or
library detail, capture a cohort, collect labels, run readiness or frozen-study
preflight, retrieve semantic evidence, call a provider, change a policy, or
route a media item.

The regression test creates a profile-derived initial intent, records its
ordinary initial lifecycle receipt, applies an explicit native purpose change,
and verifies that only the bounded aggregate current-evidence counts increase.
It also verifies that configured purpose terms remain absent from the public
review response.

## Validation

Focused backend contract and service tests cover the new bound, malformed input,
readiness projection, source version, and unchanged authority limits. The
PostgreSQL integration test covers the historical profile-derived receipt and
ordinary native declaration recovery path. Broader test, quality, security, and
container checks are recorded with the implementation commit.

## Next item

Keep the passive scheduler observing durable current-intent evidence. If the
private eligibility audit subsequently finds enough balanced eligible cases,
run one real independently labelled 24–32-case cohort and the existing
readiness and frozen-study preflight. Only a good measured error profile can
justify a later review-only semantic counter-evidence experiment.
