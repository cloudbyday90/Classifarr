# Held-out semantic lifecycle re-audit outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-reaudit-design.md) for the decision,
research, alternatives, and recommendation stack.

## Outcome

Classifarr now automatically checks the existing private eligibility audit when
verified ordinary policy lifecycle evidence changes. It covers initial native
intent establishment, native intent changes, and verified library rebuild
replacements through their common durable receipt source, so no library-specific
configuration or operator prompt is needed.

The new source is
`policy.held_out_semantic_study_lifecycle_reaudit_source.v1`. It contains only
the total receipt count and fixed counts by transition. The scheduler records a
SHA-256 fingerprint of that aggregate and returns exactly the existing
`policy.held_out_semantic_study_eligibility_audit.v3` receipt when an audit ran.
It returns no new item-level result.

The database state holds only the latest aggregate cursor and audit receipt. A
dedicated advisory lock prevents simultaneous service instances from running the
audit together. An unchanged complete state remains quiet; failed work retries
at most three times for the same lifecycle state.

## Boundaries preserved

The re-audit cannot capture a cohort, collect labels, invoke readiness or
frozen-study preflight, perform semantic retrieval, call an AI provider, change
policy, change configuration, expose an endpoint, or route media. It has no
library, policy, actor, rule, provider, or media identity in its source or
stored receipt.

An automatic re-audit result is measurement only. It cannot establish policy
change eligibility or semantic selection. It also cannot make an ambiguous item
eligible for automatic routing.

## Validation

Focused contract, source, persistence, re-audit service, eligibility audit,
lifecycle source, scheduler, startup, and advisory-lock tests pass: 96 tests in
9 suites. Server type checking, security lint, test lint, migration validation,
and the static ESM import check pass. Final Compose and live audit validation is
recorded with the implementation commit.

## Next item

Let the automatic count-only re-audit observe future verified lifecycle changes.
Only when its existing audit can support one complete frozen 24–32-case cohort
should the next stage obtain independent human labels and run the existing
readiness and frozen-study preflight. Good measured error remains a prerequisite
for any later semantic counter-evidence, and ambiguous items must still go only
to review.
