# Guarded offline Docker provider stop

Date: 2026-10-15. Local synthetic implementation; no Unraid/shared Ollama change,
deployment, automatic recovery, request replay or release.

## Decision and scope

Implement the first mutating lifecycle control as an explicit offline command,
not an automatic supervisor. A private configuration pins one request, provider
instance and Docker network. `plan` checks them without writes; `stop` requires a
separate fresh administrator review. `inspect` reads only the durable record.
Fresh installations and unconfigured gateways do nothing.

The narrow supported profile is a dedicated Linux Docker container: non-root,
read-only, no added capabilities, no-new-privileges, private namespaces, no mounts,
devices, auto-removal, restart manager or published ports. Its single network must
be a pinned local internal bridge with IPv4 isolated gateway mode, IPv6 disabled,
and no other connected container. Require an explicit offline-management label.
Reject unsuitable profiles; do not silently change network/firewall/restart policy.
Real GPU/model-volume deployments need a separately reviewed profile.

The operator must independently exclude other Docker controllers, host/root
access, alternate provider instances and consumers. Docker's stop API has no
start-epoch compare-and-swap. Two reads cannot replace exclusive control, and
ordinary internal networking does not exclude host access. Therefore no result
claims exclusive control was machine-proven or authorizes recovery. This remains
an administrator-controlled tool outside Classifarr, with no Docker socket in
the gateway/application and no HTTP administration endpoint.

## Durable protocol and unknown outcomes

1. A dedicated PostgreSQL session obtains the existing gateway/recovery advisory
   lock. Reentrant sessions and running gateways are refused. Version 4 is required.
2. Require the exact currently uncertain request and its immutable configured
   binding; legacy/unbound work cannot select a container to stop. Plan hashes
   bind current owner, attempts, provider configuration and network configuration.
3. Stop revalidates a private review (15-minute freshness, exact plan, explicit
   dedicated-provider/exclusive-control/consumer-stop/stop approvals). Persist an
   append-only UUIDv7 stop intent with synchronous commit before Docker dispatch.
   One intent per binding is permitted, even if acknowledgement is lost.
4. Send at most one fixed Docker `POST /containers/<full-id>/stop?t=5`. No retry,
   arbitrary method, shell command, remote socket, context, proxy or fallback.
5. Require stable post-stop observations for the same daemon/container/image/start
   and unchanged configuration/network. Save a separate UUIDv7 observation only
   after the expected exited/PID-zero state. An HTTP success alone is insufficient.

Every external action occurs outside SQL transactions. Lost DB acknowledgement
prevents dispatch; the intent may nevertheless exist. Timeout, cancellation,
database loss, process death, lost Docker reply or post-stop drift leaves an
intent without a completion observation. Never repeat that stop automatically.
Even pre-dispatch cancellation after saving consumes the one-shot stop intent.
The original active request, attempts, cooldown, owner and maintenance state are
never changed by this controller. Stop evidence is not inference completion.

Offline administrator recovery remains separate. Its inspection exposes stop
intent/observation references, and its independent checks must establish that any
pending Docker operation has settled before acknowledgement or restart. A later
saved observation does not prove present stopped state. The controller has no
start/resume/kill/delete/network-mutation operation. It cannot repair its own
uncertain write by resetting a marker.

## Limits and schema

One explicit invocation, one stop maximum, 3-second reads, 8-second stop request,
40-second combined operation deadline and 55-second CLI hard deadline. API 1.51,
8 KiB headers, 256 KiB bodies, fixed sanitized codes. Two bounded snapshots before
and after stop; no provider inference. DB connect/query/statement deadlines remain
5/5/4 seconds. Advisory session ownership is not a Docker lifecycle lock.

Standalone timestamped v3-to-v4 migration plus fresh schema. New intent and
observation primary keys use native PostgreSQL 18 UUIDv7. Unique binding/intent
references bound each table to the existing 100,000 binding limit. Append-only
triggers and separate SELECT/INSERT-only controller grants protect ordinary
roles, not privileged DBAs. No application schema or default runtime change.

## Options, pros/cons and recommended stack

| Option | Benefit | Limitation | Decision |
| --- | --- | --- | --- |
| Automatic stop/clear from a Docker snapshot | Fewer operator steps | Unproven dispatch identity and lifecycle races | Reject |
| Reviewed one-shot stop with durable intent | Controlled targeting; unknown outcomes survive crashes | Administrator exclusivity; narrow profile; no automatic recovery | Implement |
| General Docker access in the gateway | Easy orchestration | Exposes host-level authority to HTTP workload | Reject |
| Dedicated lifecycle owner and authenticated dispatch binding | Can support machine-authorized recovery | Requires a new enforced trust/deployment boundary | Next architecture stage |

Stack: modular ESM controller, fixed local Docker API operations, isolated-network
profile, PostgreSQL advisory serialization and append-only UUIDv7 intent/evidence,
then separate human-reviewed recovery. A future exclusive supervisor must own
provisioning/ingress and bind actual transport, not reinterpret configured pins
as attestation. Docker authorization plugins alone are not that proof.

## Verification and completion

Use real local HTTP sockets and isolated PG for invalid/stale review, malformed
Docker data, network peers/config changes, wrong pins, missing bindings, competing
controllers, DB failure, lost acknowledgements, cancellation, unknown stop and
post-stop drift. Assert intent visibility at POST arrival, one POST maximum,
UUIDv7, restricted grants and unchanged admission state. Prove fresh/upgrade
parity and v3 refusal. Rehearse packaged code and an exact owned synthetic Docker
container/network; verify cleanup. Rebuild local Compose with no cache and keep
gateway routing/AI budgets unchanged. Record actual outcomes separately.

## Official research

Discovered and opened through MCP on 2026-10-15. Recommendations are design
inferences, not vendor endorsements.

- [Docker port publishing](https://docs.docker.com/engine/network/port-publishing/):
  internal versus isolated gateway mode and host/IPv6 access considerations.
- [Docker bridge networks](https://docs.docker.com/engine/network/drivers/bridge/):
  same-network peers can communicate; membership matters.
- [Docker authorization plugins](https://docs.docker.com/engine/extend/plugins_authorization):
  API authorization has protocol/streaming limitations; it is not full host control.
- [Docker stop](https://docs.docker.com/reference/cli/docker/container/stop/): bounded
  grace period followed by forced termination, not successful inference completion.
- [Docker restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
  and [live restore](https://docs.docker.com/engine/daemon/live-restore/): daemon loss
  and manual stop alone cannot establish a durable lifecycle boundary.
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html)
  and [transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html):
  serialize cooperative database users and persist intent before external effects.
