# Gateway history query outcome

## Result: query and full local study passed

The narrow query passed exact reference equivalence and the original four-second
limit. The same no-cache image passed the eight-minute regression, complete
30-minute varied-history load plus one-minute idle observation, and separate
three-cycle real-restore rotation. Limits and integrity checks were not relaxed.

## Scope and identities

Implemented on main on 18 October 2026. The
[design](gateway-history-query-design.md) records the approved diagnostic lane,
official PostgreSQL research, alternatives, safeguards and verification contract.
This follows the [previous blocked study](gateway-extended-study-outcome.md);
its failed results have not been relabeled as passing evidence.

| Subject | Exact identity |
| --- | --- |
| Baseline main / fixed reference SQL | `acea8e51ec4b3d0e5352454864cdf5351940bb97` |
| Previous failing image source | `410a0276f1c9dee9c45f085f0c816a869f8fc24f` |
| Previous failing local image | `sha256:24577b34af9532c6312a151d4d41cc3ae68890b1c1a1345f171120ae56bd5f50` |
| Implemented source | `ced59b14b6b3e77843bb35716bf615807762487d` |
| No-cache candidate image | `sha256:bb5ae10262451bc9f91b6f0282d4c6a8f7793fa48d54de24c0d24156dd8ea441` |

The candidate was built from clean source with required provenance and protection
of the running image. Its inspected revision label matches the implementation.
These are local Docker image IDs, not registry manifest, signed provenance or
multi-platform acceptance claims. This outcome is a later documentation change.

No release, tag, PR merge, Unraid/Plex/shared-Ollama change or live recovery was
performed. Rehearsal provider traffic is synthetic and isolated. No new table, schema,
identity, purge control or authority was added; existing UUIDv7 checks remain.
GitHub MCP enumerations found no open PRs, so none could be randomly implemented.

## Measured cause and equivalent fix

The old query carried a whole-job value through its complete-history scan and
join/sort before conditional evidence hashing. With 3,000 varied failed-history
records, actual plans showed substantial shared-buffer fetches and execution
time. Both sorts stayed in memory: **a disk-sort spill was not the cause shown by
these measurements**.

The new fixed ESM query materializes only the required scalar metadata first,
then computes the unchanged complete-row canonical fingerprint for eligible
records in the same SQL statement/snapshot. It does not trust a stored manifest
hash or cache evidence between assessments. Protection JSON, all statuses,
native timestamps, ordering, fields/types and count/byte accounting remain equal.

The first diagnostic used the previous failing image. Its old/current query was
identical to the reference: reads took 4,530–6,732 ms and its separate four-second
probe failed. The runner exited nonzero and verified cleanup. That result is a
failure reproduction, not a performance acceptance.

The candidate diagnostic compared reference/current/current/reference in one
restricted read-only repeatable-read session, outside HTTP load:

| Observation | Reference | Candidate |
| --- | ---: | ---: |
| First raw query (ms) | 6,340.572 | 58.504 |
| Second raw query (ms) | 6,052.725 | 37.759 |
| Backend CPU ticks, first / second | 116 / 107 | 4 / 3 |
| Actual plan execution (ms) | 5,416.159 | 26.833 |
| Plan root shared hits / reads | 8,405 / 29,312 | 294 / 137 |
| Plan root temporary blocks read / written | 0 / 0 | 0 / 0 |

All 3,001 raw metadata rows and the exact 1,998,043-byte accounting were equal.
The candidate's separate four-second probe passed in 44.309 ms. The session stayed
within the diagnostic-only 60-second deadline and owned-resource cleanup passed.
The fixture contained 233,849,324 canonical failed-history bytes; physical TOAST
storage was 242,466,816 bytes, total relation storage 245,874,688 bytes.

