# Inventory writer compatibility outcome

## Decision

The next [scoped-repair item](library-scoped-repair-outcome.md) is implemented:
automatic writer discovery and an isolated adapter for the existing sync upsert.
The adapter preserves production identity/metadata decisions while testing
identity-before-library lock ordering and revision rechecks. Keep it isolated;
bulk, parent-cascade and restore writers still prevent production promotion.

Recent commits established revision-checked inventory scans, automatic diagnostics,
recovery benchmarks, bounded repair and library-scoped ordering. This work adds
the writer compatibility evidence needed before those prototypes can be adopted.
It does not add operator labeling, collection steps or semantic auto-routing.

## Automatic repository inventory

Run:

```bash
npm run inventory:writer-compatibility
```

The final source assessment scanned 1,831 code/SQL files totaling 12,045,948 bytes
with Node v24.18.1 and ESLint 10.9.1. It emitted source locations, scope, operation,
target and hashes without connecting to a database or returning SQL/data values.
Its source fingerprint was
`30646c603cb356d3d5c049fa18d53fdbb32f26feacd2a4ba6ea383df7db0c86d`.

| Source scope | Direct inventory candidates | Parent-cascade candidates | Dynamic targets |
| --- | --- | --- | --- |
| Runtime source | 17 | 4 | 37 |
| Maintenance/prototype code | 2 | 0 | 36 |
| Migrations | 2 | 4 | 0 |

These are statement candidates, not unique services or proven runtime executions.
The scan also recorded 85 indirect query-argument sites and 26 dynamic SQL
execution sites. Dynamic targets across other domains are retained as uncertainty;
they are not claimed to write inventory. The schema snapshot supplied six inventory
triggers and the deletion ancestry through `libraries` and `media_server`.

The directly identified runtime families include:

| Writer family | Existing behavior to preserve |
| --- | --- |
| Sync upsert | Library moves, source normalization, `xmin` comparison and retention decisions |
| Sync pruning | Full-library removal of unseen external IDs |
| Queue enrichment and retries | Observation/clock writes after external work; source-evidence comparisons |
| Identity resolution and review | Typed identity provenance, actor checks and transactional audit |
| Rating normalization | Original and normalized rating relationship |
| Broad cleanup and post-upgrade work | Multi-item operations and transaction boundaries |

Parent deletions were discovered in backup restoration, media-server library sync
and broad cleanup. Dynamic restoration in `backupRestoreTables.mjs` is explicitly
unresolved. The full path/line ledger is regenerated rather than maintained by an
operator. No new writer is automatically declared compatible by appearing here.

The scanner parses JavaScript without executing it, ignores comment-only DML,
distinguishes `COPY FROM` from `COPY TO`, handles CTE writes, quoted identifiers,
multi-table truncate and dynamic templates, and fingerprints content independently
of enumeration order. Parse failures, unsupported languages and unresolved SQL
stay visible. It is not a complete PostgreSQL parser, dependency/call graph, or
proof of deployed privileges. Files outside the declared roots/extensions are
outside its scope; SQL assembled through arbitrary helpers remains unproven.

## Isolated sync assessment

Run:

```bash
npm run benchmark:inventory-sync-compatibility
```

The no-argument command creates a disposable `postgres:18.6-alpine` container using
generated credentials. It reuses the existing production persistence service and
exact upsert predicates, binding only the known source-table clauses into the
allowlisted prototype schema. No production SQL or persistence service was changed.

In the measured same-key insert race, the first writer paused while holding its
identity/library locks, before inserting a row. The second writer visibly waited
on the identity advisory lock. After the first committed, the second detected its
stale missing-row assumption, reread the source, recomputed the decision, and
completed on its second read. Exactly one item remained for that external identity.

An unrelated sync committed in 14.09 ms while the first writer remained paused.
This is a local observation, not a latency SLA. The same PostgreSQL 18.6 assessment
retained resolved TMDB identity, observation data/clocks and normalized rating
through a library move, then cleared incompatible enrichment when the source
changed. An undeclared parent cascade was rejected. Disposable schema cleanup
was verified; provider requests and production writes were zero.

The PostgreSQL integration suite additionally proves:

- Movie and TV retention through omission and library moves.
- Observation/rating resets after title, year, provider-ID or media-type changes.
- Recomputed decisions after an intervening move, deletion or enrichment.
- A second membership/revision check when a move happens after discovery but
  before library locks; no mutation touches the undeclared library.
