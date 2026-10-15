# Optional Ollama gateway: local prototype

Status: Unreleased, 2026-10-15. **Not enabled by default.**
This first slice supports isolated testing, not production cutover. Existing
Classifarr clients still connect directly by default. The bounded study adapters
and saved-verification factory accept an explicitly injected gateway dependency
for local testing; no saved
setting activates it. Do not change the application's saved Ollama host to this
restricted gateway.

## What it does

The standalone ESM process authenticates installation-specific bearer tokens,
admits one compute request at a time, and keeps a bounded foreground waiting list.
Background work is refused while busy instead of accumulating prompts in memory.
The token determines work priority; a request header cannot promote a background
credential. Use separate tokens for each installation/work class.

It requires a **separate PostgreSQL 18 database**. The table primary key, owner
and request references use native time-based UUIDv7; the migration filename uses
a UTC timestamp. These references are not secrets or authorization tokens.
The control ledger stores the current request reference, installation name,
timestamps, attempt count and cooldown. An append-only binding history records
each admitted request and its optional configured provider instance. Neither
stores prompts or answers.

Compute bindings also record operation/model and unique Classifarr request
references. Optional keyed fingerprints distinguish repeat serialized inputs
without storing prompts. See [work identity](ollama-upstream-identity.md).

Without TLS the gateway only binds `127.0.0.1`. Verified TLS supports an explicit
private IPv4 listener (see startup configuration below). The upstream must be a fixed private/loopback
IPv4 HTTP origin, or an explicitly pinned HTTPS origin as described in
[upstream identity](ollama-upstream-identity.md). There is no DNS resolution, redirect following, arbitrary proxy
target, cloud fallback, generation retry, or model installation endpoint. The
operator's model allowlist must use fully qualified names such as `example:latest`.
The gateway does not independently attest that an upstream model is local;
Classifarr's existing model/digest validation remains required for integration.

## Explicit setup for a disposable local test

Do not initialize this schema in a Classifarr application or production database.
With a dedicated, empty test database and schema-owner connection, apply
`database/ollama-gateway/current.sql` using `psql -v ON_ERROR_STOP=1`.
This is the version-6 fresh standalone schema. It deliberately fails
if run again rather than recreating a missing/uncertain ledger.

Create a separate runtime role with database CONNECT, schema USAGE and table
SELECT, column-scoped admission UPDATE and binding INSERT, as listed in the
[offline recovery procedure](ollama-gateway-offline-recovery.md). It needs neither
schema creation nor application-table access. Existing version-1/2/3/4 test databases
require the explicit timestamped upgrades in that procedure, never `current.sql`.
Use a local PostgreSQL socket or verified TLS for a remote database. Do not disable
certificate verification. Keep the database and its ledger durable across restarts.

Create a private JSON configuration file (mode 0600 on Linux; restricted user ACL
on Windows), outside the repository. Its shape is:

```json
{
  "database": {
    "host": "/var/run/postgresql",
    "database": "gateway_test",
    "user": "gateway_runtime"
  },
  "gateway": {
    "upstream": "http://127.0.0.1:11434",
    "port": 11435,
    "models": ["example:latest"],
    "timeoutMs": 180000,
    "queueMs": 5000,
    "credentials": [
      {
        "installation": "local-test",
        "workClass": "background",
        "token": "REPLACE_WITH_A_RANDOM_32_BYTE_BASE64URL_TOKEN"
      }
    ]
  }
}
```

Generate a cryptographically random token of at least 32 bytes. The illustrative
placeholder is not a usable secret. Set `CLASSIFARR_GATEWAY_CONFIG_FILE` to that
file, then explicitly run `npm --prefix server run gateway:ollama`. Do not paste
credentials into command-line arguments, logs, browser code or support reports.
The normal application entrypoint never reads this configuration or starts the
gateway. Keep the containing directory private too. Linux rejects a symlink at
the configuration filename. Do not edit the active file in place.

