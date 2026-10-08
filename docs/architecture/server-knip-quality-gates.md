# Server Knip Quality Gates

## Status

Implemented July 2026; tooling reviewed October 2026.

## Decision

Classifarr keeps two complementary server Knip checks:

1. `npm run lint:knip` analyzes the complete server source and server-owned
   executable scripts. It fails on unused files, exports, dependencies, and
   unresolved imports.
2. `npm run lint:knip:production` starts at `src/index.mjs` and checks only
   production dependency declarations, unresolved imports, and executable
   binaries. File and export reachability remain the responsibility of the
   comprehensive check.

This split prevents maintenance-only validation modules from being misreported
as shipped application files while still enforcing the runtime dependency
boundary in CI.

Root maintenance scripts use `scripts/lib/cliRuntime.mjs`. They do not import
the server-private CLI helper, so each lint workspace owns the executable
surface it analyzes.

## Rationale

Knip builds a graph from configured entry files. Its official guidance is to
correct entry and project boundaries before suppressing findings, and to remove
genuinely unused exports rather than hiding them. The comprehensive check is
therefore the authority for dead-code findings. The production check narrows
to the dependency issue types that are unique to the shipped runtime path.

## Validation

Run both commands from `server/`:

```text
npm run lint:knip
npm run lint:knip:production
```

The CI workflow runs both checks before server tests.

For a Knip upgrade, also run both modes without `--cache` using the installed
CLI (`node node_modules/knip/bin/knip.js` from `server/`). This distinguishes
current analysis from cached results without deleting shared caches.

`src/__tests__/knipContract.test.mjs` invokes that CLI against disposable ESM
fixtures. It checks tagged/renamed re-exports alongside genuine unused exports,
missing imports, normal/production dependency scope, cold/warm cache consistency
and invalid configuration. It runs with the normal backend unit suite; fixtures
do not install packages or use application credentials. It does not replace
either full-repository Knip command.

`src/__tests__/knipEntryContract.test.mjs` additionally checks wildcard package
exports against test-only usage, development entry negations and null/private
export paths. Both suites share the bounded, shell-free ESM fixture helper.
Production-only unused-export detection here is a synthetic tool contract, not
an expansion of the repository's dependency-only production gate.

The [6.39.0 design](../knip-refresh-design.md) and
[validation outcome](../knip-refresh-outcome.md) record the upgrade separately
from this ongoing gate policy.
The [6.40.0 design](knip-640-update-design.md) covers the follow-up entry-discovery
and plugin-cache changes. If configuration or path changes produce unexpected
cached results, compare uncached analysis first; do not suppress findings or
delete a shared cache to make an upgrade pass.

## Sources

- [Knip: How Knip works](https://knip.dev/explanations/how-knip-works)
- [Knip: Configuring project files](https://knip.dev/guides/configuring-project-files)
- [Knip: Resolve reported issues](https://knip.dev/guides/handling-issues)
- [Knip: Production mode](https://knip.dev/features/production-mode)
