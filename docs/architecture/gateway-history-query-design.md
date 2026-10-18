# Gateway history query design

## Agreed scope and failure

Approved on 18 October 2026: investigate the varied-history metadata timeout in a
separate disposable read-only profiling lane, then make the smallest equivalent
query change. A diagnostic session may run for at most 60 seconds; production
retains its four-second statement, five-second client, two-second lock and
120-second assessment limits. Work on main, no release. Unraid, Plex and shared
Ollama remain untouched. No new tables, identities, admin controls or purge
authority are needed; existing native UUIDv7 identities remain required.

The previous study reproduced a timeout in `readArchiveHistory` before catalog
admission. Its plain plan showed a wide whole-row reference through a join/sort;
the exact operator cost remains a hypothesis until measured. An unchanged
reference query will be retained only in synthetic fixtures, not application
fallbacks. Do not increase production limits to make the experiment pass.

## Official research and alternatives

Sources discovered through MCP search/navigation and opened on 18 October 2026:

- PostgreSQL 18 [EXPLAIN](https://www.postgresql.org/docs/18/sql-explain.html)
  distinguishes estimates from actual execution, serialization cost, shared/temp
  buffers and timing overhead. Use bounded JSON plans with `ANALYZE`, `BUFFERS`,
  `SERIALIZE TEXT` and `TIMING OFF`, outside measured HTTP load. Plan timings are
  diagnostic, not network latency measurements.
- [CTE materialization](https://www.postgresql.org/docs/18/queries-with.html)
  explains when subqueries are folded or materialized and how that affects
  repeated computation and optimization. An explicit narrow boundary is a
  candidate, not proof of a better plan on every PostgreSQL version.
- [SELECT](https://www.postgresql.org/docs/18/sql-select.html) documents evaluation
  of expensive output expressions around sorting/limits. Verify actual work and
  exact results rather than relying on SQL formatting.
- [TOAST](https://www.postgresql.org/docs/18/storage-toast.html) describes
  out-of-line storage and its effects on row/cache/sort size. Logical JSON bytes,
  physical storage and bytes transferred to Node are different measurements.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Raise timeouts/resources | May complete expensive work | Conceals the current bound failure; rejected |
| Cache trust across assessments | Avoids repeated reads | Can hide changed evidence/files; rejected |
| Narrow metadata before eligible full-row hashing | Can avoid carrying inert payloads through joins/sorts | Requires complete result, budget and tamper equivalence; selected only if evidence supports it |
| Delete failed history | Reduces data | Removes required diagnostic/budget history without authority; rejected |

## Contracts that cannot change

Return complete metadata in `(created_at,id)` order. Preserve all seven job
statuses, full protection JSON, native timestamps, field aliases/order/types,
the 10,001 sentinel, 10,000-row cap and exact 8 MiB projected-row JSON cap.
Count overflow retains priority over byte overflow. No truncated success.

Eligible evidence remains the byte-identical PostgreSQL SHA-256 of the complete
job's canonical JSONB row, not a stored manifest hash or reduced JavaScript
object. Inert evidence hashes remain NULL. Detail reads retain their exact
128 KiB cap and compare all metadata fields to the captured summary. Preserve
microsecond timestamp and same-stored-hash payload mutation detection.

Keep the history read in one SQL statement/snapshot. A failed read grants no
archive, retry, retention, recovery or purge authority. Admission attempts,
cooldowns, cancellation, uncertainty and crash fencing are unchanged. Empty or
disabled installations gain no work. No provider request or HTTP call belongs
inside a database transaction.

## Bounded diagnostic lane

Reuse the existing isolated soak setup: exact image/revision, fresh database,
real prerequisite capture/private restore, and 3,000 deterministic varied failed
records. Do not start inference or scheduled worker loops. Retain the source's
2 GiB/2 CPU/512 PID cap and existing prerequisite-worker limits, no network or
published ports, fixed mounts, nonroot workers and exact-label cleanup.

Use a separate restricted SELECT-only reader, checked fixed database identity,
default read-only setting and repeatable-read read-only transaction. A single
60-second wall-clock deadline closes that diagnostic client; it is not a live
worker setting. Run a finite reference/current/current/reference comparison,
at most two actual plans, then an explicitly separate four-second current-query
probe. The longer diagnostic executions cannot count as production-budget proof.

Run from the repository root with an immutable local image and its inspected
revision label:

```text
node scripts/run-gateway-online-archive-rehearsal.mjs <sha256:image> <40-character-revision> --history-profile
```

The mode accepts no database, provider, mount or duration override. It returns
nonzero for failed equivalence, missing evidence, the four-second probe or cleanup.
The fixture-only environment marker is set by the runner, not a deployment flag.

Bound plan input bytes, nesting and node count. Emit allowlisted numeric
aggregates/operator names only, never raw plans, expressions, SQL parameters,
payloads, credentials or untrusted errors. Record identity-checked backend CPU
ticks, query elapsed time, actual rows/loops, width, sort spill and shared/temp
buffer counters. Missing observations stay unavailable. A timeout/cancellation,
unexpected query/result/role or cleanup failure is non-success; never auto-rerun
the experiment or refund an admitted attempt.

## CI repairs and security boundary

The prior run's five failures include a stale preflight expectation, seven
unclassified standalone/operator example settings, and fixed SQL interpolation
sites. Extend the preflight test so the new study gate's failure is exercised.
Classify the operator settings as deferred and keep rejecting them at the
application boundary. Do not forward their database, file or Docker authority.

Use explicit fixed SQL statements/closed vocabularies at the flagged sites;
preserve parameterized values and denial probes. Do not disable the code-health
scanner, add blanket suppressions or evade it by renaming clients. Re-review
changed verifier/loader fingerprints individually; never regenerate ownership
baselines or reinterpret unresolved classifications as authorization.

## Verification and final stack

Add real PostgreSQL reference/current equality across statuses, timestamp ties,
NULLs, protection changes and varied payloads. Compare raw budget and fingerprint
fields before JavaScript strips them. Retain existing exact-size/count, payload
tamper, microsecond, cancellation and deletion tests. Test plan-parser caps,
malformed/missing metrics, output sanitization and cleanup rejection.

Run the five failed CI contracts, affected unit/integration suites, ownership and
preflight gates, lint/types/ESM and full backend tests. Build a clean-source image
without cache. Re-run bounded profiling, unchanged eight-minute load, complete
30-minute varied-history load and separate real-restore rotation. Do not overlap
heavy tests/builds/profiling with measured traffic. Archive checks and counters
must remain strict; another failure stays a blocker, not a relaxed acceptance.

Stack: diagnose actual work → smallest equivalent SQL → boundary/tamper proof →
exact-image regression and extended load → separate rotation → private backup
and protected local Compose refresh only after passing gates. Record actual
outcomes/limitations separately. Further deduplication within a live snapshot is
deferred until this baseline succeeds; global caching and production changes are
outside the agreed scope.
