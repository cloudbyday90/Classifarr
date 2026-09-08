# Held-out Semantic Lifecycle Re-audit Cadence Outcome

Status: implemented on 2026-09-08. See the separate
[design](held-out-semantic-lifecycle-reaudit-cadence-design.md) for research,
alternatives, and the recommendation stack.

## Outcome

Classifarr now rechecks the count-only lifecycle source every five minutes,
instead of every fifteen. This shortens the normal wait after ordinary authoring
commits qualified provenance, without adding an operator task or running
private study work inside the authoring transaction.

The existing gate remains authoritative: a missing lifecycle receipt stops
before the policy-evidence read; incomplete declared-purpose evidence stops
before candidate retrieval; unchanged successful sources remain quiet; and a
failed audit retains its three-attempt limit. The delayed startup check,
in-process no-overlap option, and database advisory lock are unchanged.

## Validation

The scheduler test verifies the five-minute cron schedule, no-overlap option,
advisory lock delegation, and delayed startup invocation. Existing re-audit
service tests cover the source-change requirement, incomplete-source stop,
unchanged-success stop, and bounded failed-audit retry behavior.

## Next item

Passively wait for ordinary native authoring to create a current lifecycle
receipt and complete declared-purpose evidence for the same active policy. The
automatic gate will then evaluate the existing private eligibility audit at its
next five-minute scheduled check, subject to its existing no-overlap and
advisory-lock controls. Only if it supports one balanced real 24–32-case cohort
should the platform obtain independent labels and run readiness plus frozen-study
preflight. Semantic counter-evidence remains conditional on good measured error
and can only refer ambiguity to review.
