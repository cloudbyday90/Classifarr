# Inventory refresh readiness diagnostics design

Date: 2026-10-31. Status: implemented and verified locally; see the separate
[outcome](inventory-refresh-readiness-diagnostics-outcome.md).
Predecessor: [storage handling outcome](inventory-refresh-storage-failure-outcome.md).

## Problem and evidence

Description and representative refreshes check inventory readiness before entering
their workers. The shared wrapper already refuses work after a failed probe and
returns `deferred/unavailable`, but these two runtimes provide no diagnostic hook.
Their schedulers ignore deferred failure context. Consequently a database storage,
permission or timeout failure can disappear behind a generic unavailable result.

The wrapper also serves comparison context and automatic source-pair work. Other
services call its reader directly. Change only the two refresh integrations;
preserve every other consumer's behavior and the readiness SQL/policy.

## Agreed contract

Add a small opt-in readiness reader and a separate diagnostic/warning service.
Reuse the existing readiness SQL, three-second statement timeout and transaction
observer's entered/completed distinction. Observe actual query calls plus genuine
acquisition/BEGIN/COMMIT failures. Application projection errors inside unfinished
callbacks do not become database evidence. Do not wrap provider callbacks or
traverse raw nested causes to infer database origin.

The existing optional wrapper hook produces a server-minted, closed readiness
capsule: fixed stage, incident reference, validated database category, allowlisted
SQLSTATE when proven and bounded database duration. An unobserved lookalike code
or raw message remains unknown. Retain no SQL, parameters, paths, credentials,
provider responses or raw error. Revalidate the capsule at the logging boundary.

Keep `deferred/unavailable` and existing scheduler receipt semantics. Do not feed
readiness failures into worker recovery, start a new one-hour hold, reset existing
retry history or invalidate caches. A later ready probe merely permits the worker
to apply its normal cooldown, ownership, admission and validation checks; it does
not prove storage or refresh recovery. Readiness polling remains automatic on its
current schedule. Fresh, disabled or busy setups continue to do no heavy work.

Use the two existing scheduler loggers for fixed warnings after the wrapper has
returned. Keep the diagnosis hook pure so stopped probes remain quiet. Bound
warnings to one per fixed category per refresh scheduler per thirty minutes,
including exact boundary behavior. Use a tiny process-local category/time map:
the existing global logger deduplication is best-effort and cannot by itself
guarantee this interval. No timers or persistent incident registry are needed.
Repeated failures and later ready probes do not erase that warning bound.

Share storage-check prose with the existing database diagnosis, but give readiness
its own precise continuation text. Do not reuse the worker's one-hour retry claim
or branded failed-task transport for a probe that did not create that cooldown.
Add no recovery announcement in this batch. Logging failure cannot alter refusal
or start work. A warning's normal database persistence may fail during an outage;
do not add a second sink, write replay or recovery authority to compensate.

## Lifecycle, security and limits

Preserve coalescing, stop fencing, configuration checks, all current cache and
worker state, ownership fail-stop and existing admission. The current wrapper
does not forward caller cancellation into the probe, and its statement timeout
starts after BEGIN; this batch makes no new cancellation or acquisition-deadline
promise. Stop still suppresses a completed probe's diagnostic result.

Each runtime still coalesces to one outstanding probe, using the same SET LOCAL
and one-result readiness SELECT without an additional query retry. The current
closed vocabulary bounds warning timestamps to twelve categories per registered
scheduler; it stores numbers, not incident payloads.

Warning state is bounded by the closed category vocabulary and is process-local;
restart or a new scheduler registration loses the warning interval. Invalid clocks
cannot create an unbounded warning stream. Server-minted diagnostic metadata uses weak lifetime tracking,
without retaining raw failures. No new schema, API/UI, setting, job, provider call,
operator CLI trigger, routing, learning, cleanup, restart or deployment is added.
The source change stays on main and creates no release.

The static ownership review adds only the opt-in adapter's exact source/analysis
entry and rationale. Its indirect-query gap remains explicitly unresolved; no
existing entry, parser baseline or ownership classification is relaxed. Review
and integration evidence do not certify production writer compatibility.

## Official research and recommendation stack

Sources discovered and opened through MCP on 2026-10-31:

- [PostgreSQL SQLSTATE guidance](https://www.postgresql.org/docs/current/errcodes-appendix.html)
  recommends error codes over localized message text and distinguishes disk-full,
  connection capacity, memory and configuration-limit failures. Our application:
  require observed database origin before applying the existing closed taxonomy.
- [OWASP logging guidance](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet)
  supports proportionate logging, treating cross-boundary data as untrusted,
  excluding sensitive payloads and testing logging failures/resource exhaustion.
  Our application: fixed capsules, bounded warnings and failure isolation.
- [W3C status-message guidance](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  describes useful status without unnecessary interruption. Our application is
  to preserve the existing interface and avoid another alert/control surface;
  this server-only change makes no WCAG conformance claim.
- [Jest's CLI guidance](https://jestjs.io/docs/cli) supports rerunning failed
  tests. Our verification application: investigate and fix failures, then report
  the original broad result separately from a failed-suite rerun. A rerun without
  coverage preserves the complete broad production-coverage report.

| Option | Benefit | Cost or limitation | Recommendation |
| --- | --- | --- | --- |
| Opt-in trusted diagnosis and bounded warnings | Explains preflight refusal without changing recovery behavior | A failed probe still uses its existing polling cadence; warning persistence may fail | First batch |
| Send preflight failures into worker recovery | Could delay subsequent heavy attempts | Changes cooldown, cache and recovery meaning before the worker starts | Separate recovery design |
| Extend all readiness consumers at once | Broader diagnostic coverage | More contracts and unrelated failure semantics | Defer |
| New dashboard, incident store or manual trigger | Additional controls/detail | More UI and lifecycle complexity | Exclude |

Recommended stack: observe narrow database boundaries, mint safe evidence, retain
the current refusal, then emit bounded warnings through existing logs. Measure
remaining acquisition/cancellation and recovery coverage before choosing another
behavior change.

## Verification and delivery

Cover fresh/disabled/busy refusal, unknown and spoofed errors, actual query and
transaction failures, callback projection failures, exact warning boundaries,
clock problems, logger failure isolation, coalescing, stop during a probe and
normal automatic resumption. Prove no heavy/provider work occurs after refusal
and that existing worker cooldown debt survives readiness transitions.

Use isolated real PostgreSQL controlled SQLSTATE exceptions and existing fixtures
to verify rollback, pool reuse and sanitized persisted warnings. Do not exhaust a
disk or mutate production. Run focused suites, relevant backend coverage/ratchet
and quality gates. Record exact results and limits in a separate outcome, update
Unreleased, review current open PRs, and commit/push on main without a release.
