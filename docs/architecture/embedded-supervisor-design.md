# Embedded lifecycle supervisor

Date: 2026-09-30. Base: `434dd775`.

## Decision and scope

We separate lifecycle supervision from the forthcoming privilege provisioning
cutover. The current entrypoint starts PostgreSQL with `pg_ctl`, then replaces
itself with Node. The previous live restart required database crash recovery.
The first production component will coordinate shutdown without changing SQL
roles, HBA, inventory ownership, routing, schema mode or background-job eligibility.
The live installation is not redeployed in this round.

The existing initialization/upgrade shell remains responsible for provisioning.
After it succeeds and drops privileges, a small ESM supervisor owns the Node
child and adopts the exact running database PID/data path/start-time identity.
There is no SQL connection, administrator credential, new dependency or internal
restart loop. Docker remains responsible for restart policy.

## Contract

On SIGTERM, SIGINT, application exit or database loss, we enter shutdown once:

1. Cancel the serial five-second database process check.
2. Send Node SIGTERM, allow fifteen seconds, and observe its actual exit.
3. If necessary, kill only that direct Node child and wait another two seconds;
   report failure, not graceful success. Never stop PostgreSQL before Node exits.
4. Stop the same database with `pg_ctl -m fast -w -t 20`; allow a bounded command
   deadline and require `pg_controldata` to report `shut down`.
5. Exit nonzero on any failure. Never signal a replacement database instance.

Signals received before application spawn prevent spawning it. Repeated signals
cannot skip draining. All listeners/timers are disposed. Health stays the existing
application health endpoint; supervisor startup is not an application-ready claim.
Packaged Compose examples recommend a sixty-second total stop budget. The
supervisor activates from the image with no new variable, volume or template
setting. Existing Unraid/Compose installations need not adopt that recommendation
to start or use the supervisor. Their host-controlled timeout remains unchanged.

We explicitly test Docker's unchanged ten-second stop timeout, including custom
UID startup. Passing a small fresh-install test does **not** guarantee that every
busy database can finish in ten seconds. We do not shorten transactions, disable
durability or label a forced kill as clean to manufacture such a guarantee. The
internal maximum deadlines exceed ten seconds so hosts with more time can use it;
an earlier host SIGKILL can still interrupt this sequence. Status polling must not
delay delivery of SIGTERM to the application.
Node now closes HTTP admission before awaiting queue-claim release, allowing the
two drains to proceed concurrently; repeated signals share the same shutdown.
Its existing ten-second failure deadline is unchanged, and active requests are
not forcibly disconnected early to satisfy a benchmark. This follows
[Node HTTP shutdown semantics](https://nodejs.org/download/release/v24.17.0/docs/api/http.html).

The supervisor is non-root and inherits the already-selected application UID/GID.
It cannot provide privilege isolation while the database shares that identity.
PID-file checks reject an observed replacement; they are not an atomic security
fence against another same-UID process replacing files or restarting PostgreSQL.
Production database restart authority must belong to this container lifecycle.
If Tini starts as root and its child drops to another UID, Tini needs signal
permission (`CAP_KILL`, present in Docker's normal root-container defaults).
The custom-UID fixture retains this capability for Tini, not the non-root app.
The ordinary non-root Compose path does not need that cross-UID capability.
The entrypoint still rejects external schema mode. Interruptions during the old
initialization/major-upgrade shell are not certified by this post-bootstrap slice.
Forced container kills, host crashes and disk failures can still require recovery.

## Research and tradeoffs

Official sources discovered/read online on September 30, 2026:

- [Node child processes](https://nodejs.org/docs/latest-v24.x/api/child_process.html):
  signal delivery is not proof of termination; attach lifecycle listeners
  immediately and wait for exit. Execute fixed binaries without a shell.
- [PostgreSQL shutdown](https://www.postgresql.org/docs/current/server-shutdown.html):
  fast shutdown rolls back remaining transactions and shuts down normally;
  immediate shutdown requires recovery. We do not SIGKILL PostgreSQL.
- [Docker process management](https://docs.docker.com/engine/containers/multi-service_container/):
  the main process is responsible for its children. Retain Tini for reaping.
- [Compose services](https://docs.docker.com/reference/compose-file/services/):
  the default ten-second grace period is host-controlled, not an image property.
- [Unraid shutdown guidance](https://docs.unraid.net/unraid-os/troubleshooting/common-issues/unclean-shutdowns/)
  also documents a ten-second Docker default and optional increased headroom.
  [Community Applications](https://docs.unraid.net/unraid-os/manual/applications/)
  retains installation settings in user templates. We do not rely on template
  changes being propagated by an image update.
- The [official PostgreSQL image](https://github.com/docker-library/postgres/blob/master/Dockerfile-debian.template)
  uses fast shutdown yet still recommends a larger host timeout: even database-only
  images cannot promise every shutdown fits the default. For Classifarr we retain
  the supervisor stop signal and send fast shutdown only to PostgreSQL.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  use explicit status and failure text, not color alone. This is a CLI/backend
  change, not a new UI or a claim of WCAG conformance.

| Option | Benefit | Cost / remaining risk |
| --- | --- | --- |
| Keep detached PostgreSQL | No new process | No ordered shutdown; ten-second stop can interrupt data work |
| Non-root embedded supervisor (selected) | Fits existing installation; bounded shutdown and fail-stop | Small Node process and serial status probes; same SQL/OS authority |
| Separate database service | Clearer process/filesystem ownership | Deployment, backup and upgrade migration; larger compatibility scope |
| s6-overlay | Established dependency-aware service supervision | Additional init packaging and migration; cannot override host timeout either |

We expect one extra Node process and a short status subprocess every five seconds,
not unbounded concurrency. These have memory/CPU cost; disposable observations are
not representative load benchmarks. Separate services become preferable if embedded
provisioning complexity outweighs single-container compatibility.
We reviewed [s6-overlay's lifecycle documentation](https://github.com/just-containers/s6-overlay/blob/master/README.md).
It is a reasonable future alternative for a larger service graph, but is not a
solution to the host deadline. Retaining Tini plus a narrow ESM coordinator avoids
introducing a second restart owner for this two-process lifecycle.

## Validation, rollout and next work

Test signal races, failed spawn/kill, abnormal exits, deadlines, identity changes,
status/stop failures and listener cleanup. Use disposable production-image containers
to test real Docker stop/restart, custom UID/GID, application/database failures and
preserved synthetic data. Re-run the separate-identity isolation rehearsal. No live
volumes, provider credentials, PR merges, version bumps or releases are involved.

Reverting this lifecycle change restores the old launch arrangement without a
schema rollback, but loses orderly database shutdown. Preserve rollback images.
The recommendation stack is: lifecycle supervision; explicit privileged
provisioning/maintenance handoff with upgrade/restore parity; complete writer
capability migration; only then automatic legacy recovery. Do not fabricate old
ownership or broaden permissions to bypass a failing compatibility test.
