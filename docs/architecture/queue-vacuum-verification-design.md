# Queue maintenance verification and CI diagnosis

Date: 2026-10-07. Baseline: `304d8e428177f91cadab2edf3dd487854a89537d`.

## Evidence and scope

Source run 37677016163 failed the eligible automatic-vacuum integration case with
`queue_vacuum_attempt_unverified`; its isolated local rerun passed. The historic
log does not identify the underlying category. The success fixture enables table
autovacuum immediately before manual maintenance, permitting competing work.
That is a concrete race window, not yet proof of the historic failure's cause.

The isolated reproduction now confirms this boundary: with a one-second
autovacuum cadence, 60 repetitions of the original success fixture produced a
`55P03` warning after admission (`completion_unverified`, active vacuum and
conflicting lock observed), plus a pre-admission deferral. The executor correctly
rejected skipped work. The historic CI log still cannot prove its exact cause.

The correction is test-only: keep autovacuum enabled and raise only the three
table-level vacuum/insert/analyze thresholds for a 15,000-row synthetic workload.
Restore each edited option exactly in `finally`, including previously absent
options, and leave unrelated options untouched. A second pinned test connection
takes the conflicting lock immediately before VACUUM, after reservation, to test
the race deterministically. No cluster setting is retained in the committed test.

First capture bounded verification evidence and reproduce the boundary on an
isolated PostgreSQL 18 database. Implement only the demonstrated correction.
Keep the runtime's warning/counter checks, fixed relation, advisory locks,
one pinned connection, 60-second deadline, six-hour durable cooldown and
three-attempt limit. Never turn skipped work into success or retry a vacuum
merely because verification is uncertain. No live maintenance, schema change,
privilege grant, Compose/template requirement or memory-policy change is intended.

## Options

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Bounded failure evidence and controlled success/contention fixtures | Makes failures actionable while proving both real database outcomes | Extra fixture code; selected |
| Retry until the CI test passes | Little implementation work | Hides the original failure and does not establish a cause; reject |
| Ignore warnings or require only a resolved query | Removes the apparent failure | Can claim completion when PostgreSQL skipped work; reject |
| Increase production timeouts or disable autovacuum | Might alter timing | No causal evidence; harms unrelated operations; reject |

## Contract

- Fresh/healthy installations remain observation-only. Admission, restore
  quarantine and inventory/backfill checks remain authoritative.
- Completion still requires the expected command, no relevant warning, the same
  supported relation/statistics epoch and increases in both manual counters.
- An admitted failure retains its attempt and cooldown across disconnect/restart.
  Cancellation or unknown completion cannot authorize another immediate write.
- Evidence must identify the stage and fixed failure reason without SQL text,
  raw notice/error messages, credentials, row payloads, user names or addresses.
  Numeric/bounded counter evidence must preserve unknowns, not invent zeroes.
- Real database tests must control competing maintenance in their success fixture
  and exercise lock interference explicitly. Any fixture-only tuning must be
  restored and must never alter a deployed database or production defaults.
- Test observations do not prove the exact cause of a historic failure when its
  original evidence is missing. Record that limit in the separate outcome.

## Official research

Discovered with web search and retrieved on October 7, 2026:

- [PostgreSQL 18 VACUUM](https://www.postgresql.org/docs/18/sql-vacuum.html)
  documents relation skipping with `SKIP_LOCKED`, warning-based permission skips,
  and non-transactional execution. A resolved command is insufficient proof.
- [PostgreSQL 18 locking](https://www.postgresql.org/docs/18/explicit-locking.html)
  describes the conflicting lock used by ordinary vacuum and analyze.
- [PostgreSQL 18 statistics](https://www.postgresql.org/docs/18/monitoring-stats.html)
  is the reference for cached observations and cumulative maintenance counters;
  do not assume estimated dead tuples are exact physical bloat.
- [Table storage parameters](https://www.postgresql.org/docs/18/sql-createtable.html)
  and [routine vacuuming](https://www.postgresql.org/docs/18/routine-vacuuming.html)
  support table-scoped fixture thresholds. They are not deployment tuning advice;
  anti-wraparound maintenance remains PostgreSQL's responsibility.
- [DefinitelyTyped versioning](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/README.md)
  ties declaration versions to the API they describe. Node 26 declarations are not
  a compatible Node 24 tooling update merely because they install successfully.

No UI or HTTP contract changes are intended; no new accessibility claim is made.

## PR trial and verification

Fresh enumeration returned two open dependency PRs. Random selection chose
[#555](https://github.com/cloudbyday90/Classifarr/pull/555), immutable head
`5545605b53c854de8847b44e24fa083ff4218080`, proposing client Node declarations
24.19.1 to 26.6.4 and undici-types 7.24.6 to 8.9.0. Apply its exact diff locally
and run the pinned Node-24 contract gate before installation. Revert if rejected;
do not merge it or weaken the runtime contract. The trial was applied and rejected
by that gate (7/8 passed); after reverting it, the gate returned to 8/8. No
dependency installation or retained version change was needed.

Run focused unit and isolated database tests, applicable backend gates, the full
database suite, and a no-cache local Compose build. Back up the local test
database before replacement; verify health and unchanged security/mount settings.
Dump and independently verify the schema in disposable image containers.
Keep Unraid untouched. Record CI source/run identity and all failures separately.

## Recommendation stack

1. Establish and correct the smallest demonstrated maintenance verification gap.
2. Recheck the exact source in CI; do not substitute a local pass for that result.
3. Resume native/anonymous-memory investigation with existing safeguards intact.
