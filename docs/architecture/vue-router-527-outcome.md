# Vue Router PR 527 adoption outcome

Date: 2026-09-07.

## Selection and implementation

GitHub MCP listed open PRs 530, 528 and 527. One `Math.random()` draw selected
[PR 527](https://github.com/cloudbyday90/Classifarr/pull/527), head
`47a246dd720098398f104b0bebfaad98c7028e18`. Its exact package and lockfile patches
were applied locally to the current main baseline. Vue Router changes from 5.3.0
to 5.3.1 with the upstream tarball integrity preserved. Other dependency versions
remain intact. The original PR was not merged through GitHub.

## Research and recommendation

The official [upstream commit](https://github.com/vuejs/router/commit/92cfd6f4f3dd529376704eb3b8575309d2418317),
discovered through the PR and fetched with GitHub MCP, fixes active-link comparison
for non-string parameters. Its regression uses the experimental router with an
integer parser. The [official comparison](https://github.com/vuejs/router/compare/v5.3.0...v5.3.1)
also includes release/CI changes. This is not evidence of an application auth bug
or a security advisory.

| Option | Pros | Cons |
| --- | --- | --- |
| Adopt 5.3.1 (recommended) | Small patch; existing router and lockfile workflow | Still requires local navigation and production-build verification |
| Stay on 5.3.0 | No dependency change | Retains the upstream active-link defect |
| Switch to experimental router | Could use parsed parameter features | Unnecessary architecture and compatibility work for this application |

Keep Vue Router's stable APIs, existing auth/setup guards and named Vue navigation.
Do not introduce experimental router APIs just to exercise the upstream patch.

## Validation and outcome

`npm --prefix client ci --ignore-scripts` completed with zero reported audit
vulnerabilities. The exact manifest/lock patch was reviewed after installation.
All 58 tests in five client suites passed, including the existing router guard
suite, statistics integration, named API and evidence presentation. Browser
coverage passed protected-page loading, links, keyboard interactions and responsive
statistics under 5.3.1. Server/client typechecks also passed.

The disposable application build and schema result are recorded in the separate
[attribution outcome](evidence-method-attribution-outcome.md). These scoped checks
do not certify every route or dependency security property. No release, application
version bump or deployment is included.
