# Hosted resource budget correction: outcome

## Scope — 28 September 2026

The [design and incident evidence](resource-study-hosted-budget-diagnostics.md)
separate the earlier fixed schema-replay failure from the finite host-default
PID ceiling that blocked resource CI before its workload started.

## Verification

Regression coverage exercises unlimited and finite baseline limits, invalid or
smaller-than-comparison limits, explicit ceiling enforcement, continuity across
fresh/restarted containers and workload snapshots, malformed/missing telemetry,
sanitized failure output, accurate report labels and cleanup on drift. Baseline
tests use both cgroup v1 and a v2 fixture matching the hosted 19,151 PID ceiling.

Local verification passed after the correction:

- Full backend unit suite: **1,524 suites / 46,017 tests**.
- Server/client lint and types; copyright, ingestion ownership and dependency-use
  gates; strict ESM mock/import checks; Markdown validation and diff whitespace.
- The earlier local 32-minute sustained run remains separate cgroup v1 evidence.
  The limit correction does not change its workload or claim a repeated soak.

Hosted end-to-end validation is pending the corrective commit. No passing result
is inferred from unit fixtures or the earlier local cgroup v1 soak. This change
does not alter production defaults, ownership recovery, routing or live data.

## Follow-up

After hosted validation, proceed to representative unfinished-backfill restart
recovery in the existing installation drill. Keep process epochs separate and
require recovery of original durable work, not reseeding or age-based takeover.
