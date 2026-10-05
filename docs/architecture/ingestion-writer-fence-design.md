# Database-enforced ingestion boundary: design

Date: 2026-09-30. Status: isolated executable contract; not enabled in production.

October 5 update: the user selected a narrower
[compatibility fence](ingestion-compatibility-recovery-design.md) for unattended
legacy recovery without deployment changes. It rejects unmodified older writers;
it does not satisfy the stronger privileged-writer isolation described here.
This document and its unresolved writer review remain the security-hardening plan.

## Decision and evidence

The next component after the [unknown-owner investigation](legacy-ingestion-september30-incident.md)
is a storage boundary that can reject an old writer before recovering its unfinished
imports. Ownership means permission for one running import to update a library;
it does not mean ownership of the media files or a user's library.

I inspected the session-lock and claim repositories, database pool and container
entrypoint. A read-only query of the local database showed that the application
role has superuser, create-role and bypass-RLS privileges. The entrypoint creates
the cluster using that same bootstrap identity. We cannot safely solve this by
assigning historical rows a new owner or by adding a trigger that privileged
callers can bypass.

We implement a real-PostgreSQL, authenticated-role rehearsal first. It creates no
production migration, startup service, activation setting or background job.
The live `legacy_owner_unknown` protection and reviewed recovery remain unchanged.

## Alternatives and final recommendation stack

| Approach | Advantages | Costs and limits | Decision |
| --- | --- | --- | --- |
| Keep reviewed recovery | Existing tested behavior; no privilege migration | Operator must establish that old writers stopped | Retain during migration |
| Age-based adoption or ownership stamping | Little implementation work | Cannot reject an old writer; creates false certainty | Reject |
| Separate credentials plus fixed database operations | Database rejects ordinary callers that bypass application guards | Requires full writer, bootstrap, upgrade and restore migration | Recommended target |

Our stack is: separate runtime/maintenance credentials; a non-login function
owner; fixed typed database operations; exclusive session coordination and
run/source checks; atomic recovery receipts; then complete capture/backfill
and upgrade/restore validation. The rehearsal delivers the storage contract
slice, not the complete production stack.

## Implemented contract

The modules under `server/src/scripts/ingestionWriterFence/` separate environment
guards, installation/cutover, lifecycle SQL, item-write SQL and the ESM client.
They run only through the disposable integration harness. Installation requires
`NODE_ENV=test`, an integration run identity and the harness's exact database-name
shape. These are misuse guards, not authentication against a malicious administrator.

The isolated sequence is:

1. Generate dedicated owner, worker and legacy identities; install private SQL
   functions and revoke PUBLIC execution in the creation transaction.
2. Commit denial of new legacy logins and demotion of the newly created legacy
   superuser. Refuse role memberships and foreign-database sessions.
3. Drain old sessions, including unfinished transactions. Acquire bounded table
   locks, transfer old table ownership and revoke ambient table/function access.
4. Commit the cutover receipt. Only then may a new exclusive library owner retire
   incomplete markers and begin a replay, atomically with its recovery receipt.
5. Check the library, run UUID, session PID/start, login, exclusive advisory lock
   and library/source row revisions on every item write and completion.

The worker cannot write protected tables directly, truncate them, disable their
triggers, delete cascade parents, create functions in trusted schemas or assume
the function-owner role. Definer routines have pinned `search_path`, fully
qualified relations and no caller-supplied SQL. The owner alone receives
`pg_read_all_stats` to inspect backend start identity; runtime cannot assume that
role or read its private binding table. That monitoring privilege remains part
of the privileged function-owner trust boundary, not a general runtime grant.

All library IDs are parameters. Movie and TV fixtures cover Plex, Emby and
Jellyfin. Disabled, archived or unconfigured sources are ineligible; music remains
excluded by the existing schema. No provider HTTP or AI call is made.

## Critical bootstrap distinction

The rehearsal creates an ordinary superuser role. It does **not** demote the
cluster bootstrap superuser. PostgreSQL explicitly prohibits changing that
identity's `SUPERUSER` property. Therefore this installer must not be promoted
unchanged into a live upgrade. The production design needs a separately
authenticated maintenance path and a restricted runtime login, retirement of
the old bootstrap login, session drain, role-membership and HBA review, and
protection of embedded database/maintenance credentials from the runtime.
Application possession of host or database-administrator authority remains
outside the candidate's containment claim.

## Failure, resource and completion boundaries

- A cutover lock timeout leaves adoption disabled; the already-retired login stays
  retired. Retry is possible after the blocker ends. Partial privilege cutover
  rolls back instead of recording success.
- A failed recovery receipt rolls back marker changes and the new run together.
  Lost connections release coordination; replacements obtain new tokens and can
  replay partial items without duplicates under the existing unique identity.
- Each run accepts at most 1,000 distinct external IDs, titles of 500 characters
  and external IDs of 100 characters. The installer uses 5-second statement,
  1-second lock and 15-second transaction limits; session-drain polling is bounded.
  These are rehearsal limits, not production scalability recommendations.
- No pruning is exposed. Completion checks a caller-provided count against its
  seen ledger; that is **not proof of a complete upstream scan**. Full provider
  capture finalization, observations, collections, enrichment and pruning must
  be adapted before production use.
- No new polling daemon or UI is introduced. Binding/seen records and per-write
  checks add database work. Receipt retention and representative throughput/RSS
  comparisons remain production prerequisites; no speed or memory gain is claimed.

Rollback here means disposal of the owned test database and generated roles.
A future production rollback must quiesce writers and restore a reviewed
credential/schema state; simply restoring old superuser access removes the fence.

## Official research, verified September 30, 2026

URLs were discovered through online search and read through the research tools.

- [PostgreSQL advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html):
  cooperative locks alone are not access control. We retain coordination and add
  database privileges plus run validation.
- [PostgreSQL function security](https://www.postgresql.org/docs/18/sql-createfunction.html):
  restrict definer search paths and PUBLIC execution; the installer applies both
  before committing the functions.
- [PostgreSQL role attributes](https://www.postgresql.org/docs/18/role-attributes.html)
  and [role membership](https://www.postgresql.org/docs/18/role-membership.html):
  evaluate elevated attributes, inherited privileges and role assumption, not
  only direct table grants.
- [PostgreSQL ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html):
  bootstrap-superuser demotion is prohibited; membership needs separate handling.
- [PostgreSQL CALL](https://www.postgresql.org/docs/18/sql-call.html): transaction
  control is unavailable inside an outer transaction. The rehearsal retirement
  procedure uses this to prevent accidentally hiding NOLOGIN until after drain.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages):
  future recovery UI should expose waiting, interrupted and completed states as
  understandable text and programmatically determinable status. No UI changed
  here, and no WCAG conformance claim follows from database tests.

## Next delivery and acceptance

Implement production runtime/maintenance credential separation and bootstrap-login
retirement in the startup/upgrade path, tested on disposable restored data first.
Acceptance must show a fresh installation and a restored older installation can
start, migrate and restart with a non-superuser runtime, while the old credential
cannot reconnect or perform late writes. Explicitly inventory remaining shared
writers and maintenance capabilities before enabling automatic legacy adoption.
Then extend this tested gateway to full capture/finalization and perform a
published-image upgrade/restore drill. Do not replace these criteria with another
ownership timestamp or an unchecked enable flag.

See the separate [verification outcome](ingestion-writer-fence-outcome.md).
