# Representative refresh failure diagnostics design

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
failure to select a targeted fix. The user confirmed this separate runtime scope
on 22 October 2026 through the repository planning workflow. It does not authorize
live replay, provider requests, VM recovery or a release.

## Approved implementation contract

Use separate observation and failure-projection modules. Weak metadata preserves
the original thrown object for existing admission/cancellation handling; the
innermost failed stage wins. The scheduler receives a new fixed-message error
with only a privately branded, immutable projected envelope. It never receives
the original cause. Each failed attempt gets a random incident reference; this
is correlation metadata, not a stable incident deduplication key.

Stages cover initial/final state reads, admission, provider creation, installed
representation inspection/checkpoint, snapshot/warm preparation, fitting,
consumer preparation, independent verification and publication checkpoint.
Database observations wrap actual queries. Transaction acquisition/BEGIN/COMMIT
are observed separately from an unfinished callback: warm preparation executes
application callbacks inside the transaction, so wrapping the entire transaction
as a database failure would be incorrect. Initial/final state reads bridge the
description repository's already trusted database observation. Unknown admission
failures remain unknown rather than guessing their origin from an error code.

Keep the internal 120-second signal separately, distinguishing its expiry from
explicit shutdown/external cancellation and the provider's 60-second timeout.
This changes diagnostic evidence only: a task deadline remains failed/backed off,
and typed resource deferrals and explicit cancellation retain existing outcomes.
Failure categories use existing finite provider, representative validation and
SQLSTATE vocabularies plus task_deadline and unknown. Durations are rounded and
capped at one day; malformed clocks produce null. No arbitrary property spread,
getter execution, nested cause or caller-supplied SQLSTATE crosses the envelope.

No database migration or new work is introduced. Retry eligibility remains
process-local (restart loses it), with at most one active refresh and the existing
database-scoped discovery admission. This change neither persists cooldowns nor
changes restart ownership, configuration fencing, resource limits or attempt
counts. Completion means verified failure metadata reaches persisted scheduler
logs, existing success/deferral/cancellation tests pass, isolated transport and
SQLSTATE tests pass, and a fresh committed-source no-cache image rehearsal passes.
The rehearsal uses synthetic disposable Compose projects, not live appdata.

Official guidance discovered and opened through MCP on 22 October:
[PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
recommends structured SQLSTATE over parsing messages. Code 57014 denotes query
cancellation, not proof by itself of a statement timeout. No SQLSTATE was
retained in this reported incident; do not assign one retrospectively.

[OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
supports correlation identifiers, consistent bounded fields, sensitive-data
exclusion and testing logging failures. The
[Node 24 API documentation](https://nodejs.org/download/release/latest-v24.x/docs/api/globals.html)
describes timeout signals and composition retaining the originating abort reason.
Both URLs were discovered and opened through MCP on 22 October 2026. The latter
currently documents 24.22.1; no toolchain update is included (tests use 24.21.0).
