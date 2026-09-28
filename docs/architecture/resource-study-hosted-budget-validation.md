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

## Hosted result

[Resource run 36496014431](https://github.com/cloudbyday90/Classifarr/actions/runs/36496014431)
passed on corrective commit `84d6c899`, including upload of aggregate evidence.
The receipt records image
`sha256:392d7dd4ea3e62fab5b4cf777de44f5de842b5cb0ef6aef29d10f891d337bf98`.

| Check | Observed result |
| --- | --- |
| Actual cgroup / effective PID ceiling | v2 / 19,151, unchanged across both startups and workload |
| Memory / CPU quota | 2 GiB / no cgroup CPU quota; period 100,000 microseconds |
| Total probe duration / settled idle | 154.4 seconds / 10.015 seconds |
| Supported inventory / completed metadata tasks | 400 / 420 |
| Held recovery cohort | 20/20 completed, no premature starts |
| First dispatch / cohort completion after clearance | 0.694 seconds / 2.068 seconds |
| Final pending / failed / routing work | 0 / 0 / 0 |
| OOM / OOM kills / memory-limit events / PID denials | All zero |
| Sampled container memory peak / PID peak | 394.8 MiB / 48 |
| Evaluations completed | 53; synthetic vectors, no model calls |
| Idle queue / completed-count changes | None across six samples |
| Owned cleanup | Passed |

This confirms the previously failing hosted baseline path, not the optional
capacity/budget-comparison/30-minute profiles; those were not run in this job.
Ten seconds of hosted idle is not long-term memory evidence: its RSS window
medians increased by 0.25 MiB, which is not a leak diagnosis. The earlier local
30-minute cgroup v1 workload remains separately scoped. Production defaults,
ownership recovery, routing and live data are unchanged. Main CI/CD was still
running when this resource result was recorded; it is not represented as passed.

## Follow-up

After hosted validation, proceed to representative unfinished-backfill restart
recovery in the existing installation drill. Keep process epochs separate and
require recovery of original durable work, not reseeding or age-based takeover.
