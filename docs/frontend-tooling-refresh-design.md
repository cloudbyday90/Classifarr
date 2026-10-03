# Frontend tooling refresh design

Research date: 2026-10-03. Scope: frontend development dependencies and their
lockfile, not a platform release or a database/runtime dependency upgrade.

## Decision

Update Vite 8.3.1 to 8.3.2, Vitest and its V8 coverage provider 5.0.2 to 5.0.3,
and vue-tsc 3.3.11 to 3.3.12 together. Keep TypeScript 6, existing test isolation,
the four-worker limit, lifecycle-script policy and security overrides unchanged.
Resolve or explicitly report the existing routing-rehearsal CI failure separately;
passing frontend tests cannot substitute for installation acceptance.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Focused frontend patch batch | Relevant fixes with a small review surface | Transitive changes still need tests | Recommended |
| Update every outdated package | Fewer pending upgrades | Mixes bundler, database, logging and lint regressions | Defer |
| Include TypeScript 7 now | New compiler generation | Separate Vue compiler compatibility work | Separate evaluation |
| Freeze tooling indefinitely | No immediate churn | Misses upstream fixes and security improvements | Reject |

## Official research

- [Vite 8.3.2](https://github.com/vitejs/vite/releases/tag/v8.3.2) fixes watcher
  error handling, environment disposal and asset handling, and replaces its
  cross-spawn usage with tinyexec. Exercise actual production assets, not just
  package installation.
- [Vitest 5.0.3](https://github.com/vitest-dev/vitest/releases/tag/v5.0.3) fixes
  jsdom 30.1 Blob support and cached-module imports. Keep the coverage provider
  on the same release as the test runner.
- [Vue language tools 3.3.12](https://github.com/vuejs/language-tools/releases/tag/v3.3.12)
  includes safer handling of untrusted Vue files and type-analysis fixes.
  This does not establish that Classifarr had an exploitable runtime issue.
- [Vitest issue 11423](https://github.com/vitest-dev/vitest/issues/11423) reports
  environment leakage with `isolate: false`. Our configuration does not disable
  isolation. Do not trade isolation for test speed to work around failures.
- [npm clean install](https://docs.npmjs.com/cli/v11/commands/npm-ci/) documents
  frozen lockfile installation. This is the v11 documentation page; local
  execution uses the repository's pinned npm 12.2.0 and its strict script policy.
- [OpenAI skill guidance](https://learn.chatgpt.com/docs/build-skills) supports
  focused triggers and progressive disclosure. Add an instruction-only dependency
  review skill that routes to existing scripts rather than a second updater.

URLs were discovered through web search or official release API responses and
then retrieved. Findings describe the versions available on the research date,
not a guarantee about future releases or all advisories.

## Verification and boundaries

1. Review exact release notes, engines, peer dependencies, install scripts and
   the lockfile diff. Regenerate the lockfile with scripts disabled first.
2. Run a clean client install with the existing strict lifecycle policy; validate
   its dependency tree and npm audit. Retain remote OSV as an independent check.
3. Run all client tests with coverage, lint, typecheck, production build and the
   existing production policy-route browser asset smoke.
4. Run dependency-policy tests and targeted tests for any rehearsal changes.
   Reproduce the routing failure with disposable synthetic data and immutable
   image IDs; do not change live Compose, skip the test or suppress its failure.
5. Record actual outcomes separately, including pending CI and unavailable PRs.

No API, UI, database schema, saved configuration, image base, release version,
service permissions or runtime dependency changes are planned in this batch.
Rollback is a normal reviewed revert of the manifest and lockfile together.

## Recommendation stack

1. Restore trustworthy routing-rehearsal evidence and complete this patch batch.
2. Update backend runtime packages (`pg`, `dotenv`, `pino`) in a separate tested
   batch, checking provider logging/redaction and database integration behavior.
3. Update shared lint tooling and Node typings with both workspaces checked.
4. Evaluate TypeScript 7 for the Vue client independently; do not force peer ranges.

See [the outcome](frontend-tooling-refresh-outcome.md) for completed checks.

The current installation job passed during investigation. Retain all existing
acceptance checks and add [bounded routing failure diagnostics](architecture/manual-routing-rehearsal-design.md#failure-diagnostics)
instead of guessing at a timing fix. The historical intermittent failure remains
unexplained until its failing boundary is captured.