For a dedicated Docker provider, optionally add `gateway.providerInstance` with
exactly `daemonIdHash` (SHA-256 of daemon ID), `containerId` (full 64-character ID),
`imageId` (immutable `sha256:` ID) and `startedAt` (exact Docker UTC start string,
including nanoseconds). Use the reviewed provider's facts, never a container name
or mutable image tag. Leave the whole object absent if these are not established;
partial objects and `null` are rejected. No Docker socket is needed or accepted.

These pins are administrator-declared intent, **not proof of the actual responder**.
They are saved atomically with each claim before HTTP dispatch. They cannot change
on credential reload. A controlled gateway restart can accept new pins but cannot
rewrite old bindings or clear uncertain work. See the
[binding design](../architecture/ollama-request-binding-design.md) for the evidence
boundary; automatic provider recovery is still disabled.

## Credential rotation and revocation (local prototype)

On Linux, the standalone process supports explicit SIGHUP reload. Replace the
private file atomically from the same private directory, with mode 0600, and send
SIGHUP to the **gateway process**, not the Classifarr application or shared Ollama.
Only credentials may change live. Provider (including instance pins), models, port, deadlines and database
configuration must remain identical. There is no HTTP administration endpoint.

For a routine rotation:

1. Add a newly generated token with the same installation/work class, keeping the
   old token temporarily. The list remains limited to 32 credentials.
2. Replace the file, signal the gateway, and confirm the fixed
   `ollama_gateway_credentials_reloaded` message. Confirm the new token with the
   database-only `/gateway/status` endpoint; never put it in logs or a URL.
3. Close/recreate the affected test client with the new credential.
4. Remove the old token, replace the file and reload again. Confirm the reload and
   that the old token now receives 401. Merely editing a file does not revoke it.

For suspected compromise, remove the token immediately instead of keeping overlap.
Removed tokens or changed installation/work-class bindings cancel their body reads,
inspection, queued and active requests. Unchanged credentials continue. Work that
was already dispatched may still be running upstream; its durable uncertainty is
not cleared. Revocation cannot retract partial output already delivered.

A missing, invalid, non-private or incompatible file, or a five-second reload
deadline, emits `ollama_gateway_reload_failed` and stops the gateway with exit code
1. Current credentials remain valid until replacement succeeds or failure stops
the process. Do not interpret a signal alone as successful revocation. Correct the
file before restarting; retained attempts, cooldowns and uncertain markers survive.
To revoke everyone, stop the gateway. Empty credential lists are not accepted.
Windows uses explicit stop/replace/restart instead of SIGHUP.

Reloads are serialized with at most one queued follow-up. The startup path is fixed;
environment edits cannot redirect reloads. No token expiry or secret-manager client
is implemented yet. Never restore revoked credentials from an old file backup.
See the [lifecycle design](../architecture/ollama-gateway-credential-lifecycle-design.md)
and [outcome](../architecture/ollama-gateway-credential-lifecycle-outcome.md).

## API and fixed bounds

Every route requires `Authorization: Bearer <token>`. Status is
`GET /gateway/status`; it reads only the control database. It returns `ready`,
`cooldown`, `maintenance`, `uncertain_or_active`, or `history_full`, plus attempt
count, current request reference, timestamps and waiting count. Binding count/limit
and the active binding's ID/evidence kind are included; full container pins are
available only through offline database inspection. It does not imply GPU-wide idleness.

Binding history is capped at 100,000 records. At capacity new compute is refused;
completion, recovery and status still work. Do not reset the counter or delete
history to bypass the cap. A reviewed retention/archiving policy is deferred, so
this remains a bounded prototype rather than an unattended production rollout.

Supported upstream routes: GET `/api/tags`, `/api/ps`, `/api/version`; POST
`/api/show`, `/api/generate` with an explicit boolean `stream`, and `/api/embed` with
at most eight input strings. Query strings, chat, images, arbitrary decoding
options and model administration are rejected. Generation options are limited to
temperature (0–2), seed (0–2,147,483,647), context (1–65,536), and output tokens
(1–4,096). These gateway ceilings are not permission to raise caller limits.

