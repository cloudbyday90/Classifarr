# Inventory observation trigger replay — validation

## Result

The original release-schema replay failure reproduced before the fix at catalog
line 9131. After the forward migration and snapshot generation, the unchanged
gate passed: 75 post-release migrations replayed, 297 migration ledger entries
present, and complete catalogs matching. The previous release baseline remains
unchanged. No catalog comparison exception or parenthesis stripping was added.

## Root-cause evidence

On the same isolated PostgreSQL 18.4 server, `pg_get_triggerdef(..., false)`
returned nested `OR` clauses for the original row-constructor predicate. After
restoring that definition, it returned a flat list. The next restore was stable.
The replacement's first definition already matches the stable form and the
fresh snapshot. This reproduces the failure without a server-version mismatch.

The snapshot was regenerated using the existing `dumpSchema` utility against a
new Testcontainers database, after applying the new migration. Its trigger DDL
was already canonical and did not change; only generation metadata and the
migration ledger changed. PostgreSQL version banners record the actual local
18.4 generator, not the application's embedded server version.

## Validation evidence

- Focused database suites: 3 suites, 66 tests passed. These include 32 new
  trigger tests plus the existing provider recovery and observation tests.
- The new matrix executes 36 transitions per path across the historical row
  predicate, forward migration and fresh snapshot: 108 transition assertions.
  It covers all nine fields, supported null transitions, same-value updates
  and controls for unrelated metadata. Real library/server foreign keys remain
  enabled; Plex and Jellyfin fixtures require no outbound requests.
- Trigger replacement preserves the entire seeded item row. Repeated replacement,
  definition restore and transaction rollback are covered. Existing provider
  tests still reject stale lease completions and verify recovery without
  changing media identity.
- Five catalog negative controls reject altered Boolean logic, missing fields,
  lost null-safety, timing/event changes and a different trigger function.
- The static ownership gate initially flagged the new migration and regenerated
  snapshot. Their two fingerprints were reviewed and updated under the existing
  SQL-history classification. No runtime writer was reclassified or exempted.

- Full backend suite: 1,523 suites, 45,951 tests passed on the final code after
  the ownership-review update. The initial run's single ownership failure was
  fixed, not ignored.
- Server/client lint and type checking, Markdown lint, ESM imports, strict
  mock-shape checks, migration naming, copyright, ownership review and both
  dependency-use checks passed. Whitespace validation passed.
- A freshly built isolated application image using PostgreSQL 18.6 passed
  `check-schema-snapshot-container.mjs`. Its disposable container/data were
  cleaned up. The snapshot generated with 18.4 also agrees with embedded 18.6;
  no banner change was needed because the existing generator normalizes version
  metadata when deciding whether the snapshot differs.

Full database integration also passed: 191 suites / 2,216 tests, with one
pre-existing suite/test skipped. The owned PostgreSQL container was removed by
the existing teardown. No validation failure remains from this change.

## Reproduce locally

From the repository root, run:

```powershell
npm run test:local:schema-release-replay
npm --prefix server run test:unit
node scripts/run-workspace-tests.mjs lint typecheck lint:docs esm:check-static-imports migration:check esm:check-test-mock-shapes:strict test:ci:preflight
```

From `server/`, use the existing isolated integration runner:

```powershell
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage
```

The rebuilt-image check uses `IMAGE_NAME=classifarr:trigger-replay-validation`
with `node scripts/check-schema-snapshot-container.mjs`, never a live container.
The validation image was
`sha256:7d93ec1031f4a78fa3a6930f2eda8b6c0c04a1f5ef7bb20a1e99c90fdb0bb6d3`.
Local logs remain ignored under `.tmp/trigger-*.log`; they are not release
attestations or claims about a deployed installation.

## Operational boundaries and PR availability

The September 28 GitHub MCP search returned no open pull requests in
`cloudbyday90/Classifarr`, so no random PR could be selected. No PR was merged.
The work uses disposable databases and synthetic data; no live library,
credentials, routing configuration or container was changed. No release, tag
or version bump is included.

## Next high-value item

Run a bounded sustained mixed-workload recovery soak, building on the existing
installation-budget profile. Measure memory growth over time, backlog age and
drain rate while ingestion, backfill and evaluation overlap; inject a temporary
provider outage and process restart. Require stable recovery without duplicate
work or lost ownership before recommending production CPU/PID limits. Short
startup samples alone do not establish sustained headroom.

The [sustained observation follow-up](sustained-resource-observation-validation.md)
adds and measures same-process drain/idle evidence. Restart remains a distinct
installation-drill boundary; its outcome does not imply a restart under this
sustained workload was exercised.

See the [design and trade-offs](inventory-observation-trigger-replay-design.md)
for the selected stack and official PostgreSQL/W3C source basis.
