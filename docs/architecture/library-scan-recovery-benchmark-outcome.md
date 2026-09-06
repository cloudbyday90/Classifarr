# Library scan recovery benchmark outcome

## Decision

The [benchmark design](library-scan-recovery-benchmark-design.md) is implemented.
Neither evaluated candidate satisfies the existing work bound and completion
requirements across the tested populations. Keep the current production sampler
and automatic diagnostics. This is the completed benchmark decision, not an
unverified production recovery change.

A two-page visit helps populations up to 40,000 rows, but larger continuously
changing libraries still restart before completion. A frozen projection preserves
its captured baseline, but needs the full bounded population up front, adds
storage and refuses larger populations. Raising either fixed cap merely moves
the boundary. Neither candidate justifies silently increasing the current
20,000-metadata-row visit contract.

## Delivered code

Run the developer benchmark from the repository root:

```sh
npm run benchmark:library-scan-recovery
```

The ESM CLI creates a disposable official PostgreSQL 18.6 container, generates
fixed fixtures, runs 45 deterministic scheduling scenarios and 36 database probes,
then prints aggregate JSON. It accepts no connection, image, SQL or output-path
arguments and does not load application database configuration. All temporary
probe writes roll back; connection/container cleanup runs on success and failure.
This developer command adds no operator step to automatic inventory analysis.

Separate modules implement scheduling, temporary fixtures, compact projection,
database probing and report orchestration. The projection reuses the production
observation-validity predicate, including malformed records and bounded observation
size. Unknown coverage stays null. No route, UI, database schema, scheduler,
classification or readiness contract changed.
The report's promotion decisions are benchmark assessments, not runtime flags
or a replacement for the existing readiness contract.

## Scheduling evidence

The fixed model uses 15 active libraries, one scheduled turn per five minutes and
90 slots. Continuous churn changes the large library before every scheduled turn.
The following times are scheduled offsets, not measured execution latency.

| Population and condition | Current single page | Two-page visit | Frozen projection |
| --- | --- | --- | --- |
| 20,000 rows, continuous changes | Completes on first turn | Completes on first turn | Completes on first turn |
| 20,001 rows, stable or change every two rounds | First completion after 75 minutes | First turn | After 75 minutes |
| 20,001 rows, continuous changes | No completion; five restarts | First turn | After 75 minutes |
| 40,000 rows, continuous changes | No completion | First turn | After 75 minutes |
| 40,001 or 80,001 rows, continuous changes | No completion | No completion | Refused: above capture cap |

All strategies retain 84 scheduled visits for the other 14 libraries and a
75-minute maximum scheduled revisit gap. That establishes modeled scheduling
fairness, not unchanged database contention. Frozen completion after 75 minutes
describes a 75-minute-old measurement baseline, not current metadata freshness.

The production sampler is separately exercised under repeated clock revision
changes to corroborate starvation while smaller libraries retain their turns.
Existing diagnostic counters expose that condition without marking it as a
classification failure.

## PostgreSQL 18.6 measurements

Three repetitions per row-count/strategy pair run in fixed order using the official
`postgres:18.6-alpine` image. The report records the actual version as `18.6`.
These local prototype timings are descriptive; fixed order and warmed caches
prevent treating small differences as causal performance improvements.

| Rows | Strategy | Median elapsed ms | Min–max ms | Serialized source bytes | Temporary storage bytes | Complete |
| --- | --- | --- | --- | --- | --- | --- |
| 20,001 | Current | 412.40 | 394.79–423.15 | 7,006,716 | 0 | No |
| 20,001 | Two-page visit | 414.74 | 397.34–417.50 | 7,007,068 | 0 | Yes |
| 20,001 | Frozen projection | 541.63 | 540.68–550.04 | 7,007,068 | 1,384,448 | Yes |
| 40,000 | Current | 403.10 | 401.68–479.16 | 7,006,716 | 0 | No |
| 40,000 | Two-page visit | 914.68 | 864.42–941.69 | 14,046,716 | 0 | Yes |
| 40,000 | Frozen projection | 1,227.10 | 1,208.40–1,290.22 | 14,046,716 | 2,719,744 | Yes |
| 40,001 | Two-page visit | 919.06 | 898.77–1,010.62 | 14,046,716 | 0 | No |
| 40,001 | Frozen projection | 18.16 | 17.91–19.54 | 35 | 0 | Refused |

