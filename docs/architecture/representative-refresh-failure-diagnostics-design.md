# Representative refresh failure diagnostics proposal

## Problem and scope

Investigated on 22 October 2026 after the reported SchedulerService incident
at 21 October 11:24:32 UTC (reference prefix 8f45b14d). This is a read-only
diagnosis and proposed next change, not an implemented runtime fix or permission
to rerun refresh, alter inventory, reset cooldowns or contact shared Ollama.

The representative refresh catches arbitrary failures and returns only failed.
Its scheduler then creates a new generic unavailable error. The scheduler runner
retains only its message; the logger therefore constructs its own stack. This
explains why the report points at logging instead of the actual failing stage.
It does not identify the underlying failure.

## Recommended next implementation

Add a small representative-specific ESM failure observation/projector, following
the existing description-refresh pattern without mislabelling representative
events as description incidents. Keep finite stage and category vocabularies,
bounded durations and an incident reference; preserve that projected evidence
through the worker, scheduler error and scheduler log. Database classification
belongs only around database operations, not arbitrary provider code values.
Unknown stays unknown. Never include raw exception text/causes, SQL/parameters,
endpoints, model input, vectors, credentials or provider responses.

Preserve readiness, configuration/revision checks, cooperative discovery
admission, existing timeouts and process-local exponential cooldown (one minute
through one hour). Do not add attempts, timers, persistence, schema migrations,
endpoint probes or status-view network I/O merely to improve diagnosis. Empty,
disabled, busy and resource-deferred installations must remain no-work/deferred,
not newly alarming errors. Optional profile work must not block ordinary imports.

Regression cases should cover state/admission/database, representation
inspection, repository snapshot, fit, verification and task-deadline failures;
source/configuration changes; cancellation and shutdown; safe unknown errors;
hostile getters/private extras; no success publication after failed verification;
and unchanged cooldown/no-overlap behavior. Verify real SQLSTATE classification
in an isolated PostgreSQL fixture, not the live database. No live replay is
needed to qualify this observability change.

## Options and recommendation stack

| Option | Pro | Con |
| --- | --- | --- |
| Keep generic failures | Minimal disclosed data | Cannot identify the failing stage or distinguish safe remediation |
| Add bounded stage/category evidence | Actionable, private-safe diagnosis; existing pattern available | Requires propagation and regression coverage; cannot recover an old discarded cause |
| Increase deadlines or loosen validation now | Might hide a symptom | Unsupported by this incident; weakens safeguards without proving a cause |

Recommend bounded diagnostics first, then use the next naturally occurring
failure to select a targeted fix. Before implementation, confirm this separate
runtime scope through the repository planning workflow. The existing file-only
VM journal agreement does not authorize a scheduler behavior change.

Official guidance discovered and opened through MCP on 22 October:
[PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
recommends structured SQLSTATE over parsing messages. Code 57014 denotes query
cancellation, not proof by itself of a statement timeout. No SQLSTATE was
retained in this reported incident; do not assign one retrospectively.
