# Isolated full-application gateway pilot

Design, 2026-10-15. Local synthetic testing only; no release or live cutover.

## Gap and contract

The network rehearsal proves TLS and network separation but previously replaced
normal application startup with injected admission/runtime functions. Extend that
existing runner with a fresh, normal-entrypoint Classifarr container. Keep the
original composition test. Do not change application defaults or saved production
settings. No work is needed on ordinary installations for this test-only change.

Use the packaged application, real migrations, runtime admission, authentication,
CSRF checks and scheduler. Create a synthetic administrator and ordinary user in
the disposable database. Save only the synthetic provider settings. Replace the
application container with its private gateway routing file enabled, then exercise
the administrator history API and one explicit model warm request. Verify anonymous
and ordinary users cannot read history. Read again after same-image replacement.

The gateway database and UUIDv7 receipts must survive application replacement.
History reads must leave both provider attempt count and admission state unchanged.
A temporarily paused fixture gateway must produce a bounded unavailable response,
not direct-provider fallback. Unpause in a finally block. Do not recover, clear or
replay uncertain work. A stopped application is the safe rollback point; disabling
routing to bypass a ledger is not rollback. This is not an older-image upgrade test.

## Bounds and failure handling

- Two internal Docker networks, no published ports; only gateway joins both.
- Full application and gateway containers: two CPUs, 2 GiB memory, 512 PIDs each.
  The existing tiny provider/composition fixtures retain their tighter limits.
- Fixed synthetic model, one explicit warm call; existing composition uses one
  generation. Observe additional startup work rather than silently resetting it.
- Normal gateway deadlines, concurrency, persisted cooldowns, 100,000 binding cap,
  attempt accounting and ownership/provider fences remain unchanged.
- HTTP probe deadline 15 seconds, existing history transport deadline five seconds;
  container readiness 180 seconds; fixed targets and no redirects.
- Missing configuration, authentication failure, invalid query and unavailable
  gateway are distinct outcomes. No transient error triggers an automatic retry.
- All keys and synthetic login state are private disposable files. Never print
  response bodies, tokens or subprocess assertion diffs on failure.
- Cleanup only generated, labeled fixture containers/networks and validated
  repository temporary paths, with absence verified even after test failure.

No new table or schema migration is needed. Existing native PostgreSQL UUIDv7
request/completion records are asserted, not replaced with a new identity scheme.

## Research and options

Official pages discovered and opened through MCP on 2026-10-15:

- [Docker bridge networking](https://docs.docker.com/engine/network/drivers/bridge/):
  separate bridges isolate containers unless ports are published; host and
  same-network access remain possible. Test the actual bypass boundary, not just
  a configuration flag. This does not attest a production host firewall.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  containers have no resource limits by default; apply explicit CPU/memory bounds.
- [PostgreSQL 18 release notes](https://www.postgresql.org/docs/18/release-18.html):
  native UUIDv7 generates timestamp-ordered identities. Retain the established
  PostgreSQL 18 schema rather than adding a dependency or new tables.

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Existing composition-only test | Fast, focused | Does not exercise real auth, startup and persistence together |
| Isolated full-application pilot (selected) | Closes that integration gap without real provider traffic | Slower; synthetic replies cannot establish model quality or GPU capacity |
| Enable shared provider now | Real workload observations | Outside approved scope; requires retention, network and uncertainty review |

Recommended stack: existing ESM runner plus small fixture modules, packaged
Node/Express runtime, PostgreSQL 18 UUIDv7 gateway ledger, private-CA TLS and two
internal Docker networks. Keep normal local/Unraid routing unchanged.

Completion requires real authenticated reads, one observed admitted warm request,
preserved request identities across replacement, no read-triggered compute,
unavailable behavior without bypass and verified cleanup. Next defer reviewed
retention/archiving before unattended operation, then a separately approved real
provider pilot with measured capacity and a rollback plan that retains uncertainty.
