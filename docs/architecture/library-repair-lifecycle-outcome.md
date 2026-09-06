# Library repair occupancy, contention and lifecycle outcome

## Decision

The [lifecycle design](library-repair-lifecycle-design.md) is implemented and tested.
Keep the existing production sampler. The current live snapshot fits its
20,000-row single-visit limit in every active library. The isolated repair
prototype now handles idle-cache reclamation, empty ranges and reader/truncate
ordering correctly, but its global head still blocks unrelated writers.

This work adds no operator collection or cleanup step, provider call, application
endpoint, migration, classification action or release. Readiness and independent
study requirements remain unchanged.

## Implemented fixes

Three real PostgreSQL regression tests failed against the previous implementation
before the fixes were applied:

- A 33rd library was refused even when 31 retained cursors had been idle for
  more than seven days. Admission now reclaims those cursors and their summaries
  automatically under the publication lock, preserving recently visited libraries.
- Deleted ranges retained empty summaries. Repair now removes those summaries;
  the cursor and journal still detect later inserts behind the cursor. Missing
  insert events cause an explicit restart with counts withheld.
- A reader blocked behind a source-table exclusive lock already held the head.
  It now acquires the compatible source-table lock before the head, preventing
  the reader/truncate cycle without blocking ordinary row updates at that table lock.

Selected-library age and clock restart diagnostics remain observable. Reclamation
rolls back if replacement admission fails. Recently visited libraries are never
evicted merely to admit another library. Complete counts remain withheld after
continuity loss, overflow, expiry or capacity refusal.

ESM modules separate lifecycle operations, read-only occupancy, concurrency probes,
connection recovery, storage measurement and report orchestration. The existing
disposable runtime now supplies scoped additional connections and closes them
before removing the container.

## Live Compose occupancy

A database-enforced read-only repeatable-read transaction measured all 10 active
libraries on 6 September 2026 at 08:23:32 America/New_York. The source PostgreSQL
version was 18.6. The reader fetched only library IDs and positive integer item
IDs, then emitted aggregate counts and anonymous ordinals. Names, source IDs,
metadata and credentials were omitted from the report.

| Measurement | Result |
| --- | --- |
| Active libraries | 10 of 32 supported cursors |
| Inventory items | 6,692 |
| Occupied library/range pairs | 42 of 128 supported summaries |
| Largest library | 2,813 items across 18 ranges |
| Smallest library | 30 items across four ranges |
| Nominal range utilization across the snapshot | 0.7967% |
| Assessment complete / current capacity fit | Yes / yes |
| Metadata rows read / provider calls / live writes | 0 / 0 / 0 |

The reader has a global 200,000-item budget plus one sentinel, and a 32-library
budget plus one sentinel. Complete evidence can establish fit. Truncated evidence
reports unknown fit unless its observed lower bound already exceeds a cap.
Tests cover the exact boundary, subsequent empty libraries and capacity breaches.

Capacity fit does not establish scan efficiency or future fit. Every live library
is below 20,000 items, so replacing the existing single-visit path with fixed
global-ID ranges would introduce extra visits. Sparse allocation explains why
the largest library occupies 18 ranges despite having only 2,813 items.
The snapshot establishes occupancy, not metadata quality or human labels.

## Disposable concurrency and lifecycle evidence

Run the reproducible developer assessment from the repository root:

```sh
npm run benchmark:library-repair-lifecycle
```

The no-argument CLI creates an official `postgres:18.6-alpine` container, measures
controlled fixtures, verifies schema cleanup and stops all scoped connections
and the container. Application database configuration is not loaded. Destructive
probes and vacuum target only the newly created disposable schema.

The fixture includes a dense 20,001-item library and a 257-range sparse library.
The occupancy reader correctly reports that their combined 262 ranges exceed
the page cap. A bulk update spanning 257 ranges advances the journal generation
rather than storing a partial change set.

Actual lock inspection confirmed that both same-library and other-library writers
wait behind a reader holding the global head. Each probe includes an intentional
100 ms hold, so its elapsed time is not ordinary ingestion latency. A writer with
a 100 ms lock timeout aborted with PostgreSQL code `55P03`; subsequent complete
coverage retained the prior journal sequence.

The old table/head order was reproduced with explicit locks and PostgreSQL
reported a real `40P01` deadlock. With the corrected reader, the truncate transaction
could acquire the head while the reader waited for the table. After truncate
committed, the reader returned `restart_required` with null counts.

A committed partial cursor survived closing its first connection. A second
connection completed the next page inside an uncommitted visit, then its owned
backend was terminated. The pending page/cursor writes rolled back. A third
connection resumed from the committed cursor and completed by reading one row.
This verifies session interruption and reconnect, not database/host crash recovery.

