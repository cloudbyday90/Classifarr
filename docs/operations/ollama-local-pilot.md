# Local synthetic gateway pilot

This is an isolated test, not a command to enable shared Ollama or Unraid.
See the [design](../architecture/ollama-local-pilot-design.md) and separate
[outcome](../architecture/ollama-local-pilot-outcome.md).

## Run

Build a clean-source image first. Use its immutable image ID and matching source
label; mutable tags are rejected. Docker and OpenSSL must be available. Set
`OPENSSL_BIN` if OpenSSL is not on PATH.

```text
node scripts/run-ollama-gateway-network-rehearsal.mjs <sha256:image-id> <40-character-source-sha>
```

The runner creates its own random containers, internal networks and fresh data
directories. There are no live-volume, credential or provider overrides. Budget
up to 2 GiB and two CPUs each for the gateway and full application, plus the two
small composition/provider fixtures. Nothing is published to host ports.

The application first verifies direct-mode history is not configured. It saves
synthetic provider settings, then is replaced with explicit private TLS routing.
An administrator performs one warm request. Anonymous/user access, invalid
queries, history reads, a temporary fixture-gateway outage and another application
replacement are checked. Normal authentication, migrations and scheduler remain
enabled. A fixed summary is printed; private test credentials are never printed.

Success requires two total synthetic compute attempts including the original
composition test, unchanged history and admission after outage/replacement, a
blocked direct provider connection and verified resource cleanup. This is not a
real model benchmark, workload classification test or published-release upgrade.

## Failure and rollback

The runner restores a paused fixture gateway in `finally`, then removes only its
owned disposable resources. A cleanup error is a failure, not a pass. Investigate
only the exact reported fixture resources; never use Docker prune.

For a future real pilot, rollback means stop new work and preserve the gateway
database, configuration revision, attempts, cooldowns and unknown work. Restoring
an old application must not enable direct bypass, restore revoked credentials,
replay unknown requests or roll the ledger backward. No such live cutover or
rollback is performed here. Retention/archiving and dedicated-provider deployment
review remain prerequisites to unattended operation.
