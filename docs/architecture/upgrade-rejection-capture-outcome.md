# Published-upgrade rejection capture outcome

Date: 2026-10-03.

## Change and proof

The published-upgrade runner now checks the expected restore-verification error
in both captured stdout and stderr, reading at most 200 log lines. Exit code 1
is still required. Logs remain private. No application startup guard changed.

The stderr-only regression failed before the change and passed afterward.
Missing-marker and wrong-exit regressions continue to reject the scenario.
The published-upgrade suite passed **48 tests**, included in the combined
229-test focused run.

The full isolated published-release drill passed locally both before and after
the capture change. The final run verified all **12 checks**: signed baseline
provenance, fresh startup, scheduler/backfill crash recovery, persisted-volume
migrations, interrupted restore, normal-startup rejection, explicit verified
retry, movie/TV handoff, verified restart, and upgraded scheduler progress.
Cleanup passed. Music remained excluded and routing task count stayed zero.

Inputs:

- Published baseline: `v0.48.4-beta`, source
  `a0e417fd714919bb4ca30e20f9cd2380136ca74e`.
- Baseline digest: `sha256:dc95fcdd80123b6bbf5b252fec286d9e81fbbc21a1030087c0a44abacd6a187f`.
- Candidate: `sha256:3360774cf9d5f246c1f517e313d35443b4aefb653ac7734cb18e0d1f807b0d7b`.
- Database: PostgreSQL 18.6; migration count changed from 222 to 315.
- Deployment profile: standard; saved configuration unchanged within the run.

## What this establishes

The dual-stream evidence defect is proven and fixed. It is a plausible cause of
[CI run 37120415214](https://github.com/cloudbyday90/Classifarr/actions/runs/37120415214)
failing at `normal_rejection`, but its sanitized artifact did not retain the
actual rejection text. The exact remote failure is therefore **not proven** to
have that cause. The old runner also passed locally; do not describe this as a
deterministic reproduction of the remote incident.

Keep the next CI run as an independent check. If it fails at the same boundary,
add a bounded structured rejection classification rather than accepting any
exit-1 container. No workflow was bypassed, release created, live volume loaded,
or running service replaced.

See the [design and tradeoffs](upgrade-rejection-capture-design.md).
