# Restricted-runtime authenticated routing

Reviewed 2026-10-04. Extend the existing embedded isolation drill, not production
permissions or saved templates. This is a prerequisite for considering a later
identity cutover; ordinary DML remains broader than an ingestion gateway.

## Contract

After the existing empty-state movie/TV classification fixture, use the normal
setup and login endpoints to create disposable administrator and ordinary-user
sessions. Prove anonymous, non-admin and missing-CSRF classification requests
cannot create history or contact providers. Then submit one movie and one series
through the real classification endpoint, deterministic preset policies and real
Radarr/Sonarr HTTP adapters. Require exactly one add per provider, verified reads,
the intended destination and persisted routed outcomes. Compare exact history
receipts after dump/restore and restart without replaying commands.

Only the guarded disposable probe may temporarily point the existing TMDb service
base URL at a fixed loopback provider; restore it in `finally`. No method mocks,
environment override, production endpoint option or auth bypass are introduced.
This proves application behavior against a synthetic transport, not TMDb service
availability, TLS, browser interaction or actual Radarr/Sonarr compatibility.

The existing read-only image, network-none namespace, disposable volumes,
2 GiB/two CPU/128 PID limits and peer-authenticated non-owner SQL role remain.
The HTTP fixture binds loopback only, bounds request/response bytes and time,
counts unexpected requests and closes all sockets. Sessions stay in memory and
are never included in receipts. Provider configuration is disabled after use;
optional AI and embeddings are not enabled. No work runs on normal fresh installs.

No write retries: timeout, cancellation, malformed response, duplicate add or
unknown destination fails the disposable run. The fixture does not reconcile an
uncertain live add or infer ingestion ownership. Shutdown joins the runtime before
database maintenance. Existing role, file, DDL and maintenance denials still pass.

## Options and recommendation stack

| Option | Advantage | Limitation |
| --- | --- | --- |
| Service-only fixture | Fast and deterministic | Misses authentication and real transport |
| Extend isolated HTTP rehearsal (chosen) | Exercises real middleware, policies and SQL | Synthetic provider and TMDb URL seam |
| Live-provider test | Real provider integration | Needs separate explicit targets and credentials |

Recommendation: authenticated fixture now; next test interrupted/uncertain routing
under this identity, then finish privileged-adapter coverage before proposing a
production identity migration. Keep legacy ingestion recovery separately fenced.

## Research

Official sources discovered through web search and opened on 2026-10-04:

- [OWASP REST security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html):
  enforce endpoint authorization and keep session credentials out of URLs/logs.
  Loopback HTTP here is isolated test transport, not a production TLS recommendation.
- [PostgreSQL schema security](https://www.postgresql.org/docs/18/ddl-schemas.html):
  schema CREATE permission is a trust boundary; keep it revoked from the web role.
- [PostgreSQL GRANT](https://www.postgresql.org/docs/18/sql-grant.html):
  ordinary table permissions do not confer object ownership or schema alteration.

No browser contract changes or new accessibility-conformance claim. Outcomes and
remaining limitations are recorded separately after validation.

## Restore defect found during implementation

The real PostgreSQL regression reproduced deletion of a library referenced by a
`routed` classification during replace restore (the existing `completed` case
passed). Preserve both terminal-success states and their media-server parents.
Still clear the old *arr configuration links; retaining historical identity must
not reactivate a destination omitted from the backup. No schema change or history
status rewrite is needed. Other restore deletion semantics remain unchanged.
