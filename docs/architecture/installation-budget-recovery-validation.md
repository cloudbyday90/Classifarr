# Installation budget recovery validation

## Scope and outcome — September 28, 2026

Implemented the [opt-in installation budget design](installation-budget-recovery-design.md)
in the existing ESM installation drill. Production services, pool sizing, live
limits, routing and release versions are unchanged. No separate orchestrator,
runtime dependency, migration or scheduled background process was added.

Fresh-install recovery passed in a disposable Docker Compose project with the
normal application entrypoint, PostgreSQL 18.6 and all 296 migrations. Docker
settings and effective cgroup limits independently verified 2 CPUs, 128 PIDs
and 2 GiB memory. This is local dirty-checkout diagnostic evidence, not clean
CI or published-upgrade acceptance.

## Final measured run

The repeat run tested candidate image
`sha256:b126a94fa1aaad4a7a9e4a36eb368e019613444dcb3dec000cad090aecfae095`.
The launcher removed its owned image and disposable resources after verification.

| Check | Observed result |
| --- | --- |
| Fixed PostgreSQL connection limit after normal restart | 32 |
| Injector connections held / hold duration | 16 / 5.000 s |
| Admission rejection | SQLSTATE 53300 |
| Owned connections remaining after release | 0 |
| New SQL connection and HTTP health recovery | 49.1 ms |
| Normal-runtime readiness after forced crash | 6.37 s |
| Scheduler backfill/profile recovery after readiness | 28.26 s |
| Original items completed | 4 of 4; 2 movies, 2 TV items |
| Original inventory and ingestion-run identities | Unchanged |
| Music / routing tasks | Excluded / 0 |
| PID/thread observation during pressure | 66 |
| Memory observation during pressure | 296.9 MiB |
| Memory-limit events / OOM kills / PID denials | 0 / 0 / 0 |
| Owned containers, volume, network and candidate image cleanup | Passed |

These resource readings are point observations, not continuous peaks or sizing
minimums. Cumulative denial/OOM counters cover the observed container lifetime.
Connection saturation was injected server-wide using bounded direct clients;
this does not claim saturation of the application's private connection pool.
The refill lock deliberately held backfill until the crash. New connection/health
recovery occurred before the crash, and scheduler recovery occurred afterward.

An earlier run also passed (44.6 ms connection recovery, 6.35 s readiness and
54.19 s post-readiness backfill). Scheduler timing varies with its ordinary tick;
these two runs are not a throughput or percentile benchmark. Actual Docker
execution used cgroup v1; cgroup v2 is contract-tested, not locally exercised.

## Published-upgrade boundary and PR availability

Full `--resource-budget` installation acceptance returned **blocked at preflight**.
The pinned published-image attestation verification returned HTTP 401 (bad GitHub
CLI credentials). No published-baseline Docker work started. Provenance was not
disabled or replaced with a locally built baseline; the receipt explicitly marks
requested budget coverage as not verified.

GitHub MCP searches at the start and end of implementation returned no open PRs
in `cloudbyday90/Classifarr`. Therefore no random PR could be selected or applied;
no closed PR was substituted, and no PR was merged.

## Verification

| Validation | Result |
| --- | --- |
| Focused final recovery/receipt tests | 5 suites, 133 tests passed |
| Full backend unit suite | 1,520 suites, 45,850 tests passed |
| Server/client lint and type checks | Passed |
| Markdown, static ESM and strict test mock checks | Passed |
| Migration, copyright, dependency and ownership preflight | Passed |
| Fresh-only disposable runtime test | Passed twice |
| Full published-upgrade budget acceptance | Blocked by attestation authentication |

Focused tests cover resource/receipt validation, missing evidence, same-lifetime
counter regression, cgroup v1/v2 contracts, admission failures other than 53300,
leaked clients, finite attempts/timeouts, health failure, idle connection errors,
environment guards and cleanup. Host-runner tests cover fresh and upgrade budget
paths, fixed Compose limits, a single build and failure before unsafe continuation.
The restart observer retains its no-reseed/no-repair contract.

Local diagnostics remain ignored under `.tmp/installation-budget-*.log` and
`.tmp/ci/runtime-installation-acceptance.{json,md}`. The live Classifarr image and
limits were inspected read-only; it was not rebuilt or restarted for this task.
It remained healthy on image
`sha256:8c2fe703d58e4784b2ef153aa11377e1bce125e720eb62707311fd042aa7625e`
with the same 2 GiB memory limit and no CPU quota or PID cap. Other running
containers were not changed. No release was created.

## Recommendation and next step

Retain the existing scheduler, ownership/checkpoint protocol and PostgreSQL pool,
with this opt-in acceptance gate. Benefit: concrete fault/recovery evidence without
new production machinery. Limitation: four synthetic items and a single host do
not establish long-term capacity, leak freedom, provider behavior or upgrade safety.

Next: restore GitHub CLI authentication and run
`node scripts/run-runtime-installation-acceptance.mjs --resource-budget` from a
clean checkout. Require both fresh and published-upgrade recovery before proposing
live CPU/PID caps. Do not repeat the completed capacity comparison or deploy the
test's 32-connection database setting as a production recommendation.
