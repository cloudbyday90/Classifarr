# Resource study: hosted budget failure diagnostics

## Evidence — 28 September 2026

[CI/CD run 36485954122](https://github.com/cloudbyday90/Classifarr/actions/runs/36485954122)
used `8d1acc30` and failed the published-schema replay comparison on the inventory
observation trigger expression. The forward migration in `6380baf3` addresses
that separate issue. Its subsequent
[CI/CD run 36488458584](https://github.com/cloudbyday90/Classifarr/actions/runs/36488458584)
passed, including the replay check. Re-running the old SHA would not apply the fix.

[Resource run 36488458669](https://github.com/cloudbyday90/Classifarr/actions/runs/36488458669)
used `6380baf3` but failed `assertStudyBudget` during the first startup receipt,
before seeding or starting the workload. The log did not contain the effective
limits, so it cannot identify which limit differed. The successful local cgroup
v1 study does not establish equivalence with this hosted environment.

## Design and safety

The first diagnostic commit kept budget assertions unchanged while gathering evidence. A small ESM
formatter/parser exposes only the allowlisted budget name and safe-integer
cgroup version, memory limit, CPU quota/period, PID limit and PID denial count.
Unknown values remain null; arbitrary error messages, environment variables,
payloads and extra properties are never forwarded. The host wrapper reparses
and sanitizes the bounded diagnostic line before printing it.

Failure still prevents seeding, measurements and a success artifact. The launcher
cleans only its verified, initially empty, randomly named Compose project. No
daemon setting or live container limit changes are involved.

## Validation and next decision

Regression tests cover malformed/oversized diagnostics, stripping private fields,
safe host forwarding and owned cleanup after a failed probe. These diagnostics
were added after the completed smoke/soak measurements; they change the failure
path, not the measured workload.

The diagnostic commit `01fd7b7b` produced
[hosted run 36494956074](https://github.com/cloudbyday90/Classifarr/actions/runs/36494956074).
Its first startup reported cgroup v2, memory limit 2,147,483,648 bytes, CPU quota
-1 with period 100,000 microseconds, PID limit **19,151**, and zero PID denials.
Docker configuration validation passed. Only the assertion that baseline's
effective PID limit must be unlimited was wrong.

## Corrected baseline contract

Distinguish absent application-requested PID configuration from the host's
effective limit. Keep Docker configuration validation unchanged. Baseline accepts
unlimited or a safe-integer finite ceiling at least 128, the fixed comparison
ceiling. Smaller or unknown limits fail. Explicit bounded/stress ceilings remain
exactly 128; CPU quota/period, 2 GiB memory, denial/OOM checks and recovery deadlines
are unchanged. No daemon configuration or host protections are weakened.

Require identical effective cgroup version, memory, CPU quota/period and PID limit
across both startup receipts and workload initial/final snapshots. Sampling still
rejects in-run drift. Comparison validation independently checks the same boundary.
Reports disclose the actual effective ceiling, including finite baseline values.

| Option | Benefit | Cost / risk | Decision |
| --- | --- | --- | --- |
| Require unlimited on every host | Simple assumption | Rejects valid host-enforced defaults | Reject |
| Change Docker/systemd to remove the host cap | Makes the assumption pass | Changes protection outside the experiment | Reject |
| Observe host default and verify continuity | Portable, honest evidence; preserves controls | Baseline values differ between hosts and must be reported | Select |
| Ignore PID telemetry | Avoids startup failures | Conceals denials and configuration drift | Reject |

Recommended stack: requested Docker config verification → effective cgroup
verification → cross-start continuity → bounded workload and denial counters →
explicit aggregate reporting. Do not interpret a reported default as proof that
all ancestor constraints or available host resources are unlimited.

## Official sources

Discovered through web search and read on 28 September 2026:

- [Docker container creation](https://docs.docker.com/reference/cli/docker/container/create/)
  documents the PID option and unlimited setting.
- [Moby issue 45188](https://github.com/moby/moby/issues/45188) demonstrates finite
  effective PID defaults with the systemd cgroup driver despite absent or
  unlimited-requested Docker options. This supports the distinction; the hosted
  diagnostic above independently establishes this repository's exact mismatch.

Final hosted validation is recorded in the
[outcome document](resource-study-hosted-budget-validation.md).
