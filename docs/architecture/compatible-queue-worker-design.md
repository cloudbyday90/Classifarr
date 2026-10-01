# Compatible on-demand queue maintenance design

Date: October 1, 2026. Baseline: `8ee9e2dc`. No release or live restart.

## Decision

The user selected activation with current permissions and unchanged deployment
templates. We will move eligible automatic queue vacuum recovery into a bounded
child of the existing embedded supervisor. This is process-lifetime containment,
not privilege separation: the application and worker retain the same OS/SQL
identity. Protected storage and full identity cutover remain separate work.

## Options and recommendation

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep execution inside the app | No extra process | Cannot independently stop a stuck executor; baseline |
| Compatible on-demand child | Independent deadline and shutdown; no template edits | Temporary extra Node process; same administrator authority; selected |
| Full identity cutover | Protects maintenance authority from the app | Requires protected storage, complete adapters and deployment capabilities unavailable in some forced-non-root templates |

I recommend compatible activation now, then the remaining privileged-operation
adapters and protected-layout migration. We reuse the existing scheduler,
read-only observation, fixed-byte channel and SQL admission rather than create
another polling loop or expose a maintenance API.

## Contract

Normal embedded startup supplies an inherited descriptor to its direct app child.
Restore mode does not attach online maintenance. A separate compatible wrapper
starts only the fixed queue-assessment command under the current non-root UID.
The isolated wrapper retains its separate-identity checks; neither wrapper is a
fallback for the other. A missing or broken configured channel never falls back
to direct maintenance.

The executor receives a constructed local-database environment, not application
secrets, preload hooks, arbitrary commands, SQL, paths or payloads. It independently
rechecks pressure, autovacuum progress, restore exclusion, ingestion/backfill
readiness, cooldown and attempts. Healthy fresh state starts no maintenance child.
Only eligible intervention runs the existing fixed ordinary VACUUM; no VACUUM
FULL, configuration repair, data deletion or ownership adoption is introduced.

One request may be active, with a five-minute request floor, a 512-MiB V8 heap cap,
two database connections, 64-KiB combined output cap, existing sixty-second SQL
budget and bounded whole-process execution. Output is drained but never forwarded.
TERM/KILL cancellation requires confirmed child exit before PostgreSQL shutdown.
These are not total-RSS or CPU guarantees; PostgreSQL retains its existing I/O and
maintenance-memory limits. Repair attempts retain their six-hour cooldown and
three-attempt durable budget, which remains app-writable in compatible mode.

Logs identify `shared_identity`, assessment/start/outcome and actionable failures.
No provider requests, additional listener, container or deployment flag is added.

## Official research

URLs were discovered through online tools and reviewed October 1 against the
September 2026 PostgreSQL 18 / Node 24 baseline. Live pages are not archived
September snapshots.

- [PostgreSQL routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html):
  preserve autovacuum as primary maintenance and avoid blocking VACUUM FULL.
- [PostgreSQL predefined roles](https://www.postgresql.org/docs/18/predefined-roles.html)
  and [peer authentication](https://www.postgresql.org/docs/18/auth-peer.html):
  a separate process with the same login is not least-privilege isolation.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  use inherited descriptors, direct execution, drained pipes and observed closure.
- [Docker security](https://docs.docker.com/engine/security/): do not add container
  capabilities to bypass a saved deployment's permissions.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages):
  keep outcomes meaningful in text. No UI changes or new WCAG conformance claim.

## Acceptance and rollback

Prove idle/no-child, readiness deferral, eligible repair, cooldown, request abuse,
failure sanitization and cancellation. Exercise the real executor and unchanged
standard, custom-ID and Community Apps-style upgrades. Preserve isolated peer
and protected-ledger negative tests. Source rollback restores prior scheduler
composition without a data migration. No live data is used in the tests.
