# Web Search Provider Bridge and Fresh-Install Seed Reconciliation

## Context

The provider-neutral web-search storage migration introduced `web_search_provider_config`
and `web_search_provider_usage` so Tavily, Brave, Serper, and future providers can share
one configuration and usage model. The initial bridge also projected legacy
`tavily_config` into the provider table.

The bug was fresh-install parity: `pg_dump --schema-only` captures tables, indexes, and
constraints, but not data rows. A migration that mixes DDL and provider seed data can work
for upgraded installs while fresh installs using `database/schema/current.sql` miss those
seed rows unless the data is replayed explicitly.

## Official-Source Research

- PostgreSQL documents `INSERT ... ON CONFLICT` as the native upsert path and guarantees an
  atomic insert-or-update outcome when a conflict action is used:
  <https://www.postgresql.org/docs/current/sql-insert.html>
- PostgreSQL constraints are the database-level contract for accepted row values:
  <https://www.postgresql.org/docs/current/ddl-constraints.html>
- PostgreSQL `pg_dump` separates schema and data output, so schema-only snapshots do not
  carry ordinary table rows:
  <https://www.postgresql.org/docs/current/app-pgdump.html>
- Microsoft documents the Strangler Fig pattern as a facade-based migration approach where
  legacy and new systems coexist only while functionality is replaced:
  <https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig>
- OWASP recommends centralizing, auditing, and protecting secrets. Provider API keys must
  remain masked in read models and should not be logged:
  <https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html>

## Recommendations

### 1. Keep Provider Defaults As Idempotent Seed Reconciliation

Use a data-only reconciliation migration for provider defaults and register it with the
schema snapshot seed list.

Pros:
- Fresh installs and migrated installs converge on the same default provider rows.
- Re-running migrations is safe because `ON CONFLICT` preserves existing rows.
- The snapshot test can verify rows by checking the replayed seed SQL.

Cons:
- Adds one more seed migration to maintain.
- Requires discipline: future mixed DDL+DML migrations must either avoid seed data or add a
  seed-reconciliation migration.

### 2. Preserve Legacy Tavily Values During Backfill

Seed defaults first, then merge the latest legacy `tavily_config` row into the Tavily
provider row.

Pros:
- Clean installs get a disabled Tavily provider row.
- Existing installs keep active state, API key, and search options.
- The legacy source remains visible through `legacy_source = 'tavily_config'`.

Cons:
- Short-term bridge complexity remains until runtime Tavily paths fully move to the
  provider framework.

### 3. Keep Secrets Write-Only In Runtime Read Models

The provider storage read model should continue to mask API keys by default and only
return raw keys to internal services that execute provider calls.

Pros:
- Aligns with OWASP secrets-management guidance.
- Keeps future Brave/Serper support from expanding the secret leak surface.

Cons:
- Tests need explicit `maskSecrets: false` cases for internal service reads.

## Final Recommendation Stack

1. `20260614_103000_add_web_search_provider_storage.sql` creates the provider tables,
   indexes, constraints, usage table, and initial Tavily legacy bridge.
2. `20260614_110500_reconcile_web_search_provider_seed_data.sql` replays provider defaults
   and legacy Tavily merge idempotently.
3. `scripts/dump-schema.mjs` includes the reconciliation migration in `SEED_MIGRATIONS`
   so `database/schema/current.sql` remains fresh-install equivalent.
4. Schema tests verify table shape, provider defaults, and applied migration coverage.
5. Runtime provider reads continue through `webSearchProviderStorage`, with masked output
   by default and explicit raw-secret reads only for execution paths.

## Outcome

Fresh installs receive disabled `tavily`, `brave`, and `serper` provider rows. Upgraded
installs keep any existing Tavily settings while gaining the provider-neutral row. The
bridge remains temporary by intent: legacy Tavily configuration is migration input, not the
long-term runtime source.

## Next Design Targets

- Tavily runtime cutover: replace direct `tavily_config` reads with provider storage reads.
- Generic Web Search Provider settings UI: configure provider keys, priorities, and limits
  without Tavily-specific settings screens.
- Provider usage governance: enforce soft daily/monthly limits and cooldown-aware provider
  selection before adding Brave and Serper adapters.
