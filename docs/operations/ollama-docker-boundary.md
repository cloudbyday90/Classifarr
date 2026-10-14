# Inspect a dedicated Docker provider boundary

This optional offline tool reports observations only. It does not stop, start,
recover, resume or send inference. Every result has `recoveryAuthorized: false`.
It is groundwork for a dedicated provider supervisor, not an automatic repair.

## Prerequisites and use

Run outside Classifarr as a trusted administrator with local Docker socket access.
Do not mount that socket into Classifarr or the provider. Docker socket access is
privileged; protecting this tool does not make that access read-only for other
programs. Use a private directory and a mode-0600 JSON file on Linux; restrict its
Windows ACL to the operator. Never supply a remote Docker endpoint.

Create a document with exactly these fields from an independently reviewed
dedicated provider deployment. Do not automatically repin on mismatch:

```json
{
  "socketPath": "/var/run/docker.sock",
  "daemonIdHash": "<SHA-256 hex of Docker info ID, without trailing newline>",
  "containerId": "<full 64-character lowercase container ID>",
  "imageId": "sha256:<64-character image ID from container inspect Image>",
  "startedAt": "<exact container inspect State.StartedAt value>"
}
```

The placeholders intentionally fail validation. Use the actual locally configured
socket, not an assumed path. Docker Desktop Windows uses a local named pipe; JSON
requires escaping backslashes, for example `"\\\\.\\pipe\\dockerDesktopLinuxEngine"`.
The observer ignores Docker contexts and proxy environment settings. It requires
a Linux daemon supporting API 1.51, not Windows containers.

Set `CLASSIFARR_GATEWAY_BOUNDARY_CONFIG_FILE` to that private file and run:

```sh
node server/src/scripts/observeOllamaProviderBoundary.mjs inspect
```

Exit zero means the read completed for the pinned container, **not** that recovery
is permitted. `stopped` describes only that container epoch in two samples.
`not_stopped` covers running and other non-exited states. `changed` means a pin or
sample differed. `unavailable` includes missing containers, unsupported API,
incomplete data and daemon failure. `cancelled` follows operator interruption.
Do not interpret absence, a failed read or a stale saved report as stopped work.

Configuration concerns are fixed codes, not raw Docker data. A provider using
private networking or GPU devices will require additional review; an empty list
does not establish exclusive ingress, complete process scope or lifecycle control.
Two equal samples cannot exclude activity between or after them. The daemon ID
is not a boot ID. A future supervisor must bind dispatches to an exact instance
and control all lifecycle/ingress changes before these observations can contribute
to machine-authorized recovery.

Continue to use the [offline recovery procedure](ollama-gateway-offline-recovery.md)
when needed; this report cannot replace its independent administrator review.

## Local synthetic rehearsal

The runner requires an immutable local image, its exact source SHA and an explicit
local daemon endpoint. It creates only a labeled synthetic Node container, with
no network, ports or inference, and checks running/stopped/restarted observations.
It also exercises the packaged CLI against a fake Docker Unix socket. It never
mounts a real Docker socket. Only this runner starts/stops its own synthetic
container; the observer sends GETs only. Owned cleanup is verified.

```sh
node scripts/run-ollama-docker-boundary-rehearsal.mjs <image-id> <source-sha> <local-docker-endpoint>
```

See the [design and researched alternatives](../architecture/ollama-docker-boundary-design.md)
and [verification outcome](../architecture/ollama-docker-boundary-outcome.md).
