# Knip 6.39 refresh: design

Reviewed: 2026-10-03. Scope: server development tooling and its quality gates.

## Decision

Update Knip 6.38.0 to 6.39.0, retaining the existing manifest range convention
and a reviewed lockfile. Keep both comprehensive and production-dependency
checks, current rule severities, entry points and exceptions unchanged.

The [official release](https://github.com/webpro-nl/knip/releases/tag/knip%406.39.0)
includes fixes for excluded tags and renamed re-exports, plus framework/plugin
discovery improvements. GitHub MCP supplied the release and source comparison:
base `c0e42f83bda7664065465f2f3faca7af97c988ac`, head
`ed30e5b7e9a53ae0158726ee7ccdecc4f9dbde07`.
The relevant graph change tracks exported names along each re-export path rather
than assuming the original binding name at an entry point. Classifarr uses
`-lintignore` and ESM modules; a synthetic contract will test this edge case
without claiming the current application has this false positive.

Registry metadata and the upstream manifest show unchanged dependencies,
no install lifecycle script, and Node `^20.19.0 || >=22.12.0`, compatible with
our pinned Node 24.21.0. No native package upgrade is expected. Do not expand
installer permissions or relax security overrides.

## Recommendations and tradeoffs

| Option | Benefit | Cost / limitation |
| --- | --- | --- |
| Adopt upstream 6.39.0 | Correct re-export/tag handling; current plugin discovery | Detection changes require positive and negative regression fixtures |
| Stay on 6.38.0 | No tooling change | Retains known analysis inaccuracies |
| Add broader ignores | Can silence a false positive | Also hides genuine issues; reject this approach |

Recommend the upstream update with executable contracts, not additional ignores.
Per [production-mode guidance](https://knip.dev/features/production-mode), the
production run complements rather than replaces the default run. Per
[project-boundary guidance](https://knip.dev/guides/configuring-project-files),
fix entry/project configuration before suppressing findings. Per the
[CLI documentation](https://knip.dev/reference/cli), caching is optional and
metadata-based: verify without cache as well as through existing cached commands.
These are development checks, not a production security scanner or proof of
runtime correctness. No UI or web accessibility behavior changes in this batch.

## Implementation and verification

Add an ESM suite that invokes the installed Knip CLI through Node without a
shell, in disposable local fixtures. Bound child duration/output and avoid
passing application credentials. Cover tagged and renamed re-exports, genuine
unused exports, missing imports, normal/production dependency differences,
cache consistency and invalid configuration. No network install, live service
or third-party fixture execution is needed.

Run the contract against the old version first. Review every lockfile change,
clean-install under the existing strict policy, run `npm ls --all`, audit all
dependency scopes, and run lint, scoped typecheck, both Knip modes and existing
toolchain/CI-preflight checks. Report separate observed results in the
[outcome](knip-refresh-outcome.md). Do not imply a full application test run.

GitHub MCP and the saved GitHub CLI login returned no open Classifarr PRs on
2026-10-03. There is no PR to randomly select or merge.

Next stack: land this bounded tooling change, assess frontend TypeScript 7
against Vue tooling support, and keep Node typings aligned with Node 24.
No version bump, release, branch creation or deployment is authorized here.
