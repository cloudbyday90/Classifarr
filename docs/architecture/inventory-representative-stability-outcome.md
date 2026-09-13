# Representative learning stability: outcome

Date: 2026-09-13.

## Implementation

The [fixed design](inventory-representative-stability-design.md) extends the existing
ESM geometry and scoped learner, with separate multi-start fitting/partition
diagnostics and ranking-fallback services. The existing benchmark runner and CLI
retain v1 and expose the explicit stability mode. No dependency, API, schema,
version, release, live routing or settings change is included.

The old 12-pass run and three 64-pass starts use the same training exclusions.
Training-only selection prefers convergence then mean assigned cosine, with fixed
start-order ties. Salted starts may produce identical initial points or partitions;
they are sensitivity probes, not independent votes. Partition similarity and
agreement with existing placements are not calibrated classification confidence.

The public report contains anonymous library strata, aggregate convergence,
objectives, coverage and ranking results. Assignment arrays are discarded after
partition comparison. Raw vectors, example hashes, titles and item identifiers
are not serialized. Existing media/fold scope, snapshot verification, read-only
execution, bounded workload and cancellation remain enforced.

## Verified local results

All five final reports passed source/model verification and share identical
snapshot components: 6,655 documents, 6,652 cached vectors, 6,657 metadata entries
and ten libraries. The 900 descriptions comprise the known 800 controls plus
100 newly sampled descriptions. Five-fold exclusion removes held-out descriptions
and every copy before fitting each library. No generation calls were made.

| Cohort | Cases | Baseline | Old 12-pass groups | Best training fit | Stability-filtered | Gains / losses versus baseline |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Original control | 300 | 253 | 257 | 258 | 255 | 4 / 2 |
| Additional control | 300 | 280 | 278 | 283 | 282 | 2 / 0 |
| Prior pair-pilot control | 100 | 95 | 93 | 92 | 95 | 0 / 0 |
| Prior representative control | 100 | 91 | 94 | 92 | 94 | 3 / 0 |
| New cohort excluding prior 800 | 100 | 91 | 91 | 91 | 91 | 0 / 0 |
| Total | 900 | 810 | 813 | 816 | 817 | 9 / 2 |

These are agreements with existing library placement, **not verified accuracy**.
The known controls improve by seven; the unseen cohort is neutral. The old method
had 17 gains and 14 losses; selecting only by training fit had 16 gains and ten
losses. Checking initialization sensitivity reduced changes to eleven, with nine
gains and two losses. It also declined some potential gains. No thresholds or
initializations were tuned using these observed outcomes.

Movies: 466 cases, 411 to 415 agreements, four gains and no losses. TV: 434 cases,
399 to 402, five gains and two losses. The new cohort contains 58 movies and 42 TV
descriptions; all nine remaining placement disagreements there are movies. Seven
libraries supply new queries because three small libraries have no remaining
unseen descriptions. All ten libraries remain in training/candidate scope within
their media type. The first control samples every library.

All 656 original consensus cases remain unchanged. Among 244 description/metadata
disagreements, 174 pass the stability check, 30 retain baseline because model views
choose different destinations, and 40 retain baseline because at least one
same-media alternative fit is unconverged. No extra user review request is created.

## Convergence, cost and remaining limitations

The old control reaches its limit in 136 of 250 library/fold fits. All 250 selected
fits converge, but seven of the 750 individual starts still reach 64 passes. The
remaining starts are not silently treated as converged or retried indefinitely.

Selected models contain 61–65 supported groups per fold. Only one to five eligible
descriptions per fold are discarded; minimum supported coverage is 99.924%.
Coverage does not imply correct placement. The minimum pairwise adjusted Rand
agreement across starts ranges down to -0.096764; the median of per-library minima
is 0.336213. Thus convergence is fixed for the selected fits, **not** initialization
sensitivity or semantic correctness of the partitions. The ranking fallback is
still necessary; no claim of globally optimal clusters is made.

