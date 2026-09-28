# Inventory observation trigger replay — design

## Decision and root cause

Keep the strict released-schema replay gate. Add a forward migration that
replaces only `reset_inventory_tmdb_observation_clocks` with explicit scalar
`IS DISTINCT FROM` comparisons joined by `OR`. Retain all nine watched fields,
the existing function, `BEFORE UPDATE` timing and row-level execution. Do not
rewrite the historical migration or clear existing recovery state.

The September 27 provider-recovery migration uses a row-constructor comparison.
On a single isolated PostgreSQL 18.4 instance, its first decompilation produces
nested `OR` nodes; restoring that SQL produces one flat `OR` list. A second
restore is stable. The existing snapshot already contains the flat form. The
release replay therefore fails its textual catalog check even though these
particular null-safe predicates describe the same change detection. This is a
reproduced serialization difference, not evidence of missing recovery fields.

## Alternatives and trade-offs

| Option | Benefit | Cost or risk |
| --- | --- | --- |
| Forward migration with explicit comparisons — selected | Converges existing upgrades and fresh installs; comparator stays strict | One metadata-only migration and a brief table lock during installation |
| Rewrite the historical migration | Smaller migration count | Already-applied installations would not receive the correction |
| Strip parentheses from catalog SQL | Easy textual match | Could conceal genuinely different Boolean precedence; rejected |
| Restore both catalogs again before comparing | General deparser round-trip normalization | More databases and complexity; unnecessary for this bounded difference |

Final recommendation stack: PostgreSQL 18 → immutable historical migrations →
transactional forward trigger replacement → current schema snapshot → isolated
behavioral regression tests → unchanged full-catalog release replay gate.
No new service, dependency, singleton or runtime polling is needed.

## Safety and verification plan

The production migration runner executes the replacement and ledger update in
one transaction. The migration contains no item updates, deletes, network calls
or new privileges. Failed installation must roll back rather than bypass the
gate. Do not run schema tooling against the live installation for this work.

Test the original migration predicate, forward replacement and fresh snapshot
on disposable PostgreSQL databases. Cover all nine watched fields, allowed
null transitions, same-value updates, unrelated metadata changes, preserved
recovery state on migration, and repeated definition restore. Existing provider
recovery tests continue to verify fencing of stale completions and retries.
Negative catalog controls must still reject missing fields and changed logic.

## Official source basis — September 28, 2026

- PostgreSQL's [row comparisons](https://www.postgresql.org/docs/18/functions-comparisons.html)
  define `IS DISTINCT FROM` as null-safe: two null values are not distinct,
  while a null and non-null value are distinct. Retain this behavior for each field.
- PostgreSQL's [catalog information functions](https://www.postgresql.org/docs/18/functions-info.html)
  describe `pg_get_triggerdef` as a reconstruction rather than the original SQL.
  The nested-to-flat behavior above is our local reproduction, not an upstream
  guarantee about every expression or server version.
- PostgreSQL's [CREATE TRIGGER reference](https://www.postgresql.org/docs/18/sql-createtrigger.html)
  supports replacing a trigger and explains that `UPDATE OF` responds to columns
  mentioned in a statement. The unchanged-value `WHEN` guard remains essential.
- W3C's [accessible writing guidance](https://www.w3.org/WAI/tips/writing/)
  informs the descriptive headings and meaningful links in these documents.
  This database-only change introduces no UI or chart and makes no new WCAG claim.

Implementation evidence is recorded separately in the
[validation outcome](inventory-observation-trigger-replay-validation.md).
