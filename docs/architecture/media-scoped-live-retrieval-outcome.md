# Media-scoped live retrieval: outcome

## Implemented component

Live requests now read only their movie or TV inventory, while still comparing
every active library of that type. The new ESM live-corpus reader validates a
canonical typed identity, binds the media type as a SQL parameter, and rejects
mixed-media results, scope changes and cancelled reads. Existing corpus budgets,
source-conflict checks and query/copy exclusions remain enforced.

The preceding commit, `970aa5f0`, introduced bounded fitted-model reuse. This
change complements that work; it does not introduce another cache or replace
fresh evidence with cached routing decisions. The default shared SQL remains
byte-for-byte compatible for global refresh and benchmark consumers. No schema,
API, dependency, frontend, setting or release change is needed.

See the separate [design and research document](media-scoped-live-retrieval-design.md)
for alternatives, pros/cons, August 2026 applicability and official sources.

## Local Compose verification

On 12 September 2026, the service was rebuilt and recreated. All three affected
production service hashes matched the workspace; the container became healthy.
The comparison process enforced PostgreSQL read-only transactions and disabled
content/file logging. It made four local model-generation calls, reused each
proposal across comparison arms, and never routed media or wrote history,
configuration or training records. Only aggregate counts, timings and outcome
categories were emitted.

The stored **require-all-confirmations setting remains enabled**. To exercise
automatic-route qualification, the harness supplied a false value only through
its in-memory configuration reader. The database setting was not changed. A
test receipt therefore does not mean that the running application will bypass
the operator's confirmation preference.

### Whole-inventory parity

Within one repeatable-read snapshot, each scoped query returned exactly the
corresponding media-filtered rows from the preceding all-media query, including
memberships outside shortlisted libraries.

| Corpus | Returned rows | Active libraries represented | SELECT execution, ms | Shared buffer hits |
| --- | ---: | ---: | ---: | ---: |
| Previous all-media read | 6,651 | 10 | 1,049.703 | 59,559 |
| Movie-scoped read | 5,008 | 5 | 822.505 | 48,016 |
| TV-scoped read | 1,643 | 5 | 238.363 | 14,013 |

These are individual `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF, FORMAT JSON)`
measurements, not transfer times or throughput claims. All three had zero shared
buffer reads; planning took approximately one millisecond. Scope reduces rows
returned by 24.7% for movies and 75.3% for TV in this particular inventory.

### Live AI/RAG comparison

The local retained smoke set contained three movie cases and one TV case. Each
ran with the exact preceding repository implementation and the new scoped
implementation, both with their default fitted-model caches, in cold and warm
arms. Arm order alternated by case. All 16 arms produced identical live evidence
within their case, including learned fingerprints, baselines and qualification.

| Case | Media | Previous warm retrieval, ms | Scoped warm retrieval, ms | Unchanged outcome |
| --- | --- | ---: | ---: | --- |
| 1 | Movie | 2,460 | 1,543 | Review; neighbors disagree |
| 2 | Movie | 3,783 | 2,710 | Qualified; two fresh checks and a valid test receipt |
| 3 | TV | 2,028 | 768 | Review; metadata disagrees |
| 4 | Movie | 1,944 | 1,537 | Review; metadata disagrees |

Case 2 sums both retrieval calls. Its complete warm validation fell from 5,170
to 3,985 ms. Its policy score remained 38.72: this optimization changes neither
the score nor the evidence requirements. Qualification still depends on the
existing learned-evidence and deterministic routing checks.

The qualified case's warm phase totals identify where time remains:

| Measured phase | Previous, ms | Scoped, ms |
| --- | ---: | ---: |
| Corpus SELECT and transfer | 2,333 | 1,471 |
| Vector ranking | 321 | 237 |
| Baseline vector reads | 99 | 95 |
| Repository remainder | 729 | 588 |
| Embedding representation inspection | 196 | 202 |
| Query embedding | 62 | 78 |

