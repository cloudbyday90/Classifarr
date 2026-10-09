# Local five-call capture outcome after the provider update

Date: 2026-10-09. Scope: local testing, not Unraid deployment or a release.
See the separate [design and options](evaluation-capture-trial-design.md).

## Result and evidence

The operator updated the shared Windows Ollama provider to 0.40.2. The explicit
metadata preflight subsequently passed without changing Classifarr model identity
checks. The provider is shared with Unraid, but the Classifarr databases are
separate. Only the local test installation's capture allowance was activated.

| UTC checkpoint | Observed result |
| --- | --- |
| 20:47 | All 10 imports and current-run backfill handoffs complete; no due/processing tasks; policy replay complete |
| 20:48:21 | Provider preflight ready; local allowance enabled at 5 calls / 42,240 reserved tokens, starting from zero reservations |
| By 20:50:11 | Ordinary scheduled capture published its response batch; supervisor observed `captured`, then disabled the allowance |
| 20:50:12 | Independent status read confirmed both limits zero; 5 calls / 42,240 token reservations retained |
| 20:50:50 | Read-only database check found one published batch with five responses; saved replay had not consumed it yet |
| 20:56:00 | Ordinary replay resumed successfully after the memory deferral, without a restart or admission change |
| 20:58:35 | Read-only replay of capture's window validated all 5 cached responses and produced 5 AI pairs; no provider calls or result writes |

The five responses report 13,782 input tokens and 74 output tokens, with 11,507 ms
combined generation-client latency. No output-limit or suspected context-limit
flags were set. These are recorded provider metrics, not the 42,240-token
conservative reservation and not a billing or accuracy claim. No prompts, raw
responses, model digests, credentials or database dumps are included here.

Trial image: `sha256:1a5cd1894ea508be70d278161bf028aa26e14de116e4055ed69711bd2041ce27`,
OCI revision `8ab4a7071994d5b1208b7811edcb08ef1803e810`. The local container had
started at 20:14:34 UTC and was not restarted to obtain the capture result.

The temporary ESM supervisor used the existing CLI and scheduler, a 20-minute
deadline, same-UTC-day guard and a `finally` disable/verification path. It is not a
durable expiry mechanism against host/process failure. The trial did not call the
one-shot capture entry point, reset quota, bypass cooldowns or change routing.

## Replay observation

At 20:50 UTC the next policy evaluation deferred with `memory_pressure`. Its last
saved result remained the 20:44 revision: 300 sampled, 282 eligible, 75 selected,
zero paired. Inventory was still ready. At 20:52:31 a separate diagnostic process
reported 1,206,796,288 available bytes and a 2 GiB constraint; that later sample
does not reconstruct the earlier refusal or identify which allocations caused it.
The unchanged discovery gate includes a 768 MiB work allowance, a 256 MiB reserve
at this limit, concurrent reservations and 64 MiB recovery hysteresis.

At 20:56:38 the persisted policy result was complete again: 300/300 policy cases
paired, with 18 automatic, 244 review and 38 manual outcomes on each policy arm.
The optional AI comparison still showed zero pairs. The database explains the
remaining delay: capture's checkpoint is at offset 0, but the independent survey
had evaluated offset 75 and advanced to 100. That 25-item window has 23 missing
response cases and two non-adjudication cases; it does not inspect the first
window where these five responses belong. The first batch also introduces a
model-identity revision in history, rather than merging it into no-model results.

No forced collection, memory-limit increase, process restart or re-enabled capture
was used to obtain this recovery. Publication and normal policy replay are proven;
ordinary saved replay of the newly captured window is not yet proven. This is not
a full-cycle memory-retention study or proof of a leak. Capture permission, sweep
position and saved paired coverage must not be conflated.

A separate read-only diagnostic then acquired the existing discovery lock and
memory admission, read the current snapshot and ran the existing bounded worker
at capture's offset 0. All five stored keys matched its plan. Both arms had five
cache hits, zero invalid results, 19 misses and one unavailable case, producing
five AI pairs. In these cases both arms reused the same request key; five calls
therefore yielded five pairs, but that ratio is not guaranteed for other inputs.
There were no reference labels, so accuracy and improvement are not established.
This diagnostic neither saved a result nor advanced a cursor; the dashboard was
not made to report work that the normal survey had not yet performed.

## Changes and verification

Updated operator guidance to distinguish reservations, published responses and
saved pairs; explain why five calls do not promise five compared items; and make
trial cleanup and memory-pressure handling explicit. No runtime defect was
reproduced during capture, so no application refactor was invented. All temporary
trial automation uses ESM and remains excluded from version control.

- Focused capture/quota/scheduler/history unit and HTTP checks: 5 suites, 80 tests
  passed, no skips.
- Isolated PostgreSQL capture and budget checks: 2 suites, 11 tests passed, no
  skips. Existing application data was not used for integration tests.
- Fresh random open [PR 555 trial](node-types-pr-555-outcome.md): exact immutable
  manifest/lock diff applied locally, then rejected by the existing Node-major
  contract (8/8 baseline, 7/8 candidate, 8/8 restored). No install or merge.
