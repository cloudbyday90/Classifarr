# Automatic inventory representative cache: design

Date: 2026-09-13. Scope: background preparation, not live routing.

## Why this component

The preceding stability study compared 900 distinct descriptions across movie
and TV libraries. It did not create a reusable runtime profile. Repeating those
fits for incoming requests would waste CPU and delay classification. Maintain a
source-versioned, process-private profile automatically instead.

This is unsupervised grouping of existing description vectors, not model
fine-tuning or proof that existing placements are correct. Library names and
operator purpose declarations are not training features.

## Decisions and alternatives

| Option | Benefit | Cost | Decision |
| --- | --- | --- | --- |
| Fit during classification | Immediately available input | Repeated CPU cost and request latency | Reject |
| Persist profiles in SQL | Survives process restarts | Migration, lifecycle and stale-model complexity | Defer |
| Bounded in-memory background cache | No new model generation; isolated fitting; automatic recovery | Rebuild after restart; one cache per process | Implement |
| Use stale profiles while refreshing | Higher availability | Can retain removed or conflicting source evidence | Reject for evidence |

## Implementation contract

- Reuse current-inventory projection, conflict exclusions, vector cache, local
  provider admission and sync revision hints. No benchmark sampler is called.
- A short, bounded repeatable-read transaction reads active movie/TV library
  scope, projected membership and current representation-specific cached vectors.
  Fit outside the transaction. No database transaction spans CPU learning.
- Fingerprint the training protocol, representation, private provider config,
  active library IDs/types, item membership, description hashes and float32
  vectors. Library names, titles and raw descriptions are not worker inputs.
- Fit three deterministic starts in one ESM worker thread, selecting convergence
  before training objective. Reuse the evaluated algorithm, omitting its legacy
  comparison run. Shared descriptions do not become multiple library votes.
- Runtime limits: 64 libraries, 50,000 membership rows, 10,000 unique descriptions,
  eight million vector components, one active fit per process, bounded worker
  heap and two-minute run deadline. Oversized/incomplete inputs remain unavailable.
- Read a new snapshot and verify provider identity/config and sync revision before
  atomic cache publication. Source changes discard the candidate, not the checks.
- Check automatically at startup and each minute; reconcile unchanged input every
  five minutes, with revision hints bypassing the quiet interval. Failures back off
  from one minute to one hour. Missing vectors wait for existing automatic backfill.
- Keep one completed model, at most 32 MiB in accounting units and 30 minutes TTL.
  Sync hints and foreground activity immediately withdraw publication; an
  inaccessible completed fit can be reused only after identical fresh inputs are
  proven. Changed inputs, failure, disablement or shutdown clear the cache.
  Source validation is point-in-time, not a database-wide serializable guarantee.
- Full-inventory models have a distinct kind and cannot satisfy the benchmark's
  mandatory held-out-fold contract. No live routing consumer is added here.
- Return/log allowlisted aggregate counts only. Never log vectors, descriptions,
  titles, item IDs, library IDs, source hashes, provider endpoints or raw errors.

Each process owns its own ephemeral cache, so a database advisory lock would not
share its result with another process. Local single-flight prevents overlap;
distributed persistence/coordination remains a separate scaling decision.

## Official research and security rationale

Sources discovered and read using online tools on 2026-09-13:

- [Node.js worker threads](https://nodejs.org/api/worker_threads.html): workers
  suit CPU-intensive JavaScript. Use a fixed module URL, bounded input, explicit
  termination and resource limits. Worker limits do not replace input bounds and
  are not a security sandbox. Only long-established APIs supported by Node 24 are
  used; the current documentation also contains newer APIs that are not adopted.
- [PostgreSQL 17 SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html):
  repeatable-read keeps each read coherent; a later transaction is required to
  observe changes committed during fitting.
- [OWASP RAG security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html):
  scope cached evidence, invalidate changed/deleted sources, bound retention and
  fail closed. This cache is server-private, not a cross-user response cache.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  future visible progress should be understandable and accessible without taking
  focus. No new UI panel is needed for this backend component; stale-while-
  revalidate may serve a clearly dated status summary, not stale routing evidence.

## Recommendation stack

1. Ship automatic, bounded, source-verified profile preparation.
2. Compare cached profiles with existing decisions for genuinely unseen items in
   shadow mode, including sparse-library and start-disagreement fallback.
3. Only consider routing promotion after independent evidence of fewer mistakes;
   do not reinterpret placement agreement as calibrated confidence.

See the separate outcome document for actual verification and remaining limits.
