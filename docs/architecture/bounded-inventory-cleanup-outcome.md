# Bounded inventory cleanup outcome

## Decision and implementation

The next [writer compatibility item](inventory-writer-compatibility-outcome.md) is
implemented as a disposable PostgreSQL prototype. It adds complete-manifest pruning,
bounded source deletion, library/server admission guards, durable job checkpoints
and explicit parent completion. Production cleanup behavior and schema are unchanged.

The implementation separates input contracts, schema, admission triggers, parent
guards, job/manifest lifecycle, source batches, completion steps and measurements
into ESM modules under `server/src/scripts/inventoryCleanup/`. It reuses the existing
sync persistence adapter and scoped-repair lock/trigger services. No dependency,
operator queue, manual collection process or AI routing behavior was added.

Run the complete local assessment with:

```bash
npm run benchmark:inventory-cleanup
```

The command accepts no connection arguments, loads no application configuration,
creates a disposable `postgres:18.6-alpine` container with generated credentials and
verifies removal of its fixture schema. Reports expose aggregate fixture results,
with provider requests and production writes both zero.

## Measured PostgreSQL 18.6 outcome

| Scenario | Measured result |
| --- | --- |
| Full-sync pruning | 2,049 initial items, 137 seen identities retained, 1,912 deleted |
| Partial first transaction | 128 deletions, job remained running |
| Resume | Remaining pruning completed through a new connection |
| Unrelated library sync | Committed in 33.59 ms while target admission remained closed |
| Library removal | 2,051 items drained before one empty parent was removed |
| Server removal | 395 remaining items, including 257 without a library, drained before three parents were removed |
| Mutation bounds | At most 128 source deletions or one parent deletion per step |
| Server admission | Late source insert rejected during draining |
| Final fixture counts | Zero items, libraries and servers |
| Cleanup | Disposable schema removal verified |

The timing is one local observation, not a latency guarantee. Source and parent
counts exclude job bookkeeping and bounded repair-cache invalidation work. The
prototype does not claim a bound on every production cascade or total index work.

## Concurrency and failure evidence

Twenty-one new PostgreSQL integration cases passed. Together with existing sync and
scoped-repair regressions, the targeted run passed **80 tests across four suites**.
These use the existing PostgreSQL 18.4 integration image; the standalone assessment
above used 18.6.

The checks cover:

- Incomplete traversal and mismatched manifest counts reject before deletion;
  duplicate manifest appends are idempotent and abandoned collecting jobs can cancel.
- Empty complete manifests drain zero, one, 128 and 129 rows correctly.
- A 2,051-row library retains exactly its three seen identities, including IDs near
  the beginning and end, with 37-row resumption steps and idempotent completion replay.
- Late inserts, updates remaining in the target and moves into the target reject.
  Moves out and unrelated library writes remain possible.
- A move or external delete after candidate discovery is counted separately from
  cleanup deletion; membership and `xmin` are rechecked after library locks.
- Undeclared parent deletion rejects even for empty parents. Missing admission
  fences cannot produce successful completion. Cross-server mismatches and source
  identity/library ownership changes reject.
- Server removal includes unassigned source items and blocks new child libraries.
  Other servers remain usable; overlapping cleanup ownership on one server rejects.
- An admitted uncommitted sync makes fencing fail atomically with `55P03`. After
  that sync commits, its row is included in the drain. Conversely, an uncommitted
  fence makes incoming sync fail without inserting a row.
- Competing workers visibly wait on database locks and commit exact progress
  without duplicate counts; unrelated sync proceeds while one worker is held.
- Injected checkpoint failure and real backend termination roll back the entire
  unfinished batch. A new connection resumes from the committed job state.
- An obsolete cursor cannot hide remaining target rows: the independent absence
  check keeps the job running and restarts its scan before allowing completion.

Connection termination is not a whole PostgreSQL server-crash or storage-recovery
test. Target writes receive retryable admission failures during the drain; a future
production orchestrator must schedule those retries without operator intervention.

## Read-only Compose dependency evidence

