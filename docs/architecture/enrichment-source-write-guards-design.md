# Enrichment source write guards design

## Decision

Extend the current captured-source contract to every write in queue enrichment.
The previous rollback assessment reproduced late OMDb ratings and unresolved
metadata reaching a replaced source item because its ID, type, library and null
TMDb ID had not changed. History also needs a write-time check: a source can
change after the metadata update succeeds and before history is inserted.

Use a shared ESM source projection containing media server, external key,
library, type, title, year, IMDb ID and TVDB ID. Capture it from PostgreSQL before
provider work, preserve nulls, and compare it atomically at each write. Keep the
expected TMDb ID separate because the normal resolver may establish it during
the task. Source fields are compared exactly; normalization is the sync layer's
responsibility. Missing or malformed snapshots cannot authorize a write.

## Persistence boundaries

- Update OMDb ratings in one conditional statement. Derive `original_rating`
  from the locked row's current rating, eliminating the separate read/write gap.
  Require the captured source and pre-resolution TMDb identity. Calls without
  a source snapshot may still obtain provider data but cannot backfill a rating.
- Move final metadata and observation-clock persistence into a small ESM module.
  Require the same source and the final resolved-or-null TMDb identity. Zero
  updated rows complete as skipped and prevent history persistence.
- Guard source-item history inserts with a materialized source selection and
  `FOR SHARE`, keeping the source stable for the insert statement. This protects
  the interval after metadata persistence without holding locks during provider
  calls. A rejected history insert reports a source-change skip. Remove the
  internal snapshot from serialized history metadata.
- Reuse the projection for resolver provenance writes so the fields cannot drift
  between writers. Preserve standalone history behavior for callers without a
  source item; source-item callers require captured evidence.

The source snapshot excludes enrichment metadata, rating normalization and queue
bookkeeping. Those changes must not invalidate a valid provider response. A source
that changes and returns to identical captured fields is indistinguishable by
this contract. Independently valid writes are not rolled back if a later stage
finds that the source changed; normal sync invalidation and queue recovery apply.

No schema, dependency, scheduler, frontend or public API change is needed.
The existing PostgreSQL pool statement timeout bounds history lock waits
(`POSTGRES_STATEMENT_TIMEOUT_MS`, 30 seconds by default). Database errors remain
errors; they are not converted into successful writes or source-change evidence.
Provider rate limits, retry policy, authentication, and semantic readiness gates
remain in place. Source placements remain observations, not verified labels.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Separate source check followed by an unguarded write | Familiar | Leaves a concurrency gap | Reject |
| Hold a transaction across provider calls | Stable source | Locks inventory during slow or failed network requests | Reject |
| Compare the initial row revision everywhere | Detects every row update | Rejects normal enrichment and rating bookkeeping | Reject |
| Conditional writes plus a short history source lock | Protects each persistence boundary without new operator work | Extra comparisons and brief contention; conservative source edits can discard results | Implement |
| Per-item manual confirmation | Explicit oversight | Repeated operational work does not solve races | Exception workflow only |

Recommended stack: validated inventory → attributable typed identities → atomic
source-guarded enrichment → automatically refreshed coverage-aware profiles →
bounded library comparisons → independently evaluated classification support.

## Official research

Sources were discovered and read through MCP/web tools on September 5, 2026 for
the requested August 2026 baseline. Living documentation is not claimed to be an
archived August snapshot.

- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  explains that conditional updates and locking reads re-evaluate predicates
  after a concurrent updater commits. Keep the source check in that operation.
- [PostgreSQL UPDATE](https://www.postgresql.org/docs/18/sql-update.html)
  defines affected-row counts, including zero without a SQL error. Treat zero
  as rejected work rather than reporting successful enrichment.
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  distinguishes `FOR SHARE`, which blocks source updates for the statement, from
  `FOR KEY SHARE`, which permits non-key updates and is insufficient here.
- [OWASP business logic security](https://cheatsheetseries.owasp.org/cheatsheets/Business_Logic_Security_Cheat_Sheet.html)
  recommends atomic conditional updates or appropriate transaction locks for
  check/use races. Bind all values; interpolate only fixed application SQL.
- [W3C PROV-DM](https://www.w3.org/TR/prov-dm/)
  connects derived information to the entities and activities that produced it.
  Keep provider observations attached to the source they actually used, without
  claiming RDF conformance or classification correctness.

## Validation

Test every captured field, typed and null TMDb identities, source deletion,
unrelated metadata and rating updates, malformed/missing snapshots, and caller
mutation. Exercise actual PostgreSQL waits and predicate rechecks, including a
source change between metadata and history. Repeat the previous failure paths
and a 32-item real-source regression sample in rollback-only local Compose
fixtures with controlled providers and no live source writes. Record final
results and the next task in a separate outcome document.
