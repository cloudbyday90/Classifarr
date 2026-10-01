# Restricted queue maintenance handoff outcome

Date: October 1, 2026. Backend-only component; no release or live deployment.

## Delivered behavior

The [design, options and official-source research](restricted-queue-maintenance-handoff-design.md)
are implemented as small ES modules. The existing scheduler can use an inherited
fixed-capability channel to request an independent queue-recovery assessment.
The trusted supervisor launches one bounded worker; it never accepts arbitrary
SQL, commands, paths, roles, databases or environment values from the runtime.

The security-hardening review shaped two important constraints: protect the
durable retry ledger from the runtime, and keep production identity activation
separate from this component. The worker refuses unsafe grants before evaluating
the existing pressure, ingestion/backfill readiness, locks, cooldown and attempt
limits. A request is not permission to force a repair.

The channel is optional and exercised under actual separate OS/SQL identities in
the disposable Linux rehearsal. **Production still uses its previous shared
identity and direct recovery path.** This commit does not claim that production
administrator authority has been removed or that legacy ownership errors have
been repaired by this channel.

| Situation | Behavior |
| --- | --- |
| Healthy, settled queue | Read-only observation; no maintenance child |
| New pressure or state requiring reconciliation | Request an independent trusted assessment |
| Eligible sustained pressure | Existing bounded queue vacuum/analyze; durable attempt recorded |
| Busy, unready or cooling down | Defer without forcing repair |
| Unsafe runtime grants | Worker refuses maintenance |
| Invalid, excessive or failed channel | Close capability; no privileged fallback or immediate retry |
| Shutdown during work | Cancel and join the child before database stop; unconfirmed exit fails shutdown |

## Resource and security limits

There is no new listener, daemon, polling loop, credential or template setting.
We reuse the existing fifteen-minute schedule and delayed startup. Both endpoints
enforce a five-minute request floor and one in-flight request; the broker creates
no backlog. Read-only observations have a five-second connection watchdog after
acquisition and three-second statement limits. Existing pool acquisition limits
remain in effect.

The trusted worker has an eighty-five-second overall deadline. The parent waits
at most ninety seconds before bounded TERM/KILL joins; the client waits ninety-five
seconds and does not retry. Existing sixty-second SQL-session, six-hour cooldown,
three-attempt and bounded-output contracts remain unchanged. The worker's 512 MiB
V8 old-space cap is not a total-memory or CPU limit.

The runtime may delegate the descriptor to a descendant, but cannot expand its
fixed operation or reset its protected budget. Root, packaged code and the
database administrator remain trusted. General application writes and unresolved
ingestion ownership paths are not certified safe by this work. Logs and result
delivery are best-effort; a lost response can follow committed work, so durable
state controls later assessment. A failed channel stays unavailable until its
lifecycle restarts.

## Validation

- Targeted protocol, client, broker, worker, scheduler and supervisor tests:
  118 passed in seven suites.
- Real PostgreSQL tests: 26 passed in three suites, including six new protected
  boundary tests. They reject effective table/column writes and NOINHERIT role
  membership while permitting the intended read-only runtime.
- Disposable Linux Docker drill: all eight core checks passed, including real
  eligible repair with active runtime admission, healthy/cooldown deferral,
  malformed request denial, administrator reconnect denial, ledger-write denial
  and sentinel preservation across clean restarts.
- The complete drill's core elapsed time was 69,970 ms; maximum orchestrator RSS
  was 93,388 KiB. Default, custom-UID and Unraid stop-and-verification observations
  were 2,293, 2,437 and 2,344 ms under the ten-second stop budget. These are synthetic
  lifecycle observations, not total-container memory or production capacity data.
- Frontend coverage: 5,795 tests in 411 suites passed; production build passed.
- Final backend coverage: 48,381 tests in 1,587 suites passed, with one existing
  skip. The combined coverage ratchet passed without baseline changes. The new
  boundary, client, read-only assessment and protocol modules have 100% line and
  branch coverage; the broker has 100% line and 95.74% branch coverage. Real Docker
  execution additionally exercises the worker's command-line entry point.
- Lint, types, copyright, Knip, ESM imports/mock shapes, policy gates, migration
  naming/integrity and Markdown (1,717 files) passed. Reviewed ownership inventory:
  19 owned, 188 separately coordinated and 490 unresolved paths; no existing
  unresolved paths were waived or certified compatible.
- A newly built disposable container passed the fresh-database schema comparison
  and cleaned up its synthetic data and image. The live-source comparison could
  not proceed because the running installation lacks the earlier migration
  `20261001_120000_queue_vacuum_recovery.sql`. No live migration was applied to make
  this check pass; the new container's schema matched the committed snapshot.
- The initial full backend run found one outdated seven-check assertion in the
  isolation lifecycle test. It now verifies the eighth check, its ordering and
  failure cleanup; all 19 lifecycle tests and the final full rerun pass.

## Recommendation stack and next component

Keep PostgreSQL autovacuum first, bounded conditional recovery second and
on-demand diagnosis third. For a restricted embedded runtime, use this fixed
handoff to reach those existing capabilities without carrying administrator
credentials. Advantages: no new network service or template requirement, a
protected repair budget and independently checked work. Costs: process startup
on requested assessments, conservative deferral after channel failure and the
remaining identity-migration work. A separate authenticated maintenance service
is a better fit only when external database administration warrants its deployment
and credential-management cost.

The next high-value component is **production identity activation with
installation-compatible upgrade and rollback**. Account for remaining privileged
jobs, preserve saved Compose/Unraid templates, establish protected peer-mapped
roles and executable/data ownership, and prove interrupted-upgrade recovery.
Acceptance must show the real application cannot reconnect as administrator or
reset the repair budget while supported maintenance still works. Measure total
container RSS and application query latency on representative small hosts before
activation. This is a concrete deployment boundary, not another diagnostic layer.

The first implementation stage is the
[image-only upgrade compatibility contract](image-only-upgrade-compatibility-design.md):
validate saved settings before writes and prove unchanged deployment profiles.
Its completion does not by itself activate the production identity boundary.

## Delivery scope

GitHub MCP and the saved-login GitHub CLI both returned no open PRs for this
repository. There was no random open PR available to implement; none was invented,
merged or closed. The disposable drill removed its own containers, images and
synthetic volumes. Live containers and persistent data were untouched. No image
publication, tag, release, dependency change or production identity migration was
performed.
