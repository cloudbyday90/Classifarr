# Dedicated restore operating mode

Date: 2026-09-27. Builds on restore-session ownership.

## Decision and boundaries

Select `CLASSIFARR_RUNTIME_MODE=restore` at restart. This branch never imports the
normal bootstrap, startup repairs, post-upgrade tasks, ordinary routes, workers,
schedulers, Discord or backfills. It serves existing-account authentication,
backup list/preview/import, mode status, liveness and the static UI. Normal mode
keeps export/preview but refuses HTTP import with actionable restart guidance.

Normal startup holds a shared PostgreSQL admission lock before importing its
bootstrap and until process exit. Loss of its connection is fatal, not a signal to
reconnect and continue writing. Restore acquires the exclusive admission lock on
the same pinned session as its restore writes; a separate lock connection would
allow restoration to outlive ownership. Cooperative normal instances prevent a
restore; an active restore prevents normal startup. Maintenance can serve login
while another normal instance lives, but cannot restore until that instance stops.

Normal startup refuses an existing non-ready restore gate before loading repairs.
A fresh database with no gate can still use the existing setup/migration path.
Maintenance requires an initialized compatible schema and an existing administrator;
it does not run migrations or create accounts. After verified restoration it remains
in maintenance until an explicit normal restart. It does not automatically resume
routing or reinterpret an unverified checkpoint as success.

Authentication/session bookkeeping remains intentionally available: user accounts
are not replaced by configuration restores. Administrator authentication, CSRF and
login rate limits remain enforced. Unavailable capability data disables restore.
No password/token is added to a URL. Other API endpoints fail closed by default.

Older binaries, direct SQL scripts and external writers do not participate in this
cooperative protocol and must be stopped manually. Already accepted provider jobs
cannot be recalled. This is a restart-based boundary, not online pause/resume.
Advisory admission is not a distributed fencing token: connection loss detection
and in-flight commands on other connections are not atomic with lock release.
Operators must stop every normal instance and external writer before restoration,
even though the lock also detects cooperating instances left running.

The maintenance import graph uses the database-only learning-pattern adapter,
not the classification evidence coordinator and its transitive AI providers.
Authentication security settings are loaded without normal startup repairs.
Normal admission reserves one checked-out connection; `POSTGRES_POOL_MAX` must
be at least 2 (the default remains 15). This protocol requires session-affine
PostgreSQL connections, not transaction-mode connection pooling.

## Operator procedure

1. Use an initialized database with an existing administrator and the same
   compatible application/database version. Make and retain a backup before
   entering maintenance. This is configuration recovery, not a full database or
   PostgreSQL-major-version recovery mechanism.
2. Stop all normal Classifarr instances and external writers. Keep persistent
   volumes, database contents and backup files. Do not use `down --volumes`.
3. Set `CLASSIFARR_RUNTIME_MODE=restore` in the deployment environment and recreate
   the application container/process. With the repository Compose configuration,
   set it in `.env` and run `docker compose up -d --no-deps classifarr` after stopping
   the service. A plain container restart does not apply changed environment values.
   Do not change the image or database version as part of this restore step: the
   container entrypoint still manages its embedded PostgreSQL startup.
4. Open the existing application address at `/restore`, sign in as an existing
   administrator, select a backup, preview it, and explicitly confirm restore.
   If another participating normal instance remains active, import returns 503
   before changing the restore gate or configuration.
5. Wait for verified success. The application remains in restore mode; there is
   no automatic routing restart. A disconnected browser is not evidence of success.
   If verification is incomplete, keep maintenance active, inspect the error and
   restore verification evidence, and retry only after addressing the cause.
   Session-owned interrupted attempts can be explicitly retried; unknown legacy
   owners require investigation. Never manually mark an unverified gate ready.
6. After verification, set `CLASSIFARR_RUNTIME_MODE=normal` and recreate the
   application. Startup checks the existing restore gate before loading normal
   services. Monitor health, queues and provider connectivity before expecting
   normal automation. If startup refuses an incomplete gate, return to restore
   mode rather than bypassing the guard.

Normal mode keeps backup creation, download, preview and deletion. Restore mode
intentionally permits only existing-account login/refresh/logout/me, backup
list/preview/import/runtime status, setup-status compatibility, health and the
static UI. Auth/session bookkeeping and explicit restore/audit writes remain
possible; this is not a globally read-only server. Configuration restore does not
replace users. Login rate limits and CSRF protections use the existing middleware.

## Research and alternatives

Official sources discovered with search tools on 2026-09-27:

- [PostgreSQL advisory locking](https://www.postgresql.org/docs/18/explicit-locking.html):
  shared/exclusive admission coordinates participating sessions and ends with the
  owning session. The application must enforce participation.
- [Node.js HTTP lifecycle](https://nodejs.org/download/release/latest-v24.x/docs/api/http.html):
  closing HTTP is not equivalent to stopping all asynchronous application work.
  A separate bootstrap avoids mistaking response/server completion for writer drain.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  expose loading/mode/results as status text without moving focus. Disabled restore
  controls have a visible explanation, not just a different color.
- [W3C labels and instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions):
  name the backup file, password and restore-mode controls and associate their
  visible labels with the corresponding inputs.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Scheduler pause | Small change | Misses requests, startup and detached writers | Reject |
| Online writer drain | Avoids full restart | Requires complete tracking of every writer | Defer |
| Dedicated startup plus admission | Clear boundary; cross-process exclusion | Downtime; one normal pool connection; older writers need manual shutdown | Implement |

Recommendation stack: dedicated mode and admission, pinned restore transactions
and verification, then controlled normal restart. Next, rehearse this workflow from
a supported release image in disposable containers, including interruption and
readiness before resuming automation. No release, live restore or deployment occurs
in this change.
