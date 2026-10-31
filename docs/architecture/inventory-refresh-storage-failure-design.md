# Inventory refresh storage-failure handling design

Date: 2026-10-31. Scope agreed in the preceding conversation and reaffirmed by
the request to implement the next item. Work stays on main, without a release.

## Problem and evidence

The read-only Unraid investigation found PostgreSQL temporary-file ENOSPC errors,
then a checkpointer PANIC and loss of the application's database ownership session.
The application correctly stopped. This change does not identify why storage was
exhausted, prove the volume is currently full, repair production or relax fail-stop.

The refresh database observer omits SQLSTATE `53100`; a genuine disk-full response
therefore becomes `database_unknown` with generic issue guidance and an initial
one-minute retry. Representative refresh shares that mapping but independently
validates categories. Description recovery already has a one-hour slow-retry
ceiling. Representative configuration changes currently reset its retry state,
which would erase a storage hold unless that hold is kept separately.

## Contract and boundaries

Extract the existing fixed database taxonomy/diagnosis into one small shared ESM
service. Preserve existing categories, wording and ordinary retry semantics; add
only `53100` → `database_disk_full`, fixed storage guidance and slow retry. Accept
proof exclusively from existing observed database calls. Provider SQLSTATE-like
codes, arbitrary messages, nested causes and current filesystem readings cannot
establish database storage failure. Unknown codes remain unknown; `53200`, `53300`
and `53400` do not become disk-full.

Use the existing scheduler/log surfaces. Keep incident references, stages,
allowlisted SQLSTATE, bounded durations and generic scheduler errors. Storage
guidance directs attention to the relevant database/temp/WAL volume, free space,
inodes and quotas, while preserving backups and database files. Representative
scheduler guidance is derived from its validated failure, never supplied text.
No additional logging sink, UI, API or provider request is introduced.

Description recovery uses its existing capped slow-retry path. Representative
refresh adds a separate one-hour storage deadline; ordinary failures/deferrals
cannot shorten it, and configuration resets preserve it. Successful admitted work
clears retry state as before. Compute/consume the trusted failure once and reuse
it for retry selection and reporting. Keep cancellation and task-deadline
precedence unchanged. The exact deadline is inclusive: heavy work may retry when
one hour has elapsed, subject to the normal admission and configuration checks.

State/readiness probes may still run during representative cooldown. A new
observed storage failure can extend the hold from that observation. This is a
process-local policy: restart loses the hold and diagnostic episodes, while
durable cache checkpoints and persisted logs survive according to their existing
lifecycle. No new persisted cooldown, table or configuration setting is added.

Preserve durable completed description cache entries and isolation safeguards.
Representative errors still invalidate its private shadow model; keeping a stale
model available would weaken its existing verification boundary. Preserve locks,
resource/memory admission, revision checks, one active pass, existing statement/
lock/transaction limits and the 120-second worker deadline. No automatic cleanup,
container restart, ownership reconnect, uncertain write replay or routing/learning
authority is added. Fresh/disabled/busy setups acquire no new work.

Pre-worker readiness exceptions and unobserved direct checkpoint/advisory calls
remain explicit coverage limits. Do not wrap an entire advisory-lock callback as
a database operation: it contains provider work. Expanding those origin boundaries
is a separate follow-up, not permission to infer evidence from a raw code.

## Research, alternatives and recommendation stack

Official sources discovered and read through MCP on 2026-10-31:

- [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
  recommends SQLSTATE over localized text and identifies `53100` as disk-full.
- [PostgreSQL disk usage](https://www.postgresql.org/docs/18/diskusage.html)
  explains disk/quota exhaustion and possible database shutdown. Our inference:
  report what PostgreSQL observed without claiming current host-wide capacity.
- [PostgreSQL resource limits](https://www.postgresql.org/docs/18/runtime-config-resource.html)
  makes temporary-file limits per process and privilege-controlled. A blanket
  runtime limit could break restricted roles and cannot guarantee WAL/checkpoint
  safety; defer it until workload and privilege evidence justify a separate plan.
- [PostgreSQL error reporting](https://www.postgresql.org/docs/18/plpgsql-errors-and-messages.html)
  supports explicit SQLSTATE exceptions. Use that in isolated integration tests
  instead of exhausting an actual disk; it proves handling, not physical ENOSPC.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)
  supports bounded context, excluding secrets/raw payloads and testing logging
  failures without allowing them to interrupt application work.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  supports useful status without unnecessary interruption. Our application of
  that guidance is to reuse existing logs and avoid another alert/control surface;
  this server-only change makes no WCAG conformance claim.

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Explicit diagnosis with existing one-hour recovery ceiling | Accurate guidance and less repeated heavy work | Recovery may wait an hour after space becomes available; restart resets hold | Implement |
| Diagnosis with unchanged rapid retries | Smallest behavioral change | Can repeatedly pressure exhausted storage | Not selected by user |
| Automatic deletion or restart | Could restore availability in some cases | Data/ownership risks; does not establish safe recovery | Excluded |
| Global disk checks or privileged temp limits | Could help prevention | Different volumes/quotas and restricted-role semantics need evidence | Separate design |

Recommendation stack: trusted storage diagnosis → bounded automatic rechecks →
isolated handling regression tests → separately evidenced prevention/coverage
work. Keep the operator process automatic and the interface unchanged.

## Verification and completion

Test trusted database errors versus spoofed provider codes, unknown/resource
codes, hostile values, redaction, log-sink failures and scheduler transport.
Verify exact one-hour boundaries, first state-read failure, configuration changes,
ordinary failures/deferrals, disabled/busy/cancelled states, successful automatic
recovery, durable cache preservation and private-cache invalidation. Real
PostgreSQL tests raise `53100` in disposable transactions and verify rollback,
pool reuse and sanitized persisted logs without any disk fill or live data.
Run affected suites, backend coverage/ratchet and quality gates; record actual
results, limits, Unreleased changes and the next item in the separate outcome.