Requests are capped at 256 KiB; generation/inspection replies at 1 MiB, embedding
replies at 4 MiB. Streaming uses validated NDJSON, at most 64 KiB per record and
8,192 records within the same 1 MiB total. Partial records are forwarded with
backpressure; the final `done` record follows clean upstream EOF and the durable
completion write. An interrupted stream closes without a fabricated final record.
At most 32 handlers and 64 connections are accepted, with a
global 120 requests/minute intake limit including authentication failures. One
installation can have one waiting foreground request; at most eight wait globally.
Default queue wait is five seconds (maximum thirty); default total request time
is 180 seconds (maximum 300), including body intake and waiting. No prompt queue
survives restart. Existing caller consent, memory checks and retry/attempt limits
remain necessary and must not be reset when integrating this service.

Complete upstream 429/503 replies create a persisted five-second cooldown.
Rejected requests return fixed codes, never provider error text. An aborted,
truncated, malformed, timed-out or otherwise uncertain dispatched request keeps
its durable marker. Missing control state, database-session loss or a different
upstream identity fails closed. A second active gateway for the same database
cannot start. Do not use multiple databases to coordinate the same provider.

There is intentionally **no clear-lock endpoint**. A gateway restart, expired
timeout or loaded-model listing does not prove an upstream request stopped. An
uncertain request requires the separate
[offline administrator-reviewed recovery procedure](ollama-gateway-offline-recovery.md);
never delete the ledger or restart shared Ollama as an automatic workaround.
The procedure records human attestation, not machine-verified provider termination.
This prototype remains local-test-only, not ready for live cutover.

The current invocation can safely finish a claim when cancellation occurs before
transport is invoked, or after a fully validated provider response. It still
counts the attempt and preserves cooldowns; no cancelled caller receives the
answer. This is bookkeeping, not a retry or proof of remote cancellation. Lost
evidence, uncertain dispatch and failed completion writes still block recovery.
See the [completion-recovery design](../architecture/ollama-gateway-completion-recovery-design.md).

## Explicit client integration for local fixtures

`server/src/ollamaGateway/client.mjs` exports `createGatewayClient`, accepting
`{ url, upstream, models, token, ca? }` and `{ expectedUpstream }`. The gateway URL
must be a fixture HTTP `127.0.0.1` origin or HTTPS private IPv4 origin with an
explicit PEM CA. Startup activation requires HTTPS. The expected provider must match the declared
upstream; its hash is checked by the gateway before dispatch. There is no redirect,
ambient proxy, caller-supplied header passthrough or direct-provider fallback.
Credentials remain in the client's closure, not returned diagnostics.

Use `request(path, body, { signal, timeoutMs, maxResponseBytes, onRecord })`.
For streaming generation supply `stream: true` and an async `onRecord` callback;
the request promise returns the final record only after clean completion. A
callback cannot turn partial text into a verified result. The same total deadline
bounds backpressure and callbacks. `close()` cancels outstanding requests and
rejects future requests. At most 32 client requests may be in flight.

`createLocalDescriptionBenchmarkClient` and `createLocalStudyEmbeddingClient`
accept the same private gateway configuration via their second argument's
`gateway` property. This dependency is never taken from the normal AI settings
response. They retain the saved provider identity, model/digest checks, attempt
hook and their 180/60-second deadlines. Embedding replies retain the 4 MiB limit;
gateway inspection replies use its stricter 1 MiB limit. Their `close()` methods
close their owned gateway clients. Omitting the dependency preserves direct mode.

`createOllamaGatewayGenerationClient({ configuration, gateway })` binds the shared
primary generation leaves to one immutable `{ baseUrl, model }` configuration.
It provides `generate`, `generateWithProgress`, `preflightConnection`, `getVersion`
and `close`. The saved-verification factory accepts `gateway` in its private
factory argument and uses the same adapter. Neither is a full Ollama service:
there is no warming, embedding or model-administration fallback. Untagged models
mean `:latest`; all other model overrides are rejected. Preflight reads the exact
current model and digest rather than reusing cached success. Close and recreate
the factory when configuration or credentials change.

