# PR #535: local Node type-definition update

## Selection and source

On 2026-09-19 the GitHub MCP service returned open PRs #531, #532, #535 and #536.
PR #531's patch was already in the previous commit and was excluded from the draw.
A uniform `node:crypto.randomInt(3)` draw over `[532, 535, 536]` selected
[PR #535](https://github.com/cloudbyday90/Classifarr/pull/535).
The inspected head was `6dc5e00f483db23b9bdb4c825822c69d4ef4efc5`.
The two-file patch was applied locally; no merge, close or comment was performed.

## Design and boundaries

Update the server's `@types/node` development dependency from `^26.5.1` to
`^26.6.1` and its lockfile entry, including the upstream package integrity hash.
The existing `undici-types` dependency remains unchanged. Upstream source is the
official [DefinitelyTyped Node definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node).

This updates definitions, not the application runtime. The existing supported
engine remains Node `>=24.18.1 <25`, and verification uses Node 24.18.1. The type
definitions' major version already differed from the runtime before this PR;
the patch does not introduce that mismatch or adopt new runtime APIs. Static
type checks alone cannot establish Node 24 runtime compatibility.

## Pros, cons and recommendation

- Benefit: stay current with the selected upstream definitions through a small,
  reproducible package/lockfile change.
- Risk: wider definitions can admit APIs unavailable in the supported runtime.
  Keep runtime tests and engine constraints; assess major-version alignment as a
  separate dependency-policy decision rather than silently changing this PR.
- Recommendation: retain the update with local static, runtime and Compose checks.
  Do not interpret a successful type check as an application release or runtime upgrade.

## Outcome and rollback

The locked install completed with `npm ci --ignore-scripts`: 653 packages audited,
zero vulnerabilities reported by that install's audit. Server type checking passed.
Full application and container results are recorded separately in the
[outlier-aware recovery outcome](outlier-aware-recovery-outcome.md).

Rollback is a new commit restoring the previous package range and lockfile entry,
followed by a locked reinstall. No data migration or restoration is required.
No product-version bump, release or tag is part of this change. Dependabot may
subsequently recognize equivalent changes; that is not an agent-performed PR merge.
