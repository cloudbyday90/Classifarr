# Resource capacity regression gate

## Decision — 28 September 2026

Extend the disposable resource study into an automated correctness gate. The
previous soak exercised admission refusals but its queue was empty during the
pressure interval. That cannot establish preservation or recovery of queued work.
This change must prove that real durable metadata tasks wait, survive and resume.
It does not change production limits, routing, schema or release version.

## Recommendations and tradeoffs

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Short isolated CI test | Repeatable regression detection on every PR | Docker build and about two minutes of work plus drain | Default gate |
| Larger synthetic vector corpus | Exercises transport, worker memory and evaluation at 6,700 rows × 768 dimensions | Slower; synthetic vectors do not measure AI quality | Opt-in capacity profile |
| Tight CPU / RSS thresholds | Detects small performance changes | Shared runners and caches make absolute thresholds noisy | Report measurements; enforce safety and recovery invariants |
| Change live CPU/PID limits now | Limits resource exposure | May starve database, ingestion or recovery without evidence | Defer production tuning |

## Protocol and boundaries

Use the existing guarded, randomly named disposable Compose project, fresh
database, internal network, read-only root and 2 GiB memory ceiling. No live
volumes, provider credentials, published images, release creation or deployment.

Keep bounded ingestion, source outage, profile refresh and real evaluation
threads. Use 768-dimensional deterministic vectors. Smoke uses 400 evaluation
rows; capacity uses 6,700; this is evaluation-corpus size, not durable inventory
size. Preserve the separate 30-minute soak command.

At pressure onset, deny new admissions and wait for already admitted queue
operations to settle. Enqueue a bounded cohort of real metadata tasks for existing
synthetic inventory, balanced across all four libraries and both media types.
Record their IDs only within the process. Repeatedly verify
all remain pending with zero attempts during pressure. At pressure clearance,
start a monotonic clock; observe actual processor entry, not an empty dequeue or
permit acquisition. Require first dispatch within 30 seconds, every cohort task
completed exactly once, and completion within the bounded 120-second recovery
window. Fail if the hold interval was missed or too short.
The queue's `attempts` field counts failures rather than starts; the independent
processor-entry observer detects duplicate or premature dispatch. Completed tasks
must contain successful enrichment results, not a skipped-work result.
First dispatch is timestamped at processor entry; completion is observed at the
next approximately two-second poll, so the completion duration is an upper bound.

Continue requiring outage preservation, complete ingestion/backfill, current
profiles, no failed/routing tasks, no OOM or memory-limit events, and no leaked
permits. Metrics unavailable means failure, not a fabricated zero. Receipts carry
an explicit profile and version so old smoke evidence cannot satisfy this gate.

## CI security and evidence

Use a separate GitHub-hosted workflow for pull requests, pushes to main and manual
runs. Read-only repository permissions, full-SHA action pins, checkout credential
persistence disabled, no secrets, no privileged PR trigger, bounded job timeout,
and per-ref concurrency control. Manual capacity selection is an allowlisted
choice; no user-provided shell command, path or image.

The launcher cleans only its verified-owned project and image. Ordinary failures
must still clean up. Forced runner termination cannot promise in-process cleanup;
ephemeral hosted-runner disposal provides the outer boundary. Do not run this
workflow on persistent self-hosted runners. Publish only explicit aggregate JSON
results, never raw logs, database dumps or the entire hidden `.tmp` directory.
This workflow is a failing CI check; configuring it as a required branch-protection
check is a separate repository setting, not changed here.

Run `node scripts/run-resource-study.mjs --smoke` for the default two-minute
workload, `node scripts/run-resource-study.mjs --capacity` for the five-minute
larger-corpus workload, or omit the flag for the 30-minute soak. Build/startup,
settlement and up to two minutes of final drain are additional. Each workload
command has an outer deadline of its nominal duration plus three minutes.
Passing v2 receipts are emitted only after worker settlement, container health
and owned-project cleanup; failures cannot publish a passing receipt.

## Official sources researched

- [GitHub secure use reference](https://docs.github.com/en/actions/reference/security/secure-use):
  least-privilege tokens, immutable action pins and untrusted-input precautions.
- [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax):
  event filters, explicit permissions, timeouts and concurrency controls.
- [GitHub concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency):
  avoid redundant concurrent runs for the same ref.
- [GitHub artifact action contract](https://github.com/actions/upload-artifact/blob/main/action.yml):
  explicit file patterns, retention and hidden-file opt-in for the narrowly
  selected aggregate receipt under `.tmp`, not the entire directory.
- [Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints):
  container limits and their operational implications; no CPU quota is not proof
  of adequate CPU capacity.
- [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/):
  preserve readable text/data equivalents when presenting measurements. This
  change uses labeled numeric results and tables; it adds no chart-only UI.
- [Node timer cancellation](https://nodejs.org/api/timers.html):
  promise-based timers support AbortSignal cancellation, providing a standard
  building block for a future bounded queue wakeup with a polling fallback.

Sources were discovered through online search and checked on 28 September 2026.
The thresholds above are engineering acceptance choices, not limits prescribed
by those sources.

## Final recommendation stack

1. Enforce queued-work preservation and bounded recovery in every short CI run.
2. Exercise representative vector dimensions and an opt-in larger corpus.
3. Keep raw CPU, memory, event-loop and backlog evidence for trend analysis.
4. Based on the larger run's 106-second final drain, evaluate
   [bounded completion-driven queue wakeups](queue-completion-wakeups-validation.md)
   with polling fallback. Keep concurrency, provider controls, retry dates and
   memory admission unchanged; compare drain time and verify wakeup/lifecycle races.
5. Compare explicit CPU/PID limits only in the isolated topology before proposing
   a production default, including ingestion and database recovery under load.

See the [separate validation outcome](resource-capacity-regression-validation.md)
for measured results and limitations.
