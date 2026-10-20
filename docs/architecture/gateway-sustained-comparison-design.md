# Sustained archiving on/off comparison — design

Agreed through grill-me on 2026-10-20: four local synthetic arms in off/on/on/off
order, diagnostic latency rather than a numerical production latency gate, strict
correctness, and a newly coordinated quiet window after preparation. Allow roughly
2½ hours: traffic plus idle alone takes 124 minutes, before setup/restores/cleanup.
Normal applications stay running. No Unraid, Plex or shared Ollama changes.

## Question and controlled inputs

Measure the impact of current archiving and restore verification on the same
synthetic gateway inference workload, not two archiving algorithms or real model
capacity. Preserve existing regression/extended entry points. Add only a fixed
comparison study with sealed `comparison-off` and `comparison-on` profiles; never
accept caller-defined providers, durations, SQL targets, mounts or resource limits.

Each fresh isolated arm gets identical prerequisite archive/restore preparation,
3,000 failed historical jobs with deterministic varied 75,000-byte padding, the
same 1,980-arrival plan and fixed 650 ms synthetic provider. UUIDv7 IDs/timestamps
and physical storage can differ; require matching shape/plan, not identical
databases. Off means no archival workers **during measurement**, not skipping
prerequisite verification or disabling any production service.

Keep 30 minutes traffic, then 60 seconds idle; two foreground arrivals per two
seconds, 50 ms apart, one expected busy background arrival every fifth pair.
Retain four client slots, 500 ms lateness cutoff, 1,800 foreground successes,
180 expected background 429 responses, unique fingerprints/UUIDv7 IDs, provider
concurrency one, and no retry/catch-up. No failed/dropped/unexpected responses.

On retains existing 60-second before, 1,680-second archive-loop and 60-second
after phases, actual dump/restore overlap, two verified catalog roots at attempt
one, unchanged failed-history digest/bytes, original budgets and zero cleanup
operations. Worker shutdown is not instantaneous at the after marker; do not call
that phase a clean inference-only baseline. Off requires no loop workers, no
catalog jobs/roots or managed archive connections/transactions during measurement,
and the same request/history/idle correctness. Absence is a positive control,
not a waiver of missing co-load evidence. Preparation-only workers are removed
before either comparison workload starts.

## Observations and completion

Retain bounded source/database/worker sampling and original coverage rules. Add
fixed one-minute request summaries and overall distributions, with foreground and
expected-busy populations separate. Report p50/p95/p99/max, exact counts,
generator lateness and pre-claim/SQL-claim durations; identify the worst synthetic
request using only fixed numerical/role fields, not bodies or credentials.
Minute quantiles are not averaged to construct overall quantiles. The same
offered slots define each minute in every arm; counts and plan digests must match.
Small per-minute populations limit percentile precision. Bins can reveal short
stalls but are not exact dump/restore-window causal attribution.

Return a bounded, validated arm result only after exact-owned cleanup. Require
correct inference, full history preservation and treatment-specific archive
progress/absence. Keep legacy return behavior unchanged. A successful result
means correctness-qualified diagnostic evidence, **not** latency acceptance,
comfortable headroom, leak freedom or production Ollama capacity. Keep missing
optional PSI/device-I/O metrics unavailable, never zero; do not add new privileged
telemetry or reinterpret memory charging events as disk traffic.

Reuse the read-only host endpoint observation before the study and after each
arm's verified cleanup. Preserve the first baseline. On changed/unavailable
observations, retain completed correctness reports, mark timing inconclusive,
stop remaining arms with nonzero exit and do not retry. Fixture/cleanup failure
retains its original error. No broad label exclusions or foreign cleanup. Matching
endpoints do not exclude short-lived work, live-restored daemon restarts,
resource/configuration changes, host/VM contention or cache evolution; coordination
and cautious interpretation remain necessary. No new persisted scheduling state
or automatic run/resume is added.

Source: 2 GiB/no swap/2 CPUs/512 PIDs. Archiver: 256 MiB/no swap/0.5 CPU/32 PIDs.
Verifier: 1.5 GiB/no swap/1 CPU/64 PIDs. Preserve operation/SQL timeouts, attempts,
cooldowns, read-only roots, UID 1000, dropped capabilities, no-new-privileges and
network isolation. Only restricted archiver workers receive the source socket;
verifiers get neither source credentials nor Docker socket. No HTTP inside new
database transactions, cache flush, forced GC, clock edits or raised limits.
No new tables/identities; all existing ledger/job UUIDv7 checks remain intact.

## Official research and tradeoffs

Discovered with MCP search/navigation and opened on 2026-10-20:

- [Google SRE monitoring](https://sre.google/sre-book/monitoring-distributed-systems/?hl=hr):
  observe latency, traffic, errors and saturation; short-window tails expose
  effects hidden by averages. Our fixed minute summaries are a bounded application
  of this guidance, not sufficient statistical proof.
- [Google SRE objectives](https://sre.google/workbook/implementing-slos/?hl=it):
  objectives should reflect user experience. A fixed-delay synthetic provider is
  not evidence for choosing a production LLM latency objective.
- [Grafana open arrivals](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/)
  and [dropped iterations](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/dropped-iterations/):
  keep offered work independent of completion and expose drops. Reuse the existing
  ESM driver, without adding k6 or rescheduling missed work.
- [NIST blocking](https://www.itl.nist.gov/div898/handbook/pri/section3/pri332.htm?trk=article-ssr-frontend-pulse_little-text-block):
  control nuisance factors where possible. Balanced order and repeated treatments
  reduce some order sensitivity; two repetitions are still exploratory.
- [PostgreSQL transaction characteristics](https://www.postgresql.org/docs/18/sql-set-transaction.html):
  repeatable-read snapshots are transaction-scoped; SQL read-only is not a promise
  of no disk writes. Preserve current private transaction/restore contracts.

| Option | Benefit | Cost / decision |
| --- | --- | --- |
| Four balanced off/on arms | Independent controls and repeated observations | About 2½-hour quiet window; selected |
| One matched pair | Faster first comparison | No treatment repetition, more order sensitivity |
| Existing 60-second phase controls | No harness changes | Different duration and shutdown overlap; insufficient standalone baseline |
| Diagnostic latency with strict correctness | Exposes distributions without inventing a production SLO | Cannot certify a numerical latency budget; selected |
| Numerical latency acceptance | Clear deployment decision once meaningful targets exist | No agreed real-workload objective yet; deferred |

Recommended stack: fixed matched profiles → sealed source/image identity →
native regression → coordinated window and endpoint guard → four sequential arms
with real restore/absence proof → bounded tail/progress evidence → verified
cleanup → backed-up local Compose evaluation. Further production optimizations
require evidence beyond this synthetic comparison.

## Verification and delivery

Test fixed plan/minute boundaries, malformed/missing/duplicate populations,
distributions, worst-request privacy, strict baseline absence versus co-load
progress, source/bootstrap profile and argument rejection, original regression
behavior, stop-after-cleanup/no-retry and failure preservation. Run gateway tooling,
ownership/preflight, affected ESM/lint/type checks and exact no-cache native image
regressions before measurement. Do not build/test concurrently with the study.
Record observations in a separate outcome, update Unreleased, commit/push on main;
no branch, release or version bump. Back up normal local appdata before replacing
its container; never run study SQL against it.

At planning, MCP listed only PR #568, already adopted locally with exact ESLint
10.13.0 and reviewed parser metadata. Do not reapply it or call it a new PR change.
Recheck current open PRs before handoff and review any genuinely new selection.
