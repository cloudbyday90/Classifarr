# Runtime transport and IP update outcome

## Implemented scope

Follow the [design and official research](runtime-transport-ip-update-design.md).
Server overrides and lockfile now select Engine.IO 6.6.11, ws 8.22.0 and
ip-address 10.7.3. Exactly three package records changed: versions, registry
tarballs and integrity hashes only. No added/removed packages, new installers,
client/root dependency edits, migration or application configuration changes.
New tests are ESM; no production WebSocket endpoint was activated.

## Dependency and local regression evidence — 2026-10-08

- Node 24.21.0 / npm 12.2.0; clean install under unchanged strict lifecycle policy.
- `npm ls --all` reports no problems. Full server npm audit, including development
  dependencies, reports zero vulnerabilities. This is point-in-time scanner
  evidence, not a guarantee of safety.
- Old installed dependencies: 31 pass / 10 fail across 41 focused assertions.
  The same tests pass after the update. One initial reverse-DNS fixture put the
  subnet suffix on the wrong octet; it was corrected before the recorded baseline.
- Expanded transport/IP/Discord regression run: **8 suites, 83 tests passed**.
  Real loopback sockets cover invalid close arguments on both peers, binary
  messages, graceful closure, fragmented payload limits and compression rejection.
  Engine.IO uses real packets/timers; a spy counts timer refreshes across two
  heartbeat cycles, followed by a real timeout despite continuing non-pong traffic.
  IP tests retain real Express quotas and mapped/IPv6/private-range boundaries.
- Backend typecheck and both Knip modes pass. Initial new-test lint errors were
  promise-executor return style, corrected without suppressions; lint then passes.
- Dependency-tooling/install-policy suite: **40 tests passed**.

Full coverage, image rebuild, isolated schema dump/check and local evaluation
are pending at this checkpoint. Do not interpret this document as release approval.

## Random open PR

The current open set was #555 and #556; `Get-Random` selected
[PR #555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`. Applied its exact client manifest and
lockfile changes locally (Node declarations 26.6.4 and undici-types 8.9.0).
The runtime-baseline gate went from **8 passing** to **7 passing / 1 failing**:
Node 26 declarations violate the deployed Node 24 contract. Reversed only the
trial changes and confirmed **8 passing** and no retained client diff. No install
or PR merge. An incompatible PR is not retained merely to include a second change.

## Limits and next work

The predecessor implementation `d8ec4dc9cf8779a17547e68e1e235295d423a596` completed
[main CI](https://github.com/cloudbyday90/Classifarr/actions/runs/37852609737)
successfully, including database and installation checks. Publication/release jobs
were skipped by policy; those results are a baseline, not evidence for this batch.

Next: separately review immutable pins for setup-node and artifact upload/download
actions, including their evidence-transfer consumers. Keep Node 26 declarations,
client TypeScript 7 and unrelated major updates held. No release, tag, version bump,
new branch, Unraid deployment or comparison-memory improvement is claimed here.
