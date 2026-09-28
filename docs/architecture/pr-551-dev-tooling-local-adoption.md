# PR 551 development tooling: local adoption

Date: 2026-09-28.

## Selection and scope

The connected GitHub service returned open PRs 551, 550 and 549. One random draw
selected [PR 551](https://github.com/cloudbyday90/Classifarr/pull/551), at head
`32809c2ac7ac0707cd8debf9c0f91ce3b232df30`. Its two development updates were
applied locally, not merged through GitHub:

- Knip `^6.37.0` → `^6.38.0`.
- Supertest `^7.2.2` → `^7.3.0`.

The server lockfile was regenerated using npm with install scripts disabled.
Review confirmed only these two package records and root development ranges
changed; their integrity values match the selected PR. Production dependencies,
runtime version and release metadata remain unchanged.

## Research, tradeoffs and decision

[Knip release notes](https://github.com/webpro-nl/knip/releases) describe the
6.38.0 tooling improvements; [Supertest's official releases](https://github.com/forwardemail/supertest/releases)
document 7.3.0. URLs were obtained from the PR through GitHub MCP and opened
through web tools, including the Supertest repository redirect.

Benefit: current dependency analysis and HTTP test tooling, including Supertest
ephemeral-server behavior fixes. Cost: development updates can expose new lint
findings or change request/assertion behavior. They do not belong in a production
runtime repair and are validated separately through the existing gates.

Recommendation: adopt these bounded updates only with dependency checks and the
full backend unit/integration suites. Retain the current runtime architecture;
do not widen dependency ranges beyond the selected PR or merge it remotely.

## Outcome

The local package/lockfile changes are implemented. Validation totals and any
limitations are recorded in the separate
[Jellyfin recovery outcome](jellyfin-restart-recovery-outcome.md).
No release, PR merge, deployment or production dependency update is part of this work.
