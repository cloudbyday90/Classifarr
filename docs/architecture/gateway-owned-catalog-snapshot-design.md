# Owned catalog snapshots — design

## Approved scope

Approved 2026-10-20 after the [local study](gateway-snapshot-reuse-study-outcome.md):
give the runtime catalog phase a private, short-lived SELECT-only connection and
reuse only the three base catalog-table summaries inside its one transaction.
Callers receive immutable scheduling data and one capture operation, never a raw
client, query function, transaction handle or connection-close method.

No new admin controls, database tables, migration, public API, provider call,
release or version change. Stay on main. Unraid, Plex and shared Ollama remain
unchanged. The optional gateway must already be explicitly configured; fresh
application installs do not start gateway work.

## Research and decision

Official sources were discovered through connected search/GitHub services on
2026-10-19 and rechecked on 2026-10-20:

- [PostgreSQL 18 transactions](https://www.postgresql.org/docs/18/sql-set-transaction.html)
  bind repeatable-read visibility to the current transaction.
- [node-postgres transactions](https://node-postgres.com/features/transactions)
  require one client for a transaction. Its [client API](https://node-postgres.com/apis/client)
  exposes transaction status and low-level query forms. Inference: a final active
  status cannot prove that an earlier transaction was not committed and replaced.
- [Node filesystem guidance](https://nodejs.org/download/release/v24.21.0/docs/api/fs.html)
  describes check/use races. Inference: a frozen SQL view does not freeze files.

| Choice | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Private owner and domain operations | Raw transaction control cannot escape through the runtime API; legacy query forms stay unchanged | At most one additional temporary read-only session and connection setup cost | Recommended |
| Intercept the existing raw client | Avoids another connection | Captured methods, custom query objects and wire access can bypass interception; compatibility risk | Reject |
| Check only transaction status | Cheap extra detection | Does not identify transaction continuity | Not an ownership boundary |

This is an internal authority boundary, not a sandbox against arbitrary code
execution in the Node process. The extra connection exists only during the
serial catalog phase; it closes before publication. No pool, session cache or
process-wide content cache is introduced.

## Runtime contract

The owner constructs its own client from a private copy of validated source
configuration. Preserve the existing 5-second connection/query, 4-second SQL,
2-second lock and 75-second idle-transaction limits. Bound the operation to
120 seconds and the caller's cancellation. Check SELECT-only role privileges and
configured identity before admission; keep the existing repeatable-read/read-only
snapshot helper and canonical UTC serialization.

Capture the base three tables once using the production cursor. Retain only
deeply immutable count/max-ID/hash summaries and their exact byte total, not row
bodies. In frozen capture, replay the base charge only if it fits the remaining
256 MiB budget. Otherwise run the original complete stream so overflow occurs at
the original row with the original failed-budget mutation. Read and hash the
fourth table freshly. Keep schema, per-row and row-count limits unchanged.

Legacy context-based captures remain uncached. Never fall back to another
snapshot after lost ownership. Retention inventory, permissions, relationships,
independent admission record, source/policy identity, managed-file checks, free
space, pins, dump validation and isolated restore verification remain fresh.

Expose only frozen report/revision/semantic data and one capture call. Refuse
overlap, repeat capture, invalid options and escaped operations after completion.
Invalidate on cancellation or client end/error. Drain in-flight capture before
closing the scope; unfinished capture or a settled capture failure cannot produce
success. Callers must await capture to use its result.
Discard summaries in finally on commit, rollback, error, cancellation or restart.

No new retries or side effects are admitted. Preserve existing shared ordinals,
cooldowns and single maintenance exclusion. A capture error is recorded against
its admitted job. Ambiguous publication/commit stays blocked/exporting rather
than guessing that another attempt is safe. Connection failures before admission
consume no job attempt; unavailable/unknown ownership fails closed.

## Verification

Add unit contracts for API confinement, lifecycle/disposal, cancellation, byte
replay and exact overflow fallback. Use real isolated PostgreSQL for concurrent
changes, terminated backends, frozen visibility, pressure-sized consistent
synthetic history and fresh-session cleanup. Extend existing sealed image
rehearsals for real dumps/restores, admission changes and corruption/refusal
paths. Preserve existing legacy tests and source-parity study contracts.

Run scoped tests first, then types, lint, ownership, ESM, dependency and docs gates.
Build the exact committed source with no Docker cache, evaluate disposable image
rehearsals sequentially, back up local appdata and refresh only local Compose.
Record actual results and limits separately; do not claim production performance
or published-image provenance from local timings or OCI labels.

## Random open PR

Planning enumerated open PRs `[567,566,565]`; random selection chose
[PR #567](https://github.com/cloudbyday90/Classifarr/pull/567). Rechecked OPEN on
2026-10-20 at head `b5c79b66bcd6eb018464ca0072d1770df1b04c17`, base
`7854126dc1eba599df25dd233e0307b1594ba3b0`. Implement client ESLint 10.13.0
locally without merging, using an exact direct pin instead of its caret range.

[Official ESLint release notes](https://github.com/eslint/eslint/releases) describe
additional rule checks and an autofix correction. Benefit: current lint fixes;
risk: new diagnostics. Keep rules, peer requirements, overrides and strict script
policy unchanged. Review a scripts-disabled lock generation, then clean install,
lint/types, frontend tests/build, full dependency tree and full audit.

## Recommendation stack

Private transaction owner → immutable base summaries → exact budget accounting →
fresh fourth-table capture → unchanged filesystem and restore fences. Defer
retention reuse and any further check reduction until this bounded runtime change
has end-to-end evidence. Document the outcome before committing/pushing all work;
no release is part of this batch.

See the [implementation outcome](gateway-owned-catalog-snapshot-outcome.md) for
artifact identity, verification, local Compose evaluation and remaining risks.
