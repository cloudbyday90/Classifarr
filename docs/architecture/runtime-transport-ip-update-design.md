# Runtime transport and IP dependency update

## Scope and decision — 2026-10-08

Update only the server's exact overrides: Engine.IO 6.6.10 → 6.6.11,
ws 8.21.0 → 8.22.0 and ip-address 10.7.1 → 10.7.3. Keep Node 24.21.0,
npm 12.2.0, authentication, proxy trust, payload limits, memory safeguards,
database schema and deployment templates unchanged. No release is authorized.

Socket.IO's `~6.6.0` accepts the Engine.IO patch. express-rate-limit's `^10.2.0`
accepts the IP patch. The existing ws override already permits 8.22.0, but
Engine.IO's `~8.21.0` and socket.io-adapter's `~8.18.3` do not. Pin the reviewed
version exactly and test the shared transport rather than claiming universal
upstream support. Discord's `^8.17.0` accepts it. Its HTTP Undici 6 override stays.

The progress WebSocket service is currently unwired; this work must not expose
its unauthenticated subscriptions. The active IP dependency is used by HTTP rate
limiting. Reverse-DNS conversion is dependency hardening, not a demonstrated
application exploit or a fix for the comparison-worker memory report.

## Official research

URLs and patches were retrieved through GitHub MCP release collections and
official web search on 2026-10-08; registry metadata was queried using pinned npm.

- [Engine.IO 6.6.11](https://github.com/socketio/socket.io/releases/tag/engine.io%406.6.11)
  and its [patch](https://github.com/socketio/socket.io/commit/da008a514ded71e3058a964c831c69abe417b2f5)
  extend a pending pong deadline once per heartbeat cycle when another packet
  arrives. Traffic without a pong must still be disconnected eventually.
- [ws 8.22.0](https://github.com/websockets/ws/releases/tag/8.22.0) keeps invalid
  close arguments from wedging an open connection and adds a protocols option.
  The intervening 8.21.3 release corrects compression window negotiation.
- [ip-address 10.7.3](https://github.com/beaugunderson/ip-address/releases/tag/v10.7.3)
  checks reverse-IPv4 input length before splitting. The
  [maintainer explanation](https://github.com/beaugunderson/ip-address/pull/228)
  classifies this as hardening, not an accepted security advisory. Version 10.7.2
  also accepts mixed-case reverse-DNS suffixes and missing trailing root dots.
- [Socket.IO options](https://socket.io/docs/v4/server-options) explain heartbeat
  and message-size limits and compression's memory overhead. Preserve these
  defaults; do not enable compression or increase budgets to make tests pass.
- [ws API](https://github.com/websockets/ws/blob/master/doc/ws.md) defines close
  validation and payload limits. Exercise actual loopback connections and cleanup.

Candidate Node engines are >=10.2, >=10 and >=12 respectively. No new native
dependency is required. ws's native peers remain optional. Registry tarball
installs have no added install/postinstall hooks; ip-address's repository prepare
and prepack scripts are not permission to run them. Keep strict allow-scripts.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Hold all versions | No dependency churn | Leaves verified fixes blocked; reject |
| Engine.IO/IP patches with ws 8.21.3 | Closest Engine.IO parent range | Misses invalid-close fix; fallback if real transport tests fail |
| Exact three-package batch | Reviewed fixes, repeatable shared transport | ws crosses two parent tilde ranges; recommended with regressions |
| Broad latest-version refresh | More packages current | Unrelated failures and larger review surface; defer |

1. Prove the old/new behavior with real transports and bounded parser tests.
2. Review lockfile deltas, clean install, full dependency tree/audit, backend
   regressions, lint, typecheck and both Knip modes. Do not weaken checks.
3. Commit clean source, build local Compose without cache, compare image inventory,
   dump/check schema in a disposable database, then evaluate the backed-up local
   test installation. No Unraid access or published-image claim.
4. Next, review pinned CI artifact actions separately before release preparation.

## Random PR trial

The open set contained #555 and #556. PowerShell `Get-Random` selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), head
`5545605b53c854de8847b44e24fa083ff4218080`. Apply its exact client manifest/lock
diff locally and run the runtime baseline gate before any install. Node 26 types
must not silently replace declarations for deployed Node 24. No merge or PR
state change. Record acceptance/rejection and executed checks in the separate
[outcome](runtime-transport-ip-update-outcome.md).
