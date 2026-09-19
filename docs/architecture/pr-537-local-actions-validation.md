# PR 537: local GitHub Actions update

Date: 2026-09-19.

## Selection and scope

The GitHub MCP service listed open PRs 532, 536 and 537. A single Node
`crypto.randomInt(3)` draw selected [PR #537](https://github.com/cloudbyday90/Classifarr/pull/537).
Its inspected head was `a6a38e5fa4e8f30f0d3e63b4955f27c608d1c29b`.
Applied its seven workflow references locally; no PR merge, release or tag.
Reconciled the repository's image-provenance validator with the new verified
build/push SHA. The PR alone left this strict allowlisted revision stale, which
the full server suite caught. No provenance gate or permission check was relaxed.

## Verified upstream revisions

GitHub MCP reads of the official tag refs resolved each tag directly to the
proposed commit. Release pages were also fetched, rather than assumed.

| Action | Official release | SHA used |
| --- | --- | --- |
| Docker QEMU | [v4.4.0](https://github.com/docker/setup-qemu-action/releases/tag/v4.4.0) | `99012661954931238ded8c8b007157a8430204e1` |
| Docker Buildx | [v4.4.1](https://github.com/docker/setup-buildx-action/releases/tag/v4.4.1) | `f87e5991a6d7451dcb8d9637bfbc97413f497069` |
| Docker build/push | [v7.4.0](https://github.com/docker/build-push-action/releases/tag/v7.4.0) | `c3c9e263c25d99ce0380d002d59b67737d91b0dc` |
| OSV scanner, four references | [v2.6.0](https://github.com/google/osv-scanner-action/releases/tag/v2.6.0) | `a345acffa64b0eaede81a3d9aae6141214d9c8fc` |

The build/push release reports a metadata workflow-command-injection fix. OSV's
release includes failing incomplete scans and JSON export fixes. QEMU updates
shared Docker error handling; Buildx skips BuildKit pre-pulls for explicit endpoints.
These upstream statements are not a claim that a Classifarr exploit was reproduced.

## Design, tradeoffs and recommendation

Retain immutable SHA pins, consistent with
[GitHub's secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use).
Keep existing event filters, permission boundaries, vulnerability failure gates and
tag-only image/release publication. Dependabot's scan retains read-only contents
permission and no SARIF-upload step.

Benefit: current upstream fixes without mutable tags or expanded permissions.
Cost: incomplete OSV scans now fail rather than appearing clean; hosted runner
compatibility still requires hosted validation. Keeping older action revisions
would avoid update risk but miss these fixes. Recommend verified pins plus local
workflow contracts and subsequent hosted checks.

## Local verification

The ESM workflow tests assert all seven references, unchanged Docker tag gating,
OSV fail-on-vulnerability settings, Dependabot permissions and absence of
`pull_request_target`. Focused workflow and application tests passed. The rebuilt
local Compose image started healthy with its read-only root filesystem retained.

Local Docker builds exercise the application image, not GitHub runner actions,
SARIF permissions or registry publication. Those behaviors cannot be claimed
tested by Compose. No release workflow was dispatched to test this patch.
Full-suite results are recorded separately in the candidate-stability outcome.
All five existing provenance, published-digest consumer, provider-fault receipt,
release-candidate publication and installation-evidence contract commands also
passed locally. These were validation commands, not publication workflows.

## Rollback

Revert just the two workflow files' action revisions and corresponding pin tests
in a new commit. This update introduces no application dependency, migration,
product-version change or CommonJS code.
