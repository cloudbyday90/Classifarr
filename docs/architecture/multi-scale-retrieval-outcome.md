# Coverage-preserving multi-scale retrieval outcome

## Delivered component

September 19, 2026. Implements the [frozen design](multi-scale-retrieval-design.md)
following the previous local-community experiment. Small ESM services separate
source validation, profile construction, retrieval, caching and evaluation.

The component keeps every same-media candidate and its nearest raw descriptions,
then adds bounded, deduplicated broad/local representatives. Shared descriptions
remain separate. A local-group miss never creates another operator review.
Optional discovery failure returns raw/broad context and is not cached, allowing
the next request to recover. Invalid mandatory inputs still fail closed.

This is a held-out retrieval-context component, not a live classifier change.
It currently requires an explicit held-out set and is consumed by the offline
evaluation command. There is no new endpoint, setting, acknowledgement, migration,
dependency, model call, automatic routing rule or confidence increase.

## Cache and safety boundary

One completed private profile, five-minute lifetime and 256 MiB conservative
accounting limit; one in-flight build with at most eight waiters. Equivalent
requests share work. Different concurrent sources return busy. Cancellation of
one caller does not cancel the others; cancellation of all callers prevents late
publication. Build deadline is six minutes with existing worker/cooperative aborts.

Source, representation and holdout changes cannot reuse the old key. Owned input
copies omit names, descriptions and metadata; returned query objects are fresh
and contain no vectors. Profiles stay in memory, are not persisted, and cannot
authorize a route. The command rechecks the source and embedding identity at exit.

## Evaluation

The final local Compose run completed with source and embedding identity verified
and no changed source components. It used 300 descriptions not present in the
prior 1,700 sampled descriptions, split into five folds of 60. All copies of each
fold's query hashes were excluded before fitting. Prior cohort items could remain
training context; no thresholds were tuned on this cohort.

The snapshot contained 6,655 documents, 6,652 cached vectors and ten libraries,
using `mxbai-embed-large:latest` with 1,024 dimensions. Seven libraries supplied
fresh queries; three small libraries had exhausted their unseen query pool in
earlier cohorts. All ten remained candidates in their movie/TV scope. There was
no sample shortfall or overlap with the prior cohorts. Sample fingerprint:
`ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`.

| Measure | Movie | TV | Total |
| --- | ---: | ---: | ---: |
| Held-out queries | 172 | 128 | 300 |
| Candidate/query pairs retained | 860 | 640 | 1,500 |
| Raw examples retained | 2,580 | 1,920 | 4,500 |
| Deduplicated merged examples | 5,676 | 4,313 | 9,989 |
| Candidate/query pairs with local context | 373 | 385 | 758 |
| Queries whose nearest item had no supported local group | 106 | 64 | 170 |
| Lost raw examples / omitted candidates / merged duplicates | 0 / 0 / 0 | 0 / 0 / 0 | 0 / 0 / 0 |

Counts of examples are retrieval occurrences across queries, not distinct media
items. Broad/local context added 5,489 examples beyond the raw matches; shared
evidence was returned separately 300 times, never as an exclusive vote. All 170
ungrouped-nearest queries retained their raw/broad fallback. The broad-only
diagnostic compared all 300 queries, agreeing with observed placement on 254
(148 movies, 106 TV) with no abstentions. Local context does not change that
decision by construction. This is not 84.7% routing accuracy: independent labels
remain zero, accuracy is null, and live promotion remains disabled.

All five cold loads built once and all five warm loads reused the same handles.
Cumulative cold-build time was 564.326 seconds versus 7.820 seconds for warm loads
(about 72 times lower). Per-fold cold times ranged from 60.556 to 132.829 seconds;
warm times ranged from 1.305 to 2.020 seconds, including source validation/copying
and fingerprinting. These are local evaluation measurements with other work
overlapping, not production request latency or a general speed guarantee.

