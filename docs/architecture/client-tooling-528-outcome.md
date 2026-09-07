# Client tooling PR 528 adoption outcome

Date: 2026-09-07.

## Selection and local implementation

GitHub MCP returned one open PR at task start, [PR 528](https://github.com/cloudbyday90/Classifarr/pull/528).
One `Math.random()` draw from that one-item population selected it; there were no
other open candidates. Reviewed head: `269481ca04e6d620e71d2587ce1eba7e20382d13`.
Its exact manifest and lockfile patches were applied to current main, preserving
the already adopted Vue Router 5.3.1 update. The original PR is not merged through
GitHub. All changes are integrated as local, tested work.

| Package | Before | After |
| --- | --- | --- |
| `@types/node` | 26.4.0 | 26.4.1 |
| `@vitest/coverage-v8` | 4.1.11 | 5.0.0 |
| `vitest` | 4.1.11 installed | 5.0.0 |
| `globals` | 17.11.0 | 17.12.0 |
| `postcss` | 8.5.26 | 8.5.28 |

## Official research and compatibility decision

The [Vitest 5 announcement](https://vitest.dev/blog/vitest-5.html) and
[official migration guide](https://main.vitest.dev/guide/migration/) were discovered
through the PR/web tools. Node 24.18.1 and Vite 8.2.2 satisfy the new prerequisites.
Version 5 clears mock call history before each test, requires hoisted mocking calls
at module scope and removes sequential test options. The repository's existing
ESM tests and bounded four-worker jsdom configuration passed without weakening
those defaults or changing runtime code for the test runner.

The official [PostCSS changelog](https://github.com/postcss/postcss/blob/main/CHANGELOG.md),
identified through the PR and read with GitHub MCP, records a type regression fix
in 8.5.28 and parser/list/type fixes in 8.5.27. These are maintenance updates, not
evidence of a specific application security vulnerability.

| Option | Pros | Cons |
| --- | --- | --- |
| Adopt the complete group (recommended) | Matched Vitest/coverage versions; current maintenance fixes | Major test-runner change requires full client validation |
| Adopt only patch updates | Smaller tooling change | Leaves the selected PR partly unimplemented and postpones Vitest migration |
| Disable new mocking defaults | Could mask legacy test assumptions | Preserves call-history coupling between tests; not needed here |

Keep the current ESM test architecture, per-file isolation, four-worker limit and
matched Vitest/coverage versions. Do not trade isolation for speed solely because
the runner suggests it.

## Validation and outcome

`npm --prefix client ci --ignore-scripts` completed with zero reported audit
vulnerabilities. Before feature UI changes, all 4,652 client tests in 336 files
passed with coverage generation under Vitest 5. No compatibility refactor was
required. The final full run includes the added daily-coverage tests; its counts
and coverage are recorded in the [daily outcome](daily-provenance-coverage-outcome.md).
Focused feature tests, browser layout/navigation, typechecks and the disposable
container build also validate the integrated change there.

No release, application version bump, experimental router migration or production
deployment is included. A passing dependency audit and tests are bounded evidence,
not certification of every security property.
