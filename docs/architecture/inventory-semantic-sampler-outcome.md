# Inventory Semantic Sampler — Outcome

Status: implemented, unreleased on 11 September 2026. No version bump or release.

## Delivered

- Added a small ESM sampler, separate SQL and aggregate-report modules, and a
  local command. Reused the existing deterministic inventory frame with an
  optional active-library scope; existing callers keep their previous scope.
- Removed policy declarations as a prerequisite for this diagnostic only.
  Live routing admission and learning behavior are unchanged.
- Matched stored embeddings by provider, model and dimensions; excluded stale,
  zero-norm, conflicting-source and full-cohort neighbor identities. Historical
  duplicates do not consume multiple neighbor positions within one library.
- Preserved descriptions and neighbor examples in memory for future semantic
  evaluation. Only content-free aggregate results leave the command.
- Kept every missing-evidence case in the sample denominator. Neither tied
  scores nor absent observed-library neighbors imply a wrong placement.

## Real Compose result

The rebuilt local Compose instance completed the default sample without policy
declarations, reviewer worksheets, inference calls or database writes by the
sampler. Repeated runs returned the same aggregate results:

| Measurement | Result |
| --- | --- |
| Active libraries | 10 |
| Sampled identities | 24; six per stratum |
| Items with descriptions and usable stored embeddings | 24 |
| Items with cross-library comparisons | 24 |
| Retrieved neighbor examples with descriptions | 360 |
| Strongest-neighbor library matched current membership | 22 |
| Strongest-neighbor library differed from current membership | 2 |
| Tied comparisons | 0 |
| Retrieved neighbors with authorized-outcome receipts | 0 |
| Independently labeled samples | 0 |
| Measured accuracy | Unavailable |

Both disagreements were in the reality stratum. The other strata were
documentary, genre-overlap and ordinary. These observations do not establish
which destination is correct, and do not resolve the screenshot item itself.
Existing representations may already encode historical labels. In particular,
22/24 agreement must not be displayed as routing confidence or accuracy.

The initial timed run took 33.39 seconds. Disabling JIT experimentally took
32.58 seconds and did not justify a configuration change. Materializing the
compatible vector set before exact ranking, retaining normal relational
indexes, and deferring description/receipt reads until after neighbor selection
took 31.51 seconds with unchanged counts. This is a modest observed difference,
not a controlled performance benchmark or a general speedup claim. A one-item
instrumented run measured about 407 ms for the inventory frame and 1,044 ms for
retrieval. The sampler is bounded offline work, not an interactive request path.

## Running locally

```sh
docker compose exec -T classifarr node src/scripts/runInventorySemanticSample.mjs
```

For a checkout with its normal local database configuration:

```sh
npm --prefix server run study:sample:inventory-semantics
```

Optional arguments: `--size` from 1 to 32 and `--seed` of 16–128 ASCII letters,
digits, hyphens or underscores. The default is 24 with a fixed versioned seed.
Do not serialize the service's private `cases` result; consume it in process.
Only `report` is intended for stdout or a diagnostic artifact. `complete` means
the sampling run completed, not that routing accuracy has been established.

## Validation and CI impact

- Full Windows backend suite: 1,206 suites and 34,092 tests passed before the
  final query optimization. The final focused suites passed 32 tests.
- Real pgvector integration: four tests passed after the final query change,
  covering full-cohort exclusion, duplicate histories, incompatible/stale/zero
  vectors, source conflicts, missing query embeddings, media-type identity,
  deterministic sampling, read-only snapshots and restored session settings.
- An initial integration run passed all four assertions but timed out during
  cleanup. Releasing its connection after each test fixed the fixture leak;
  the integration harness itself was not changed.
- Backend security/test lint, backend type checking, documentation lint,
  ESM static-import and mock-shape checks, and `git diff --check` passed.
- Local Compose rebuilt successfully and `/health` reported a healthy service
  with its database connected.

The new tests use the existing unit/integration jobs. No CI workflow, client
contract, frontend component, dependency, schema or release setting changed.
The CLI is opt-in diagnostic execution; no scheduler or background worker was
added in this component.

Additional CI checks: the product-language, delivery-term-removal and
runtime-release-maintenance audits passed. The production-naming gate remains
blocked by 26 pre-existing `phase` references in untouched lifecycle/UI/storage
files. A read-only `git diff HEAD` check of every flagged file confirmed none
was changed by this work. The gate was not weakened and those unrelated
contracts were not renamed. Consequently this patch does not claim that the
entire repository CI pipeline is green, despite passing sampler tests.

## Pull request availability

GitHub MCP returned no open pull requests for `cloudbyday90/Classifarr` on
11 September 2026. There was no PR to randomly select, implement locally or
merge. [Repository pull requests](https://github.com/cloudbyday90/Classifarr/pulls)

## Final recommendation and next component

Keep this inventory-first sampler as the measurement source. Its advantages
are no additional declarations, no provider cost, real current-library
neighbors and explicit missing-evidence counts. Its limitation is that existing
embeddings are not verified label-free representations and current placement
is not an independent correctness label.

Next implement a paired, label-free description-embedding comparison using
these same sampled identities and held-out exclusions. Compare it with the
stored-embedding baseline to learn whether actual descriptions improve
cross-library distinctions, especially reality versus neighboring TV libraries.
Use that evidence to guide autonomous library understanding; do not add another
manual declaration screen or silently lower routing thresholds.

The [design document](inventory-semantic-sampler-design.md) records the official
research, date limitations, alternatives, security boundaries and recommendation
stack. W3C guidance was considered; this offline component deliberately adds no
new dashboard card or busy status announcement.
