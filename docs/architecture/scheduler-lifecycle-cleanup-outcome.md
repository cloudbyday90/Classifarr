# Scheduler lifecycle cleanup outcome

Date: 2026-09-09. See the separate
[design](scheduler-lifecycle-cleanup-design.md).

## Delivered behavior

All four core delayed startup tasks now use the existing cancellable scheduler
interface. Reset stops their timers, stops cron work, and disables the local
event-loop histogram. Controlled SIGTERM and SIGINT shutdown runs scheduler
cleanup before queue drain and HTTP server close.

The scheduler work remains library- and configuration-agnostic. It does not
inspect media, select a cohort, invoke AI, modify policy, or route media.

## Validation

Focused tests cover the startup-task registry, reset cancellation, histogram
stop behavior, shutdown ordering, and a contained cleanup failure. The local
passive receipt evidence remains seven `under_25ms` windows; pool-wait receipts
remain deferred. The focused set passed 157 tests in 9 suites, and the full
backend unit suite passed 33,111 tests in 1,158 suites before final
JSDoc-only typing tightening. Lint, typecheck, documentation lint, ESM static
checks, no-cache Compose rebuild, and health verification passed; the completed
working-tree security review reported no findings.

## Next item

After enough passive windows exist, reevaluate only the aggregate delay bucket
distribution. Add pool-wait receipt instrumentation only if a sustained
high-delay profile appears and the resulting fixed measurements would change a
performance decision.
