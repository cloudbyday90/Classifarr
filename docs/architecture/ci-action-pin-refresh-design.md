# CI action pin refresh

Reviewed 2026-10-08. Follows the [dependency pin audit](dependency-pin-audit-2026-10-08.md).

## Decision and verified sources

Update only the three reviewed GitHub actions, using release-tag commit objects
retrieved through the GitHub connector. Keep Node 24.21.0 and npm 12.2.0.

| Action | Before | Selected release | Immutable commit |
| --- | --- | --- | --- |
| setup-node | 7.0.0 | [7.1.0](https://github.com/actions/setup-node/releases/tag/v7.1.0) | `949feb2413d6458794dcd2491c4babbbce0c15c1` |
| upload-artifact | 7.0.1 | [7.0.2](https://github.com/actions/upload-artifact/releases/tag/v7.0.2) | `cf430e030ddbb5b0abf93d22962f4752f3646cd9` |
| download-artifact | 8.0.1 | [8.0.2](https://github.com/actions/download-artifact/releases/tag/v8.0.2) | `9000827ccba6bdab643e8b6fd33ac0654aef8333` |

Reviewed the official comparisons for
[setup-node](https://github.com/actions/setup-node/compare/v7.0.0...v7.1.0),
[upload-artifact](https://github.com/actions/upload-artifact/compare/v7.0.1...v7.0.2)
and [download-artifact](https://github.com/actions/download-artifact/compare/v8.0.1...v8.0.2),
including action metadata, source changes and dependency changes. All three retain
the Node 24 action runtime. Setup adds bounded manifest retries, installed-version
verification, absolute version-file paths and mise support; our relative `.nvmrc`
contract is unchanged. Its generated bundles also change substantially with the
upstream bundler/dependency refresh; this review is not an exhaustive supply-chain audit.

Both artifact actions carry artifact 6.3.1. The reviewed transport uses up to five
attempts, positive integer `Retry-After` seconds for HTTP 429 and a 120-second total
retry-wait ceiling. Download's bundled dependency changes also include Octokit and
Azure updates. Action inputs are unchanged; digest mismatch remains a hard error.
Do not mistake the separately published GHES Node-20 backport for this github.com
deployment's appropriate release.

[GitHub's security guidance](https://docs.github.com/en/actions/reference/security/secure-use)
supports full commit pins, code review and least-privilege tokens. Preserve readable
version comments for Dependabot, and update the existing strict workflow validators
with the reviewed revisions. Extend existing tests rather than add a second gate.

## Scope and safety contract

Change action references in five workflows and six existing ESM validators only;
add exact-pin coverage and stale/floating-pin rejection tests. Preserve triggers,
permissions, cache inputs, upload paths/retention, same-run downloads, receipt
identity checks, native architecture matrices, environments and promotion locks.
No application dependency, API, database, runtime memory policy or deployment
template change. No release, tag, branch, automatic merge or Unraid operation.

Local validators test contract preservation, not GitHub's hosted artifact service.
Remote CI must exercise Node setup and receipt upload/download; tag-only publication
remains deliberately unexecuted. Rebuild local Compose from clean committed source
without cache, compare installed package inventories, use isolated schema dump/check,
then preserve local appdata while replacing and observing the test container.

## Options and recommendation stack

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Refresh reviewed immutable pins together | Current setup and artifact transport fixes; consistent receipt producers/consumers | Requires workflow regression and hosted CI; recommended |
| Keep existing pins | No immediate change | Misses reviewed reliability fixes; retain only if regression found |
| Use moving version tags | Fewer manual pin edits | Mutable execution identity; reject |

First complete this action batch and verify the exact-commit CI. Next improve the
comparison warning's sanitized admission evidence, without changing memory guards;
then reassess release readiness and the remaining optional tooling candidates.
Do not broaden this batch into a runtime upgrade to accept an incompatible PR.
