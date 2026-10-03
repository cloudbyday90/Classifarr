# Manual routing rehearsal outcome

Date: 2026-10-03. Linux amd64 images, Docker Desktop, Node 24.21.0.

## Delivered and verified

Added a modular ESM Docker owner, scenario runner, synthetic provider, seed and
authenticated probe. No production routes, admission rules, schema, retry limits
or provider behavior changed. The production entrypoint and real minute scheduler
ran unmodified. The root command is `test:local:manual-routing-rehearsal`.

The final real-image run passed all eight phases and cleanup:

| Check | Observed result |
| --- | --- |
| Prior-image state | Two explicitly enabled items retained one prior attempt and their due dates across upgrade |
| API boundaries | Anonymous/non-admin denied; missing CSRF and extra request fields rejected; sixth request rate-limited |
| Interrupted scheduled lookup | Actual Radarr GET observed before SIGKILL; restart retained attempt two and its cooldown |
| Exhaustion | Next empty lookup consumed attempt three; re-enabling did not reset it |
| Provider rejection | Sonarr 401 paused the provider and refunded the confirmed failed check |
| Repair after restart | Pause survived; authenticated credential update allowed a verified read against the same destination |
| Side effects | Two movie GETs, two TV GETs, **zero provider writes**; original decisions and attempt tokens preserved |
| Legacy / cleanup | Incomplete legacy history was not enrolled; owned container and scratch volume removed |

Immutable inputs:

- Baseline source: `eef03e57ffdd26d638f32f1593c424b438041ea2`.
- Baseline image: `sha256:6c04c447e6a32d53c708e316f5ea0aeecaa0264579cda3e8f5b31bc0d2bfae67`.
- Candidate runtime source: `c897e9ea0085943f5c2982fc31e6a3bcd258ea75`.
- Candidate image: `sha256:3360774cf9d5f246c1f517e313d35443b4aefb653ac7734cb18e0d1f807b0d7b`.

The images were built locally with the production Dockerfile. The candidate
runtime is unchanged by this tooling-only commit. The fixture directory was
mounted separately read-only, not over application code. Neither the running
Classifarr service nor another application's container/data was changed.

## Validation and corrections

Eight focused backend suites passed: **229 tests, zero skipped**. These cover the
new harness, provider guard and lookup contracts, existing shutdown drill, and
published-upgrade capture regressions. Workspace lint, server/client typechecks,
ESM import/mock checks, copyright, dependency preflight, ownership drift checks,
Markdown and skill metadata validation passed. No ownership baseline was changed.
Full backend/frontend coverage suites were not rerun for this tooling-only change;
the prior runtime commit's CI unit and database jobs passed.

Early rehearsal attempts exposed fixture mistakes, corrected before the passing
run: completed legacy history needs its library reference; normal sessions must
be renewed after restart; rate-limit responses can be plain text. These were not
production fixes. Failed runs also cleaned their owned resources.

The recovery AI skill now conditionally loads an image-rehearsal reference. It
records immutable-image boundaries, real interruption evidence, deliberate
fixture clock changes, write-attempt counting, and label-checked cleanup. Its
metadata validator passed; this is not an independent agent behavior evaluation.

## Limits and next recommendation

Prior attempt state is synthetic. After verifying preserved deadlines, the
fixture makes only its own deadlines due to avoid waiting 15 minutes; it does not
claim natural cooldown-expiry coverage. The test covers one forced-kill movie
lookup and one TV credential-repair flow, not every provider/architecture matrix.
It uses a development baseline; published-release acceptance is a separate drill.

Recommendation stack: keep fast unit/SQL tests, run this image rehearsal, then
bind its receipt to the candidate's image and source in release acceptance.
The benefit is repeatable restart evidence; the cost is Docker plus several real
scheduler ticks. **Next: integrate this receipt into frozen release evidence and
CI, including explicit wrong-image and missing-receipt rejection.**

GitHub MCP and saved CLI authentication found no open Classifarr PRs, so no random
PR could be selected. No PR was merged and no release was created.

See the [design, tradeoffs and official sources](manual-routing-rehearsal-design.md)
and [separate startup-capture design](upgrade-rejection-capture-design.md).