Repository remainder includes preparation/fitting, transaction/pool and
instrumentation overhead; it is not an isolated CPU measurement. Small setup,
configuration and query-vector reads are omitted from this table. Do not sum
these observations into an advertised service-level guarantee.

This is a four-case integration/performance smoke comparison, **not a balanced
accuracy benchmark**. Generation was held constant within each case; the first
cold embedding call also incurred model warm-up. No build or test suite ran
alongside the measurement, but normal local service and host variability remain.
No additional evaluation samples were created in this component.

## Automated checks

- Focused services: **19 suites, 268 tests passed** with targeted coverage.
- Policy/routing/code-health selection: **600 suites, 28,269 tests passed**.
- PostgreSQL integration selection: **5 suites, 24 tests passed**.
- New live-corpus reader: **100% line, branch and function coverage**. The three
  selected production files together reached 95.79% lines and 94.59% branches.
- Backend typecheck, changed-file ESLint, static-import and ESM mock-shape checks
  passed. Markdown lint and whitespace checks passed.
- The production naming gate still reports **26 pre-existing legacy references**
  against its zero-reference baseline. This count was not increased and the gate
  was not relaxed; these results do not establish fully green CI.

New database coverage proves TV/global profile and baseline parity, same-media
memberships outside the shortlist, cross-media identity isolation, source and
description conflict exclusions, stored-query copies and warm-result parity. A
separate test proves that 10,001 unrelated TV descriptions no longer block a
bounded movie request, while the TV request and global corpus still reject their
over-budget inputs. This availability improvement is deliberate.

Focused command, from `server/`:

```powershell
$patterns = 'liveInventoryDescription|inventoryDescription|inventoryMetadataCandidates|liveInventoryLearned|liveLibraryMatch'
node scripts/run-jest.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

Database integration command, from `server/`:

```powershell
$patterns = 'live-inventory-description|inventory-description-refresh|inventory-description-vector-cache|policy-shortlist-replay|consensus-review-recovery'
node scripts/run-jest.mjs -c jest.integration.config.mjs --runInBand --no-coverage --testPathPatterns=$patterns
```

Targeted coverage and the local comparison harness remain under ignored `.tmp/`.
They do not replace current global coverage reports or establish the global
coverage ratchet. Compose reused the unchanged frontend build layer; no new
client test run is claimed.

## Recommendation and next component

Keep the parameterized media-scoped reader. Its benefit is less unrelated work
and fewer unrelated-media availability failures, with unchanged evidence. Its
cost is an additional scope contract and continued full same-media reads. The
recommended stack remains PostgreSQL/pgvector, local embeddings, modular ESM
readers, exact-input model reuse and fresh deterministic routing validation.
There are no additional user controls or acknowledgements.

**Next: reduce the remaining corpus projection and sorting work.** Corpus reads
still consumed 1,471 of 2,710 ms in the qualified warm retrieval pair. A separate
instrumented movie plan took 982 ms: its join subtree finished at approximately
44 ms, the sort at 572 ms, and the projected result at 972 ms. These cumulative
node times suggest investigating wide-row materialization and synopsis projection
before adding indexes or changing embedding checks. The 5,008 history index
lookups averaged approximately 0.003 ms each, so their mere count is not evidence
that they are the dominant cost.

Prototype a lean corpus projection while preserving exact synopsis fallback,
stable ordering, limits and all same-media evidence. Compare plans and exact
results before selecting an implementation, then repeat a balanced movie/TV
sample. Do not cache stale routing authority, hard-code library categories or
build another settings panel to obtain the speedup.

The projection follow-up is documented separately in the
[lazy synopsis design](lazy-corpus-synopsis-design.md) and
[outcome](lazy-corpus-synopsis-outcome.md).

## PR and release scope

Two GitHub MCP checks on 12 September 2026 returned no open Classifarr PRs. There
was no eligible random PR to implement, and no closed or unrelated PR was
substituted. No PR was merged. High-level changes are recorded under Unreleased;
no version bump, tag or release is created.
