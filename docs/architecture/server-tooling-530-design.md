# Server tooling update design

Date: 2026-09-07.

## Selected change

One random draw from the three open PRs (527, 528 and 530) selected
[PR #530](https://github.com/cloudbyday90/Classifarr/pull/530), head
`f4b7e0bfa55379ad0313325c4760108e0a6f7383`. Apply its package and lockfile patches
to the current branch, retaining the previously adopted runtime dependencies.
Test locally without merging the original GitHub PR.

| Development dependency | Before | After |
| --- | --- | --- |
| `@types/node` | 26.4.0 | 26.4.1 |
| `globals` | 17.11.0 | 17.12.0 |
| `jest` | 30.5.0 | 30.5.1 |
| `knip` | 6.32.3 | 6.34.0 |

## Official September research

The PR and upstream resources were discovered/read with GitHub MCP and web search
on September 7. The [Jest 30.5.1 release](https://github.com/jestjs/jest/releases/tag/v30.5.1),
published September 1, fixes ESM package-import resolution and mapper/configuration
behavior. Those fixes make the existing ESM test runner a relevant local check.
The [globals 17.12.0 release](https://github.com/sindresorhus/globals/releases/tag/v17.12.0),
also September 1, updates environment globals and adds a webpack global.
[Knip 6.34.0](https://github.com/webpro-nl/knip/releases/tag/knip%406.34.0), published
August 31, updates analysis including filesystem glob support and private-parameter
type usage. The [official Node declaration source](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node)
uses the 26.4 development line; its source sentinel version is not the npm patch
version. Verify the installed patch and integrity against the PR lockfile.

## Options and recommendation

| Option | Benefit | Cost or limitation |
| --- | --- | --- |
| Apply the reviewed dependency group | Exercises maintained ESM test, lint and dependency-analysis tools together | Requires regression checks for tool behavior changes |
| Keep current tooling | Avoids immediate tool changes | Defers the selected fixes |
| Upgrade unrelated runtime/types majors | Could address broader alignment | Expands scope beyond this PR and needs separate compatibility work |

Recommend the exact PR patch, `npm ci` with the committed lockfile, focused Jest
and real PostgreSQL suites, typechecks, scoped ESLint and production Knip analysis.
The host install disables package lifecycle scripts. The normal Docker build still
verifies the repository's installation path. Keep code ESM and leave runtime
dependencies unchanged. Node 26 declarations on the existing Node 24 runtime are
a pre-existing alignment limitation; typechecking alone does not prove runtime
API availability, so the runtime and container tests remain necessary.

No release, version bump or GitHub PR merge is part of this change. The separate
outcome document records installed versions and actual checks.
