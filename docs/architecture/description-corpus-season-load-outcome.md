# Description corpus timeout and season-load outcome

November 24, 2026. See the [design and tradeoffs](description-corpus-season-load-design.md).

## Docker incident

The embedded PostgreSQL log recorded a statement timeout on the inventory
corpus SELECT at 6:59:16.931 p.m. EST on November 23. The matching scheduler
record followed at 6:59:17.053 p.m., in `corpus_read`, with SQLSTATE
`57014` and 16.107 seconds of elapsed transaction work. The repository uses a
15-second statement deadline and a two-second lock deadline. The observed
wall time includes the surrounding database operation. The stage precedes
embedding-provider creation.

The recovery warning scheduled a 69-second cooldown. The same incident
reference appeared in the caught-up message at 7:01:03.851 p.m. EST. The
retained records showed no later failed description-refresh run through the
November 24 inspection. The container and data were inspected read-only.

## Isolated study

The existing profiler now includes typed season documents in a third
synthetic workload alongside both history-fallback baselines. Revoked, expired
and evidence-only fixture controls check exclusions. The study counts only
the known corpus statement when sampling simultaneous owned PostgreSQL
sessions. A canonical document fingerprint lets same-key SQL ties vary while
detecting content and membership changes in repeated reads.

The full-size study used PostgreSQL 18.6 in an inspected disposable container
with 1 GiB memory, two CPUs, 256 PIDs, and a loopback-only ephemeral port.
Every paired cycle observed two simultaneously active corpus SELECTs.
Each fixture retained its fingerprint across repeats and after lock release.

| Workload | Rows | Single reader | Paired readers | EXPLAIN execution |
| --- | ---: | ---: | ---: | ---: |
| Sparse history fallback | 6,487 | 159–174 ms | 192–491 ms | 99 ms |
| All history fallback | 6,487 | 159–186 ms | 235–588 ms | 86 ms |
| Sparse fallback plus 650 active season mappings | 9,087 | 214–239 ms | 255–782 ms | 140 ms |

The season workload expanded 2,600 eligible documents and read 1,339
temporary blocks in the instrumented SELECT, compared with 501 in the sparse
baseline. Ordinary JavaScript preparation took up to 391 ms in that workload.
The query used the existing 15-second limit throughout. The deliberate
held-lock controls returned `55P03` at the existing two-second lock limit.
Schema and container cleanup were verified.

The production SELECT's SHA-256 matched the October study. The static
ownership review updated only the three modified profiler fingerprints and
kept their existing offline classification. No database schema or scanner
policy changed.

## Recommendation

Keep the current query and limits. These warmed synthetic runs test the
season join and paired reads but exclude the deployed worker mix, pool
pressure and real workload history. The database log proves the deadline was
hit during the incident. This study does not establish the underlying
bottleneck. If the timeout recurs, measure the actual workload mix and
bounded wait categories before deciding on a query, index or resource change.