The database query bounds ID lookahead and metadata reads. Frozen refusal reads
40,001 IDs but no metadata, stores no projection and returns no complete counts.
For accepted frozen captures, a subsequent source mutation leaves restored flags
unchanged. Two real database sessions demonstrate the consistency boundary:
read-committed pages can combine two versions into a total present in neither;
repeatable read preserves one snapshot.

The compact prototype excludes production queue joins, population hashing,
cursor claims and persistence. Temporary storage includes relation/index pages,
not durable WAL or long-term retention overhead. Serialized bytes are not process
memory. Timing excludes fixture creation and controlled source mutations. A
temporary frozen table proves projection behavior, not crash-safe cross-visit
storage or production readiness.

## Compose assessment

The running Compose PostgreSQL 18.6 service supplied 32 real typed identities,
16 movies and 16 TV items from eight libraries. They were combined into a
controlled benchmark library with synthetic padding; these are not measurements
of the original libraries' full populations. Six valid and 26 malformed metadata
cases supplied explicit expectations. All work used temporary tables and rollback.

| Probe | Outcome |
| --- | --- |
| 20,001-row current visit | Incomplete, counts withheld |
| 20,001-row two-page and frozen candidates | Complete; expected captured/fresh/keyword/language counts matched |
| Frozen baseline after source change | Unchanged |
| 40,001-row current/two-page candidates | Incomplete, counts withheld |
| 40,001-row frozen candidate | Refused; zero metadata rows and storage |
| Rollback | Verified |
| Provider requests / live writes / classification writes | 0 / 0 / 0 |

No running application was redeployed. Real identities and controlled fixtures
are not independent human labels; readiness and frozen-study gates remain in force.

## Validation

Focused model/CLI checks passed 20 tests. PostgreSQL validation passed the final
15 recovery tests, including 45 actual sampler visits that left the large changing
library incomplete while all 14 smaller libraries completed three scans each.
The earlier combined run passed 31 tests across recovery, diagnostics and
incremental coverage; the final recovery run adds the production corroboration.

The standalone official PostgreSQL 18.6 run completed all 36 cost probes with
verified rollback. All six private Compose probes passed. Full backend coverage
passed 30,131 tests across 1,063 suites in 529.2 seconds. Backend line/branch coverage
is 90.07% / 80.59%; the coverage ratchet passed using the fresh backend report and
the retained current report for unchanged client code.

Repository lint, server/client types, static ESM imports, strict ESM mock shapes,
both server unused-code checks, migration/schema integrity, Markdown validation
(1,008 documents) and the local Docker build passed. No browser behavior changed.

## Recommendations and next implementation

| Approach | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Existing sampler plus diagnostics | Preserves current resource contract and fair turns | Large changing libraries can remain incomplete | Keep in production |
| Capped extra pages | Simple bounded improvement for medium populations | Larger payload/work; starvation moves to a higher boundary | Do not promote as general recovery |
| Full bounded frozen projection | Consistent historical baseline after source changes | Up-front read, capacity refusal and unproven durable lifecycle | Keep as a prototype |
| Bounded change journal with per-page aggregates | Could repair changed pages instead of restarting entire libraries | Requires exact commit ordering, overflow handling and consistency proof | Next implementation to evaluate |

Next: implement a bounded journal of scan-relevant changes and a page-repair
prototype. Cover observation updates, clock changes, identity correction, deletion
and library reassignment. Repair must preserve a coherent measurement revision;
journal overflow, missing continuity or unsupported changes must fall back to
the existing restart path. Bound journal storage globally and repair work per
turn, then replay these same churn scenarios before considering production use.

Recommended stack: synchronized inventory → transactional observation revisions
→ automatic profiles → fair incremental scans → retained diagnostics → bounded
change repair with verified consistency → independently evaluated review-only
semantic evidence. Official sources, tradeoffs and the requested August research
scope are recorded in the [design](library-scan-recovery-benchmark-design.md).

The GitHub MCP query returned no open pull requests on 6 September 2026, so no PR
was available for random selection or local implementation. No external PR was
merged and no release was created.
