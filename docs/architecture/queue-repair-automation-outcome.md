# Reviewed-repair automatic retry design outcome

Date: 14 October 2026. Design only; no runtime worker, schema or enrollment UI
was added for this feature. No tasks were enrolled, retried or approved.

## Decision

The [design](queue-repair-automation-design.md) separates approval of an identity
repair from permission to retry classification and potentially route media.
It specifies a second, explicit per-receipt opt-in, stored consent, cancellation,
expiry, persisted cooldowns and bounded admission checks. Existing task attempt
limits are unchanged. Restart, repeated enrollment and a different administrator
must not reset them or resurrect cancelled consent.

The first-time Ollama capability test is independent: it is a fixed diagnostic,
not consent to retry a media request. Its background scheduling changes do not
implement or enable this proposed automation.

## Recommendations and trade-offs

Retain manual retry as the fallback. Build a one-time scheduled enqueue through
the existing guarded repair retry writer, rather than a second retry engine.
This preserves source checks and original budgets, at the cost of a new durable
consent state machine and explicit stopped outcomes requiring review.

Do not automatically enroll past approvals, reset budgets, guess identities or
retry an uncertain provider mutation. Cancellation can prevent an uncommitted
enqueue; it cannot undo classification or routing already admitted.

## Next implementation and evidence

Implement the consent repository and bounded claim/cancel operations first,
then the worker and explicit UI. Prove PostgreSQL lock order, competing claims,
manual-retry and cancellation races, actor/configuration changes, expiry and
restart with original counters intact. Exercise authenticated HTTP and uncertain
responses before enabling the UI. The numeric limits in the design are proposed
application policy, not measured production performance or vendor mandates.

There is no runtime test claim for this design. Its acceptance checklist remains
open; the separate AI-readiness outcome covers only that implemented change.
