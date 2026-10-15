# Reviewed offline provider stop

Unreleased, 2026-10-15. Local prototype only. This command is **not** an automatic
recovery job and is not suitable for the shared Unraid Ollama installation.
It runs outside Classifarr; do not mount a Docker socket into the application.

## Supported boundary

Use only a dedicated Linux container whose full container/image/start/daemon
identity was recorded with the uncertain request. Unbound and legacy requests
are refused. Independently arrange exclusive Docker lifecycle control, stop all
consumers and isolate every alternative provider instance/address. An advisory
database lock does not exclude host administrators or other Docker controllers.

The container must have numeric non-root UID/GID, a read-only root, dropped ALL
capabilities, no-new-privileges, private IPC/PID/cgroup/UTS namespaces, `runc`, no
mounts/devices/links, no restart policy or auto-removal, and no published ports.
Memory, CPU and PIDs must be explicitly bounded (at most 8 GiB, 8 CPUs and 4096).
Require label `io.classifarr.gateway.lifecycle=offline-v1`. Its one pinned network
must be a local internal bridge, IPv4 gateway mode `isolated`, IPv6 disabled,
non-attachable/non-ingress, with no other connected container. The command never
changes these settings to make an unsuitable provider pass. GPU/model-volume
profiles and enforced provisioning remain future work.

## Schema and privileges

Back up the **standalone gateway database**, stop the gateway, and follow the
[schema upgrade sequence](ollama-gateway-offline-recovery.md). Version 4 is
required; never apply this schema to the Classifarr application database.
Use a dedicated non-owner, non-superuser role with CONNECT and no inherited
broader grants. Its only schema/table grants are:

```sql
GRANT USAGE ON SCHEMA ollama_gateway TO gateway_stop;
GRANT SELECT ON ollama_gateway.admission, ollama_gateway.request_binding TO gateway_stop;
GRANT SELECT, INSERT ON ollama_gateway.provider_stop_intent,
  ollama_gateway.provider_stop_observation TO gateway_stop;
```

Do not grant UPDATE, DELETE, TRUNCATE, CREATE or recovery-role membership.
The controller cannot clear the original request, change attempts/cooldowns or
resume the gateway. Append-only triggers also reject ordinary history edits.
Privileged DBAs can override these controls; retain an independent incident record.

## Inspect, plan, then explicitly approve

Create a private JSON file outside the repository, Linux mode 0600/restricted
Windows ACL, in a private directory. Final symlinks are rejected on Linux. Use
the real pins from the immutable request binding, not a newly selected container.
The placeholders below intentionally do not validate:

```json
{
  "database": { "host": "/var/run/postgresql", "database": "dedicated_gateway", "user": "gateway_stop" },
  "providerHash": "EXACT_64_CHARACTER_PROVIDER_HASH",
  "requestId": "EXACT_UUIDV7_REQUEST_ID",
  "boundary": {
    "socketPath": "/var/run/docker.sock",
    "daemonIdHash": "EXACT_64_CHARACTER_DAEMON_HASH",
    "containerId": "EXACT_64_CHARACTER_CONTAINER_ID",
    "imageId": "sha256:EXACT_64_CHARACTER_IMAGE_ID",
    "startedAt": "EXACT_DOCKER_STARTED_AT"
  },
  "networkId": "EXACT_64_CHARACTER_NETWORK_ID"
}
```

Set `CLASSIFARR_GATEWAY_STOP_CONFIG_FILE` to this file. The only accepted actions:

```text
node server/src/scripts/controlOllamaProvider.mjs inspect
node server/src/scripts/controlOllamaProvider.mjs plan
node server/src/scripts/controlOllamaProvider.mjs stop
```

Packaged path: `/app/src/scripts/controlOllamaProvider.mjs`. `inspect` is database
only. `plan` performs bounded Docker GETs, without durable writes or provider
calls. Both require the gateway to be stopped; never kill unrelated DB sessions
to acquire its lock. Local Unix sockets/Windows named pipes only; no remote TCP,
context auto-selection, proxy, redirects or arbitrary Docker commands.

After the actual independent checks, copy `plan.expected` unchanged into a
**separate private review file**:

```json
{
  "version": 1,
  "expected": {},
  "operatorRef": "admin-alias",
  "evidenceRef": "incident-reference",
  "observedAt": "REPLACE_WITH_ACTUAL_REVIEW_TIME_UTC",
  "assertions": {
    "dedicatedProvider": true,
    "exclusiveDockerControl": true,
    "allOtherConsumersStopped": true,
    "stopApproved": true
  }
}
```

Set `CLASSIFARR_GATEWAY_STOP_REVIEW_FILE` to that file before `stop`. Never automate
filling these assertions for a live provider. Reviews expire after 15 minutes
and must follow admission. Changed owner, attempts or configuration invalidate
the review. References allow letters, digits, underscore, hyphen and period;
do not include secrets, URLs or raw logs.

## Interpret the result

The controller synchronously records a UUIDv7 intent **before** sending one
`stop?t=5` request. Docker may force termination after five seconds. Stable
same-identity exited/PID-zero observations produce a separate UUIDv7 record.
`docker_stop_observed` does not mean inference succeeded or prove global provider
isolation. Every result says `recoveryAuthorized: false`.

If the command times out, dies, loses its DB/Docker reply or reports
`gateway_stop_outcome_unknown`, inspect the journal. An intent without an
observation remains unknown, including cancellation after commit but before
dispatch. **Do not retry stop, delete the intent, reset the request, or restart
the provider to escape uncertainty.** The unique intent prevents another stop
for that binding. If no intent is visible after a lost commit reply, first ensure
the old DB session and Docker operation have definitively settled.

A saved observation is historical, not present-state proof. Keep isolation in
place, establish that any pending stop operation has settled, and independently
verify the entire provider boundary before the separate
[administrator recovery and resume procedure](ollama-gateway-offline-recovery.md).
This command cannot start/resume/delete anything or authorize replay.

## Local verification

The existing gateway image rehearsal tests the packaged CLI against real isolated
PostgreSQL and synthetic Docker HTTP, including SIGKILL after stop dispatch.
The existing Docker boundary rehearsal additionally uses an owned idle container
on an isolated internal bridge to test actual daemon stop behavior. These are
complementary checks, not an end-to-end production supervisor or model-quality test.
See the [design](../architecture/ollama-provider-stop-design.md) and
[outcome](../architecture/ollama-provider-stop-outcome.md).