Strict streams reject partial output even if permissive options were also passed.
External controllers must disable partial-on-stall; use the adapter-owned
controller when partial stalls are allowed, so it can cancel its own transport.
Ordinary streams retain permitted abort/stall partials, cancel their transport,
and do not report complete progress. Unknown dispatch stays blocked in the ledger.
Streaming hard time is capped at five minutes, including preflight; a gateway
configured with a shorter timeout can stop it sooner. Reasoning requests that
normally allow ten minutes do not extend this gateway cap. Buffered generation
defaults to two minutes after preflight. This is an explicit test-mode limitation.

The default running installation has not been rerouted. Explicit startup can bind
the main classifier, warming, inspection and verification together; model admin
operations are refused. Network ACLs and verified uncertainty recovery remain
prerequisites to live coordination. See the [streaming design](../architecture/ollama-gateway-streaming-design.md)
and [outcome](../architecture/ollama-gateway-streaming-outcome.md).

### Shared provider context (explicit dependency only)

`createOllamaGatewayProviderContext({ configuration, gateway })` owns one common
transport. Configuration binds `{ baseUrl, model, embeddingModel? }`; optional
`host` and `port` must agree with the origin. The generation-only factory above
is a compatible restricted view of this context.

Alongside generation and verification preflight, the context provides
`getModels`, `getLoadedModels`, `getModelInfo`, `embed`, `warmModel` and
`warmEmbeddingModel`. Inspection only returns bound models. Warming and text
embeddings spend durable attempts and use five-minute keep-alive. Embedding
truncation is disabled. Missing models are refused, not downloaded. There is no
model-administration, multimodal or direct-HTTP fallback.

The embedding adapter factory accepts optional `ollamaProviderContext`. If
provided, matching explicit host/port values confirm the binding; conflicting or
partial overrides fail before dispatch. That branch bypasses the direct retry
wrapper. Opt-in startup supplies the scoped owner before normal constructors load.

Close and replace the whole context on configuration/credential changes. Close
aborts inspection and compute together without clearing uncertain gateway work.
Do not enable partial routing: use coordinated startup for health probes, the
embedding router, settings tests and application warming. See the
[provider-context design](../architecture/ollama-gateway-provider-context-design.md)
and [verification outcome](../architecture/ollama-gateway-provider-context-outcome.md).

## Local image rehearsal

After a clean-source no-cache Classifarr image build, run:

```text
node scripts/run-ollama-gateway-rehearsal.mjs <sha256:image-id> <40-character-source-sha>
```

The existing owned-container runner creates synthetic data with no external
network, no published ports, two CPUs, 2 GiB memory and 512 PIDs. The normal
application entrypoint stays intact. A separate fixture starts the packaged
gateway CLI against a loopback stub and a dedicated least-privilege database
role. It checks two installation credentials, queue priority, UUIDv7, preserved
attempts, Linux credential reload/revocation, invalid-file shutdown, graceful
restart and abrupt process death. Only its randomly named
container/data directory are removed, with cleanup verified. It never calls real
Ollama and is not proof of a published-release upgrade or real model quality.

Next: evidence-based uncertainty recovery and an operator-approved deployment
cutover before live activation. See the
[generation design](../architecture/ollama-gateway-generation-design.md) for
tradeoffs and the [generation outcome](../architecture/ollama-gateway-generation-outcome.md)
for verification and remaining limits.
See [design](../architecture/shared-ollama-admission-design.md) and
[outcome](../architecture/shared-ollama-admission-outcome.md).

## Opt-in application startup with TLS

See the separate [startup design](../architecture/ollama-gateway-startup-design.md)
and [outcome](../architecture/ollama-gateway-startup-outcome.md). This is not an
instruction to enable the shared Unraid provider during development.