Plan counters are inclusive; child values must not be summed. Shared reads mean
PostgreSQL buffer fetches, not proof of physical disk reads. `ANALYZE` and output
serialization add diagnostic overhead; these few observations are not a general
speedup guarantee. See the official
[EXPLAIN documentation](https://www.postgresql.org/docs/18/sql-explain.html),
discovered/opened through MCP on 18 October 2026, and the design's linked CTE,
SELECT and TOAST documentation.

## CI repair without reducing safeguards

The baseline main
[run 39159982318](https://github.com/cloudbyday90/Classifarr/actions/runs/39159982318)
failed five tests in three suites. Its database and installation jobs passed;
that did not make repository validation pass.

- Added the existing gateway tooling gate to the preflight expectation, including
  its failure-propagation coverage.
- Classified seven standalone archive/cleanup example settings as deferred
  operator configuration. The application still rejects them rather than
  forwarding file, database or Docker authority.
- Replaced the flagged fixed SQL interpolation sites with complete fixed
  statements/closed vocabulary and parameterized values. Denial probes and
  restore guard ordering remain intact. The scanner was not disabled or given a
  blanket exception.

Reviewed the changed verifier, loader, query and callers individually; pinned
the two new SQL helpers and renewed only their affected ownership records. The
review cap, unresolved ownership debt and fail-closed production-compatibility
classification remain unchanged. Non-SQL helper drift is also tested.

## Completed source and native checks

- Full backend CI coverage: 1,874 suites, 60,216 passing tests, one skipped.
  Statements/lines 89.18%, branches 86.45%, functions 90.74%.
- Full frontend coverage: 476 files, 7,369 passing tests. Statements 87.79%,
  branches 81.84%, functions 87.50%, lines 89.47%.
- Coverage ratchet passed for both reports. The focused four-suite CI repair
  run passed 36,334 tests; gateway Node tooling passed 23 tests.
- Real disposable PostgreSQL integration: four suites, 62 tests passed. These
  retain exact row/byte and 128 KiB detail boundaries, tamper, cancellation,
  deletion and microsecond checks, plus raw reference/candidate equality across
  every status, NULLs, ties and changed complete protection metadata.
- Ownership/preflight, copyright, both Knip modes, lint, types, ESM/mock-shape,
  syntax, Markdown, whitespace and staged secret checks passed for the source.
- The exact candidate passed full online archive/catalog/retention refusals,
  actual restricted restores and mixed v6/v7 scheduling handoff/quiet checks.
  Scheduling observations are simulated; capture/restore and replacement are
  real. No claim is made that a daily interval elapsed.
- All three separate rotation cycles passed: seven historical inference archive
  jobs and eight catalog jobs remained; six roots retired and two retained.
  Attempts progressed 3 → 5 → 7. Obsolete files were removed and old pins released
  only after the required replacement proof. No cleanup operation was created.
  Every completed native rehearsal verified its owned-resource cleanup.

Detailed local logs are ignored, regenerable `.tmp/history-query-*.log` files.

## Load study and local rollout

The unchanged eight-minute regression passed on the exact candidate: 480
foreground successes, 48 expected busy responses, 480 distinct fingerprints and
UUIDv7 load identities, and two verified catalogs at attempt 1. Final admission
and binding counts were 481 including the prerequisite, with no active request
and zero cleanup operations. Dump windows overlapped four/five admissions and
restore windows overlapped four/two. Owned-resource cleanup passed.

| Regression phase | Request p95 (ms) | Pre-claim p95 (ms) |
| --- | ---: | ---: |
| Before | 1,291.637 | 620.746 |
| Archives active | 1,267.627 | 609.209 |
| After | 1,263.694 | 606.684 |

Maximum arrival lateness was 7.258 ms. Source lifetime peak charge was 368,254,976
bytes; the loop verifier's was 690,069,504 bytes. The loop archiver's lifetime
peak reached its exact 268,435,456-byte cap without recorded OOM/limit events.
That is not proof of spare headroom: peak includes page cache and does not show
the minimum available memory or settled process allocation.
The official Linux
[memory-controller documentation](https://www.kernel.org/doc/html/latest/admin-guide/cgroup-v1/memory.html?highlight=swappiness),
found/opened through MCP on 18 October 2026, distinguishes lifetime peak, cache,
RSS and approximate usage counters. Interpret the separate observations together;
do not reset counters or force cache reclaim to improve the reported result.

The full varied-history study passed with 1,980 offered arrivals: 1,800 successful
foreground requests and 180 expected busy responses. Peak synthetic-provider
concurrency stayed one. All 1,800 load fingerprints and UUIDv7 identities were
distinct. Final attempts/bindings were 1,801 including the prerequisite, with no
active request. Exactly two catalogs were verified at attempt 1 and two roots
retained; cleanup operations stayed zero. Dump windows overlapped seven/eight
admissions and both observed restore windows overlapped eight admissions.

All 3,000 failed rows retained the exact 233,849,304-byte canonical size and
digest `b2cc29fea4b0992b427a57d560b8ad0e267d65c2dbbbd9564d301c9e4168f821`.
Real uncompressed catalog dumps were 233,199,529 and 233,428,004 bytes, within the
unchanged 256 MiB per-dump limit. Normal five-minute assessments were used; no
deadline, admission counter or scheduling clock was edited. Cleanup verified
removal of only the fixture's labeled containers, volumes and disposable data.

| Extended phase | Request p95 (ms) | Pre-claim p95 (ms) |
| --- | ---: | ---: |
| Before | 1,280.809 | 611.970 |
| Archives active | 1,270.255 | 610.324 |
| After | 1,262.633 | 606.061 |

Maximum arrival lateness was 9.937 ms; event-loop p95/max were 20.251/75.170 ms.
These phase differences do not establish a statistically significant latency
improvement. Production timeouts, resources, attempts and cooldowns are unchanged.

| Extended observation | Source | Archiver | Catalog verifier |
| --- | ---: | ---: | ---: |
| Valid samples / failed | 1,860 / 0 | 1,676 / 0 | 1,654 / 0 |
| Maximum sampling gap (ms) | 1,058.587 | 1,052.271 | 1,014.063 |
| Lifetime peak charge (bytes) | 620,437,504 | 268,435,456 | 1,166,798,848 |
| Observed charge peak (bytes) | 455,745,536 | 268,414,976 | 1,153,630,208 |
| Observed anonymous peak (bytes) | 263,352,320 | 65,548,288 | 154,693,632 |
| Observed file-cache peak (bytes) | 176,451,584 | 199,057,408 | 988,385,280 |
| Observed worker RSS peak (bytes) | 85,028,864 | 97,480,704 | 182,484,992 |

All coverage gates passed without hitting the 2,048-sample cap. Recorded memory,
OOM and PID-limit events stayed zero. Source transaction observations counted
nine qualifying transactions, with maximum observed age 43,281.337 ms. PSI and
per-cgroup I/O-byte observations were unavailable, not zero. Peak fields are not
necessarily simultaneous and must not be added together.

The source had 60 idle samples: worker RSS ranged 73,777,152–74,117,120 bytes;
heap used ranged 12,152,592–12,972,840 bytes. Verifier RSS remained 147,013,632
bytes in its last quiet bin, above its initial roughly 66 MB. Stable late samples
do not distinguish allocator/retained-buffer behavior from longer-term growth.
No forced GC, cache drop or counter reset was used. A repeated large-restore
allocation/endurance study is still needed before making a leak-freedom claim.

### Protected normal local refresh

After all native gates passed, verified Docker context `desktop-linux`, the exact
old container/image and repository `data → /app/data` bind, then created
`data/backups/gateway-history-query-ready-20261018.dump`: 76,241,007 bytes, mode
0600, SHA-256
`199a246362c10e1041662b3cd889b88d68868e039914b509a7c275a1fab90d49`.
`pg_restore --list` passed; that is backup-list validation, not a full application
database restore rehearsal. Existing backups were not overwritten or removed.

Protected Compose replacement used `--no-build --no-deps --pull never` and the
tested image above. New container
`a626a58d1b10e587ac94057e8307f381ff48528a10fb1fd0885d67e0dbcedcf0`
is healthy and has the exact tested image/revision. `/health`,
`/api/system/health/ready` and `/` returned HTTP 200 on local port 21324.

The previous image
`sha256:7892a5c37ab65a813b10befe2fc371d9e25abc6c155197499971521b2e7e6c98`
is retained under its verified `classifarr-local-rollback` container-ID tag.
No pruning was performed. Optional gateway/archive/catalog/cleanup namespaces
remain absent from the normal application database. Capture budget revision 2,
all four call/token/reservation counters at zero and its existing next-check
timestamp remained unchanged. Standalone services were not activated.

## Recommendations and limits

Use the narrow same-snapshot query, strict evidence/budget validation, isolated
restore verification and bounded native studies together. Raising timeouts or
deleting failed history would conceal cost or discard required evidence. Global
trust caching could miss changed rows or files; it remains rejected.

The tradeoff is an explicit materialization boundary and a second base-table
scan for eligible fingerprints. This measured win concerns large inert history,
not every possible distribution of eligible records. Eligible whole-row hashing
remains deliberately expensive and bounded. The closed restore-statement map
also needs maintenance when the packaged table vocabulary changes; exact-set
tests and unknown-version refusals make drift visible rather than guessing.

With this baseline established, the next opportunity is to measure duplicate
canonical-fingerprint passes **within one live snapshot**, without caching trust
across sessions or assessments. Preserve budget charging, complete-history caps,
session binding, full-row fingerprints and external-file revalidation. That
optimization is deferred, not part of this patch.

Final stack: narrow one-statement snapshot → unchanged caps and full-row guards
→ actual restricted restores → full regression/extended study and separate
rotation → fresh backup and protected local refresh. Next, pair any within-view
deduplication proposal with repeated large-restore allocation measurements,
especially the verifier's higher quiet RSS. Measure before removing work; do not
replace integrity checks with a global cache or add manual purge controls.

One synthetic run on a shared desktop cannot certify leak freedom, live Ollama
capacity, indefinite endurance or production purge safety. Lifetime cgroup peak
includes cache and is not settled process RSS/heap. Unavailable PSI/I/O evidence
must remain unavailable, not zero. No production activation is recommended from
query timing alone.
