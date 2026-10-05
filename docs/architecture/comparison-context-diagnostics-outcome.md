# Comparison-context retry diagnostics outcome

Date: 2026-10-05. No live Unraid change or release.

## Finding

Local database inspection confirmed warning
`f2b18acb-18d5-4e37-8638-57d658a358d9` at 18:45:45.013 UTC.
It recorded `deferred` without its worker reason. A bounded read of retained
application files found the corresponding automatic recovery at 18:49:08.512 UTC,
approximately 3 minutes 23 seconds later. The warning is historical, not evidence
of a currently blocked import. No manual recovery was performed for this event.

The exact original deferral reason remains unknown. Low host memory is not proven
by the report: container limits, concurrent admission and readiness checks are
separate inputs. Current read-only readiness and memory admission passed; those
probes alone would not establish that comparison preparation succeeded.

## Change and evidence

A small ESM formatter preserves fixed reason codes and matching next steps.
Expected background contention is informational. Memory pressure, unavailable
memory telemetry and failed readiness checks retain warning severity. Changed
reasons generate fresh diagnostic context, repeated identical retries do not.
Unknown failures point to GitHub if persistent, without raw exception text.
Only ready/revalidated results produce a recovery message.

All five focused suites / 58 tests passed, covering the formatter, scheduler,
refresh and memory/admission behavior. Typecheck, scoped lint and the ownership,
copyright and dependency preflight passed. The final combined image and full-suite
results are recorded in the [migration diagnostics outcome](migration-failure-diagnostics-outcome.md).

No cache TTL, retry budget, concurrency, ownership gate, provider or memory limit
changed. No schema migration was necessary.

## Recommendation

Keep automatic retries and ordinary retrieval fallback. The benefit is protected
resources without interrupting classification; the tradeoff is temporarily missing
optional comparison context. Do not raise memory limits based on this historical
warning alone. If a new warning persists, use its reason to investigate the actual
constraint. Next: safe origin codes for currently generic `unavailable` failures.

The recovery skill kept diagnostic improvements separate from recovery authority.
Research and rejected alternatives are in the [design](comparison-context-diagnostics-design.md).