Provision a certificate with the gateway listener's exact IP in its Subject
Alternative Name and a private CA trusted by each application. In the gateway
file above, add `gateway.host` and `gateway.tls` containing PEM `cert` and `key`
strings. TLS 1.2 is the minimum; clients retain CA and identity verification even
if an ambient Node setting disables global certificate checks. No insecure option
is accepted. Listener, key/certificate, CA, endpoint and application configuration
changes require restart; SIGHUP remains credential-only on the standalone gateway.

Create a second private JSON file for the application, with this shape (replace
all placeholders; no real credentials belong in this document):

```json
{
  "revision": 1,
  "configuration": {
    "baseUrl": "http://10.20.0.2:11434",
    "model": "example:latest",
    "embeddingModel": "vectors:latest"
  },
  "foreground": {
    "url": "https://10.10.0.2:11435",
    "upstream": "http://10.20.0.2:11434",
    "models": ["example:latest", "vectors:latest"],
    "ca": "REPLACE_WITH_PEM_CA",
    "token": "REPLACE_WITH_FOREGROUND_TOKEN"
  },
  "background": {
    "url": "https://10.10.0.2:11435",
    "upstream": "http://10.20.0.2:11434",
    "models": ["example:latest", "vectors:latest"],
    "ca": "REPLACE_WITH_SAME_PEM_CA",
    "token": "REPLACE_WITH_DISTINCT_BACKGROUND_TOKEN"
  }
}
```

Set `CLASSIFARR_OLLAMA_ROUTING_FILE` to that file in the **container environment**
and mount it read-only with mode 0600 owned/readable by the application identity.
The selected-identity launcher also accepts this validated path. Keep its parent
directory private. Maximum JSON size is 64 KiB. Linux rejects final symlinks;
Windows requires operator-managed private ACLs. Absent means direct mode;
present-but-empty, missing or invalid fails startup. Restore mode ignores it.
Do not change saved Ollama settings to the gateway address: those continue to
identify the true upstream and must agree with this binding. Model changes need a
matching file and restart; mismatch refuses work rather than bypassing admission.

This file is process-fixed; deleting it while running does not disable routing.
To disable, explicitly stop work and the application, preserve the ledger, remove
the setting and restart only after reviewing network policy and outstanding
uncertainty. Do not temporarily allow direct access to escape a blocked ledger.

TLS covers application-to-gateway traffic. Gateway-to-Ollama remains HTTP and must
stay on a trusted isolated backend network or loopback, not an untrusted LAN.
Applications must not share that backend network; do not publish Ollama's port.
For a LAN deployment, firewall rules must permit only the gateway to reach Ollama
and must cover IPv4/IPv6 and alternative addresses. This is deployment-specific;
the application does not inspect or mutate host firewall rules. TLS configuration
alone is not evidence that bypass is blocked.

For a synthetic packaged test with two internal Docker networks and three
containers (no published ports or external provider):

```text
node scripts/run-ollama-gateway-network-rehearsal.mjs <sha256:image-id> <40-character-source-sha>
```

The runner also verifies that the packaged gateway saved the synthetic provider's
exact declared container/start reference and a UUIDv7 binding. This is a controlled
fixture assertion, not a general transport-attestation mechanism.

The runner needs OpenSSL to generate disposable test certificates (`OPENSSL_BIN`
can select a native executable). It checks a positive gateway call and a blocked
direct provider connection from the application network. It uses the packaged
startup function with injected no-op database admission/runtime, not a second
full production worker deployment. Temporary keys, labeled networks and exact
owned containers are removed, and cleanup is verified.

For dedicated Docker provider planning, the optional
[boundary observer](ollama-docker-boundary.md) reports pinned container facts
without granting recovery authority. It runs outside Classifarr and is not a
replacement for the offline administrator-reviewed recovery procedure.

The separate [reviewed offline stop controller](ollama-provider-stop.md) can
record a one-shot stop intent for a narrowly supported dedicated provider. It
does not clear uncertain work, restart providers or enable automatic recovery.
