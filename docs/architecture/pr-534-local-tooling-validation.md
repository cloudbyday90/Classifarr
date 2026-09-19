# PR 534: local server-tooling update

Date: 2026-09-19. Status: applied and validated locally; not merged.

## Selection and implementation

GitHub's open-PR collection returned #531, #532, #533 and #534. A single
`node:crypto.randomInt(4)` draw over that ordered list selected
[PR #534](https://github.com/cloudbyday90/Classifarr/pull/534).
Its head was `704c521e461ab2eefdaf8dbeae469502ecad714b`, based on current predecessor
`a63c501f3ba7c9c3ee26533cd6c210ddfd3bdb26`.

Applied both provider patches locally, without merging or closing the PR:

| Development tool | Before | After |
| --- | --- | --- |
| `@types/node` | `^26.4.1` | `^26.5.1` |
| ESLint | `^10.9.1` | `^10.10.0` |
| Knip | `^6.34.0` | `^6.35.1` |

The patch changes only `server/package.json` and its lockfile. It does not change
the supported Node 24 runtime, product version, release workflow or application
direct dependencies. The production-marked lock entries that change are
`@types/node` and its `undici-types` dependency; runtime JavaScript package
versions/integrities are unchanged. These declarations are also pulled through
production dependencies, so describing the entire production lock as unchanged
would be inaccurate. Preserve the lockfile rather than resolving a different dependency
set. The existing Node 26 type-package major is retained; types alone do not
establish Node 24 runtime compatibility.

## Official research and tradeoffs

Sources discovered through PR metadata and verified with GitHub services:

- [ESLint 10.10.0 release](https://github.com/eslint/eslint/releases/tag/v10.10.0),
  published September 4: rule fixes and an updated file-entry cache dependency.
- [Knip 6.35.1 release](https://github.com/webpro-nl/knip/releases/tag/knip%406.35.1),
  published September 9: configuration-load failures now exit with code 2.
  Run full and production dependency scans to catch that stricter failure mode.
- [Node type definitions](https://github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/node):
  development-time type checking, not an application runtime update.

Benefit: maintained lint/type/dependency checks and upstream fixes. Cost: changed
tool behavior and development-only transitive packages can break CI. Recommendation:
apply the locked development update, run the same local gates as CI, and keep the
PR unmerged. Do not infer application security from an audit result alone.

## Validation and rollback

Locked installation with lifecycle scripts disabled completed successfully;
npm reported zero audit findings. Full and production Knip scans, server/client
type checking, lint, ESM guards and Markdown checks passed. Full test and coverage
results are recorded in the [coverage benchmark outcome](library-coverage-robustness-outcome.md):
37,581 backend tests, 5,120 client tests and 12 PostgreSQL integration tests passed,
as did the coverage ratchet and local Compose build/health checks.

Rollback is restoring the two development dependency files in a new commit and
performing a locked reinstall. No schema, inventory, metadata or library data
changes are involved. No release or tag is created.
