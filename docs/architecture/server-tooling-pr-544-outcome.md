# Server tooling PR #544: local implementation

Date: 2026-09-22. No PR merge, release or application version change.

## Selection and design

The GitHub MCP open-PR collection returned #539, #541, #542 and #544. A uniform
random draw selected [PR #544](https://github.com/cloudbyday90/Classifarr/pull/544).
Its dependency changes were applied to the current branch and the lockfile was
regenerated locally, preserving the already-applied Knip update. No merge API or
PR branch merge was used.

- ESLint: 10.10.0 → 10.11.0.
- Jest: 30.5.1 → 30.5.2.
- Node.js type declarations: 26.6.1 → 26.6.2.

These are development-tool updates. Node's deployed major version and application
runtime dependency declarations are unchanged. Existing ESM test wrappers,
coverage thresholds, security lint rules and CI jobs are retained.

## Official-source research

The PR metadata supplied the official upstream repository/release URLs. They were
read using GitHub MCP and web tools on 2026-09-22.

[ESLint's 10.11.0 release](https://github.com/eslint/eslint/releases/tag/v10.11.0)
includes rule correctness, `__proto__` handling and performance changes. Its
documentation also cautions that cached results can be stale for cross-file rules;
the validation here runs the existing uncached ESLint commands.

[Jest's official changelog](https://github.com/jestjs/jest/blob/main/CHANGELOG.md)
records 30.5.2 fixes for released-version/cache reporting, literal table-key
interpolation and Windows source-map paths. The full unit and database suites are
the appropriate compatibility check for this repository's ESM test setup.

## Outcome and recommendation

The updated dependency install used `--ignore-scripts`; its audit reported zero
known vulnerabilities. The full unchanged backend suite passed with 1,374 suites
and 40,287 tests, followed by all 146 database integration suites / 1,694 tests.
The separate Compose-only test was intentionally skipped by that integration
command, not removed or disabled. The content-fix regression results are recorded
in the [metadata parity outcome](learned-query-metadata-parity-outcome.md).

Keep this update: it reduces known tooling defects without adding a runtime
service. The cost is normal lockfile churn and the need to rerun the platform's
test/type/lint gates; a tooling upgrade is not evidence of better classification.
No waiver, coverage-baseline change or CI bypass is part of this implementation.
