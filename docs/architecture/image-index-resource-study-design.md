# Image-index repair resource study

Follow-up: [capacity-aware admission](image-index-capacity-admission-design.md)
adds an independently enforced `--image-index-capacity` experiment (4 GiB,
2 CPUs, 128 PIDs) and captures the acknowledged build workspace. The original
`--image-index` profile remains 2 GiB. The original design below records the
baseline studied before the capacity policy; deadlines and retry limits remain
unchanged in the follow-up.

## Decision and scope

Measure the existing compatible image-index worker before changing production
limits. Extend the disposable resource-study launcher with `--image-index`;
do not add a production timer, dependency, migration or deployment setting.
The study exercises fixed manual claims through the real worker/executor, not
the automatic admission policy or the application's queue dispatch path.

Run sequential builds over 1,000, 10,000 and 50,000 deterministic synthetic
2,000-dimensional vectors. At 1,000 rows, also interrupt a concurrent build
while it waits for a synthetic writer, verify the invalid index, rotate the
claim and attempt recovery. Preserve data and verify both catalog validity and
queue acknowledgement. An incomplete build is a measured capacity outcome,
not a passing repair or permission to increase its budget.

## Boundaries

- Reuse the random, collision-checked Compose project, immutable candidate image,
  fresh named volume, internal network, non-root identity and 2 GiB limit.
- Seed only after the disposable marker, fixed database identity, restore-mode
  environment and empty installation checks pass. No live container or host data.
- Keep production SQL/lock/process deadlines, 64 MiB maintenance work memory,
  zero parallel maintenance workers and claim fencing unchanged.
- Execute only the three code-owned image-index definitions. No supplied SQL,
  paths, providers, vectors or arbitrary row counts are accepted from the CLI.
- Stop and join children on failures. Check PostgreSQL work has ended separately:
  a Node exit alone does not prove that its database command has stopped.
- Cleanup only owned resources. Report success only after cleanup verification.

## Measurement and interpretation

Use bounded, sequential sampling. Record elapsed time, container CPU and raw
cgroup memory, probe RSS, child RSS, PostgreSQL backend RSS, catalog outcomes
and sampled build-phase/wait categories. Missing process observations remain
unavailable, never zero. PostgreSQL RSS can include shared mappings; do not add
it to child RSS or equate cgroup cache with a leak. Sample counts are not exact
wait durations, total-job percentages or statistical confidence intervals.

The small interrupted-build case is a deterministic recovery check, not proof
of large-build recovery under mixed production load. Synthetic vectors measure
execution cost, not search recall or AI quality. Repeat on representative hosts
before making deployment recommendations.

## Official research and alternatives

Sources were discovered through the online tool and consulted on 2026-10-01
for the requested September 2026 baseline; these are live documents, not archived
September snapshots.

| Option | Benefit | Cost or limitation | Decision |
| --- | --- | --- | --- |
| Measure current bounded worker | Comparable to shipped behavior; no new privileges | Can expose incomplete large repairs | Implement |
| Raise memory/time immediately | Could shorten or finish builds | Unmeasured host pressure and longer occupancy | Defer |
| Change vector/index representation | Potential size/build savings | New recall and compatibility validation | Separate evaluation |

[pgvector's index guidance](https://github.com/pgvector/pgvector/blob/master/README.md)
explains that HNSW builds slow when the graph exceeds maintenance work memory;
it cautions against exhausting server memory. Keep current parameters while
measuring rather than choosing a larger memory limit from a generic example.

[PostgreSQL 18 progress reporting](https://www.postgresql.org/docs/18/progress-reporting.html)
distinguishes build, validation and transaction-wait phases. Report those states
separately instead of treating every active build as CPU-bound work.

[Docker stats documentation](https://docs.docker.com/reference/cli/docker/container/stats/)
explains why CLI memory differs from raw usage counters. Label the measurement
scope explicitly; raw container memory includes cache and other processes.

[W3C table guidance](https://www.w3.org/WAI/tutorials/tables/caption-summary/)
supports concise table context and clear structure. Generated Markdown uses
descriptive headings and unit-bearing headers, with textual outcomes rather
than color-only meanings. This is not a new UI or a WCAG conformance claim.

## Recommendation stack

1. Keep fixed worker boundaries and safe invalid-index recovery.
2. Add reproducible, isolated capacity evidence with honest incomplete outcomes.
3. Use measured bottlenecks to select the next change; do not widen retries.
4. Validate any later budget or index change under mixed workload and repeated runs.
