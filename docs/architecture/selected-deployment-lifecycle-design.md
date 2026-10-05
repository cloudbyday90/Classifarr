# Selected deployment lifecycle integration

Date: 2026-10-05. Follows [restricted restore HTTP](selected-restore-http-design.md).

## Decision and scope

Join saved deployment admission, selected database startup, normal application
startup and restricted restore HTTP in one ESM controller. Normal mode runs schema
maintenance first. Restore HTTP skips schema writes and starts only the restricted
authenticated interface; it does not automatically submit a restore or start
normal workers. Both modes retain the migration lease through joined shutdown.

Inspection found that offline migration preparation and verification still live
in the synthetic image fixture. Do not promote that fixture to a production
verifier or infer migration completion from a directory name. The existing shell
guard and forced-non-root compatible path remain unchanged. This batch completes
the lifecycle integration component, not automatic production conversion.

## Contract

- Require a trusted Linux/root caller holding the migration journal lease and
  independent binding. Validate the complete saved environment before effects.
- Match requested UID/GID against actual separated accounts; do not change
  ownership. Require the caller's current umask to match the saved setting rather
  than temporarily changing a process-global mask during concurrent work.
- Pass the saved database startup deadline to the database adapter and preserve
  the application heap, pool, paths, keys and tuning. A mandatory trusted vector
  verifier consumes the requested staging policy before database startup. It may
  reject; there is no silent generic fallback or ignored configuration field.
- Keep the default deployment compiler normal-only. Restore admission is explicit
  in this controller, and does not loosen the normal application boundary.
- Route a restore worker's fatal join failure back to the supervisor as a failed
  lifecycle, never a successful host stop. Handle rejected application completion
  promises without an unhandled rejection or hanging supervisor. Do not stop
  PostgreSQL if application/maintenance termination remains unconfirmed.
- No automatic restart, write retry, key rotation, inventory reset or schema
  migration. Existing worker bounds, SQL locks and durable quarantine remain.
  Fresh/legacy installations acquire no new background work from this component.
- Completion means the application, its maintenance work and database were joined
  successfully. It does not mean media recovery or optional AI work completed.

## Research and alternatives

Official sources found through MCP web search and opened on 2026-10-05:

- [Node 24 child processes](https://r2.nodejs.org/docs/latest-v24.x/api/child_process.html):
  signal delivery alone does not establish termination; handle errors and actual
  completion, and construct child environments.
- [PostgreSQL 18 role attributes](https://www.postgresql.org/docs/18/role-attributes.html):
  avoid superuser authority in network-facing application processes.
- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/):
  host shutdown deadlines and health checks remain external lifecycle contracts.
  Saved templates cannot be assumed to receive new grace-period settings.

| Option | Benefit | Cost / risk |
| --- | --- | --- |
| Separate ad hoc normal/restore startup | Small changes | Different cleanup and configuration handling |
| Shared selected lifecycle — chosen | Consistent admission, configuration and shutdown | Requires trusted migration and vector verifiers |
| Immediately replace the legacy entrypoint | Automatic rollout now | Production migration verification is not yet implemented |

Recommendation stack: shared lifecycle and fatal-error handling; production
offline migration/selection verifier and sanitized bootstrap handoff; real
published-image upgrade tests; database-fenced unattended legacy recovery.
No UI or API interaction change is introduced; existing CSRF/authentication stays.
