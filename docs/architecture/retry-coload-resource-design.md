# Retry co-load resource rehearsal: design

Date: 2026-09-30. This extends the existing isolated resource study, not the live
scheduler. No release or production resource-limit change is included.

## Gap and decision

The mixed-workload harness already runs movie/TV ingestion, metadata backfill,
profile refresh and real synthetic-vector evaluation. Its OMDb/web enrichment
adapters are no-ops, however: previous memory/CPU results did not include retry
discovery or claim SQL. Add that database co-load before interpreting the latest
idle-only deployment check as capacity evidence.

Reuse the existing fresh disposable database, internal Docker network, 2 GiB
memory ceiling, synthetic providers, fixed CPU/PID comparison and verified
owned-resource cleanup. Do not import live data, use real credentials, contact
providers, restart production, or add a new orchestration framework.

## Protocol

- Seed 60 retry records from real study-ingested items across all four libraries,
  balanced across OMDb, web search and legacy Tavily. This is comparable in count
  to the observed 51 pending web-search/Tavily records, not a large-backlog test.
- Each type has five normally due, five same-generation waits, five waits whose
  item deadline changed, and five legacy waits without provenance.
- Run one bounded, non-overlapping retry pass about every two seconds alongside
  the existing producers, metadata worker and evaluation loop. Honor the existing
  queue-class resource admission; injected pressure must defer the co-load too.
- Each pass runs actual dispatch/page SQL and one actual ID-targeted claim per
  type. Roll back each claim in a short savepoint, verifying that all queue fields
  remain unchanged. Counts represent repeated database exercises, not completed
  enrichment or distinct items. No provider admission, HTTP or result persistence
  is simulated as successful.
- During recovery rotate only synthetic credentials. Assert exact eligible IDs
  before and after rotation; changed-deadline and legacy waits remain protected.
  The recovery claim must target a newly eligible wait, not only already-due work.
- Join the retry loop before settled-idle observation. Bound database statements,
  passes and retained timings. Missing phase/type coverage, leaked claims,
  unexpected eligibility, pressure dispatch or stale receipts fail the study.
- Active synthetic OMDb configuration also generates repeated metadata-enrichment
  demand: its no-op adapter deliberately does not pretend to supply missing
  provider results. Consequently task completions are attempts, not unique items
  or successful OMDb responses, and exceed the old fixed 1,620 count. Capacity
  runs still require all 1,600 inventory items and the held 20-task cohort to
  complete. Compare only this v5 closed-loop protocol across budgets, not v4
  throughput. After joining retry work, disable only the exact synthetic provider
  configurations before drain/idle; preserve all pending retry records. This is
  quiescing test demand, not evidence of successful provider recovery.
- Version the study receipt so old no-retry evidence cannot pass as this protocol.
  Generated Markdown shows labeled aggregate counts and milliseconds, never IDs,
  credentials, titles or raw responses.

## Official research and tradeoffs

Sources were discovered/read through connected web tools on September 30, 2026.

[Docker resource constraints](https://docs.docker.com/engine/containers/resource_constraints)
recommend measuring requirements and explain hard memory/CPU controls. The study
compares the existing uncapped baseline with bounded candidates; it does not
derive a safe production default from one synthetic run.

[Node 24 command-line documentation](https://nodejs.org/download/release/v24.17.0/docs/api/cli.html)
defines old-space as only part of process memory. The deployed runtime remains
24.18.1; this reference documents the already-supported heap option, not a
runtime upgrade. PostgreSQL and non-heap memory must also fit the container.

[PostgreSQL 18 resource settings](https://www.postgresql.org/docs/18/runtime-config-resource.html)
explain that query operations and parallel workers can multiply memory use.
Measure the combined container rather than summing shared PostgreSQL RSS pages.
[Docker metrics](https://docs.docker.com/engine/containers/runmetrics/) and the
[stats reference](https://docs.docker.com/reference/cli/docker/container/stats/)
distinguish raw cgroup accounting from Linux CLI cache-adjusted memory. Keep
those measures labeled and do not compare them as identical quantities.

[W3C table guidance](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
supports descriptive context and headings. Use a short titled aggregate table
with explicit units and text outcomes; no color-only status or new dashboard.
This does not claim an application-wide WCAG audit.

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Extend the existing ESM study | Measures competing real database paths with ingestion/evaluation | Synthetic, service-driven timing | Selected |
| Rollback claim exercises | Repeatable load; verifies no leaked ownership or mutated waits | WAL/cache effects remain; not provider/completion throughput | Selected and labeled |
| Call real providers | More realistic network/inference load | Credentials, costs, nondeterminism and external effects | Excluded |
| Set live CPU/PID caps now | Immediate hard boundary | Risk of slower recovery or thread/process denial without representative evidence | Deferred |

## Recommendation stack

Existing isolated Compose topology → ESM bounded co-load → production retry SQL
and claim guards → cgroup/process/backlog observations → versioned aggregate
receipt → matched budget comparison. Retain production safeguards and limits
until representative recovery evidence justifies tuning. Record measured outcomes
and the next evidence-backed component in a separate outcome document.
