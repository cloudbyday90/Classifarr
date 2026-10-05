# Preserve restore refusal across startup maintenance

## Evidence and scope

[CI run 37248416500](https://github.com/cloudbyday90/Classifarr/actions/runs/37248416500)
tested `2621ecae3f2d881d5292f9e62e9ade331e4d8b4e`. Unit, database and
build checks passed. Installation acceptance failed at `normal_rejection`, after
the fixture killed a container during an admitted restore. The replacement
container exited 1 after startup maintenance failed; its logs lacked the specific
restore refusal required by the existing acceptance test.

Schema maintenance already checks durable restore admission before migrations.
However, the compatible worker catches every exception as exit 1, and its parent
deliberately discards child output. Moving schema checks into that worker lost
the diagnostic formerly emitted by normal application startup.

This change repairs that process-boundary contract, not restore admission or
legacy ingestion ownership. No schema, template, API or UI changes are needed.

## Contract

- A typed schema restore-refusal error maps to reserved worker exit 78. Only
  schema assessment can produce this classification; loading, profiling and
  connection cleanup failures remain generic failure 1.
- The parent waits for actual child exit and stream closure. Exit 78 with no
  signal produces a fixed restore-verification diagnostic, then still fails
  startup. Output overflow, stream failure and signal termination remain failures,
  never successful or classified restore refusals.
- Raw worker output and exception messages remain private. The parent constructs
  the message from a constant, not provider, database or filesystem content.
- Fresh and ready installations retain the existing success path. Active
  runtime/restore contention remains deferred exit 75. No new worker, retry,
  cooldown or permanent state is introduced.
- Existing one-worker concurrency, 900-second worker timeout, 920-second parent
  wait, 512 MiB Node heap, one database connection and 64 KiB output cap remain.
- Interrupted restore stays blocked until explicit verified restore succeeds.
  Cancellation and unknown errors cannot start the application. No gate reset,
  automatic replay, ownership fabrication or age-based takeover is permitted.

Completion requires negative unit cases and the real published-image upgrade
rehearsal: interrupt restore, reject normal startup for the correct reason,
verify rollback/retry, and restart normally. The acceptance predicate must not
be loosened to accept any container failure.

## Research and tradeoffs

Official sources retrieved October 4, 2026 (US Eastern):

- [Node.js 24 child-process documentation](https://nodejs.org/docs/latest-v24.x/api/child_process.html)
  distinguishes exit code, signal termination and stream closure. Keep bounded
  draining and classify only a normally exited child after streams close.
- [PostgreSQL 18 SQL restore guidance](https://www.postgresql.org/docs/18/backup-dump.html)
  recommends stopping on SQL errors and supports all-or-nothing restore
  transactions. Preserve the existing verified rollback/retry rehearsal; an
  exited process alone does not prove a successful restore.

Recommendation stack:

1. Typed error plus fixed exit-code diagnostic: small, secret-safe, preserves
   refusal. Cost: maintain a small explicit parent/worker contract.
2. Retain the unchanged image-level rejection and verified-retry checks. Cost:
   real Docker tests take longer than mocks, but catch this integration gap.
3. Resume protected startup/restore integration only after this regression is
   verified. That remains the next dependency for safe unattended recovery.

Rejected alternatives: forwarding raw child logs risks secret disclosure;
matching arbitrary exception text is brittle; treating any exit 1 as expected
would conceal unrelated startup failures. Web accessibility standards do not
change this backend-only contract.
