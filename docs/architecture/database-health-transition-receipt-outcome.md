# Database health transition receipt outcome

## Decision

Classifarr now adds a passive, server-owned receipt layer over the existing
PostgreSQL health summary. An automatic observation runs after startup and once
daily. It needs no operator-provided library, policy, database, provider, or
configuration selector.

The first valid observation establishes a baseline. A changed bucket state must
appear in the next ordinary observation before an append-only receipt is
created. If PostgreSQL's `statisticsResetAt` changes, the server discards its
prior comparison state and establishes a new baseline without creating a
receipt. This prevents counters from unrelated cumulative-statistics periods
from becoming a trend.

The receipt is advisory provenance only. It cannot run vacuum, alter database
configuration, select semantic evidence, create labels, call an AI provider,
change policies, classify media, or route an item.

## Contract

`GET /api/stats/database-health-transition-receipt` is administrator-only,
parameter-free, rate-limited, and sent with `Cache-Control: no-store`. It
returns the latest confirmed receipt from the **current** PostgreSQL statistics
period, or an explicit no-transition state:

```json
{
  "version": "database.health_transition_receipt_summary.v1",
  "status": { "id": "persistent_transition_recorded" },
  "receipt": {
    "receiptId": "42",
    "version": "database.health_transition_receipt.v1",
    "statisticsResetAt": "2026-09-09T00:00:00.000Z",
    "before": {
      "io": {
        "readOperations": "low",
        "writeOperations": "none",
        "cacheHits": "moderate"
      },
      "tableStatistics": {
        "estimatedDeadTuples": "low",
        "tablesWithDeadTuples": "none"
      }
    },
    "after": {
      "io": {
        "readOperations": "moderate",
        "writeOperations": "none",
        "cacheHits": "high"
      },
      "tableStatistics": {
        "estimatedDeadTuples": "low",
        "tablesWithDeadTuples": "none"
      }
    },
    "confirmationObservationCount": 2,
    "recordedAt": "2026-09-11T03:21:00.000Z"
  }
}
```

The only allowed bucket vocabulary is `none`, `low`, `moderate`, and `high`.
No raw counter, SQL, database or table name, schema, account, library, media,
provider, configuration, policy, AI, semantic evidence, label, or routing data
is persisted or returned. A receipt from an earlier `statisticsResetAt` never
appears as current evidence.

## Design

The implementation uses small ESM modules with separate concerns:

1. `databaseHealthTransitionState.mjs` validates and compares the five fixed
   buckets.
2. `databaseHealthTransitionObservationService.mjs` owns the transaction-bound
   two-observation protocol and reset handling.
3. `databaseHealthTransitionReceiptRepository.mjs` locks the singleton state,
   writes a pending bucket state, and appends a receipt only on confirmation.
4. `databaseHealthTransitionReceipt.mjs` validates the database row and
   projects the public provenance contract.
5. `databaseHealthTransitionObservationScheduler.mjs` registers the daily and
   delayed-startup passive observer under a PostgreSQL advisory lock.
6. `statsRouteDatabaseHealthTransitionReceipt.mjs` provides the protected
   no-store read path.

The migration stores one mutable singleton confirmation state and an
append-only receipt history. Database constraints restrict every persisted
field to the fixed vocabulary, require exactly one pending observation, require
exactly two observations for a receipt, require a true before/after change, and
reject all update and delete attempts against receipts.

## Research and recommendations

| Candidate | Advantages | Costs and limits | Recommendation |
| --- | --- | --- | --- |
| Automatic two-observation receipt | Gives future automation a durable, provenance-rich signal without operator comparison or raw operational data. | A daily cadence intentionally delays recognition; it establishes a trend, not a diagnosis. | Implemented. |
| Store every raw PostgreSQL sample | Supports detailed diagnostics. | Creates a new operational data store and increases disclosure, retention, and interpretation risk. | Do not add. |
| Compare across statistics resets | Preserves more history. | PostgreSQL reset boundaries make cumulative counters non-comparable. | Do not add. |
| Auto-vacuum, tune, or route from a receipt | Could appear to reduce manual work. | A coarse persistent bucket change cannot establish root cause or authorize a control action. | Do not add. |

### Final recommendation stack

1. Use PostgreSQL's existing aggregate statistics as the only source; do not
   introduce database-specific configuration or per-library dimensions.
2. Establish a baseline after startup and observe once per day under an advisory
   lock, so normal runtime supplies the evidence without an operator workflow.
3. Require two matching changed bucket states and reset the baseline on every
   `statisticsResetAt` change.
4. Retain only append-only coarse before/after receipts and expose only the
   latest receipt for the current reset period through the protected no-store
   API.
5. Treat the receipt solely as future automation evidence. Keep maintenance,
   classification, semantic selection, and routing independent of it.

## Security and API boundary

The route is protected by the existing administrator authorization middleware
and rate limit before it can read a receipt. It rejects query parameters, so a
caller cannot choose a history window, source dimension, or identifier. The
background observer has no HTTP route and logs only a fixed failure message.
The repository uses a transaction and row lock; the scheduler's advisory lock
prevents overlapping observers across replicas. The receipt table is guarded
against update and delete at the database boundary.

This is aligned with W3C guidance to provide versioned provenance and quality
metadata at a suitable level of detail, while limiting sensitive operational
data and documenting the API contract. PostgreSQL describes `pg_stat_io` as
cluster-wide cumulative I/O statistics and exposes a reset time, so the reset
is a mandatory provenance boundary rather than a tunable heuristic.

## Verification

- Focused backend tests cover state validation, baseline creation, reset,
  pending transition, confirmation, receipt projection, read-only receipt
  summary, scheduler registration, protected route, no-store response, and
  query rejection.
- The client API test proves the receipt endpoint accepts no caller dimension.
- Migration checks verify that the schema snapshot includes the constrained
  singleton state, append-only receipt table, index, trigger, and migration
  record.

## Research basis

- [PostgreSQL cumulative statistics](https://www.postgresql.org/docs/current/monitoring-stats.html)
  documents `pg_stat_io` as cluster-wide statistics and defines its
  `stats_reset` period.
- [PostgreSQL predefined roles](https://www.postgresql.org/docs/current/predefined-roles.html)
  documents the broad visibility of `pg_read_all_stats`, supporting a narrow
  application projection rather than forwarding database statistics.
- [W3C Data on the Web Best Practices](https://www.w3.org/TR/dwbp/) recommends
  provenance, data-quality information, stable versioned APIs, documentation,
  and an appropriate level of detail.
- [W3C Privacy Principles](https://www.w3.org/TR/privacy-principles/) supports
  minimizing exposed capability and operational information.

## Next item

Let ordinary runtime observations accumulate for one full statistics period and
review only aggregate receipt frequency and validity. If that evidence shows a
useful sustained pattern, the next safe enhancement is a similarly bounded,
server-owned readiness projection that states whether a **current** receipt is
available; it must remain advisory and have no maintenance or routing path.
