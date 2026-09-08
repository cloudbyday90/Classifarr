# Held-out semantic lifecycle re-audit outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-reaudit-design.md) for the decision,
research, alternatives, and recommendation stack.

## Outcome

Classifarr now automatically checks the existing private eligibility audit when
verified ordinary policy lifecycle evidence changes and at least one policy has
complete current declared-purpose evidence. It covers initial native intent
establishment, native intent changes, and verified library rebuild replacements
through their common durable receipt source, so no library-specific
configuration or operator prompt is needed.

The new source is
`policy.held_out_semantic_study_lifecycle_reaudit_source.v3`. It contains only
the total receipt count, fixed counts by transition, and the existing aggregate
count of policies with complete declared-purpose evidence. The scheduler records
a SHA-256 fingerprint of that aggregate and returns exactly the existing
`policy.held_out_semantic_study_eligibility_audit.v5` receipt when an audit ran.
It returns no new item-level result.

The database state holds a distinct latest aggregate source checkpoint and an
actual audit receipt. A dedicated advisory lock prevents simultaneous service
instances from running the audit together. An unchanged complete state remains
quiet; failed work retries at most three times for the same lifecycle state. A
normal lifecycle change with zero complete declared-purpose evidence remains
quiet after saving only its aggregate source checkpoint, so a later return to
the prior eligible state receives a new audit.

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
lifecycle source, scheduler, startup, and advisory-lock tests pass. The full
unit backend suite also passes: 1,133 suites and 32,383 tests. Server and client
type checking, security lint, test lint, documentation lint, migration
validation, the authoritative schema snapshot check, and the static ESM import
check pass.

A no-cache Compose rebuild produced a healthy service and a provenance-labelled
image. The scheduler completed its delayed automatic check. The local database
has no durable normal lifecycle receipt and the current inventory reports zero
complete declared-purpose policies, so it correctly emitted no audit receipt. A
direct private audit remained complete but
found no eligible policy-only comparison among 6,641 candidates; the frozen
28-case cohort attempt returned `insufficient_eligible_cases`. No labels,
readiness, frozen-study preflight, semantic selection, or routing ran.

## Next item

Let the automatic count-only re-audit observe future qualified aggregate
evidence. Only when its existing audit can support one complete frozen
24–32-case cohort should the next stage obtain independent human labels and run
the existing readiness and frozen-study preflight. Good measured error remains a
prerequisite for any later semantic counter-evidence, and ambiguous items must
still go only to review.
