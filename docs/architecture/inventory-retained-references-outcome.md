# Inventory retained references outcome

## Implementation and decision

The [previous dependent-cleanup follow-up](inventory-dependent-cleanup-outcome.md)
is implemented in the disposable assessment. Request and feedback references now
detach in bounded transactions while retaining an immutable library snapshot and
every non-reference field. New ESM modules separate table definitions, schema,
admission guards, batches and measurements. The existing cleanup coordinator,
schema fingerprint and benchmark are reused.

Run the extended assessment with:

```bash
npm run benchmark:inventory-dependent-cleanup
```

The report contract is now `inventory.dependent-cleanup.benchmark.v2` and includes
`retainedReferences`. It retains the earlier measurements and adds request/feedback
counts, non-reference-field preservation checks and index plans. The command still
rejects connection arguments and uses a disposable PostgreSQL 18.6 container with
generated credentials. Production routes, migrations and classification behavior
are unchanged. No release or dependency was added.

## Existing behavior and automatic Compose evidence

Requests already preserve `routed_to_library_name`; the prototype keeps it exactly,
including empty and null values. The new `nameAtDetachment` is a separate observation
of the library name during cleanup, not a reconstructed name at the original event.
Request status and classification-history links survive. Feedback retains policy
and suggestion IDs, correction flags, scores, reasons, metadata and timing payloads.

The local Compose assessment ran at **2026-09-06 18:58:34 UTC** in read-only database
transactions. It returned aggregate counts, catalog evidence and plain JSON query
plans, with zero writes and zero individual records returned. Both tables contained
zero rows, so there was no real request/feedback cohort available to exercise.

| Deployed reference | Constraint | Referencing index | Estimated access path |
| --- | --- | --- | --- |
| `media_requests.routed_to_library_id` | Validated, enforced, no action | None with this leading column | Sequential scan and sort |
| `policy_feedback_log.selected_library_id` | Validated, enforced, no action | `idx_policy_feedback_library(selected_library_id)` | Index scan and sort |

An empty-table plan is not performance evidence for populated production tables.
No index migration was made. The graph fingerprint was
`63d9732fc77e1283cef27b8c16aef2296ae4166d18ec7f6996a155b06d6cad37`;
the new exact-column/no-action rules propose `preserve_reference_snapshot` for these
two references. That changes evidence fingerprints without changing deployed DDL.
The graph remains non-executable and unknown relationships remain unresolved.

The container's `/tmp` is a live mount that Docker copy did not resolve. Streaming
the private helper archive through `docker exec -i ... tar` succeeded. This affected
only temporary script delivery; no running application files or database rows were
changed. Private captures remain under ignored `.tmp/`.

## Disposable measurements

| Phase | Requests detached | Feedback detached | Parents removed | Maximum domain mutations per resumed step |
| --- | --- | --- | --- | --- |
| Library removal | 257 | 129 | 1 | 17 |
| Remaining server removal | 3 | 3 | 2 | 1 |

The first library checkpoint detached exactly 17 requests. A new connection
completed the remaining work in 22 steps. Server removal completed in eight steps.
All **16,776 request/feedback rows** remained, including 392 detached rows and
16,384 unrelated rows. SHA-256 comparisons of every non-reference field before and
after cleanup matched. The report contains aggregates, not those record payloads.

The existing assessment also preserved 130 classification-history audit payloads,
rejected moving a reserved item and resumed dependent draining. Disposable schema
and container cleanup succeeded. There were zero provider requests or production
writes, and production promotion remained false.

With 8,192 unrelated rows in each retained table, the actual 128-row library batch
selection used the lab's `(library_reference, id)` indexes without disabling planner
choices. Request selection took 0.168 ms with six shared-buffer hits; feedback took
0.132 ms with seven. Both returned 128 rows with zero shared-buffer reads. These are
single cached fixture measurements, not latency promises or proof for server-wide
selection, sparse production distributions or sustained churn.

The shared domain budget excludes job bookkeeping, index maintenance and cache
repair. It bounds changed domain rows, not total query work, WAL or transaction time.
The lab graph now has eleven reachable tables and fourteen FK edges.

## Verification

The final PostgreSQL integration run passed **126 tests across six suites** in
75.408 seconds, including 25 new retained-reference cases and existing cleanup,
sync, identity-retention and scoped-repair regressions. These tests used the existing
18.4 integration image; the populated standalone benchmark used PostgreSQL 18.6.

The new cases cover shared budgets of one, 17 and 128; preservation of all request
states, existing names and history links; feedback evidence retention; moves before
fencing; both directions of real admission races; immutable snapshots and ID reuse;
scope checks; atomic rollback; backend termination and reconnect; competing workers;
and schema/trigger drift. A committed snapshot survives resume unchanged; an
uncommitted snapshot rolls back with its counter. Later request status updates are
allowed without replacing archived provenance.

The unit/code-health run passed **20,563 checks across two suites** in 18.988 seconds.
Repository lint, configured server/client type checks, ESM static import and strict
mock-shape checks, both server Knip checks and Markdown lint across 1,022 documents
passed. The local Docker image
`classifarr:retained-references-local` built successfully from the staged repository
tree, excluding ignored private captures. The image was not deployed or published.

Validation is scoped to the changed assessment and its integration dependencies.
The full backend/frontend suites and coverage reports were not regenerated in this
iteration. No coverage baseline was changed. These tests do not establish complete
production FK/trigger compatibility, whole-database crash recovery or authorization
against a database owner.

## Recommendations, tradeoffs and next item

| Recommendation | Pros | Cons |
| --- | --- | --- |
| Keep explicit detachment and snapshots | Preserves independent evidence and original identity | Extra storage and retention policy needed |
| Keep admission and immutable provenance guards | Stops late writes and accidental reattachment to reused IDs | Fenced writes need automatic retry/recovery |
| Retain existing names and statuses | Avoids rewriting historical request meaning | Consumers must distinguish event names from later observations |
| Evaluate FK/ID indexes on populated data | Supports bounded ordered selection | Adds write/index maintenance; empty deployed tables cannot establish benefit |
| Keep the assessment isolated | Validates behavior without production data changes | Production integration and remaining FK families still require work |

**Next fix: exclude detached or unresolved feedback destinations from automatic
confidence calculations.** `autoLearningConfidence.mjs` compares every selected
library ID with the candidate; a matching signal with `selected_library_id = NULL`
currently increments the rejection count. Existing clear-and-resync can create that
null state already. Add explicit destination eligibility, preserve archived records
for historical inspection, and regression-test null/missing and reused identities
before adapting wider feedback readers. Do not turn archived provenance into an
active destination or automatic negative evidence.

The selected-policy FK and other restrictive relationships still need explicit
retention contracts; this representative lab does not establish full production
graph compatibility. Automatic job recovery, snapshot/job retention, consumer
compatibility and least-privilege roles remain adoption gates.

Final recommendation stack: automatic evidence → explicit retention snapshots →
fenced admission → bounded transactional detachment → automatic recovery/retention
→ eligible evidence consumers → least-privilege production assessment.

The separate [design](inventory-retained-references-design.md) records the official
PostgreSQL/W3C sources and August-baseline limitations. GitHub MCP returned no open
PRs on 6 September 2026. The five most recently updated closed PRs were dependency
updates (#521–525), all closed without a merge; none was substituted for an open PR.