Final fitting time totals 265.854 seconds across 25 folds, including old controls
and all starts. Individual five-fold runs took 39.270, 37.497, 78.734, 72.186 and
38.167 seconds of fitting. Full backend tests ran concurrently, so this variation
is not a controlled throughput comparison. Retrieval and source checks add time.
There were 13,319 aggregate assignment passes across all libraries and fits.
The configured 1,024-dimensional cached description representation was unchanged;
no embedding or completion model was downloaded or trained.

The first attempts at both 300-item controls invalidated during post-rebuild
metadata changes. A read-only probe later observed no genre/studio/rating changes
over twenty seconds. Both controls were rerun successfully; those retries are not
new samples. No worker was disabled, source check weakened or stale result counted.

## Recommendations and next component

| Option | Pros | Cons / decision |
| --- | --- | --- |
| Keep the 12-pass learner as the only method | Lowest fitting cost; reproducible control | Many unfinished fits and more observed losses; retain as control only |
| Use the best training fit without sensitivity checks | All selected fits converged; modest net gain | Ten placement losses, including regressions in controls; do not promote |
| Keep bounded multi-start with baseline fallback | Seven net agreements gained and only two lost; detects sensitivity | More CPU; no gain on the new cohort; recommended offline/shadow method |
| Enable new live routing immediately | Could apply the control-cohort improvement | Unverified labels and unstable partitions; defer |

**Next high-value component: an automatically refreshed, source-versioned library
profile cache in shadow mode.** Build profiles after inventory changes, coalesce
repeated updates, reuse unchanged vectors, atomically replace only a complete
current model, and fall back when a model is stale or unavailable. Do not fit on
each incoming item or require users to declare every library's purpose. Keep
full-inventory models separate from held-out evaluation models so the cache cannot
introduce test leakage. Shadow comparisons can use naturally occurring outcomes
without creating a new acknowledgement screen or changing live routing authority.

Final recommendation stack: existing live routing; the reusable bounded ESM
learner with training-only selection and sensitivity fallback; automatic
source-versioned refresh next; then evaluate live integration using observed
corrections, fresh cases and measured costs. Do not raise confidence merely because
fits converge. The researched OWASP/W3C considerations and alternatives are in the
design; no UI was changed or accessibility conformance newly claimed.

## Validation

Focused tests: six suites / 78 tests passed; representative modules reached 100%
statements, functions and lines, with 98.67% branches. Coverage includes synthetic
convergence beyond twelve passes, iteration caps, training-only selection,
permuted cluster labels, deterministic replay, held-out copies, ordering/names,
unavailable groups, seed-sensitive destinations, cancellation and source drift.
Full backend regression passed **1,278 suites / 36,942 tests** in 738.673 seconds.
Coverage is 90.12% statements/lines, 82.39% branches and 92.19% functions. The
coverage ratchet passed using fresh backend coverage and the existing unchanged
client report; no threshold was reduced. Dependency/copyright preflight, backend
typecheck, test/security lint, Markdown lint and ESM checks passed. No new frontend
or dedicated PostgreSQL integration suite is claimed. Local Compose is healthy
with a read-only root filesystem; real CLI runs used read-only database access.

## Reproduction

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --evidence-reranker --representative-groups --representative-stability --max-minutes 10
```

Use `--exclude-prior-size 300` for the second 300-item control. The next two
100-item controls use `--exclude-prior-sizes '300,300'` and `'300,300,100'`.
The new 100-item cohort excludes `'300,300,100,100'`, all prior 800 descriptions.
Each report includes a same-snapshot v1 control and selected-only comparison.
Invalidated reports do not count as successful evaluations or additional samples.

## PR and CI scope

GitHub MCP reported no open Classifarr PR at selection time. No closed PR or
unrelated repository was substituted, and no PR was merged. All six workflows on
the previous commit, `0c74bf39`, passed before this work began.

The next component is now implemented separately: see
[automatic representative-cache outcome](inventory-representative-cache-outcome.md).
Its full-inventory profiles do not replace this study's held-out models.
