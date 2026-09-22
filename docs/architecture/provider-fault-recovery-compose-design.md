# Disposable provider recovery: design

## Decision

Extend the existing loopback-only Compose fixture with a one-way, test-only
recovery transition. Exercise the real provider HTTP boundary, durable circuit,
readiness probe, retry transaction and queue worker with an isolated database.
Do not connect the normal Compose stack, real media servers, secrets or models.

The test will create synthetic movie and TV pending decisions, advance only the
isolated database's due timestamps, transition the stub from 503 to a completed
generation response, instantiate a fresh worker and drain the resumed tasks.
Assertions must cover one recovery claim, stable retry budgets, no duplicate
tasks, completed queue work and no media route. A second recovery run must be
idle. The control endpoint is POST-only, loopback-published, and cannot return
to the fault state. It never reads or stores request bodies or prompts.

## Options and tradeoffs

| Option | Advantage | Disadvantage | Decision |
| --- | --- | --- | --- |
| Normal local Compose fault | Closest to deployment | Risks user data, credentials, queues and routes | Reject |
| Pure mocks | Fast and deterministic | Misses actual HTTP/probe/queue interaction | Retain as unit layer |
| Fixed disposable Compose stub and Testcontainers DB | Real transport, bounded isolation and repeatable recovery | Requires Docker; synthetic metadata cannot prove content accuracy | Select |

## Recommendation stack

1. Keep unit tests for circuit transitions and expiration edge cases.
2. Require this disposable transport-to-worker recovery test for changes to
   provider admission, retry, scheduler or queue behavior.
3. Keep the separate held-out media-content benchmark for destination quality;
   successful recovery says nothing about semantic correctness.
4. Leave operator-facing status in the existing History/Command Center surfaces.
   If a new status appears later, follow W3C WCAG 2.2 status-message semantics
   without adding another dense panel.

This follows [AWS reliability guidance on automated recovery and testing recovery
procedures](https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/rel-dp.html),
[Docker Compose project isolation](https://docs.docker.com/compose/how-tos/project-name/)
and [Compose health waiting](https://docs.docker.com/reference/cli/docker/compose/up/).
The no-duplicate invariant follows [AWS idempotency guidance](https://docs.aws.amazon.com/wellarchitected/2025-02-25/framework/rel_prevent_interaction_failure_idempotent.html).
The UI boundary follows [WCAG 2.2 status messages](https://www.w3.org/TR/wcag/#status-messages).
