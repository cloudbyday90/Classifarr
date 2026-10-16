# Automatic gateway retention assessment outcome

2026-10-15. Main branch, no release. Local/synthetic scope only.

## Delivered

Replaced the proposed manual purge workflow with automatic startup and periodic
assessment in the optional standalone gateway. It needs no page visit, button,
approval file or new administrator command. Small ESM modules separate policy,
single-statement database observation and timer/status lifecycle. A separate
bounded read-only connection keeps diagnostic failures apart from admission.

The result explains row-capacity pressure, old terminal candidates, protected
history, inconsistencies and freshness. It carries a native time-based UUIDv7
reference and observation/cutoff times. Status returns cached aggregates; logs
record decision transitions. Unknown work, attempts, cooldowns and existing
immutable history are unchanged. No new table, migration or dependency.

The [design](ollama-retention-assessment-design.md) contains official October 2026
research, pros/cons and the recommended stack. The recovery-change skill drove
the explicit bounds, no-mutation checks, separate diagnostic connection and
isolated image validation. The gateway runbook documents defaults and the one
additional column-only read grant needed by restricted gateway installations.

This is automatic assessment, not automatic deletion or disk reclamation. It
does not collect a durable trend history, predict exhaustion time, create archives
or verify restores. Normal Classifarr startup does not enable the optional gateway;
Unraid and shared Ollama remain unchanged. No UI or application API changed; the
standalone credential-authenticated status response has an additive field.

## Verification before image build

- Focused unit suite: 15 suites, 365 tests passed.
- Real PostgreSQL/HTTP gateway integration: 10 suites, 229 tests passed.
- New policy/monitor coverage: 37 tests, 100% statements, branches, functions and
  lines for those two modules only. This is not repository-wide coverage.
- Tests cover fresh/legacy/counter-inconsistent history; exact terminal versus
  protected outcomes; owner/provider fencing; read-only grants and missing
  permission; no page-triggered assessment; no overlap/catch-up; failed/stale
  observations; shutdown; restart; transition deduplication and immutable cache.
- A real 100,000-binding fixture completed assessment with a four-second SQL
  timeout and preserved the entire admission row. This is not a production load
  benchmark or disk-capacity forecast.

An initial ownership-gate run flagged the changed ledger and newly discovered
indirect CLI query. Reviewed the complete affected query chain: only dedicated
gateway tables are read, and the existing writer fences remain unchanged. Updated
only those two source records and their existing review rationale; no gate limit,
classification or analysis digest was relaxed. Historical ownership debt remains.
One unit rerun omitted the host OpenSSL path and failed TLS fixture setup. The
corrected run used the existing explicit executable and passed; no TLS test was
disabled or weakened.

Full repository backend/frontend tests and the global coverage ratchet were not
rerun. No client source or API layer changed. Image checks and final quality-gate
results will be recorded below after completion.

## Local image validation

Pending the clean-source no-cache build and isolated packaged rehearsals. No
image validation or local replacement is claimed yet.

Before replacement, created
`data/backups/gateway-retention-assessment-before-20261015.dump`, SHA-256
`8499845B975154EFBC21A5906B8160D2AC18D7A34AC48A98202C421A35626B81`.
Native `pg_restore --list` succeeded with 1,933 lines; this application backup was
not restored. The local baseline was healthy, zero restarts/OOM, with gateway
schema absent and evaluation budget unchanged (`when_idle`, zero daily calls,
tokens and reservations, revision 2).

## Next item

Automatic archive creation and isolated verification with persistent machine
receipts, followed by bounded idempotent cleanup that consumes those receipts.
Preserve uncertain/lifecycle work, exact archive references and lifetime attempts;
do not add another administrator workflow. Physical database-space monitoring is
distinct from resident history capacity and must not be inferred from row counts.

GitHub MCP returned no open pull requests in two fresh queries on 2026-10-15.
No closed PR was substituted, no PR was merged and no release was created.
