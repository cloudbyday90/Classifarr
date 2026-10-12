# Runtime-aligned Node declaration updates

Research date: 2026-10-12. Scope: dependency proposal policy, not a Node runtime
upgrade, release or production deployment.

## Problem and decision

Classifarr runs Node 24.21.0. Both workspaces declare `@types/node` 24.19.2;
the existing runtime-baseline tests require declarations on that runtime major.
Dependabot currently proposes Node 26 declarations in both workspaces. Types
describe APIs; upgrading them alone does not install those APIs in Node 24.

Add an exact `@types/node` ignore rule for `version-update:semver-major` in
`/client` and `/server`. Do not add a `versions` range, wildcard dependency rule,
patch/minor exclusion, allowlist or alternate target branch. Keep the existing
client TypeScript 7 exclusion separate. Other packages, groups, schedules, PR
limits, security workflows and strict installation decisions remain unchanged.

## Official evidence and security boundary

[DefinitelyTyped's version guidance](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
ties declaration major/minor versions to the corresponding library. This supports
reviewing runtime and declaration upgrades together, rather than accepting a
newer type surface as a runtime upgrade.

[GitHub's option reference](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference)
documents dependency-scoped semantic-version ignore rules. The distinction from
literal version ranges matters: the inspected
[updater implementation](https://github.com/dependabot/dependabot-core/blob/4725d253a379379dc85d291268d9607977b3c1af/common/lib/dependabot/config/ignore_condition.rb)
returns only explicit `versions` restrictions for security-only jobs. Its
[upstream tests](https://github.com/dependabot/dependabot-core/blob/4725d253a379379dc85d291268d9607977b3c1af/common/spec/dependabot/config/ignore_condition_spec.rb)
verify that update-type exclusions permit all version levels in that mode.
Therefore the selected rule suppresses routine major proposals without adding
a security-only version exclusion. These are inspected upstream semantics, not
a locally executed Dependabot job or proof of account-level settings.

No alert is dismissed and no repository security setting is changed. A future
security PR that requires a different Node major still needs a compatibility
review; do not bypass the runtime guard or automatically merge it. Prefer a
supported-line fix, or plan and test a complete runtime upgrade if necessary.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Leave all major proposals enabled | Every candidate remains visible | Repeated incompatible proposals and wasted CI | Reject |
| Ignore explicit future version ranges | Easy to enumerate known majors | Can also exclude security fixes; becomes stale | Reject |
| Ignore only Node declaration major version updates | Compatible updates continue; narrow scope | Runtime upgrades need deliberate policy review | Choose |
| Upgrade Node and its declarations now | New API surface becomes available together | Unrelated runtime and deployment migration | Separate work |

Recommended stack: narrow proposal rule; parsed ESM policy tests using the
server's existing YAML dependency; existing runtime/manifest/lockfile guard;
unchanged security scanners and strict installation policy; explicit runtime
upgrade review. A separate production service or new dependency is unnecessary.

## Implementation and verification plan

Use parsed-YAML tests in the existing backend script-test suite, which already
runs in CI after installing `js-yaml`. Do not introduce a YAML dependency into
the root-only tooling job. Check both workspace rules exactly, the existing
TypeScript exception, all four update entries and unchanged scheduling/grouping.
These tests protect repository configuration, not Dependabot's remote engine.

Fresh enumeration found open PRs #558 and #556. A cryptographic random draw over
that order returned index 0: [PR #558](https://github.com/cloudbyday90/Classifarr/pull/558),
head `a32e85effe1aaf9f30265363ad09fa978279c2d8`. Trial its exact client manifest
and lockfile changes (Node declarations 26.6.4, undici-types 8.9.0), not the newer
registry release. Review the two-package diff, perform a strict clean install,
tree/audit, typechecking and the runtime guard. Restore that exact patch if the
compatibility contract fails; leave the remote PR unmerged and unmodified.

After policy tests, verify the final dependency state and relevant client checks.
Build local Compose without cache from a clean implementation commit, retain a
verified backup/rollback image, and evaluate the local container read-only.
Run the schema dump against a disposable, isolated database from the new image;
never substitute live appdata. Record observed results separately in the
[outcome document](dependabot-node-runtime-policy-outcome.md).

## Maintenance

Review this policy when changing `.nvmrc`, Docker's pinned Node image or either
workspace's declarations. The major-ignore rule follows the installed major;
it does not hardcode 24, so a planned migration must update declarations and
the existing runtime-baseline tests together. Keep compatible updates enabled.
Recheck upstream security semantics if Dependabot behavior changes.