Across the five training folds, broad groups represented 32,940 member occurrences
in 320 groups; local groups represented 9,080 in 2,692 groups (27.6% of the broad
member count). Weighted non-self representative similarity was 0.6160 for broad
groups and 0.7508 for local groups. These cover different subsets, so the numbers
are descriptive geometry, not a paired quality gain. Excluding self matches does
not remove all training-selection optimism or constitute a leave-one-out refit.
There were no new embedding/generation calls, benchmark database writes or routes.

An initial partial run was stopped after code review found an unnecessary vector
normalization before the existing fitter. The loader now copies exact source
values and lets each existing fitter normalize as before. That partial run is
not evidence for the delivered component.
The first completed corrected run was invalidated by a metadata-only source
change during startup backfill. It is also excluded from accepted evidence. The
same frozen cohort was repeated without disabling recovery, weakening source
checks or changing thresholds.

## Validation and PR availability

- Focused new-service/CLI regression: six suites / 44 tests passed, with 100%
  statements, lines and functions and 99.55% branches across the five new services.
- Full client: 369 files / 5,128 tests passed. Real PostgreSQL integration:
  three suites / 26 tests passed. Browser checks: 24 development and seven
  production-build/route checks passed.
- Final full backend rerun: 1,317 suites / 38,267 tests passed. The combined
  coverage ratchet passed: backend 90.22% statements/lines, 83.02% branches and
  92.31% functions; client 85.58% statements, 77.54% branches, 85.09% functions
  and 87.67% lines.
- The first concurrent backend run found an empty rejection handler in a new
  test and an existing geometry-test timeout. The handler was replaced with an
  explicit failure assertion; no timeout or coverage baseline was relaxed.
  Both affected checks passed individually and in the final full rerun.
- Lint, typechecks, dependency/copyright preflight, ESM imports/mock shapes,
  documentation, product-language, delivery-term and maintenance checks passed.
  The separate production-naming gate remains blocked on 43 existing references;
  this component adds none and does not alter its baseline.
- GitHub MCP returned no open PRs on repeated collection checks. No random PR could
  be selected or applied. The previous commit's hosted CI and security checks
  succeeded; a new hosted run is separate from the local checks above.

## Recommendation stack and next component

Validated inventory with automatic recovery → cached description vectors → raw
matches and broad context → optional local examples → bounded AI comparison for
ambiguous candidates → existing routing safeguards.

| Choice | Pros | Cons / decision |
| --- | --- | --- |
| Keep raw and broad evidence, append local examples | Retains candidate coverage and context detail; automatic fallback | Larger context and expensive cold fit; recommended foundation |
| Replace raw/broad retrieval with local groups | Smaller evidence set | Previous experiment lost coverage; rejected |
| Raise confidence from multiple views of the same item | Appears more automatic | Counts correlated evidence repeatedly; rejected |
| Wire the context into the existing ambiguous-candidate comparison | Can directly improve destination selection without new controls | Requires downstream held-out comparison before promotion; next component |

The next high-value item is the consumer: compare ambiguous destinations using
this bounded context rather than changing confidence thresholds. Preserve the
baseline when context is unavailable, test movie/TV and ungrouped-item regressions,
and measure useful decisions rather than adding more status panels. This outcome
does not establish that local context improves semantic correctness.
Do not fit profiles on an interactive request path. A live consumer needs managed
background warming, bounded retry/backoff and raw/broad fallback while context is
unavailable. It must adapt the explicit evaluation holdout contract without
letting an item's own placement become evidence for its destination; this loader
is not yet a drop-in live-query cache.

W3C status-message guidance is relevant to any later recovery/status presentation;
the current UI and SWR behavior remain unchanged. Official research, alternative
trade-offs and privacy constraints are documented in the linked design.

## Reproduction

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --multi-scale-context --exclude-prior-sizes 300,300,100,100,300,300,300 --max-minutes 30
```

No release, version bump, tag or PR merge is part of this change.
