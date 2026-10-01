# Conditional queue maintenance recovery outcome

Date: October 1, 2026. No release or live deployment.

## Delivered behavior

The [design and official research](queue-vacuum-maintenance-design.md) are
implemented as small ES modules for observation, admission policy, durable state,
bounded execution and scheduler integration. We retain PostgreSQL autovacuum as
the primary maintenance mechanism and remove the two unconditional manual
vacuums from queue retention. Existing retention rules and cleanup history remain.

The backend now checks for supplemental recovery through the existing scheduler,
not a new daemon or container. Its first check is delayed ten minutes; subsequent
checks are every fifteen minutes. Healthy steady-state checks perform no recovery
ledger writes after initialization and never run manual vacuum.

| Observed condition | Backend action |
| --- | --- |
| Healthy or fresh queue | Observe; no manual vacuum |
| At least 10,000 estimated dead rows and 20% dead for an hour without vacuum progress | Check ingestion/backfill readiness and maintenance admission |
| Ingestion, backfill, retention cleanup, restore or another vacuum is active | Wait; do not consume an attempt |
| Eligible, idle and authorized | Save an attempt and six-hour cooldown, then run bounded vacuum/analyze |
| Three attempts without observed relief | Stop automatic interventions and log that review is needed |

These thresholds are conservative product defaults, not PostgreSQL prescriptions
or a capacity benchmark. A gap over thirty minutes or vacuum progress restarts
the pressure observation window. The service's own successful vacuum does not
reset the attempt budget. Reliable below-threshold observations or a new
statistics epoch can reset attempts; an existing cooldown is still respected.

Structured logs record admission transitions, recovery start and completion or
an unverified result. Repeated unavailable checks are locally deduplicated;
ordinary unchanged observations use debug logging. A completed operation means
both vacuum and analyze counters advanced for the same relation without a
statistics reset or warning. It does **not** mean pressure has cleared or disk
space was returned to the operating system. Later observations assess pressure.

## Safety and compatibility

Execution is limited to the permanent, ordinary, non-inherited
`public.task_queue` table. There is no caller-supplied SQL, table identifier,
force flag, new HTTP endpoint or privilege grant. The security-hardening review
kept this fixed scope and prohibited automatic privilege escalation. The service
does not disable autovacuum, terminate sessions or escalate to `VACUUM FULL`.

One pinned, discarded connection holds runtime/restore admission and exclusive
queue-vacuum/retention locks. Work has a sixty-second session budget, five-second
control-query limits, a two-second lock timeout, 64 MiB maintenance memory,
zero parallel workers and a 2 MiB buffer ring. These are per-operation limits,
not whole-container CPU/RSS quotas. Readiness is a point-in-time check, and
advisory locks coordinate cooperating code, not arbitrary administrator SQL.

Migration `20261001_120000_queue_vacuum_recovery.sql` adds a singleton recovery
ledger. Normal upgrades apply it; fresh snapshots initialize its operational row
on first use. Existing Compose files and Unraid Community Apps templates need
no edits for this component. Rollback can revert the code and leave the additive
table inert. No existing inventory, library, routing or retention setting changes.

The current production database identity remains unchanged. The separate-identity
rehearsal can execute the fixed maintenance child, but production privilege
separation is not activated here. A future restricted runtime needs a trusted,
fixed-capability handoff; insufficient privilege currently defers safely.

## Validation

- Final targeted unit/adapter run: 124 tests in eight suites passed.
- Real PostgreSQL queue, image-index and schema maintenance regression: 40 tests
  in three suites passed. A separate repeat of all thirteen queue tests passed.
  Actual synthetic dead tuples were reclaimed after durable admission; fresh
  setup, contention, quarantine, restricted roles and skipped vacuum were checked.
- The first combined database run exposed an integration adapter forwarding its
  timeout as PostgreSQL's callback argument and using pooled transaction queries.
  The fixture now uses an explicit pinned adapter; the clean reruns passed.
- Disposable embedded Docker drill passed, including actual fixed vacuum-child
  execution, restricted-runtime denial, encrypted restore, legacy identity
  recovery and data preservation. Default/custom/Unraid `99:100` stop checks
  measured 3,588 / 2,664 / 2,748 ms, including verification, within ten seconds.
  Its owned containers, images and volumes were removed successfully.
- The authoritative fresh-container schema dump completed and its temporary
  resources were removed. Snapshot changes are limited to the new ledger and
  migration bookkeeping.
- Frontend coverage: 5,795 tests in 411 suites passed; production build passed.
- Backend coverage: 48,173 tests in 1,583 suites passed; one existing skip.
  All five new recovery service modules have 100% line coverage. The combined
  server/client coverage ratchet passed without regression.
- Lint, types, Markdown (1,713 files), copyright, Knip, ESM imports/mock shapes,
  migration naming/schema integrity and policy checks passed.
  Ownership review passed: 19 owned, 177 separately coordinated, 490 unresolved.
  Existing unresolved paths were not waived or certified compatible.

## Optional operator tool

Automatic recovery needs no manual invocation. For read-only inspection, from
the server directory using the existing trusted database configuration:

```sh
node src/scripts/runQueueVacuumMaintenance.mjs --inspect
```

The same command with `--apply` is an offline operator tool, requiring stopped
cooperating runtimes and maintenance authority. It never obtains that authority
itself. Exit 0 means configured autovacuum for inspection or verified completion
for apply; 75 means attention/deferred; 1 means failure; 2 means invalid arguments.
Neither an inspection result nor exit 0 establishes general database health.

## Delivery scope and next item

GitHub MCP and a final saved-login GitHub CLI check both returned no open PRs.
There was no random open PR to implement; none was invented, merged or closed.
The live database was inspected read-only; no live vacuum, container restart,
image publication, release or template change was performed.

Recommendation stack: PostgreSQL autovacuum first, conditional bounded backend
recovery second, targeted diagnosis when safe recovery cannot resolve pressure.
This adds a small amount of admission state in exchange for automation without
unlimited retry work or silently broadening database authority.

The next high-value component is **on-demand maintenance blocker diagnosis**,
triggered by persistent pressure or an unverified intervention. Capture a bounded,
redacted explanation of old transaction/replication horizons, maintenance progress
and repeated timeout categories, with one actionable next step. It should not
collect SQL text, kill transactions or reset retry limits automatically. That
would explain why recovery cannot help before we consider broader tuning or the
later restricted-runtime maintenance handoff.
