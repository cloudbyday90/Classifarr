# Dedicated Docker provider boundary assessment

Date: 2026-10-14. Scope: local-only groundwork for a dedicated Docker provider
supervisor. The operator selected Docker rather than systemd. No shared Ollama,
Unraid, automatic recovery, inference, routing or budget changes are authorized.

## Contract before implementation

The smallest unsafe scenario is an uncertain request followed by observation of
an unrelated or restarted container. A stopped container cannot establish that
the old request ran there, that all runners were contained there, or that no
other controller can restart it. Existing dispatches have no durable container
epoch binding. Therefore this increment is an **observer, not a supervisor**.
It must always return `recoveryAuthorized: false`; offline administrator-reviewed
recovery remains the only recovery procedure.

The optional administrator CLI reads a private configuration file containing a
local Docker socket, SHA-256 of the daemon ID, full container ID, immutable image
ID and exact start timestamp. Mutable names, remote sockets, extra fields and
missing pins are rejected. Fresh/unconfigured installations do nothing. Nothing
is added to application startup, HTTP routes, database schema or Compose mounts.

The observer uses native Node HTTP, fixed GET routes and Docker API 1.51, after
checking the daemon's supported range. It samples daemon identity and container
state twice. A changed lifecycle/configuration snapshot or mismatched pin is
reported, never silently repinned. Missing/malformed data, absent containers or
daemon failures are unavailable, not stopped. Stable stopped state requires an
exited container with PID zero and no running/paused/restarting/dead flags.

Only an allowlisted projection leaves the reader: identity pins, lifecycle
timestamps, PID/flags and fixed configuration concern codes. Raw daemon responses,
environment, labels, commands, health output and mount paths are never printed.
Reported concerns include restart policy, namespace sharing, privilege, device
access, filesystem exposure and published ingress. This is not a complete Docker
security audit. Even an empty concern list conveys no recovery permission.

## Bounds, failures and authority

One explicit invocation, at most five sequential reads, no retries, 3 seconds per
read, 10 seconds total, 8 KiB headers and 256 KiB response bodies. Cancellation
destroys the HTTP request. The CLI adds a 15-second hard process deadline, including
private-file reading. Invalid configuration is permanent until corrected; daemon
failure may be transient but requires a new explicit invocation. Cancellation,
timeout, unsupported API and incomplete responses produce fixed sanitized codes.
There are no remote side effects or completion writes to retry.

Socket access is powerful even when this client only sends GET. Run it outside
Classifarr, as a trusted administrator, with a private config directory and
protected local socket. Do not mount the Docker socket into Classifarr or the
provider. No TCP, SSH, inherited Docker context, proxy, arbitrary API path or
caller-selected command is accepted. Windows permits only a local named pipe;
Linux permits a normalized absolute Unix socket path. A hostile daemon or an
administrator replacing the socket is outside this trust boundary.

Two equal samples are observations, not a lock. Daemon IDs survive restarts;
Docker live restore can retain running work. No database ownership, consent,
cooldowns, attempts or receipts are changed. No new table means no new identifier
or migration; future durable tables still require timestamp migrations and UUIDv7.

## Options and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Clear after a stopped-container check | Minimal implementation | Unbound old work and restart races can overlap inference | Reject |
| Pinned read-only observer | Small, testable; no lifecycle mutations | Cannot authorize recovery | Implement now |
| Exclusive Docker lifecycle supervisor | Can support verified stop evidence | Privileged service, durable dispatch binding and ingress ownership required | Next stage |
| Shared host/systemd discovery | Covers existing shared provider | Cannot prove complete scope from discovery alone | Defer |

Stack: modular ESM observer, native bounded local HTTP, immutable provider pins,
existing PostgreSQL ledger and human-reviewed recovery. Next, bind each dispatch
to a durable provider instance/epoch and design exclusive lifecycle/ingress
ownership before any machine-authorized clearing or replay.

## Completion and evidence

Test malformed/oversized/truncated responses, cancellation, API incompatibility,
changed identity/epoch/configuration, running/stopped/restarting states and secret
redaction using real local HTTP sockets. Rehearse against an exact owned synthetic
Docker container with no ports/network, bounded resources and verified cleanup.
Test packaged observer code separately without mounting a Docker socket. Rebuild
local Compose without cache and verify runtime/default configuration is unchanged.
Record outcomes separately; never claim synthetic tests prove shared Ollama stopped.

## Official research

Sources discovered and opened through MCP on 2026-10-14. The design decisions
above are our inferences, not vendor endorsements.

- [Docker Engine API](https://docs.docker.com/reference/api/engine/) and
  [API 1.51 reference](https://docs.docker.com/reference/api/engine/version/v1.51/):
  versioned inspection endpoints and daemon/client compatibility.
- [Docker security](https://docs.docker.com/engine/security/): daemon socket access
  is privileged authority, not a harmless status permission.
- [Docker run](https://docs.docker.com/reference/cli/docker/container/run/):
  namespace, restart and privilege settings affect container boundaries.
- [Docker live restore](https://docs.docker.com/engine/daemon/live-restore/):
  daemon unavailability does not prove containers stopped.
- [Node HTTP](https://nodejs.org/download/release/v24.19.0/docs/api/http.html):
  local socket requests, cancellation and response parsing/header controls.
