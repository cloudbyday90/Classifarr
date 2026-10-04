# Selected database startup composition

Date: 2026-10-04. Follows [durable selection](legacy-database-selection-design.md).

## Decision

Connect selection to the existing supervisor's admission phase. Selection must
be reverified before database adoption, maintenance must finish before runtime
launch, and shutdown must join children before stopping PostgreSQL. Keep these
ordering rules in a small ESM component, not a second supervisor implementation.

This increment exercises the composition in the disposable legacy-copy drill.
It does not activate identity conversion on deployed installations. The normal
entrypoint, saved Compose/CA settings and fresh-install path remain unchanged.
No timer, API, new environment switch, schema change or release is introduced.

## Safety contract

- The trusted caller holds the protected journal lease from preparation through
  supervisor completion. The component never acquires an HTTP-supplied path or
  accepts a command, credential or fallback database.
- Require a completed migration, matching binding and actual verification on
  every startup. Missing, malformed or failed evidence starts neither maintenance
  nor runtime. The selected candidate is never recopied or replaced by the source.
- Forward host cancellation to verification and database adoption. Check it
  again after verification and durable selection so a signal cannot advance to
  runtime. Bounded verification must finish/clean up before returning; abandoning
  a still-running promise is not cancellation.
- The database adapter owns start-and-adopt cleanup: if startup fails or is
  cancelled before adoption completes, it must clean up only its registered
  candidate, or fail the whole container. Never signal an unrelated PID.
- Require the maintenance launcher. Reuse the supervisor's bounded maintenance,
  application drain, database monitoring and shutdown logic; do not implement
  another retry loop. Unknown child exit remains failure, not successful cleanup.
- The top-level container must exit after a failed lifecycle, retaining container
  isolation as its last cleanup boundary. A journal lock is not fencing against
  arbitrary old writers and is not itself a production activation criterion.
- The drill retains its 120-second worker deadline, 2-CPU/2-GiB/128-PID container
  limits, network isolation and fixed synthetic paths. Child output is bounded
  and discarded, not logged. No provider requests or real appdata are involved.

Completion means an independently verified selected database, successful schema
maintenance, restricted-role runtime work and confirmed database shutdown. It
does not mean library recovery has completed: that still requires full import
and metadata backfill, excluding disabled optional AI work.

## Alternatives and recommendation stack

| Approach | Benefit | Cost or risk |
| --- | --- | --- |
| Start application directly after reading selection | Minimal glue | Skips current verification, maintenance and cancellation safeguards |
| Duplicate a new startup/shutdown loop | Independent implementation | Two lifecycle implementations can drift |
| Compose with the existing supervisor — selected | Reuses tested ordering, monitoring and drain behavior | Requires a trusted start/adopt adapter and protected launch integration |

Recommended order: prove this composition; build the fixed-path production
adapter and capability-aware entrypoint; complete privileged maintenance and
database-enforced ingestion-writer admission; then activate unattended recovery.
Do not change working legacy identities or grant privileges to get an early pass.

## Official research

Discovered with web search and opened on 2026-10-04:

- [PostgreSQL account guidance](https://www.postgresql.org/docs/18/postgres-user.html)
  recommends a database OS identity separate from other daemons and executable
  ownership. The drill preserves that separation.
- [PostgreSQL role attributes](https://www.postgresql.org/docs/current/role-attributes.html)
  explain why a superuser runtime cannot provide a meaningful permission fence.
  Startup composition alone does not solve old-writer isolation.
- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html)
  distinguish sending a signal from observing process exit. Reuse actual exit
  observation and bounded output handling, without a shell.
- [Docker runtime permissions](https://docs.docker.com/engine/containers/run/)
  distinguish saved user/capability configuration from image contents. Existing
  forced-non-root templates cannot silently gain a root provisioning boundary.

## Acceptance

Unit tests must reject incomplete selection, failed verification, cancellation,
failed adoption and failed maintenance without launching runtime. They must show
that selection precedes adoption, maintenance precedes runtime, and shutdown
finishes inside the caller's lease. The Linux drill must use real schema
maintenance, restricted SQL work, a competing lock attempt and a real SIGTERM,
then independently resume and verify the committed write and original source.
This remains synthetic process-lifecycle evidence, not a published-image upgrade,
power-loss durability or physical Unraid/Synology acceptance.
