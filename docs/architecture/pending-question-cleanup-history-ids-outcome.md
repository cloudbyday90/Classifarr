# Exact History IDs and freshness in pending-question cleanup outcome

November 23, 2026. See the [design and source review](pending-question-cleanup-history-ids-design.md).

Dry-run plans and apply results preserve exact positive History IDs through
the BIGINT maximum. Safe IDs remain numbers and large IDs are decimal strings.
Apply validates the entire batch and locks rows in exact ascending ID order.
The database schema, transaction boundary, administrator checks and retry
scheduler retain their existing contracts.

Replay validates the receipt against the locked row. A large row needs an
explicit matching binding. Replay uses the existing context timestamp check
and refuses missing or disabled referenced policies. Invalid, stale or
unavailable state queues the existing fresh-runtime evaluation. Inventory
still presents a recorded answer as a candidate for this server-controlled
decision. The existing timestamp comparison needs a stored version, so it
cannot establish when an older unstamped question was generated.

## Verification

- The original PostgreSQL 18 fixture rounded IDs in inventory and resolved
  a matching safe-ID receipt after its context changed. The repaired fixture
  passed with adjacent exact IDs, the BIGINT maximum, mixed duplicate and
  overflow refusals, and overlapping reversed batches. The queued replay
  reused its receipt and kept the saved retry schedule.
- Exact bound replay completed only its selected row. The neighboring row
  stayed unchanged, and a completed-row rerun did not repeat the outcome.
  Changed context, disabled and missing policies, copied bindings, and an
  unbound large receipt followed the existing retry path.
- All 13 targeted PostgreSQL tests, 37 focused server tests, and 27 focused
  client tests passed. The client adapter preserves large inventory IDs.
- Server coverage passed 64,578 tests across 1,958 suites, with one existing
  skip. Lint, type checking, preflight, ESM and policy gates, the client build,
  and all three workspace dependency audits passed.
- The first concurrent client run hit the existing ESLint setup deadline.
  An isolated rerun passed all 7,721 tests across 491 files with the same
  assertions and deadlines. The coverage ratchet passed with 89.33% server
  and 89.58% client line coverage.

GitHub listed no open PRs at intake or before delivery.

## Next UUIDv7 readiness item

Audit the legacy Discord `ai_clarify_` controls. Their index-only renderer,
parser, and handler still use the safe-number limit. Evaluate the existing
fingerprinted answer path and compatibility with delivered messages before
widening or retiring the legacy controls.
