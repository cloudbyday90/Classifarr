# Shared Ollama admission: implementation outcome

Status: Unreleased standalone prototype, 2026-10-14. See the separate
[design/research](shared-ollama-admission-design.md) and
[operator guide](../operations/ollama-gateway.md).

## Implemented slice

The administrator approved building an optional gateway, tested locally only.
Its ESM modules separate configuration/authentication, admission, PostgreSQL
ownership, fixed-target HTTP transport and the server. A dedicated CLI starts
it explicitly; the normal application does not import or start it.

Installation/work-class credentials control foreground precedence. One compute
request can run, with bounded foreground waiting and no background prompt queue.
Fixed route/model allowlists, byte/time/connection/intake bounds, sanitized error
codes and a loopback-only listener limit the initial surface. No gateway retries,
redirects, cloud fallback or arbitrary upstream targets are introduced.

A dedicated PostgreSQL session owns the gateway lock. A durable marker is written
before dispatch and cleared only after a known terminal response and successful
completion write. Lost sessions, cancellation, abrupt termination and unknown
outcomes cannot clear that marker or reset attempts. Complete overload responses
persist a five-second cooldown. No clear-lock/reset operation is provided.

The independent migration is timestamp-named
`20261014_121441_admission.sql`. Its table primary key, gateway owner and request
references use PostgreSQL 18 native time-based UUIDv7 with database constraints.
A separate singleton constraint prevents duplicate control rows. No existing
application table or identifier is changed. The migration is also the dedicated
database's fresh schema; it is intentionally outside automatic app migrations.

## Verification so far

- Gateway unit and repository code-health checks: two suites, 35,044 tests passed.
- Isolated PostgreSQL and actual HTTP gateway/workload checks: two suites, 25
  tests passed. Gateway-specific coverage includes two installation credentials,
  authentication, allowlists, request/response bounds, priority, cancellation,
  truncated/malformed replies, overload cooldown, missing state, competing owners,
  concurrent claims, lost completion writes, lost database sessions and actual
  standalone-process death/recreation. UUIDv7 versions/timestamps are checked.
- Type checking includes all new gateway modules and its CLI. Backend lint and
  normal/production dependency reachability checks passed.

The packaged-image rehearsal and no-cache local Compose evaluation will be
recorded after they finish. Earlier workload-control image results are not
gateway verification. Synthetic tests do not measure real-model quality, GPU
memory, cross-host TLS or published-release upgrade behavior.

## Preserved boundaries and next item

Existing Classifarr clients are not rerouted. Their budgets, consent, memory
safeguards, model validation and checkpoints are unchanged. No live inference,
Unraid setting, shared Ollama configuration, provider restart, release or PR merge
is included. GitHub MCP enumeration again returned no open Classifarr PRs.

Next: integrate a common authenticated transport into the real clients, retaining
streaming and embedding behavior, and prove cancellation/uncertainty handling
end to end before planning cross-host deployment. The restricted first gateway
is not a drop-in replacement for every current Ollama operation. Production
cutover also requires a reviewed uncertainty-recovery procedure and prevention
of direct-client bypass; independent databases still do not coordinate today.
