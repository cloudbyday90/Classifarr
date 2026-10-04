# Ingestion fence: revalidate effective authority

Date: 2026-10-04. Scope: the existing disposable authenticated-role gateway.
This is a prerequisite for production activation, not an enabled recovery feature.

## Finding and decision

The candidate `begin_run` accepts the persisted cutover flag as continuing proof
that legacy access is retired and the writer cannot bypass the gateway. Grants,
role attributes and role membership can change after that flag is committed.
The same gap affects already admitted item writes and completion. A successful
past installation is not proof of the current database boundary.

Add a private, fixed SQL assertion called before beginning, writing or completing
a run. Resolve the registered roles from the protected receipt; require the
actual `session_user` to be the registered writer. `current_user` is the function
owner inside a definer routine and must not be mistaken for the authenticated
caller. No runtime-supplied role, relation, SQL, path or capability is accepted.

## Contract

- Keep the enabled receipt, exclusive library lock, session/start identity,
  run token, source revision and transaction checks. This assertion adds to them.
- Require READ COMMITTED so an old transaction snapshot cannot intentionally
  retain obsolete catalog evidence. No transaction isolation setting is changed.
- Writer and retired legacy roles must not have elevated attributes or role
  memberships, including non-inheriting memberships. The writer must allow login;
  the retired legacy role must not. No legacy session may remain in this database.
  Clear the transaction's cached activity snapshot before checking sessions;
  READ COMMITTED does not itself refresh this separate statistics snapshot.
- The private owner must be non-login and non-elevated. Its existing monitoring
  membership is trusted; this is not protection against a database administrator.
- Reject effective direct/PUBLIC table and column mutation privileges on the
  fixed protected relations, cascade parents, profile state and private ledgers.
  Reject schema/database creation authority, sequence mutation and unexpected
  application/private routine execution. Preserve ordinary reads and TEMP usage.
- Check each gateway call, not only startup. Failure has the fixed SQLSTATE 55000
  and a fixed reason, before legacy marker retirement or new item/state writes.
  Never silently revoke grants, terminate a session, retry, or reset a budget.
- Use fixed schema-qualified names and `search_path=pg_catalog,pg_temp`. Install
  and revoke PUBLIC execution in the existing single installation transaction.
- Existing five-second fixture statements, one-second cutover lock waits,
  fifteen-second cutover transactions and 1,000-item rehearsal bounds remain. Add no network work,
  service, timer, schema migration or production startup hook.
- A corrected configuration can be reviewed and tried again. A lost-owner token
  remains invalid. This does not claim atomic protection against a concurrent
  trusted administrator who can replace functions or change grants mid-call.

The assertion checks the candidate's allowlisted boundary, not every extension,
arbitrary function body, filesystem/HBA setting or historical writer. Production
activation still requires OS/authentication separation, protected maintenance,
complete writer coverage and upgrade/restore evidence. Existing installations
remain on reviewed legacy recovery; no ownership is invented.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Trust the saved flag | Minimal work | Stale grants can invalidate the claimed boundary | Replace |
| Automatically revoke unexpected privileges | May repair drift | Changes administrator intent; cannot prove all late writers stopped | Reject |
| Revalidate inside each fixed gateway operation | Rejects observed authority drift before further work | Catalog checks add work; administrator remains trusted | Implement |
| Activate the entire production cutover now | Could eventually enable automatic legacy recovery | Shared OS/trust identity and unported writers remain | Not yet safe |

Recommended stack: protected installation and role retirement → effective-grant
assertion → library/session/run fencing → atomic bounded writes → complete source
capture and metadata recovery. The next production component remains protected
identity activation and the remaining privileged-operation/writer adapters.

## Research and acceptance

Official URLs discovered through web search and opened on 2026-10-04:

- [PostgreSQL privilege inquiry functions](https://www.postgresql.org/docs/current/functions-info.html)
  distinguish session and effective identity and include table, column, routine,
  schema and role access checks. Column grants need their own checks.
- [PostgreSQL role membership](https://www.postgresql.org/docs/18/role-membership.html)
  distinguishes inherited access from the ability to assume another role.
- [PostgreSQL function security](https://www.postgresql.org/docs/current/sql-createfunction.html)
  requires trusted search paths and timely removal of default PUBLIC execution.
- [PostgreSQL predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)
  explains that some file/program roles can bypass database-level protections.
- [PostgreSQL row security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
  explains superuser/BYPASSRLS and table-owner exceptions; RLS is not a substitute
  for the missing production authority cutover.
- [PostgreSQL transaction snapshots](https://www.postgresql.org/docs/current/sql-set-transaction.html)
  explains statement snapshots under READ COMMITTED versus retained snapshots in
  REPEATABLE READ/SERIALIZABLE. The gateway requires READ COMMITTED explicitly.
- [PostgreSQL activity snapshots](https://www.postgresql.org/docs/18/monitoring-stats.html)
  explains transaction-cached session activity and `pg_stat_clear_snapshot()`.
  The late-session regression demonstrates why the separate refresh is necessary.

Reproduce stale-grant admission on the old candidate, then verify rejection with
real independently authenticated connections. Cover late drift, column and PUBLIC
grants, role attributes/membership, private state, restored legacy login/session,
unexpected routines, stale snapshots, safe reads, rollback and valid recovery
after review. Run existing fence/reconciliation/recovery tests, scoped quality
gates, and the requested local no-cache rebuild plus isolated schema round-trip.
Keep source/image evidence and unresolved production limits in a separate outcome.
