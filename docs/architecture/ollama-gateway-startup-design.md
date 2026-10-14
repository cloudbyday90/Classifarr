# Opt-in Ollama gateway startup and transport

Date: 2026-10-14. Local implementation and synthetic testing only.

## Decision

Add an operator-owned private JSON configuration file, selected by
`CLASSIFARR_OLLAMA_ROUTING_FILE`. Absent means unchanged direct mode; a present but
invalid file fails startup before normal services load. Restore mode does not
activate AI routing. Wrap admission, dynamic service imports, listeners and timers
in the existing asynchronous owner. Close that owner on startup failure, admission
loss, process termination and server closure. Never clear its scope to fall back.

Startup requires HTTPS to a fixed private IPv4 gateway, an explicit trusted CA,
normal certificate identity verification, TLS 1.2 or newer and distinct foreground
and background tokens. No DNS, redirects, proxy environment, insecure certificate
switch or HTTP downgrade. Existing loopback HTTP remains available only to explicit
programmatic fixtures. Gateway TLS uses the same bounded HTTP handler and ledger;
its HTTP listener cannot bind off-loopback. TLS key/certificate changes require a
restart; credential-only reload remains supported.

No new scheduler, consent, retries or schema. Admission keeps UUIDv7 identities,
one compute slot, bounded foreground waiting, no background backlog, persisted
attempts and cooldowns. Cancellation or death after dispatch remains uncertain.
The new configuration/ownership step performs no inference. Existing startup and
background jobs retain their existing consent and admission. Configuration is fixed for the process;
changing it requires restart, not editing provider settings to bypass routing.

## Network boundary

TLS protects credentials, not admission bypass. The gateway must be the only
network principal allowed to reach Ollama. For containerized providers, isolate
the provider on an internal backend network with no published port; attach only
the gateway to both frontend and backend networks. Application containers join
only the frontend. For the existing LAN provider, enforce equivalent host/router
ACLs before activation. Do not claim a configuration boolean or failed TCP probe
proves a firewall. Host administrators and Docker socket owners remain trusted.

The current shared LAN installation is NOT activated by this work. Local test
evidence must distinguish scoped application routing from actual network isolation.
No automatic network-rule edits or host-wide firewall mutations are authorized.

## Research and alternatives

Official pages discovered and opened through MCP on 2026-10-14:

- [Node.js 24 TLS](https://nodejs.org/download/release/v24.20.0/docs/api/tls.html):
  retain CA verification and default identity checks; use a dedicated CA per
  configured gateway rather than changing global trust or disabling verification.
- [Docker Compose networks](https://docs.docker.com/reference/compose-file/networks/):
  explicit network membership separates services; `internal` removes external
  connectivity. Our deployment recommendation additionally forbids publishing the
  provider port and requires testing from the application's network namespace.
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md): preserve
  buffered/streaming contracts and bounded model retention at the gateway.

| Option | Advantage | Cost |
| --- | --- | --- |
| Direct shared Ollama | No additional service | No shared admission or workload isolation |
| External TLS proxy | Mature certificate automation | Extra service and another bypass boundary |
| Native gateway TLS plus network ACLs | One admission/transport boundary, no package | Operator must manage certificates and network policy |

Recommend native Node HTTPS, private file configuration, scoped ESM application
ownership, PostgreSQL 18 UUIDv7 ledger and independent network ACLs. Fixed IPv4
avoids DNS rebinding but requires certificate IP SANs and explicit address upkeep.
Startup refusal on invalid configuration is intentional availability-for-safety
tradeoff. Uncertain attempts are not reset to recover availability.

## Acceptance

Test absent/invalid/private-file configurations, restore, import-time and later
callback scope, signal/admission cancellation, TLS trust/identity failures, no
downgrade, and real HTTP/PostgreSQL behavior. Rehearse packaged code, build without
cache and evaluate local direct mode without modifying saved consent. Document
remaining deployment-specific gaps separately from implemented behavior.
