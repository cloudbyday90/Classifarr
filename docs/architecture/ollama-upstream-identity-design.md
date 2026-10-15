# Authenticated Ollama upstream identity

Status: implemented for local synthetic testing, 2026-10-15.

## Decision and scope

Add optional, explicitly configured HTTPS upstreams with a private CA and a
SHA-256 leaf public-key pin. Authenticate each new connection before sending any
HTTP bytes. For compute, commit an append-only peer observation against the
already admitted request before dispatch. Keep HTTP compatibility, clearly
unattested. Nothing enables the gateway on a fresh install.

This is the transport prerequisite of dedicated-provider provisioning, not the
complete provisioning controller. A certificate proves possession of a key, not
which Docker container owns it, where a proxy forwards work, or that work stopped.
Administrator-configured Docker pins remain declarations. Neither kind of
evidence authorizes automatic recovery. Unraid and shared Ollama remain unchanged.

The follow-up [work ownership design](ollama-work-identity-design.md) separates
Classifarr attempt identity from provider identity, including optional private
fingerprints. Unrelated consumers are not adopted into the Classifarr ledger.

## Research and alternatives

Official sources discovered with MCP search and read on 2026-10-15:

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| IP address and Docker inspect only | Simple; preserves existing setup | Does not authenticate the HTTP responder | Retain as explicitly unattested compatibility |
| CA-verified HTTPS plus leaf public-key pin | Rejects a different responder even with another trusted certificate; encrypts requests | Certificate/key rotation needs an offline configuration change; a shared key or proxy is not container attestation | Implement first |
| Enforced dedicated provisioning with an exclusive per-instance key | Can connect transport identity to lifecycle ownership | Requires durable create/start intents, secret lifecycle and exclusive Docker control | Next step before automatic recovery |

[Node.js 24 HTTPS documentation](https://nodejs.org/docs/latest-v24.x/api/https.html)
shows public-key pinning in addition to normal server-identity verification. We
retain CA, certificate validity and IP SAN checks and disable connection/session
reuse. The documentation currently describes 24.22.0; implementation is tested
on the repository's pinned 24.21.0, without a toolchain upgrade.

[Ollama's authentication documentation](https://github.com/ollama/ollama/blob/main/docs/api/authentication.mdx)
states that its local API does not require authentication. Therefore a deployment
would need a separately controlled TLS endpoint; this change does not pretend
that stock Ollama supplies a unique cryptographic container identity.

[Docker networking documentation](https://docs.docker.com/engine/network/port-publishing/)
distinguishes internal networks from isolated bridge mode. Network isolation
remains necessary but is not cryptographic identity. [Docker daemon guidance](https://docs.docker.com/engine/security/protect-access/)
also makes clear that daemon access carries host-level authority. The HTTP
gateway must continue to have no Docker socket or supervisor credentials.

[PostgreSQL UUID documentation](https://www.postgresql.org/docs/current/functions-uuid.html)
provides native time-ordered `uuidv7()`. New evidence IDs use that function, a
strict version/variant constraint, and a UTC-timestamped standalone migration.

## Contract and failure handling

- `gateway.upstream` accepts a fixed private IPv4 HTTP or HTTPS origin, never
  DNS, credentials, paths, queries, redirects, proxy environment or cloud fallback.
- HTTPS requires `upstreamTls: { ca, publicKeySha256 }`; HTTP rejects that object.
  Only these two keys are allowed. The pin is 64 lowercase hexadecimal characters
  over DER SubjectPublicKeyInfo. Pin and CA cannot change on credential reload.
- The TLS handshake is capped at five seconds within the existing request deadline
  (at most 300 seconds). No connection pool, resumed TLS session, retry or downgrade.
- Compute admission remains provider-wide concurrency one, bounded foreground
  waiting, no background backlog, monotonic attempts, persisted busy cooldown and
  the existing 100,000 binding cap. At most one peer observation per binding.
- After admission: open TLS, validate CA/IP/key, commit the observed key and leaf
  certificate hashes with an owner/request/provider guard, recheck cancellation,
  then send HTTP on that same connection. No network I/O occurs in a SQL transaction.
- Certificate/configuration errors are permanent until corrected. A disconnect,
  timeout, cancellation or lost database acknowledgement after admission leaves
  the request uncertain and counted. A peer row alone does not mean dispatch or
  completion. No retry or budget reset follows any such failure.
- Inspection routes authenticate TLS too, but create no compute evidence or
  attempts. Status reads only the database. Provider errors and certificate data
  are never logged; records contain hashes/references/timestamps, not keys,
  prompts, responses, URLs or bearer tokens.
- Schema v5 is an explicit standalone upgrade with the gateway stopped and backed
  up. It preserves active requests, old bindings, attempts, cooldowns and recovery
  receipts. No observations are invented for historical work. Old v4 writers are
  fenced out. This is not a Classifarr application migration.

## Completion and recommended stack

Prove CA/IP/pin refusal before HTTP, persistence before dispatch, failed/lost writes,
cancellation, restart, stale owners, immutable UUIDv7 evidence, legacy migration,
stream/embed/warm compatibility and packaged-image behavior with synthetic services.
Run repository gates, rebuild local Compose without cache and evaluate that image.

Recommended stack: existing ESM gateway + Node TLS with CA/IP/SPKI verification +
PostgreSQL 18 append-only UUIDv7 evidence + separate offline Docker controls. Keep
automatic recovery disabled. Next, provision an exclusive per-instance TLS key and
dedicated provider under a bounded controller, with durable create/start intents
and proof that no other consumers or lifecycle controllers can bypass admission.
