# Optional Ollama gateway: local prototype

Status: Unreleased, 2026-10-14. **Not enabled by the Classifarr application.**
This first slice supports isolated testing, not production cutover. Existing
Classifarr clients still connect directly by default. The bounded study adapters
now accept an explicitly injected gateway dependency for local testing; no saved
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
The control ledger stores only the current request reference, installation name,
timestamps, attempt count and cooldown. It never stores prompts or answers.

The gateway only binds `127.0.0.1`. The upstream must be a fixed private/loopback
IPv4 HTTP origin. There is no DNS resolution, redirect following, arbitrary proxy
target, cloud fallback, generation retry, or model installation endpoint. The
operator's model allowlist must use fully qualified names such as `example:latest`.
The gateway does not independently attest that an upstream model is local;
Classifarr's existing model/digest validation remains required for integration.

## Explicit setup for a disposable local test

Do not initialize this schema in a Classifarr application or production database.
With a dedicated, empty test database and schema-owner connection, apply
`database/ollama-gateway/20261014_121441_admission.sql` using `psql -v ON_ERROR_STOP=1`.
This initial migration is also the fresh standalone schema. It deliberately fails
if run again rather than recreating a missing/uncertain ledger.

Create a separate runtime role with database CONNECT, schema USAGE and table
SELECT/UPDATE only. It needs neither schema creation nor application-table access.
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
gateway. To rotate credentials, stop the gateway and replace its private file;
restart retains any uncertain in-flight marker and attempt count.

## API and fixed bounds

Every route requires `Authorization: Bearer <token>`. Status is
`GET /gateway/status`; it reads only the control database. It returns `ready`,
`cooldown`, or `uncertain_or_active`, plus attempt count, current request reference,
timestamps and waiting count. It does not imply GPU-wide idleness.

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
uncertain request requires a separately designed, verified recovery procedure;
never delete the ledger or restart shared Ollama as an automatic workaround.
This availability limitation is why this prototype is not ready for live cutover.

## Explicit client integration for local fixtures

`server/src/ollamaGateway/client.mjs` exports `createGatewayClient`, accepting
`{ url, upstream, models, token }` and `{ expectedUpstream }`. The gateway URL must
be an HTTP `127.0.0.1` origin. The expected provider must match the declared
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

The main classifier, warming, model administration and verification transports
have not been rerouted. Cross-host TLS and installation-wide credential lifecycle
are not provided by this local-only client. These remain prerequisites to live
coordination. See the [streaming design](../architecture/ollama-gateway-streaming-design.md)
and [outcome](../architecture/ollama-gateway-streaming-outcome.md).

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
attempts, graceful restart and abrupt process death. Only its randomly named
container/data directory are removed, with cleanup verified. It never calls real
Ollama and is not proof of a published-release upgrade or real model quality.

Next: integrate the main classification/verification transports without changing
their existing cancellation or partial-result policy, then design authenticated
cross-host deployment and evidence-based uncertainty recovery before any cutover.
See [design](../architecture/shared-ollama-admission-design.md) and
[outcome](../architecture/shared-ollama-admission-outcome.md).
