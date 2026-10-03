# Backend runtime refresh design

Research date: 2026-10-03. This batch updates the PostgreSQL driver, environment
loader and structured logger. It does not upgrade PostgreSQL itself or publish
a release.

## Decision and tradeoffs

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Update `pg` 8.23.0 → 8.23.1, `dotenv` 18.0.3 → 18.0.5, `pino` 10.3.1 → 10.4.0 | Upstream connection, configuration and logging fixes | Runtime behavior needs real integration tests | Recommended |
| Update runtime and all tooling together | Fewer update rounds | Harder to attribute regressions | Defer tooling |
| Replace the database or logging stack | Potential architectural flexibility | Unnecessary migration and compatibility risk | Not justified |

Retain the existing manifest range style, with these reviewed versions as the
new minimums and exact resolutions in the lockfile. Preserve lifecycle-script
restrictions, security overrides, numeric log levels and database retry rules.

## Official research

URLs were discovered through web search and upstream GitHub API responses.
Registry metadata supplied the exact published Git commit boundaries.

- [node-postgres published-source comparison](https://github.com/brianc/node-postgres/compare/df274d1ba9ad9d11a8f1079314faeafde7208207...0980cefebe0ae461da8883703be049fe13ca96cf)
  fixes query-configuration mutation, extended-query connection error handling,
  IP-address TLS identity checks and IPv6 connection-string parsing. Its updated
  protocol serializer changes parameter encoding. Invalid Date parameters now
  emit a deprecation warning; do not suppress that warning or enable pipelining.
- [Pooling guidance](https://node-postgres.com/features/pooling) and
  [transaction guidance](https://node-postgres.com/features/transactions) require
  checked-out clients to be released and a transaction to use one client.
  Preserve Classifarr's existing ownership, cancellation and no-replay behavior.
- [Dotenv published-source comparison](https://github.com/motdotla/dotenv/compare/f6390d1348d4c235e2a17f7c15686105915281aa...05215e09b73575b6f8e272658ca7849685651384)
  restores quiet side-effect imports, adds their TypeScript declaration and
  improves fast-parser comment scanning. Keep the current parser choice and
  externally supplied environment-variable precedence.
- [Pino 10.4.0](https://github.com/pinojs/pino/releases/tag/v10.4.0) fixes
  single-target array level filtering, child binding escaping and serialization
  of objects with an own `__proto__` property. It updates `real-require` to 1.x.
- [real-require 1.0.0](https://github.com/pinojs/real-require/releases/tag/v1.0.0)
  modernizes module loading and drops older Node support. The existing worker
  still resolves its own 0.2.0 dependency; do not force a cross-package override.
- [Pino transport guidance](https://github.com/pinojs/pino/blob/main/docs/transports.md)
  explains worker-thread transports and target-specific filtering. Test actual
  stdout and rolling files, not only Classifarr's synchronous test logger.
- [Pino logging guidance](https://github.com/pinojs/pino/blob/main/docs/help.md)
  warns against uncontrolled top-level keys. An upstream logger update is not
  a complete audit of application log inputs; nested sanitization and controlled
  field names remain application responsibilities.

The three direct packages have no install hooks. `pg` supports Node >=16 and
`dotenv` >=12; this project remains on its pinned Node 24.21.0/npm 12.2.0.
Review transitive changes before a clean install. Do not treat absence of an
audit finding as proof of security.

## Verification

1. Add ESM regressions for reusable query configurations, mixed parameter
   encoding and connection error propagation after an extended query.
2. Use the existing disposable PostgreSQL/pgvector integration runner. Retain
   its per-suite databases, cancellation tests and automatic container cleanup;
   never target live appdata.
3. Exercise quiet dotenv imports in a subprocess with a synthetic `.env` and
   an explicit small environment, plus existing parse/path/URL tests.
4. Exercise real Pino workers in bounded subprocesses. Check numeric levels,
   target filtering, child binding escaping, redaction and worker shutdown.
5. Generate the lockfile with scripts disabled, review the diff, then run a
   clean strict-policy install, dependency tree checks, npm audit and OSV.
6. Run backend tests, lint, typecheck, knip and repository tooling checks.
   Record failed, skipped or unperformed checks separately from passing ones.

No new service, API, UI, schema, Compose setting or production data change is
needed. Rollback is a reviewed revert of the manifests/lockfile together, with
the matching regression expectations reviewed. No release version or tag changes.

## Recommendation stack

1. Complete this runtime batch with real database and logging checks.
2. Update shared lint/test tooling and review Node typings against Node 24.
3. Evaluate the Vue client's TypeScript 7 migration separately.
4. Review bounded, namespaced application log data as a separate hardening task.

See [the outcome](backend-runtime-refresh-outcome.md) for observed results.

## Validation adjustment

The full integration run exposed a pre-existing fixture gap: the private quality
experiment injects discovery memory telemetry but leaves the shared admission
policy reading host memory. Reuse the existing `resourceAdmissionFixture` with
the same telemetry for both layers. This retains real admission policy, real
database transactions and all snapshot/no-write assertions. Do not lower
production thresholds or replace admission with an always-allow mock.

Legacy-ingestion reconciliation tests have the same host-memory dependency in
their media-sync constructors. Supply the existing real-policy fixture there
as well, preserving all provider, ownership, cooldown and backfill assertions.
Apply that same correction to the shared recovery-handoff fixture and the
matching catalog/content/progress/error and cross-process ingestion test entry
points. Resource-pressure tests retain their explicit pressure telemetry.

Host-run route and upgrade-handoff integration fixtures also need controlled
telemetry. Keep the standalone image probe unchanged so its resource checks
still observe real container limits. Legacy-enrichment retry tests must cancel
their real follow-up timer after each explicit batch, including assertion failure;
otherwise an earlier test can claim a later test's records.
