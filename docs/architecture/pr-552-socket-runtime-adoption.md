# PR 552: local Socket.IO adoption

Date: 2026-09-28. No PR merge, tag or release.

## Selection and design

The connected GitHub search returned open PRs 549 and 552. A uniform random draw
selected [PR 552](https://github.com/cloudbyday90/Classifarr/pull/552), confirmed
open and unmerged at head `44d9f66abd398560ab75ff22954f51e8fa795853`.

Implement its manifest and lockfile diff locally: Socket.IO 4.8.3 → 4.8.4, with
manifest range `^4.8.4`. The installed package integrity matches the fetched PR.
Installation disables lifecycle scripts; no unrelated dependencies are upgraded.

## Official research and tradeoffs

The upstream [4.8.4 release](https://github.com/socketio/socket.io/releases/tag/socket.io@4.8.4)
was discovered through the PR and official release listing. It fixes retained
acknowledgements after timeouts and rejects stateful dynamic-namespace expressions,
along with other server/type fixes. These are upstream claims, not evidence that
Classifarr has experienced each defect.

Benefit: a small compatible patch includes resource-cleanup and validation fixes.
Risk: transport behavior is runtime-sensitive; mocked tests alone are inadequate.
Recommendation: retain this exact update with a real loopback WebSocket/Socket.IO
handshake and a deliberately unacknowledged event, plus namespace rejection tests
and the broader platform checks. The client dependency is unchanged.

## Outcome

Both dedicated compatibility tests passed against the installed package: the timed
out acknowledgement is removed, and global/sticky namespace regular expressions
are rejected. The test closes its owned servers and connection. All test code is
ESM. Broader validation is recorded in [the installation outcome](scheduled-installation-outcome.md).