- A maximum of three optimistic attempts, with no unconditional overwrite.
- Analysis runs while the database session is idle, outside all adapter locks.
- Library and media-server cascades without declared locks reject atomically.
- Foreign-key failure rolls back and releases locks for the next successful sync.
- The catalog reader cannot write inside its read-only transaction.

All 68 PostgreSQL checks passed across the new adapter tests, existing production
sync-retention tests and scoped-repair suites. Integration used the existing
PostgreSQL 18.4 test image; the standalone benchmark and Compose check used 18.6.

## Read-only deployed catalog evidence

On 6 September 2026 at 12:56:36 -04:00, the local Compose PostgreSQL 18.6 instance
reported:

| Contract evidence | Repository schema | Running Compose database |
| --- | --- | --- |
| Observation-clock columns | 2 | 0 |
| Non-internal inventory triggers | 6 | 0 |
| Inventory foreign-key deletion actions | Cascades from libraries and media servers | Both present and validated |

The connected role owns the inventory table and has insert/update/delete privileges.
An owner can alter object definitions; a trigger cannot be an authorization boundary
against that owner. Deployment-role separation is therefore a future adoption gate,
not a property established by these prototype tests.

The catalog check read zero item rows and performed zero writes. It did not
upgrade, redeploy or repair the running application. These results explain why
the deployed database cannot be treated as a current observation-health fixture.
Private reports remain in ignored intermediates; only aggregate/catalog evidence
is documented here.

## Verification

The final full backend run passed **30,236 tests in 1,067 suites** in 523.251 seconds.
Server coverage was 89.84% for lines/statements, 80.65% for branches and 92.28% for
functions. The repository coverage ratchet passed without changing its baseline.
The unchanged client retained its existing coverage report; client tests were not
rerun for this backend-only change.

The 68 targeted PostgreSQL checks and the disposable PostgreSQL 18.6 benchmark
passed. Repository lint, type checks, ESM import/mock-shape checks, server dependency
checks, migration validation, Markdown lint and the final Docker build also passed.
The final parser refinements received targeted lint and the complete backend run.
These checks validate the inventory and isolated adapter; they do not establish
production compatibility for unadapted writers.

## Recommendations and next item

| Choice | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Automatic static discovery | Finds drift and indirect writers without manual collection | Dynamic data flow and runtime reachability remain uncertain | Keep as reproducible evidence |
| Existing sync service plus isolated adapter | Preserves normalization, retention and bounded retries | Not yet an application transaction gateway | Keep this tested boundary |
| Identity then library locks | Handles missing-row insert races and unrelated progress | All sync writers must obey the same order; hash collisions add contention | Require for the eventual sync gateway |
| Catalog-only deployment checks | Establishes actual columns, triggers and direct ownership | Does not audit every inherited privilege or external writer | Retain as separate evidence |
| Production repair rollout | Would expose adaptive repair | Bulk, cascade, restore, role and recovery gaps remain | Defer |

Next: **prototype bounded full-sync pruning and parent deletion together**. Preserve
the existing meaning of a completed full sync while limiting each source mutation
to the declared work budget. Recheck membership/revisions after acquiring ordered
locks, distinguish source movement from deletion, and ensure partial pruning cannot
masquerade as completed cleanup. Test large libraries, concurrent sync inserts,
parent cascades, rollback/reconnect and exact final counts in the disposable lab.
Do not add an operator queue or manual collection process.

Define how new child writes are admitted while a parent is being removed before
chunking cascades. Adding a row limit to one delete cannot by itself prevent late
inserts or establish that parent cleanup is complete. Preserve atomic failure
behavior until the bounded replacement has explicit completion evidence.

Resolve dynamic writer targets and indirect query sites before claiming complete
production coverage. Deployment-role enforcement, sustained storage churn and
database-crash recovery remain additional gates. The original independent-label
and frozen-study requirements remain necessary before semantic counter-evidence;
ambiguity must lead to review, not automatic classification routing.

Final recommendation stack: automatic source/deployment evidence → preserved sync
semantics → ordered identity/library transactions → bounded bulk and parent-writer
handling → least-privilege enforcement → coherent automatic coverage → independently
evaluated review-only AI evidence.

Official PostgreSQL, ESLint and W3C research, August-baseline limitations and the
architecture are recorded separately in the
[design](inventory-writer-compatibility-design.md). W3C DQV informs provenance and
completeness; this work introduces no UI or accessibility-conformance claim.

GitHub MCP returned no open PRs on 6 September 2026, including the pre-integration
recheck. No PR was available for random local implementation; no external PR was
merged and no release was created.
