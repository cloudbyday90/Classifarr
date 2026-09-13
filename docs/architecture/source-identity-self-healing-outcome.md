# Source identity self-healing outcome

## Implemented — 13 September 2026

The [design](source-identity-self-healing-design.md) records the root-cause
reassessment, official sources, media-type boundaries and alternatives.

Plex's adapter now supplies bounded transient candidate evidence. A dedicated
ESM recovery service verifies IMDb-to-TMDb agreement, exact title/year, and a
fresh source digest. TV also requires agreement from any supplied TVDB ID;
disputed movie TVDB IDs remain unset. Source data cannot inject a recovery
receipt, and neither fuzzy text matching nor AI chooses an identity.

Persistence uses the current capture generation, active library owner and exact
digest. Inventory write, server receipt and conflict removal commit together.
Existing identity-aware upsert behavior makes changed identities eligible for
metadata backfill and preserves completed enrichment for unchanged identities.
The existing queue discovers the repaired item without a user action.

New catalog attempts are bounded to eight per library sync. Durable one-day
retry state survives restarts and resets on changed source evidence. A recent
server-owned receipt avoids repeating catalog calls but still requires a fresh
source check; its expiry is not extended by reuse. No new queue, setting,
acknowledgement or upstream Plex write was introduced.

## Verification

- Targeted recovery, warning, sync, persistence, observation and Plex adapter
  regressions: eight suites, 117 tests passed.
- Real PostgreSQL recovery, observation and identity-retention integration run:
  three suites, 44 tests passed. It covers actual queue-refill discovery, atomic
  rollback, stale captures, changed evidence, retry expiry, concurrent claims,
  unchanged backfill retention and warning-state concurrency.
- Server typecheck and targeted ESLint passed. Two JSDoc annotations clarified
  existing transitive dependency types without changing runtime behavior.
- The classification-method scanner excludes the new identity-receipt helper
  for the same reason it excludes existing identity receipts: its `method` is
  not a classification-history value. The database classification constraint
  and permitted classification methods were not changed.
- Final full backend run: 1,268 suites, 36,605 tests passed, with 90.09%
  statement/line, 82.16% branch and 92.17% function coverage. Full PostgreSQL
  integration: 141 suites, 1,627 tests passed, one existing opt-in suite/test
  skipped. Full frontend: 367 suites, 5,074 tests passed. Fresh coverage ratchet,
  client/server typechecks and ESLint, ESM, migration and documentation checks
  passed. The unrelated production-naming gate still reports its pre-existing
  26 references against a zero baseline; this is not an all-CI-green claim.

### Local Compose outcome

The rebuilt service passed its health check with a read-only root filesystem.
Its ordinary two-minute startup sync completed all ten libraries and actually
recovered eight records: seven movies and one TV show. All eight subsequently
had completed TMDb metadata backfill through the existing scheduled queue, with
no manual enqueue or classification retry. Six repaired movies retained no
disputed TVDB ID. Eleven TV source observations remained unresolved; two had
durable retry cooldowns and the others lacked a structurally safe candidate set.

Only four library-level summaries were emitted, for the four libraries still
containing unresolved records. Each included the fixed Plex reference. The ten
full-scan state rows totaled eleven remaining skipped items. These are measured
local outcomes, not an estimate extrapolated from the read-only replay.

The new migration was applied to the existing Compose database. The fresh-install
schema snapshot was regenerated through the existing isolated-container workflow;
the final schema diff contains only the new recovery columns, warning table and
constraints, migration marker and generation timestamp. Temporary synthetic
schema-check data and its container were cleaned up; user library data was not
removed. Migration naming, snapshot integrity and freshness unit checks passed.

## Limits and recommendation

This resolves Classifarr's usable canonical identity, not the underlying Plex
catalog. Ambiguous independent IDs and incomplete evidence remain excluded and
retry when eligible. Rebuilds cannot resolve a genuinely contradictory source
record. Recovery itself performs no routing or training; existing downstream
workflows retain their own safeguards.

Keep the ESM evidence/receipt/persistence separation, PostgreSQL transaction,
bounded provider reads and existing backfill queue. The benefit is hands-off
recovery with repeat-sync stability; the cost is that ambiguity remains visible
instead of being silently guessed away. Evaluate the newly available movie/TV
descriptions in the existing library-balanced AI/RAG benchmark next, rather than
lowering routing thresholds merely because more items were imported.