The final local run recorded these descriptive timings. Each update comparison
uses the same fixture shape and indexes, with or without the journal triggers.
One fixed-order run on a shared host does not establish causal trigger overhead;
the dense tracked/untracked difference is too small to interpret as a speedup.

| Controlled update | Rows affected | Without journal ms | With journal ms | Generation invalidated |
| --- | --- | --- | --- | --- |
| Single row | 1 | 1.56 | 2.03 | No |
| Dense library | 20,001 | 167.81 | 165.99 | No |
| Sparse library | 257 | 1.47 | 2.48 | Yes |

Same-library and other-library writers took 120.20 ms and 118.40 ms respectively,
including the intentional 100 ms hold. The 100 ms timeout probe returned after
103.02 ms; the corrected truncate-order probe completed after 35.84 ms.

Storage replay committed 2,048 updates across eight journal wraps in 16 rounds,
with ordinary vacuum after every fourth round. Every round retained coherent
complete coverage; live journal rows never exceeded 256 and cached summaries
remained at four. Total prototype table/index storage, excluding the source and
untracked comparison table, grew from 131,072 to 344,064 bytes. It remained at
344,064 bytes over the final four rounds. The replay took 5,680.72 ms.

This finite plateau does not prove a hard byte ceiling. Ordinary vacuum made
obsolete space available for reuse and did not shrink the measured footprint.
No vacuum full, database crash or long-duration production load was tested.
All owned schema cleanup was verified and scoped connections were closed.

## Churn and validation

The original nine-scenario replay was repeated after the lifecycle fixes. Its
810 committed visits preserved the prior completion behavior and 20,000-row
metadata bound. Localized changes completed; changes across every range continued
to withhold complete counts. The other libraries retained their scheduled visits.

All 25 PostgreSQL checks passed across the new lifecycle tests and the prior
page-repair contract. The focused occupancy, CLI, projection and code-health run
passed 20,574 checks. Read-only enforcement, conservative partial evidence,
transaction rollback and connection cleanup are covered.

The full backend coverage run passed all 30,191 tests across 1,065 suites in
525.6 seconds. The coverage ratchet passed with fresh backend results and the
retained current report for unchanged client code. Repository lint, server/client
types, static ESM imports, strict mock shapes, both server unused-code checks,
migration/schema integrity, Markdown validation (1,012 documents) and the local
Docker build passed. The running application was not redeployed.

## Pros, cons and recommendation stack

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Existing production single-visit path | Fits every library in the observed snapshot; minimal work | Larger changing populations can still restart | Retain |
| Automatic idle/empty reclamation | Frees unused logical capacity without operator input | Requires exact journal and rollback behavior | Keep in the tested prototype |
| Source-table-before-head locking | Prevents the demonstrated reader/truncate cycle | Does not remove global writer contention or all possible writer/writer deadlocks | Keep; do not claim general deadlock freedom |
| Fixed global-ID ranges | Simple bounded reads and invalidation | Sparse IDs can add many visits and summaries | Do not replace the small-library path |
| Per-library ordering and adaptive ranges | Could reduce contention and sparse-range overhead | Membership changes, source-row order and global capacity need a new consistency proof | Next bounded prototype |
| Ordinary vacuum | Reuses obsolete row space with routine maintenance | Does not establish a hard byte ceiling or guarantee file shrinkage | Retain normal maintenance; measure sustained behavior |

Next: preserve the current small-library fast path while evaluating per-library
page boundaries and commit ordering. Use this real occupancy distribution,
opposite-direction library moves and simultaneous writers as acceptance fixtures.
Require the existing continuity, expiry, global-capacity and recovery guarantees
before any production integration. Longer storage runs and database-crash recovery
remain additional promotion gates.

Follow-up: the [per-library design](library-scoped-repair-design.md) and
[measured outcome](library-scoped-repair-outcome.md) now implement and assess this
prototype recommendation. Production writer compatibility remains a separate gate.

Recommended stack: synchronized inventory → bounded read-only occupancy evidence
→ efficient per-library scans → automatic cache reclamation → consistent and
measured transaction ordering → coherent coverage and retained diagnostics →
independently evaluated review-only semantic evidence.

Official PostgreSQL and W3C research, the August 2026 baseline limitation and
design alternatives are recorded separately in the
[design document](library-repair-lifecycle-design.md). No new interface was added,
so this work makes no new UI accessibility claim.

GitHub MCP returned no open pull requests on 6 September 2026, including the
pre-integration recheck. No PR was available
for random selection or local implementation. No external PR was merged.
