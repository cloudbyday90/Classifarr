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

Backend typecheck, lint (tests and security), both knip modes, static-import and
ESM-mock checks, inventory ownership review, copyright and npm-CLI checks passed.
The host application-pilot runner passed its three tests. Markdown validation
checked 2,252 files with zero errors after the added planning skills; whitespace
and staged secret scans passed.

Full repository backend/frontend tests and the global coverage ratchet were not
rerun. No client source or API layer changed. The no-cache image build also built
the frontend successfully.

## Local image validation

Built local Compose with `--no-cache --require-provenance` from clean source
`9a7b0fd76f2339187069d6385d2c347830768152`. Immutable image:
`sha256:ac44c3f7143e1c67363ab4a4f31f4e97af81df046302ce200554ac22217fa95c`.
The image revision label matched the source; subsequent documentation-only commits
do not change the tested runtime source.

Both existing packaged runners passed against that exact image:

- Network-disabled gateway rehearsal: real entrypoint, restricted PostgreSQL
  role, automatic assessment before status access, UUIDv7 check reference,
  separate diagnostic connection and no assessment provider calls. Existing TLS,
  credentials, application correlation, completion, offline recovery, provider
  stop, archive and restore-review scenarios remained passing. The main scenario
  reported 19 synthetic calls; separate scenario counts remain distinct.
- Internal-network full-application rehearsal: TLS, blocked direct-provider
  access, exact declared request identity, real application seed/active/unavailable
  and replacement scenarios. Exactly two synthetic provider attempts across the
  network/full-application exercise. Both runners verified removal of their exact
  owned containers, networks and temporary data. No production provider was used.

These are local synthetic tests and same-image replacements, not a published
release upgrade, live Ollama benchmark or proof of deployment on Unraid.

Before replacement, created
`data/backups/gateway-retention-assessment-before-20261015.dump`, SHA-256
`8499845B975154EFBC21A5906B8160D2AC18D7A34AC48A98202C421A35626B81`.
Native `pg_restore --list` succeeded with 1,933 lines; this application backup was
not restored. The local baseline was healthy, zero restarts/OOM, with gateway
schema absent and evaluation budget unchanged (`when_idle`, zero daily calls,
tokens and reservations, revision 2).

Replaced only the normal local `classifarr` Compose service using the tested image,
without rebuilding or pulling. The prior immutable image
`sha256:03118531fcbe967e73d9baee8ffb7e76c3bfc69d8bac0cc5a5881d2578e4f0f5`
remains protected by the local rollback tag
`classifarr-local-rollback:2fb49b422a46a50244e8a90a909e5a7c80975a0eb7575cc47869fc72350e7343`.

After replacement, the container was healthy, with zero restarts and no OOM;
non-root UID/GID 1000, read-only root filesystem, no-new-privileges, a 2 GiB limit
and no Docker socket mount remained in place. `/health` and `/` returned 200;
unauthenticated gateway-history access returned 401. Read-only SQL confirmed the
evaluation budget and next-check timestamp were unchanged and the gateway schema
remained absent. The optional gateway was not enabled in the normal application.
Startup observation was 688.9 MiB and 129.31% CPU; a later sample was 350.4 MiB
and 1.34% CPU, still healthy with zero restarts/OOM. These are point-in-time
samples, not a sustained resource benchmark. Final Markdown validation checked
2,250 files with zero errors; copyright and npm-CLI checks passed again.

## Next item

Automatic archive creation and isolated verification with persistent machine
receipts, followed by bounded idempotent cleanup that consumes those receipts.
Preserve uncertain/lifecycle work, exact archive references and lifetime attempts;
do not add another administrator workflow. Physical database-space monitoring is
distinct from resident history capacity and must not be inferred from row counts.

GitHub MCP returned no open pull requests in two fresh queries on 2026-10-15.
No closed PR was substituted, no PR was merged and no release was created.
