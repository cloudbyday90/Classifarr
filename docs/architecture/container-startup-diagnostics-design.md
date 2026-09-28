# Container startup diagnostics design

## Problem and scope

The [schema-check incident](actions-36305930631-investigation.md) exposed a
diagnostic failure: successful `docker logs` calls lost stderr, and an exited
container was polled until the readiness deadline. The underlying restore seed
was already repaired; this change must not bypass admission or extend the wait.

Scope: disposable schema checks and published-upgrade acceptance diagnostics.
No production startup, database, routing, provider or UI behavior changes.

## Research and recommendation

Official sources discovered and read on 2026-09-28:

- [Docker logs](https://docs.docker.com/reference/cli/docker/container/logs/)
  carries stdout and stderr and supports bounded tail retrieval. Capture both
  streams on failure, without environment-bearing `--details`.
- [Docker inspect](https://docs.docker.com/reference/cli/docker/inspect/)
  supports formatted projections. Read only startup state, not configuration,
  environment variables or health-check output bodies.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  supports direct argument arrays, output limits and timeouts. Synchronous calls
  wait for child termination: use a hard kill signal for bounded diagnostic CLI
  calls, and a separate curl deadline for the in-container health request.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  calls for excluding secrets and preventing log injection. Project recognized
  signals into fixed labels; never publish arbitrary command errors or log text.
- [W3C error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification)
  favors descriptive text identifying what went wrong. Apply that communication
  principle to a plain-text cause and next step. This CLI-only change is not a
  web-form accessibility implementation or a WCAG conformance claim.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Longer readiness timeout | Minimal code | Hides early exits; no explanation | Reject |
| Publish raw log tails | Detailed arbitrary errors | Secrets, SQL, payloads and CI log injection | Reject |
| Bounded state plus fixed recognized signals | Actionable, private, deterministic | Unknown errors remain explicitly unknown | Implement |
| Change production startup or auto-repair admission | Could unblock some failures | Changes safety authority without evidence | Out of scope |

Recommendation stack: bounded Docker command adapter, safe diagnostic projection,
application-readiness waiter, then integration into existing runners. Keep the
180-second readiness budget, require an actual successful health response and
stop promptly on terminal container state. Give diagnostic collection its own
small bounded budget after failure. Never call readiness success from log text.

## Safety and failure contract

- ESM modules separate subprocess execution, evidence projection and polling.
- Health probes have request and process limits; daemon failures, malformed
  inspection, exited containers and running-but-unready containers remain failures.
- Record exit code, explicit OOM flag, HTTP status, known startup signal and
  evidence availability. Exit 137 alone is not proof of OOM.
- Inspect both streams, with a tail and byte cap. Unknown output is omitted, not
  presented as a diagnosis. Fixed next steps never suggest bypassing restore gates.
- Gather evidence before owned-resource cleanup; unavailable diagnostics never
  convert failure to success. Other verification runs must not be removed by a
  shared-label sweep.
- Acceptance receipts retain their existing pass/fail contract. Diagnostics do
  not grant release permission or rewrite runtime state.

## Validation plan

Test stderr-only admission failure, early exit, explicit OOM versus exit 137,
healthy startup, running-but-unready timeout, malformed/failed inspection, hung
commands, oversized output, unknown secret-bearing logs and cleanup isolation.
Exercise real Docker with disposable synthetic failure containers and the current
fresh-install image. Document measured outcomes separately after validation.
