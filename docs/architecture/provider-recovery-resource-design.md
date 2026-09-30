# Provider recovery resource study — design

Date: 2026-09-30. Follow-up to [durable optional-provider outcomes](optional-provider-outcomes-outcome.md).

## Decision and boundaries

Extend the existing isolated resource study, not the production scheduler. Version
6 measures real retry completion alongside resource use. Version 5 rolled claims
back and used no-op optional providers; its task throughput was not unique-item
throughput. Keep its standalone database regressions, but do not compare its
resource receipts directly with version 6.

The bulk movie/TV ingestion workload uses synthetic successful optional metadata
through the real task processor. A separate eight-item cohort, balanced across
four libraries and movie/TV, uses loopback HTTP through the production OMDb
lookup, quota, pacing, retry candidate, claim and fenced persistence code.
These are different measurement populations, explicitly labeled in reports.

## Fault sequence and evidence

1. Begin with exhausted synthetic local quota. Repeated passes must preserve
   pending rows and attempt counts without HTTP.
2. Simulate a completed quota day in the disposable configuration. The next
   request returns HTTP 401; the real credential-rejection gate must stop work.
3. Inject resource pressure. No retry may dispatch during that window.
4. Repair the exact synthetic key through the existing generation trigger.
   Return one HTTP 429 with Retry-After, then one HTTP 503. Honor real persisted
   cooldowns and jitter; never rewrite retry deadlines to speed up the study.
   Allow a bounded four-minute drain: successive failures on one item can wait
   up to 60 and 120 seconds under the existing exponential-backoff policy.
5. Return type-correct results. Require eight distinct items with persisted
   evidence, eleven HTTP requests total, two charged retry attempts, no remaining
   retry work and no claims left held. Drain without disabling the provider.

The quota-day boundary and credential repair are explicit test actions, not
automatic account repair or wall-clock rollover claims. No live key is tested.
The retry service is driven by one non-overlapping, admission-controlled study
loop. This measures processing, not scheduler restart behavior. The established
installation drill remains responsible for lifecycle recovery tests.

## Isolation and resource control

Reuse the owned Compose launcher: unique project, initially empty inventory,
private volume, internal network, no published ports or host mounts, 2 GiB memory
ceiling, read-only filesystem and no elevated privileges. Validate Docker and
cgroup budgets after both starts and throughout sampling. Cleanup is restricted
to the validated owned project; no prune or live-container replacement.

The HTTP fixture binds only ephemeral IPv4 loopback, admits fixed synthetic
requests, limits connections/headers/request time and has a 32-request budget.
All processing loops are joined and the listener closes on success or failure.
The provider fixture refuses ordinary environments before mutation or listen.
Only aggregate counters/timings enter generated Markdown, never keys, IDs, titles,
upstream bodies or arbitrary text. No new dependency, schema or public API.

Small ESM modules separate fixture database operations, HTTP behavior, orchestration
and receipt validation. New mutation paths remain part of the source-review gate;
this does not reclassify unrelated unresolved ingestion writers as safe.

## Official research and application

Sources discovered through search and opened on 2026-09-30:

- [AWS: control and limit retry calls](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_mitigate_interaction_failure_limit_retries.html)
  recommends bounded backoff/jitter, testing failure scenarios, and avoiding
  layered retry amplification. Application: queue-owned single HTTP attempts and
  production persisted waits, rather than a new retry mechanism.
- [IETF RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines Retry-After
  and temporary service unavailability. Application: exercise a real header and
  HTTP failures, not a successful response containing a fabricated failure flag.
- [Docker networks](https://docs.docker.com/reference/compose-file/networks/)
  defines internal network isolation; [Compose services](https://docs.docker.com/reference/compose-file/services/)
  defines service resource limits. Application: reuse the private topology and
  verify actual enforcement rather than assuming YAML means enforced limits.
- [W3C WCAG 2.2 status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages)
  explains accessible status updates. This change is CLI/report-only, not a new
  dashboard. Reports retain headings, explicit quantities and table headers.
  A future visual status display must retain textual equivalents and avoid
  announcing every poll or relying only on color. No WCAG conformance claim.

## Options and recommendation stack

| Option | Benefit | Cost / limitation | Decision |
| --- | --- | --- | --- |
| Rollback-only retry co-load | Fast SQL contention regression | Cannot establish successful recovery | Retain standalone tests, supersede resource measurement |
| Isolated HTTP faults plus actual retry persistence | Measures bounded attempts, waits and successful settlement without provider spend | Adds real cooldown time; small synthetic cohort is not production capacity | Implement now |
| External provider load testing | Captures network/account behavior | Quota, privacy, nondeterminism and operational impact | Not authorized or needed here |
| Lower live CPU/PID/memory limits immediately | Immediate ceiling | Can hide unfinished work or starve ingestion | Do not change live limits |

Recommended stack: existing resource admission → real durable retry gates →
bounded loopback fault transport → unique-completion and wait assertions →
cgroup/process measurements → repeated matched observations before limit changes.

## Validation and next decision

Run transport/receipt/lifecycle regressions, a disposable PostgreSQL test with
real cooldowns, and the owned Compose smoke/capacity study. Run repository quality
gates and retain aggregate results in the separate outcome document. Historical
v5 observations remain historical; current comparisons require v6 receipts.

Next: use repeated matched v6 observations to decide whether a larger, separately
bounded web-search fallback cohort is warranted. Do not expand into automatic
production tuning or claim model accuracy from synthetic vectors.
