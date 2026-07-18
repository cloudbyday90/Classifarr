# Server Knip Quality Gates

## Status

Implemented July 2026.

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

## Sources

- [Knip: How Knip works](https://knip.dev/explanations/how-knip-works)
- [Knip: Configuring project files](https://knip.dev/guides/configuring-project-files)
- [Knip: Resolve reported issues](https://knip.dev/guides/handling-issues)
- [Knip: Production mode](https://knip.dev/features/production-mode)
