# Automatic inventory observation repair outcome

## Design and resulting behavior

Implemented the follow-up identified by the previous
[health assessment](library-observation-health-outcome.md). Recent commits added
health (`0ef61839`), typed overlap (`b0357500`), guarded observation writes
(`6bac0a7e`) and source identity retention (`e8e041f5`). This change makes automatic
repair use the same full validity contract as the reader and worker.

A record with fresh timestamps and `keywords: "invalid"` now reaches
observation-only enrichment after cooldown. The same holds for mismatched typed
identity, wrong JSON types, noncanonical keywords and invalid language. Valid
empty captures remain cached. Source guards, provider limits and existing task
exclusion remain in place.

The small ESM `queueRefillCandidates.mjs` owns SQL page acquisition and shared
validity filtering. `QueueRefillService` retains bounded traversal progress and
coalesces concurrent refills through enqueue completion. A failed enqueue restores
the checkpoint. No schema, API, UI or dependency changes were needed. The
[design](inventory-observation-repair-design.md) contains official-source research,
the August 2026 date qualification and alternatives.

## Validation

- 167 focused backend checks passed for refill, observation validity, source
  identity and health.
- 27 PostgreSQL integration checks passed across repair, acquisition/persistence
  and health. A 32-case matrix has six explicitly reusable records and 26
  malformed records; only the latter enter repair while fresh.
- A PostgreSQL case places a repair after 5,000 fresh rows, then inserts another
  item and invalidates an earlier one between pages. Successive pages reach the
  repair, wrap to the earlier item, and subsequently reach the new insertion.
- Worker integration repaired all 26 invalid records through guarded persistence,
  leaving no observation refill candidates and making no classification-history
  or OMDb calls.
- Full backend coverage passed: 1,056 suites and 29,861 tests. Aggregate coverage
  is 90.08% lines/statements, 80.48% branches and 92.72% functions. The new candidate
  module has 100% coverage; the coverage ratchet passes without baseline changes.
- Repository lint (including security rules), both workspace type checks, static
  ESM imports, strict mock shapes, both server Knip checks, migration naming and
  schema integrity checks passed. Markdown lint passed across 996 documents.
- `docker build -t classifarr:test .` passed. The running Compose image was not
  redeployed. Client code was unchanged; client tests were not rerun, and the
  combined ratchet used the existing client coverage artifact.

## Local Compose assessment

Selected 32 existing typed identities from the running Compose inventory: 16
movies and 16 TV items across eight libraries. Explicit contract fixtures supplied
six valid captures and 26 malformed captures, with real source identity fields
retained. These are controlled validity expectations, not independently reviewed
classification labels or real provider error measurements.

All writes used connection-local TEMP tables inside a rollback transaction. The
current selector, refill service, observation-only worker, source-guarded
persistence and health aggregation ran against PostgreSQL. General item-state
callbacks were isolated; this did not start the live scheduler or redeploy the
older running image.

| Measurement | Result |
| --- | --- |
| Correct repair selection | 26 of 26 malformed captures; zero valid captures |
| Initial selection time | 19 ms for this isolated 32-row cohort |
| Duplicate enqueue while pending | Zero |
| Enqueue during controlled outage cooldown | Zero |
| Repair after advancing past cooldown | 26 captures recovered |
| Final health | 32 fresh captures |
| Controlled provider function calls | 52: 26 failures, then 26 successes |
| Provider network requests / live writes / classification writes | 0 / 0 / 0 |
| TEMP rollback verification | Passed |

The 19 ms result is a small-cohort observation, not a production performance claim.
An additional TEMP-only scan copied all 6,692 inventory rows, using controlled
clock/provider/queue state because the running image predates the clock columns.
Its two pages returned 5,000 and 1,659 rows. With source metadata retained, measured
query/read times were 987 ms and 237 ms and serialized row sizes were 11,313,547
and 3,859,228 bytes. After replacing observations with controlled fresh empty
captures and corrupting one final eligible row, the first page returned no repair
candidates and the second reached that repair; reads took 182 ms and 61 ms.
These are local fixture measurements, including controlled eligibility state,
not production latency guarantees. Rollback was verified for both assessments.

Private scripts and raw source fields remain in ignored `.tmp`; no credentials or
inventory identities are included in tracked results. This assessment does not
satisfy human-label or frozen-study readiness gates and enables no semantic routing.

## Recommendations, limits and next item

| Recommendation | Pros | Cons or limits |
| --- | --- | --- |
| Reuse one validator with bounded traversal | Repairs evidence without routine user input; avoids SQL/JS semantic drift | Fresh records consume reads; later pages wait for scheduler cycles |
| Keep an in-memory pass cursor initially | Small change with no migration | Restart begins again; repeated restarts can delay later pages |
| Add automatic aggregate acquisition history next | Shows whether real coverage is converging and why attempts fail | Requires explicit retention, outcome semantics and bounded storage |
| Persist validation/cursor state only when measured scale requires it | Can reduce repeated reads and survive restarts | Adds invalidation, schema and validator-version management |

Final recommendation stack: guarded inventory identity → attributable observation
validation → bounded automatic repair → automatic profiles and typed overlap →
coverage/freshness and acquisition progress → independently evaluated AI assistance.

**Next item:** add bounded, automatically recorded aggregate acquisition outcomes
and convergence history. Distinguish attempted, captured and unavailable results,
retain explicit unknown coverage, and avoid raw provider payloads or per-item
operator steps. Validate actual background progress on a current migrated local
image before drawing conclusions about provider accuracy. Keep semantic readiness
and review-only counter-evidence gates unchanged.

## PR availability and delivery

The GitHub MCP open-PR listing was empty at task start and delivery recheck. There was no random open
PR to implement locally, and no closed PR was substituted. Unreleased, README and
the architecture follow-up chain are updated. Delivery is to `origin/main` under
the user's commit, push and integration authorization, without creating a release.
