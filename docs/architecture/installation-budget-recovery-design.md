# Installation budget and database recovery

Execution follow-up: [published-upgrade recovery validation](published-upgrade-provenance-diagnostics-validation.md)
records a passing clean-source run of both scenarios and the next CI automation step.

September 28 extension: [unfinished-backfill restart acceptance](unfinished-backfill-restart-design.md)
adds 300 movie and 300 TV tasks, including durable in-flight claims, to both opt-in
scenarios. Its [separate validation](unfinished-backfill-restart-validation.md)
records passing fresh/upgrade recovery without shortening the real visibility lease.

## Decision

Extend the existing isolated installation/crash drill with an opt-in
`--resource-budget` scenario: 2 CPUs, 128 PIDs and the existing 2 GiB memory
limit. Do not change live limits, production connection settings, routing,
release versions or the default installation gate.

## Evidence and recommendations (September 2026)

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Raise connection limits | More simultaneous connections | More resources; does not establish recovery | Do not change production defaults |
| Bounded connection exhaustion in the existing drill | Reproducible admission failure, cleanup and recovery evidence | Synthetic superuser connections, not application-pool saturation | Implement |
| New recovery orchestrator | Could coordinate additional workloads | Duplicates existing ownership and scheduler mechanisms | Reuse the scheduler and crash checkpoint |
| Immediately deploy CPU/PID caps | Hard resource ceiling | Published-upgrade recovery is not yet demonstrated | Keep live limits unchanged |

PostgreSQL documents that `max_connections` is a startup setting with resource
costs and reserved-slot semantics. The disposable database will use 32 slots;
the test must observe SQLSTATE `53300`, not mistake authentication, network or
PID exhaustion for connection pressure. This tests the embedded database's
superuser ceiling, not a non-superuser reserved-slot policy.
[PostgreSQL connection settings](https://www.postgresql.org/docs/current/runtime-config-connection.html).

Use finite connection deadlines, error listeners and unconditional client
release. Do not replay arbitrary SQL or enlarge the application's pool.
[node-postgres Pool API](https://node-postgres.com/apis/pool).

Require health readiness after a real normal-runtime restart; container start
order alone is not readiness.
[Docker startup order](https://docs.docker.com/compose/how-tos/startup-order/).

Report named checks, numbers with units and explicit passed/blocked status;
do not rely on color or hide missing evidence behind a percentage. No UI changes
are necessary for this CLI acceptance component.
[W3C accessible tables](https://www.w3.org/WAI/tutorials/tables/).

## Protocol and safety

1. Use the existing collision-checked random Compose project, internal network,
   owned volume and single candidate build. Verify Docker and effective cgroup
   limits independently. No host ports, live data mounts or external providers.
2. Set the fixed 32-connection ceiling only in the guarded disposable database;
   restart normally and verify the effective setting before injecting pressure.
3. Let the real scheduler ingest synthetic movie/TV libraries; retain its refill
   advisory lock at the committed-inventory boundary. Music remains excluded.
4. Open at most 33 bounded connection attempts until PostgreSQL refuses admission.
   Hold the accepted connections for five seconds, release all owned clients,
   then require a new database connection and HTTP health recovery within 15 seconds.
5. Persist aggregate pressure evidence before the existing crash checkpoint.
   Verify unchanged inventory and ingestion identities, kill only the owned
   container, restart normally and observe autonomous backfill/profile completion.
6. Check cgroup counters before pressure, during pressure, after recovery and
   after restart. Missing telemetry, memory-limit events, OOM or PID denials fail.
   Counters from different container lifetimes are not subtracted.
7. Run fresh and published-upgrade cases separately. Full acceptance still
   requires pinned published-image attestation and both cases. Fresh-only success
   is diagnostic evidence, never published-upgrade acceptance.

This is sequential database admission recovery followed by restart/backfill
recovery. It is not a claim that the application pool itself was saturated, nor
a sustained capacity benchmark. The existing pressure fixture retains the refill
lock until the crash; the restart observer must never seed, repair or invoke work.

## Recommended stack

Keep the current scheduler, durable ingestion checkpoint and PostgreSQL pool;
add bounded fault injection and allowlisted receipts to the existing ESM drill.
Require complete fresh/upgrade evidence before considering deployment caps.
Record execution results separately in the validation document.

## Running and interpreting the checks

Full local fresh + published-upgrade acceptance (requires working GitHub CLI
authentication for the pinned baseline's attestation):

```sh
node scripts/run-runtime-installation-acceptance.mjs --resource-budget
```

For a fresh-only diagnostic, without claiming published-upgrade acceptance:

```sh
node scripts/run-published-upgrade-drill.mjs --fresh-only --resource-budget
```

The existing `--ci` clean-checkout/source-revision rules also apply when combined
with `--resource-budget`. The v3 receipt has an additive `resourceBudget` section
only when explicitly requested; missing fresh or upgrade evidence blocks it.
Default CI coverage is unchanged. Startup/health deadlines and real scheduler
completion deadlines are retained, not relaxed to obtain a pass.
