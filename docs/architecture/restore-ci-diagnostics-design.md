# Interrupted-restore CI diagnostics

## Decision — 2026-10-03

Preserve bounded, sanitized startup evidence before changing restore behavior.
The failure in CI run `37142677429` reached `normal_rejection`: the container
exited with code 1, without OOM, but did not expose the expected restore-admission
message. That does not establish why it exited. The current source passed both
a local published-image upgrade rehearsal and the newer CI installation job.

This change fixes the demonstrated evidence gap, not an unproven runtime cause.
Normal workers must still refuse an unverified restore. No automatic restore
retry, ownership reset, timeout increase, dependency rollback or deployment change.

## Contract

- Run diagnostics only after an isolated rehearsal fails; no new application
  service, scheduler, database write or fresh-install background work.
- Preserve the existing 5-second command deadline and 64 KiB capture limit.
  Parse at most 100 lines per stream, 4,096 characters per JSON event, and retain the last
  16 recognized events per stream. Report truncation explicitly. Stream order
  is retained; do not infer ordering between stdout and stderr.
- Project exact component/status/reason/phase allowlists from existing embedded
  database and supervisor events. Unknown values remain unknown; never export
  raw errors, SQL, paths, environment, credentials or provider payloads.
- Save the validated candidate image ID, requested image role, operating mode,
  stage and bounded observations even when the failed container is unavailable.
  An image ID identifies local content, not a published manifest or attestation.
- Keep diagnostic collection best-effort. Failure to inspect or save cannot
  turn a failed scenario into success or prevent owned-resource cleanup.
- Upload only the generated `failure.log` files to a separate, short-lived
  diagnostic artifact. Do not change the acceptance artifact's directory layout
  or let diagnostic observations satisfy acceptance checks.
- Keep verified workflow run/attempt identity in blocked receipts. Invalid
  workflow input must still produce a blocked receipt without copying the input.

Unknown, timeout, cancelled or permanent failures all remain blocked. There is
no diagnostic-driven retry. Completion means focused negative tests pass, real
Docker stream parsing is checked, and the existing strict restore contract stays
intact. Missing evidence is not proof of successful cleanup or recovery.

## Options and recommendation stack

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Keep sanitized startup stages and image identity | Makes the next recurrence actionable without exposing logs | Allowlist maintenance; cannot reconstruct every failure | Do now |
| Retry until CI passes | Little implementation work | Hides intermittent faults and changes the test's meaning | Reject |
| Accept any exit code 1 | Avoids the failing assertion | Could accept a broken image instead of a safe restore refusal | Reject |
| Change PostgreSQL, logging or shutdown speculatively | Might affect suspected paths | No evidence that any one caused this failure | Defer until reproduced |

Recommended order: retain diagnostic evidence; reproduce any recurrence against
its exact image; fix the proven cause with a failing regression; then resume the
remaining dependency/tooling updates in small tested batches.

## Official sources checked on 2026-10-03

- [Docker container logs](https://docs.docker.com/reference/cli/docker/container/logs/):
  log reads capture available stdout/stderr; use finite tails, never `--details`
  because it can include configured environment/label values.
- [GitHub workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts):
  persist test evidence after the job; keep diagnostics separate from signed
  provenance and gate receipts.
- [Node.js process I/O](https://nodejs.org/download/release/v24.20.0/docs/api/process.html):
  explicit exit can truncate pending pipe writes. This is a possible explanation,
  not a diagnosis; fail-stop behavior remains unchanged in this round.
- [PostgreSQL pg_ctl](https://www.postgresql.org/docs/current/app-pg-ctl.html):
  a timed-out control command does not prove the underlying operation stopped.
  Keep explicit state verification and existing cleanup boundaries.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html):
  applicable to future in-app status presentation. This CLI/artifact-only change
  introduces no UI or new WCAG conformance claim; retain plain text outcomes and
  actionable next steps rather than color-only status.

Sources were located using web search/MCP and opened before use. Findings and
verification belong in the separate outcome document.
