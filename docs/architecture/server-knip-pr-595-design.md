# Server Knip PR 595 assessment design

November 21, 2026 Eastern. Approved design assessed at `774c9ef68`.
The random draw from open PRs 592 and 595 selected
[PR #595](https://github.com/cloudbyday90/Classifarr/pull/595).
The reviewed head is `ec5d8cb60372c2826c8f230ebbb301e1118c3c56`.

The patch pins Knip 6.46.0. The only updated package record is Knip itself,
and its recorded integrity matches npm. The minor release changes duplicate
export, command and plugin discovery behavior. Assess the selected PR's exact
version as one development-tool update.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Qualify and pin 6.46.0 | Advances the selected PR's fixes with a one-package lock change | Requires both runtime-dependency and general analysis comparisons |
| Stay on 6.45.1 | Preserves the current analyzer exactly | Defers fixes for real discovery cases |
| Switch to the latest release now | Includes a later set of changes | Requires a different candidate and independent release review |

Capture uncached normal and production-dependency findings from the installed
baseline and compare both modes on identical source under 6.46.0. Run the
existing installed CLI contracts on both versions and strict install, tree
and audit checks on the candidate. Verify the project's standard Knip gates
with the current configuration. Preserve the transitive graph and ignore
rules. Astra found the existing CLI fixtures cover meaningful positive,
negative, caching and mode-specific behavior. Reuse backend coverage only
with evidence that the server source, test inputs, other dependencies and
report stayed identical.

Both open Dependabot heads apply cleanly to `main`. Leave the PR unmerged and
keep the update as a regular commit on the current branch.

## Official references

- [Knip 6.46.0 release notes](https://github.com/webpro-nl/knip/releases/tag/knip%406.46.0)
- [Knip production analysis](https://knip.dev/features/production-mode)
- [GitHub Dependabot rebase guidance](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs)
