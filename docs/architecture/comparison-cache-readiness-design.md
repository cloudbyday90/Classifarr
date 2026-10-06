# Comparison cache readiness preflight

Date: 2026-10-06. Follow-up to the [retention study](comparison-refresh-retention-design.md).

## Evidence and decision

Read-only Unraid coverage showed TV Shows advancing from 67 to 243 of 964
eligible descriptions while Movies was complete. The reported warning was
incomplete optional vector coverage, not memory pressure or ingestion ownership.
The separate five-cycle retention study found collectible snapshots, terminated
workers and a stable post-collection model footprint; it did not establish an
accumulating leak. Do not change memory safeguards or introduce runtime GC.

The current comparison path nevertheless retrieves and decodes all available
vectors before discovering that some required vectors are missing. Check scoped
hash presence first, inside the existing repeatable-read transaction. If any
are missing, stop before vector transport and return bounded aggregate counts.
This is a readiness/allocation improvement, not a faster embedding backfill.

## Contract

- Only comparison requests require complete vectors. Representative profiles
  retain their existing partial-coverage behavior. Empty inventories do not
  request embeddings or create work.
- Presence uses the existing content hash, projection, model, digest, dimensions
  and 30-day freshness predicates. Read presence and vectors in the same
  read-only snapshot, under existing query, transaction and source-size limits.
- Keep post-decode completeness/shape checks and a separate post-build snapshot
  verification. Presence does not certify vector validity or later freshness.
- Incomplete coverage retains the current unavailable outcome, bounded backoff,
  jitter, deadlines, shared admission and fallback. Counts distinguish waiting
  for data from an unexplained failure; do not suppress persistent warnings.
- Only integer counts within the 10,000-description budget may reach logs.
  Require cached < eligible and missing = eligible - cached. Discard arbitrary
  fields, strings, throwing getters and inconsistent counts at the log boundary.
- No new writes, migrations, provider calls, scheduler jobs, concurrency or
  durable state. Existing restart/cancellation/configuration invalidation and
  ownership behavior remain unchanged. Import plus metadata completion remains
  independent of optional vectors.
- Completion still means every required vector validates, the model builds,
  fresh source/provider/configuration checks pass and bounded publication succeeds.

## Options and recommendation

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Hash-only preflight and bounded diagnostics | Avoids guaranteed-useless vector decoding during catch-up; actionable counts | One small extra query per complete snapshot; selected |
| Increase batch size or bypass admission | Could accelerate backfill | More provider/memory pressure without evidence of a stuck worker; reject |
| Partial comparison publication | Earlier context | Weakens completeness; reject |
| Rewrite vector transport/model storage | Potentially lower complete-cycle peaks | Larger numerical/lifecycle change; measure separately next |

Recommended stack: existing bounded backfill → scoped completeness preflight →
validated complete snapshot → worker-built model → fresh verification → bounded
cache. Keep all memory safeguards unchanged.

## Verification and sources

Prove incomplete reads never request vector payloads; complete and default
partial reads still work; stale/model-mismatched hashes remain absent; malformed
vectors still fail; concurrent cache writes cannot change the transaction's
snapshot; post-build loss refuses publication. Exercise sanitized diagnostic
counts and existing retry behavior. Use isolated PostgreSQL, not Unraid writes.

Official sources discovered/opened through MCP on October 6, 2026:

- [PostgreSQL repeatable-read isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
  supports the same-transaction presence/vector check, not reuse across transactions.
- [Node worker documentation](https://nodejs.org/download/release/v24.20.0/docs/api/worker_threads.html)
  informs separate worker lifecycle/heap measurement; this patch does not alter workers.
- [OpenTelemetry log data model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
  informs bounded contextual diagnostics. Progress is not proof that every failure
  is harmless; retain the failure category and recovery guidance.

Outcome and limitations belong in a separate document after validation.
