# Description-refresh failure attribution

Research and design: 2026-10-11. Implements the next step from the
[timeout investigation](description-refresh-timeout-2026-10-11-outcome.md), not an
unproven query-performance fix. Scope is diagnostics, on main, without a release.

## Evidence and official guidance

The local corpus read exceeded its 15-second statement deadline. Recovery reduced
the database failure to `unknown`; the scheduler then discarded even that report.
The retained database log, not the logger-generated stack, established the cause.
The task recovered automatically and a later query completed in about 0.6 seconds.

Official sources discovered and opened through MCP on October 11:

- [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
  recommend SQLSTATE over localized messages. `57014` means query cancellation,
  not exclusively statement timeout. Do not infer timeout from elapsed time alone.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
  recommends operation context and correlation identifiers, excludes sensitive
  content, and requires logging failures not to break application work.

## Contract

Use small ESM observation/diagnosis helpers, preserving original exception identity
with weakly held metadata. Observe fixed refresh stages and database-operation
elapsed time using a monotonic clock. Database attribution is accepted only at the
repository boundary; a provider claiming a PostgreSQL-like code is not a database
failure. Expose only allowlisted SQLSTATE values and fixed categories. Unknown
codes, arbitrary messages, causes, SQL, parameters, URLs, descriptions and identifiers
never enter the new diagnostic payload. Bound numeric durations and field lengths.

Recovery assigns a generated incident UUID per process-local category/stage episode.
Warnings, subsequent failed-run reports, scheduler errors and recovery completion
carry that reference. Deduplication remains bounded by fixed categories/stages and
the existing 30-minute reminder. Duration describes the observed operation, not a
claim about database execution versus pool wait or transaction cleanup. Stage
`backfill` remains a coarse boundary for the existing multi-step batch loop.
Metadata is consumed on failure handoff or explicit cancellation so a reused error
object cannot retain an earlier operation's stage. Durations are capped at 24 hours;
invalid clock values are unavailable, not replacement application failures.

Database categorization covers the refresh repository's query adapter, not every
database caller in the application. Advisory-lock and representation-checkpoint
failures can still have a useful stage without a database category. Persistent
unknown cases direct administrators to open a GitHub issue with sanitized context.

The scheduler transports only validated, internally branded details, not arbitrary
error properties. Keep its generic public error message and existing receipt
outcomes. Existing logs provide timestamps; the new incident reference is separate
from each persisted log row's error ID. No new telemetry service or schema is needed.

## Safety and lifecycle

No additional work on fresh, disabled, unsupported or busy setups. No API/UI or
provider operations are added. Preserve the shared advisory lock, configuration
revision checks, one active worker, 120-second pass signal, 15-second statement and
two-second lock limits, batch/response limits, durable cache checkpoints and
isolation journal. No HTTP enters a database transaction.

Transient, permanent provider refusals and unknown errors retain their existing
retry policy: 60-second exponential delay with bounded jitter, capped at one hour;
the existing provider-specific slow-retry choices remain intact. Database error
categories change attribution, not scheduling policy. Explicit stop/external abort
still returns `cancelled` without registering failure; timeout and lock-loss behavior
is not redefined. In-flight SQL cancellation is not newly promised.

Process restart loses diagnostic episodes and the existing process-local cooldown,
but not cache checkpoints or persisted logs. A new process creates new references.
Only `up_to_date` clears the recovery episode. A completed cache write remains the
checkpoint if later cleanup fails; this work does not replay writes or reset imports.

## Alternatives and recommendation stack

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Bounded stage/category/duration and incident references | Useful attribution with no sensitive payloads or schema change | Cannot reconstruct historical resource contention | Implement first |
| Log raw database/provider errors and nested causes | More immediate detail | Secrets, content and log-injection exposure | Reject |
| Increase limits or rewrite corpus SQL now | Might reduce observed timeouts | Cause remains unproven; changes resource risk | Defer |
| Durable tracing service and per-query metrics | Cross-process analysis | Broad architecture and retention scope | Not needed for this change |

1. Implement bounded observation and end-to-end scheduler propagation.
2. Test redaction, hostile values, deduplication, recovery, cancellation and unchanged
   deadlines; provoke a real PostgreSQL cancellation only in an isolated fixture.
3. Run backend quality gates, then the requested exact-source no-cache local build,
   isolated schema dump and read-only local checks. Preserve backup/rollback assets.
4. Profile the corpus on a disposable restored fixture under controlled load before
   choosing a query or resource fix. Unraid, Plex and shared Ollama stay unchanged.

For that follow-up, PostgreSQL's [EXPLAIN guidance](https://www.postgresql.org/docs/18/sql-explain.html)
warns that `ANALYZE` executes the query and adds measurement overhead. On the isolated
fixture, compare ordinary SELECT latency with `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF,
FORMAT JSON)` rather than treating instrumented time as normal latency. Its
[activity statistics](https://www.postgresql.org/docs/current/monitoring-stats.htm)
expose wait events; collect fixed wait categories and bounded resource samples,
not raw query text or descriptions. Both sources were MCP-verified October 11.
This is a proposed follow-up, not a benchmark executed in this change.

## Random PR trial

Fresh enumeration found #556 and #558. Random selection chose
[#558](https://github.com/cloudbyday90/Classifarr/pull/558), immutable head
`e8a7ee2e490e5437375aa3a4628943657fa1783e`. It changes only client Node declarations
24.19.2 → 26.6.4 and undici-types 7.24.6 → 8.9.0. Apply its exact diff locally,
review scripts/lockfile, run strict install, tree/audit, typechecks and the existing
runtime-major policy. Reject and restore it if that contract fails; do not upgrade
the deployed Node runtime or weaken the policy merely to retain a random PR.
Do not merge, close or edit the remote PR. Record results separately.

[Definitely Typed's versioning guidance](https://github.com/Definitelytyped/DefinitelyTyped)
ties declaration major/minor versions to the library API they describe (MCP-verified
October 11). Passing a typecheck does not establish compatibility with a different
deployed Node major; retain this repository's existing Node 24 policy.
