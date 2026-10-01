# Bounded image-index maintenance design

Date: September 30, 2026. Status: implementation; deployment defaults unchanged.

## Problem and decision

The queue's three image-index statements used `IF NOT EXISTS`, which checks names,
not index health or equivalent definitions. An interrupted concurrent build can
therefore leave an invalid index while a later task reports success.

Use one modular, bounded executor for the existing queue adapter and a fixed,
one-shot maintenance command. The command uses its invoking database identity;
the embedded supervisor can launch it as the existing maintenance identity.
It does not introduce an administrative password into a restricted worker.
Production identity separation is still staged, not enabled by this change.

## Contract

- Only the three existing image indexes on `public.classification_embeddings`
  are permitted. Task payloads cannot supply SQL, names or resource settings.
- Check all definitions before DDL. Preserve valid indexes. Create missing ones.
  Drop/recreate only an invalid index whose definition matches the fixed contract.
  Refuse unexpected same-name objects, key order, predicates or options.
- Recheck validity after DDL. Complete only a live, matching queue claim.
- Use one disposable database session, shared runtime admission for online work,
  exclusive runtime admission for offline work, and a separate exclusive index
  lock. Restore quarantine blocks both paths. No long transaction surrounds DDL.
- Limit maintenance memory to 64 MiB, disable parallel maintenance workers,
  bound lock waits to two seconds and index work to a two-minute budget, also
  limited by the claim's remaining visibility. Control queries have short bounds.
- The one-shot command handles at most one existing due job. No job means no DDL;
  no periodic privileged service or fresh-install background loop is added.
- Contention defers with a delay without charging an attempt. Actual failures
  use the queue's finite attempt budget. Lost connections are not replaced mid-job.

Concurrent DDL is not transactional with queue state. Revocation can race the
start or completion of a statement after its claim check. Rechecking before each
subsequent statement and acknowledgement stops work once loss is observed and
prevents stale completion; it does not promise atomic revocation or immediate
cancellation. The index lock prevents cooperating duplicate
executors. External administrative DDL must follow the same maintenance window.

## Recommendations and tradeoffs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Keep name-only creation | Minimal code | Invalid builds can look successful | Reject |
| Rebuild all indexes each time | Simple repair logic | Unnecessary CPU/I/O; deletes healthy indexes | Reject |
| Fixed catalog-aware executor | Idempotent, bounded, repairable | More catalog and concurrency tests | Adopt |
| Separate one-shot identity | No permanent privileged broker | Offline admission; staged activation needed | Adopt as component |
| General SQL maintenance API | Flexible | Broad privileged attack surface | Reject |

Recommendation stack: fixed contract → catalog checks → admission and claim
checks → bounded session → verified acknowledgement → separate-identity activation.

## Official research

Sources were discovered and opened through web/MCP tools on September 30, 2026.

- PostgreSQL explains that name existence does not ensure index equivalence,
  concurrent failures can leave invalid indexes, and concurrent creation cannot
  run in a transaction: [CREATE INDEX](https://www.postgresql.org/docs/18/sql-createindex.html).
- Use session-local timeouts, not global changes:
  [client connection defaults](https://www.postgresql.org/docs/18/runtime-config-client.html).
- Session advisory locks survive rollback and are released on connection loss:
  [explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html).
- HNSW build memory and parallel workers affect resource use:
  [official pgvector documentation](https://github.com/pgvector/pgvector/blob/master/README.md?plain=1).
  The chosen limits are a conservative application policy, not a PostgreSQL or
  pgvector recommendation. They do not cap total database RSS or disk usage;
  large builds can time out and require an operator maintenance plan.
- W3C recommends programmatically available status messages:
  [Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages).
  This change emits bounded machine-readable command statuses and existing queue
  logs; it changes no UI and makes no new WCAG conformance claim.

## Scope and follow-up

No release, version bump, Compose requirement, live database rewrite, or new
external service. Validate on disposable PostgreSQL and embedded fixtures first.
The next component is queue vacuum maintenance. Two direct `VACUUM ANALYZE
task_queue` calls remain in `queueMaintenanceService.mjs`. Assess autovacuum
coverage and observed queue churn first, then isolate any necessary supplemental
work behind bounded maintenance admission. Do not silently skip it under a
restricted role or grant that role broad maintenance authority.

PostgreSQL recommends autovacuum for routine work and warns that manual vacuum
adds I/O load: [routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html).
It also documents that unauthorized tables can be skipped rather than causing
a query failure: [VACUUM](https://www.postgresql.org/docs/current/sql-vacuum.htm).
Verify actual maintenance evidence, not just a resolved SQL promise.

After remaining privileged paths are covered, proceed to activation orchestration
before restricted application startup, with upgrade/rollback and unchanged-template
acceptance evidence. Do not activate partial privilege separation.
