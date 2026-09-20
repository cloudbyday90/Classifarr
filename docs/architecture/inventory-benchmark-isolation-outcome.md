# Inventory benchmark isolation outcome

Date: 2026-09-20.

## Root cause and implemented change

The [design](inventory-benchmark-isolation-design.md) separates benchmark resource
use from the live app. The old `docker exec` workflow shared the app's 2 GiB limit;
the observed 754,561,024 available bytes were below its unchanged 1 GiB startup
requirement. A warmed app can legitimately defer that workflow. Later memory
recovered naturally, so this investigation does not establish a memory leak.

The new opt-in launcher pins the app image, starts one separately limited
container, waits for temporary admission contention, and cleans up its own job.
Cancellation during creation is remembered; cancellation during admission or work
stops the owned container. Cleanup errors identify the disposable container and
return failure instead of silently reporting success. No app restart, threshold
relaxation, scheduler disablement, database migration, or routing change is part
of the launcher.

## How to run

After deploying the current local image, run from the repository root:

```powershell
npm run benchmark:inventory:compose -- --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-challenge --max-minutes 20
```

This is zero generation. `--leader-semantic` or `--leader-grounded` may request
up to 32 cases with `--generate-cases`; the grounded protocol is not recommended
for further prompt tuning after its measured failure. Arguments are checked
before job creation. The launcher adds a five-minute admission-wait budget,
inside the specified overall deadline. Busy progress requires no user action.
Ctrl+C cancels and cleans the disposable job. No release is created.

This launcher supports the repository's local embedded-PostgreSQL Compose setup.
Docker must be available, the app healthy, and Docker-host free memory at least
3 GiB. Permanent resource shortage still defers safely. It does not automatically
replay a partial evaluation after model failure or source drift.

## Measured local behavior

The new image was deployed once for validation. Subsequent benchmark runs did
not recreate or restart the live app:

| Check | Outcome |
| --- | --- |
| Zero-generation, ten-description smoke | Completed; source verified; no routing writes |
| Hold the shared PostgreSQL discovery lock for 12 seconds | Two bounded busy waits, then automatic completion; exit 0 |
| Cancel a waiting job after 6.5 seconds | Exit 130; owned container removed; lock holder exited normally |
| Run the 300-description grounded cohort behind normal background discovery | Three busy waits, then admitted; source verified |
| Live app identity, start time and restart count | Unchanged across tests; restart count 0 |
| Live `/health` during background work | HTTP 200, healthy, database connected |
| Leftover labelled benchmark containers after runs | None |

Docker inspection confirmed the actual job had separate 2 GiB memory/swap limits,
two CPUs, 128-process limit, UID/GID 1000, a read-only root, all capabilities
dropped, no-new-privileges, zero persistent mounts, and the intended shared network
namespace. The app's memory limit remained 2 GiB. The local metadata/background
workflow continued; it was not paused to obtain a passing result.

The grounded model experiment separately stopped after eight calls for unstable
and invalid responses. See its [outcome](grounded-library-comparison-outcome.md).
Removing resource contention does not repair model semantics or authorize routes.

## Verification

- Full backend coverage: 1,358 suites / 39,591 tests passed in 516.934 seconds.
  Coverage: 90.29% lines/statements, 83.52% branches, 92.43% functions.
- Admission, lifecycle, existing discovery admission and live SWR regression
  subset: nine suites / 158 tests passed. Admission-wait service coverage:
  100% lines/functions and 96.77% branches. Additional final transport/ownership
  checks passed in a three-suite / 87-test run.
- PostgreSQL corpus projection, description and vector-cache integration:
  three suites / 24 tests passed after the refactor.
- Lint, server/client type checks, copyright/dependency preflight, static ESM
  imports, ESM mock-shape checks and Markdown lint passed.
- Full frontend coverage: 369 files / 5,128 tests passed in 223.09 seconds.
  Coverage: 87.67% lines, 85.58% statements, 77.54% branches, 85.09% functions.
- Coverage ratchet passed against fresh backend and frontend reports; no baseline
  was reduced. No client source changes were needed.

The separate production-naming gate still reports 43 pre-existing references
against a zero baseline. This work neither adds references nor waives that gate.
GitHub MCP returned no open pull requests on the final check, so there was no
random open PR to implement. No PR was merged, and no version or release changed.

## Recommendations and limits

Use this isolated launcher for local inventory evaluations. Its additional RAM
cost buys app-memory isolation; the existing database discovery lock still bounds
shared heavy work. It is not a separate database or AI server, a FIFO job queue,
or a Docker-daemon crash recovery service. If the launcher is forcibly terminated
or Docker becomes unavailable, inspect its printed UUID-named container after
Docker recovers; never delete the live `classifarr` container as cleanup.

Next, follow the [scoring architecture reassessment](library-learning-next-step-reassessment.md):
a dedicated local cross-encoder with bounded, revision-keyed SWR and outage
recovery. Validate pairwise relevance on held-out movie/TV examples before any
live use. Do not compensate for failed semantic evaluation by weakening safety
thresholds, adding acknowledgement screens, or endlessly changing chat prompts.