- Supported dependency/tooling gate: 40/40 passed. No dependency changes retained.
- Markdown: 2,038 files, zero errors. Copyright: 1,552 files, passed. Diff
  whitespace check passed. Full-suite coverage is not claimed for this docs-only
  change; the behavioral checks above exercise the existing trial path.

## Recommendations

Keep the small local allowance disabled. The next implementation should prioritize
replay of newly published capture responses without abandoning the wider survey.
Today the survey resumes correctly but can take many five-minute cooldowns to
return to capture's window. Do not solve that delay with more AI generation,
manually resetting the cursor, or bypassing resource admission.

| Order / option | Benefit | Cost or condition |
| --- | --- | --- |
| 1. Bounded publication-to-replay handoff | Promptly shows whether new responses produce usable pairs; no new inference needed | Requires exact source/model identity, restart-safe consumption and survey fairness tests |
| Keep current cyclic survey | No new state or migration | Small captures may remain invisible until their window returns |
| 2. Durable expiring trial allowance | A supervisor crash cannot authorize another UTC day's inference | Persisted expiry, migration and restart/cancellation tests; preserve existing recurring quotas |
| 3. Compatible Node 24 declaration patch | Updates types without changing runtime major | Review 24.19.2 separately, with install/typecheck validation |

Do not approve larger recurring work before the first handoff is demonstrated.
A shared inference provider can affect production latency even with separate
databases. If memory deferral persists, collect the evaluator's exact admission
decision and refresh-cycle evidence before choosing an optimization. The single
deferral here recovered without intervention; it does not justify weakening the
safeguard. These follow-ups are recommendations, not implemented permission or
scheduler changes in this documentation-only batch.

## Requested local rebuild and schema dump

Built without cache from clean commit `ee18970771a6cbe2afa9325c88eb59c0ed1d4056`
using `docker-compose-smart.mjs ... build --no-cache --require-provenance`.
Recreated only the local `classifarr` service with `--no-build --force-recreate
--wait`; no appdata was deleted. The resulting local image ID is
`sha256:17c7fd36cb28cba75dd6d4f87ff73ecbae78a93c647068e576dcea98cbfe30d5`, with
the matching OCI revision. This is a local image identity, not a published image
or signed provenance claim. This follow-up documentation is not a runtime change.

The container started at 21:01:40 UTC and became healthy with zero restarts/no OOM.
It retained UID/GID 1000, a read-only root, the existing appdata/media mounts and
2 GiB limit. Health returned 200; unauthenticated evaluation history returned 401.
The provider's metadata-only preflight was ready. At 21:02:30 the database still
held the five cached responses, zero configured capture limits, and five charged
calls / 42,240 reserved tokens. All ten import/backfill handoffs were complete.
No additional capture allowance was granted after restart.

After recreation, `check-schema-snapshot-container.mjs --dump` passed against a
fresh isolated database using the new image. `database/schema/current.sql` had no
tracked difference. The exact owned schema-check container and its temporary
appdata directory were removed by the runner; both removals were verified. The
running local application's database was not used for the schema dump.

## Remote CI scope

The first Resource Capacity Regression attempt for the exact commit above,
[run 37990798850](https://github.com/cloudbyday90/Classifarr/actions/runs/37990798850),
failed before its workload marker. Its log contained only
`resource_study_command_failed`, without a failing Docker stage or underlying
diagnostic. No application/resource assertion failure can be inferred from that
message. One failed-job rerun on the same source also failed before the workload;
the original failure is retained, not relabeled as a pass.

The concurrent [CI run 37990799264](https://github.com/cloudbyday90/Classifarr/actions/runs/37990799264)
provides a concrete cause for its database job: PostgreSQL test setup failed to
pull an image because Docker Hub reported the **unauthenticated pull rate limit**.
No integration suites ran in that job. Installation acceptance also failed early;
the resource/installation messages alone do not prove they share the same cause.
Remote CI is not green, despite the successful local tests and rebuild.

[Docker's official pull guidance](https://docs.docker.com/docker-hub/usage/pulls/),
discovered through MCP on October 9, recommends authenticating automated pulls and
distinguishes account pull quotas from shared-address abuse limits. The repository
has publishing credentials, but these test jobs currently pull anonymously.
Before release, address trusted-job pull authentication with a dedicated read-only
token where possible; keep PR jobs secret-free and preserve digest/version pins.
Reusing publishing credentials would be simpler but grants more privilege than
pull-only jobs need. The operator was asked to choose the credential scope; no
secret, workflow permission or registry configuration was changed in this round.
That CI prerequisite now precedes the replay-handoff recommendation above. Also
retain the missing stage diagnostic as follow-up work rather than infer a cause
from the resource runner's generic failure.

The recovery skill preserved admission, identity and quota boundaries; the
dependency skill isolated the incompatible PR and kept its gate intact. The
release-evidence skill kept local image validation separate from remote CI.
