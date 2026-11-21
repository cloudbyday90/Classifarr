# Server ESLint PR 594 assessment design

November 21, 2026 Eastern. Approved design assessed at `2661402aa`.
The random draw from open PRs 592 and 594 selected
[PR #594](https://github.com/cloudbyday90/Classifarr/pull/594).
The reviewed head is `c6fea9865febbfebf6ae2860f6130b6e84e5bdc9`.

## Compatibility and recommendation

The PR pins server ESLint 10.15.0 and resolves its config-array dependency to
0.23.6. Both request minimatch `^11.0.5`. The repository's exact server
minimatch 11.0.4 override would still win with the PR's verbatim lockfile.
The publisher changed config resolution and several rule diagnostics in this
minor release. Treat both as observable tooling behavior.

Conditionally assess ESLint 10.15.0, config-array 0.23.6 and the published exact
minimatch 11.0.9 override in the server workspace. The latter is the current
registry release in the requested major and has the same declared dependencies
as 11.0.5. Review the resolved graph, published integrity and install policy.
Preserve root and client manifests and locks, runtime dependencies, rule
configuration and scanner settings. Update the affected server tooling pin
assertion. Compare full ownership reports on identical source, allowing only
the explicit parser version change if the analysis and bindings match.

| Approach | Benefit | Cost or limit |
| --- | --- | --- |
| Assess the coordinated server set | Meets the tool's declared matcher range and keeps an exact lock | A shared server override also reaches Jest, glob and other consumers |
| Apply the PR unchanged | Makes the smallest textual diff | Keeps the matcher below the declared minimum |
| Defer the PR | Preserves the verified current toolchain | Defers the upstream configuration and rule fixes |

Run a strict clean install, full package-tree check and full audits. Check
actual ESLint config resolution, ignore behavior and rule diagnostics, plus
existing glob, Jest discovery and PostgreSQL integration controls. Run fresh
server coverage and quality gates. Reuse client coverage only after verifying
unchanged source, installed graph and report inputs. Defer adoption on material
ownership drift or incompatible results. Keep the PR unmerged. Both open
Dependabot heads apply cleanly to the current branch.

## Official references

- [ESLint 10.15.0 release notes](https://eslint.org/blog/2026/11/eslint-v10.15.0-released/)
- [Minimatch 11.0.9 source](https://github.com/isaacs/minimatch/blob/e89926755f3f79cf79f1087bd5730ed4d7eba60e/src/index.ts)
- [npm clean install documentation](https://docs.npmjs.com/cli/commands/npm-ci/)
- [GitHub Dependabot rebase guidance](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/manage-dependabot-prs)
