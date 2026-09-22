# Provider-aware classification deferral

## Problem and selected design

The previous commit recovered exhausted jobs, but each item could still spend its
own retries discovering the same outage. A configured provider is not necessarily
able to generate. This change separates waiting for a dependency from attempting
an item again.

Use the existing PostgreSQL queue and generation-readiness probe. Persist a small
provider circuit, keyed by configuration revision, provider, effective endpoint
and model. Keys contain no credentials, titles or library names. Different
providers/models and changed configurations do not inherit an old outage.

1. Check the circuit at the classification AI boundary, after authority admission
   but before prompt enrichment, locks or inference. Deterministic classification
   and unrelated enrichment remain unchanged.
2. A structured transient provider failure opens the circuit. Other items wait
   with unchanged item retry counts. Unknown errors, malformed model answers,
   cancellations, missing models and authentication errors retain existing finite
   retry behavior; they do not open a shared outage from error wording alone.
3. The scheduler sends known transient pending retries through the same verified
   recovery path as exhausted jobs. Both share one durable, jittered 15-minute
   probe cooldown. No network call runs inside a database transaction.
4. Successful proof grants at most five trial calls; the 60-second admission
   window starts with the first worker claim, not queue insertion. See the
   [worker-started trial design](worker-started-recovery-trial-design.md). A real
   generation success restores normal traffic, including the scheduler's normal
   50-item retry sweep; a transient failure reopens the
   circuit. Epoch checks prevent stale in-flight results from overwriting a newer
   outage. Repeating the same proof cannot replenish the trial budget.
5. Pending retries preserve their existing item and automatic-recovery budgets.
   Exhausted jobs retain the previous one-cycle recovery limit. Existing manual
   retry remains available but does not bypass an active dependency outage.

Numeric limits are product choices, not standards. Configuration without a valid
revision retains the existing bounded retry behavior rather than sharing an
unverifiable outage. Database failures at the admission boundary defer AI work.
The first failed real call still counts as an item attempt; later calls held by
the circuit do not. Already admitted calls cannot be recalled. The shared probe
coordinator retains its installation-wide cooldown; changing provider configuration
does not inherit an old circuit, but does not reset that probe cooldown.

## Alternatives and tradeoffs

| Choice | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Increase each item's retries | Small code change | Repeats the outage across every item | Reject |
| Pause the entire worker | Simple | Blocks work that does not need AI | Reject |
| Durable provider circuit plus existing queue | Fewer wasted calls; restart-safe automatic recovery | Recovery delay and state-machine tests | Implement |
| New broker/workflow platform | Rich orchestration | Another operational dependency and migration | Defer |

## Security and usability

Deferral is an internal, branded error, not a caller-supplied metadata flag.
Queries are parameterized; state stores opaque dependency keys and fixed reason
codes, not credentials, prompts or provider error bodies. Probes use synthetic
input and existing cloud budget/accounting controls; they can incur charges.
No failure or readiness check selects a destination or grants routing authority.
The existing History reason explains automatic waiting; no new acknowledgement
screen or dense diagnostics panel is added. Existing inline action status remains
available to assistive technology.

## Official sources reviewed September 20, 2026

- [Microsoft circuit breaker](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker): distinguish dependency protection from item retries; limit half-open traffic and isolate independent resources.
- [AWS retry with backoff](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/retry-backoff.html): bound retries, preserve idempotency and avoid worsening service degradation.
- [PostgreSQL 18 explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html): serialize state transitions and keep transaction lock order consistent.
- [W3C ARIA22 status technique](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22): announce status changes without moving focus; this is a technique, not an additional acknowledgement requirement.

URLs were discovered through research tools and reviewed before implementation.

## Recommendation stack

PostgreSQL atomic state transitions; existing task queue and scheduler; small ESM
policy, circuit repository and admission service; existing generation-readiness
adapter; isolated PostgreSQL concurrency tests plus client/backend regressions.
Measure avoided provider calls and successful recovery before tuning the limits.