On 6 September 2026 at 13:40:26 -04:00, the running local Compose database was
inspected in a `REPEATABLE READ READ ONLY` transaction. The query read catalog data
only: zero item rows and zero writes. It did not upgrade or redeploy the application.
The existing source-schema parser independently read the authoritative snapshot.

| Referenced parent | Repository direct FK constraints | Running Compose direct FK constraints |
| --- | --- | --- |
| `libraries` | 34: 29 cascade, 2 set null, 3 no action | 32: 27 cascade, 2 set null, 3 no action |
| `media_server` | 6: 4 cascade, 2 set null | 6: 4 cascade, 2 set null |
| `media_server_items` | 2 cascade | 1 cascade |

These are direct constraint counts, not unique child-table counts or the complete
transitive graph. The running database lacks the snapshot relationships for
`library_observation_scan_progress`, `library_profile_inventory_state` and
`media_identity_review_previews`, consistent with the prior deployed-schema gap.

The broader graph matters immediately. Item deletion cascades to enrichment retry
rows and, in the repository schema, identity-review previews. Library deletion also
affects collections, policies, learned evidence and scheduling. Classification
history uses set-null behavior; requests, sync status and feedback include no-action
references. Existing library removal also marks completed history before deleting
the parent. The prototype deliberately does not replace those domain decisions.

## Verification

The complete backend coverage run passed **30,258 tests in 1,068 suites** in
496.057 seconds. Server coverage was 89.74% lines/statements, 80.65% branches and
92.06% functions; the repository baseline ratchet passed without baseline changes.
The separate PostgreSQL integration run passed 80 tests in four suites in 17.203
seconds, and the PostgreSQL 18.6 standalone benchmark passed. The backend coverage
report does not include the separately run integration tests.

Repository lint, configured server/client type checks, static ESM imports, strict
ESM mock-shape checks, server dependency checks, migration/schema integrity checks,
Markdown lint across 1,018 documents and the local Docker build passed. Client code
was unchanged; its existing coverage report was retained and client tests were not
rerun. Private benchmark/catalog reports stay in ignored `.tmp/` intermediates.

## Recommendations and next item

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Retain complete-manifest admission boundary | Clear completion meaning; no manual labeling or collection | Target writes pause during cleanup; traversal completeness remains a caller contract |
| Retain durable bounded transactions | Automatic reconnect/resume and exact counters | Whole-job progress is incremental, so committed deletions cannot be cancelled back |
| Keep one cleanup per server initially | Simple ownership and conflict behavior | Long collecting jobs delay other cleanup on that server |
| Keep prototype isolated | Preserves current production retention behavior | Does not yet reduce production deletion cost |
| Validate all dependent tables next | Makes total mutation budget and preservation decisions reviewable | Requires domain-specific cascade, set-null and restrict handling |

Next: **automatically derive the transitive deletion dependency plan, then prototype
bounded handling of item dependents and retained library references**. Start with
enrichment retry rows and identity-review previews, followed by collections, sync
status and history preservation. Include foreign-key indexes, exact affected-row
counts, concurrent dependent inserts, retained audit data and rollback/resume tests.
Treat unknown tables, cycles and unvalidated actions as unresolved evidence rather
than choosing a destructive default. Keep the plan reproducible from schema/catalogs.

Before production adoption, also establish manifest/job retention and automatic
recovery of abandoned collecting jobs, admission retry orchestration, least-privilege
runtime roles, dynamic-writer coverage and sustained storage/crash evidence. Broader
cleanup is a prerequisite for coherent inventory; independently evaluated semantic
counter-evidence remains review-only and must still pass readiness/frozen preflight.

Final recommendation stack: automatic dependency evidence → complete traversal and
durable progress → fenced bounded transactions → dependent-table preservation →
automatic retries/retention → least-privilege enforcement → production assessment.

The separate [design](bounded-inventory-cleanup-design.md) documents the official
PostgreSQL/W3C research, August-baseline qualification and alternatives. This change
adds no UI or accessibility-conformance claim. GitHub MCP returned no open PRs on
6 September 2026, so none was available for random local implementation.
