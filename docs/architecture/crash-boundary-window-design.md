# Bounded crash-boundary verification design

Date: 2026-10-02. Scope: disposable installation tests, not production recovery.

See the separate [measured outcome](crash-boundary-window-outcome.md) for the
delayed-response negative experiment and complete frozen-image matrix.

## Finding and decision

The unfinished-backfill fixture holds active metadata writes for eight seconds.
The host verifies the checkpoint, performs preparation and resolves the container,
then sends SIGKILL. That sequence has an unmeasured check-to-use gap. A successful
readiness response alone does not prove the same claims were still held at death.
The previous failed start-count assertion remains unexplained; this gap is an
observable design weakness, not proof of a production queue defect.

Keep the finite fixture hold and all production deadlines. Move preparation and
container-ID discovery before the final boundary verification. For the backlog
case, return a conservative remaining hold window from active, fixture-labelled
PostgreSQL sleep queries. Measure the whole verification round trip, kill dispatch
and observed exit on one host monotonic timeline. Address the already resolved
owned container directly, avoiding another Compose service lookup after proof.

Reject missing, malformed or expired windows before kill; also reject a late exit
observation before starting the recovery observer. Never count a late injected
crash as a valid recovery experiment, even if the final queue happens to drain.
Retain the original exact task identities, start counts, completion counts and
ten-minute visibility assertions as independent correctness checks.

## Safety and limits

- Only the existing collision-checked disposable Compose project supplies the
  container ID. No caller-supplied live target, socket mount or privilege increase.
- The database observation reads only active `PgSleep` sessions with the fixed
  fixture application name. Missing workers or unusable timestamps fail closed.
- Query age includes work before the sleep, so subtracting it from eight seconds
  gives a conservative window. Host elapsed time starts before the probe request,
  additionally charging transport/import time rather than comparing host and
  database timestamps. Database clock stability is still an environmental
  assumption; exact durable recovery assertions remain mandatory.
- A monotonic, bounded, fixed-stage diagnostic excludes task IDs, SQL, credentials,
  arbitrary exception values and provider payloads. Keep it on failures as well
  as success. It is diagnostic evidence, not publication authorization.
- Slow hosts may reject a valid but unobservable crash. That is preferable to
  misclassifying an invalid injection as a product recovery failure.
- No runtime timeout, concurrency, ownership, routing or deployment-template
  settings change. Recovery still means import plus metadata; music stays excluded.

## Options and recommendation stack

| Option | Benefit | Cost / reason |
| --- | --- | --- |
| Increase production deadlines or loosen counts | Easier green tests | Reject: changes the behavior being qualified |
| Freeze all container processes | Stops progress | Cannot run the existing in-container database verification while frozen; larger protocol change |
| Measured finite window and direct owned-ID kill | Small change; no production hook; early, actionable failure | Conservative rejection on a slow host; still requires real recovery checks |

Recommend the measured-window protocol, deterministic delayed-command tests,
then an isolated real fresh/backfill experiment. Rerun the complete frozen-image
matrix after the boundary evidence is accepted. Sustained resource soak and actual
saved-template operator acceptance remain subsequent release gates.

## Official research

Checked on October 2 for the September 2026 baseline. These are live official
pages, not archived September snapshots; no dependency or runtime upgrade is implied.

- [Node performance measurement](https://nodejs.org/download/release/v24.21.0/docs/api/perf_hooks.html)
  provides process-relative high-resolution timing. Use one host clock for command
  milestones, rather than subtracting timestamps from separate machines/processes.
- [PostgreSQL activity statistics](https://www.postgresql.org/docs/18/monitoring-stats.html)
  distinguishes query start, active state and wait events, and documents transaction
  snapshot caching. Use a fresh read, restricted to the injected sleep sessions.
- [PostgreSQL deadlines](https://www.postgresql.org/docs/18/runtime-config-client.html)
  distinguishes lock, statement and transaction timeouts. Preserve them; fixture
  timing must fit the system rather than disabling its safeguards.
- [Docker kill](https://docs.docker.com/reference/cli/docker/container/kill/)
  supports explicit signals and container IDs. Sending a signal and observing the
  expected non-OOM exit are separate required checks.
- [Docker pause](https://docs.docker.com/reference/cli/docker/container/pause/)
  suspends all container processes, including the database used by the probe.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  supports meaningful programmatic status without focus changes. This CLI-only
  fix does not change UI or claim accessibility conformance; any later UI projection
  should distinguish invalid test injection from failed application recovery.

## Validation plan

Test malformed windows, absent workers, clock reversal, preparation delay,
verification transport delay, kill delay, late exit, invalid/OOM exit and command
failure. No rejected pre-kill boundary may send SIGKILL or start recovery. No
post-kill timeout may be converted into a successful result. Test output redaction
and the existing owned-resource cleanup path. Record actual Docker results and
remaining limits in a separate outcome document.
