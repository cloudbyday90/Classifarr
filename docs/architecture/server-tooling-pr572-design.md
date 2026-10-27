# Server tooling PR 572 design

Date: 2026-10-27. Scope: locally implement the randomly selected open
[PR 572](https://github.com/cloudbyday90/Classifarr/pull/572), without merging it.

## Selection and immutable input

The connected GitHub MCP returned five open PRs: 572, 571, 570, 569 and 568.
A local `Get-Random -Minimum 0 -Maximum 5` selected index zero from that list.
The inspected head is `59d62d04809f41a8a1be7a4cd3140c2b9ce2888c`, based on
`b484ce770fdbc5459c232507b80ff36aea8d873c`. Its two changed files are the server
manifest and lockfile. The immutable diff was obtained through GitHub MCP.

## Recommendation and tradeoffs

Apply `eslint-plugin-n` 18.5.0 and `knip` 6.42.1 with exact versions. Retain the
repository's npm lifecycle-script decisions and overrides. Although registry
metadata offers a newer Knip, taking that unrelated version would stop this
being a bounded implementation of the selected PR.

| Option | Advantage | Cost | Decision |
| --- | --- | --- | --- |
| Merge the provider PR | Preserves provider history automatically | Contrary to the requested local implementation | Reject |
| Apply the reviewed versions locally | Reproducible, scoped tooling validation | Requires lockfile/transitive review | Select |
| Update every outdated package | Fewer outstanding updates | Mixes runtime, client and lint regressions | Defer |

Official release links were discovered in the provider PR and through the search
MCP, then retrieved: [eslint-plugin-n releases](https://github.com/eslint-community/eslint-plugin-n/releases)
and [Knip releases](https://github.com/webpro-nl/knip/releases). The Node plugin
update adds current Node built-in support and fixes lint analysis. Knip updates
parser/tool integrations; review its native parser packages and changes to Jest
dependency detection. Verify exact registry engines, peers, scripts and locked
transitives before installation.

Exact upstream references retrieved through GitHub MCP:

- [eslint-plugin-n 18.5.0 changelog](https://github.com/eslint-community/eslint-plugin-n/blob/v18.5.0/CHANGELOG.md).
- [Knip 6.42.0](https://github.com/webpro-nl/knip/releases/tag/knip%406.42.0)
  and [6.42.1](https://github.com/webpro-nl/knip/releases/tag/knip%406.42.1).
- [unbash 6 migration](https://github.com/webpro-nl/unbash/releases/tag/6.0.0).

## Execution and validation

Use the pinned Node 24.22.1/npm 12.2.1 toolchain locally without changing global
installation. Generate the lockfile with scripts disabled, review package graph
changes, then perform a clean install under the existing strict script policy.
Run dependency-tree validation, audit, lint, typecheck, Knip, relevant backend
tests and the existing dependency-tooling checks. Keep existing failures visible.

Inspect stale Dependabot PRs against current main. Superseded updates can be
closed; use the documented bot rebase command where an update still needs
rebasing. [GitHub's command reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-pull-request-comment-commands)
was discovered and opened through search MCP. Do not force-push main, merge a PR,
disable future dependency updates or create a release.

Observed results and PR disposition belong in
[the separate outcome](server-tooling-pr572-outcome.md).
