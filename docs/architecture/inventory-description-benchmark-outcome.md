# Inventory description evidence-budget benchmark outcome

## Implementation

The previous commit added live inventory-description evidence with a maximum
of three descriptions per candidate. That path still has the same limits,
policy authority, and routing thresholds. The new experiment is separate:

- A read-only snapshot repository reuses the existing corpus and vector cache.
- A sampler/ranker freezes a seeded, whole-cohort-held-out 100-title sample.
- A prompt module supplies nested 9/30/100-example budgets and strict parsing.
- A local-only generation client checks installed model provenance and records
  bounded completion/token measurements without persisting private content.
- A runner reports aggregate outcomes, failures, shortfalls, and paired changes.
- A CLI defaults to preflight; generation requires an explicit case count.

No new dependency, endpoint, schema, setting, confirmation screen, migration,
CommonJS file, release, tag, or version bump was introduced. See the
[design, trade-offs, and official-source research](inventory-description-benchmark-design.md).

## Reproduce locally

Run from the repository root with the local Compose service healthy and the
existing description cache current:

```powershell
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-budget-20260911 --size 100
```

The preflight reads the corpus and inspected embedding representation, but does
not request generation or create missing embeddings. An incomplete cache must
be filled by the existing refresher, not silently bypassed by the benchmark.

```powershell
docker compose exec -T classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-budget-20260911 --size 100 --generate-cases 100 --context 32768 --max-minutes 20
```

For a pilot use `--generate-cases 3`; the **entire 100-title sample remains held
out**. The size argument is not the example budget: every generated case runs
all three arms. The maximum is 100 cases / 300 calls, serially, with a maximum
120-minute explicitly selected run budget. Ctrl+C cancels the CLI and preserves
completed aggregate measurements when generation has begun. No automatic retry
or resume is implied; compare fingerprints before comparing separate runs.

The CLI prints JSON and exits nonzero for incomplete samples, interrupted runs,
estimated input-budget violations, or completed runs containing errors. Invalid
outputs and output-limit stops are not counted as valid proposals. No prompt,
synopsis, title, library ID, or raw model output is printed.

## Local Compose evidence

Checked September 11, 2026. The initial preflight completed for **100 titles**,
covering all **10 current library groups**. Every case supplied the full requested
9, 30, and 100 examples. Average prompt sizes were respectively 3,813, 10,359,
and 32,161 UTF-8 bytes; the largest 100-example prompt was 39,343 bytes.

The retrieval-only shortlist omitted the observed destination for **3/100**
titles. These are review candidates, not three proven classification errors:
inventory placements are observational and the benchmark does not import an
independent reference set. It reports `accuracy: null` by design.

The generation pilot completed all nine calls using the saved local
`gemma4:e4b` model, a 32,768-token requested context, temperature zero, fixed seed
42, optional thinking disabled, and a 64-token output limit. This is a controlled
description experiment, not an end-to-end replay of production policy reasoning.

The full run completed **300/300 local comparisons** on the same frozen sample
and snapshot as preflight. Every call returned a valid numbered proposal; there
were zero abstentions, invalid outputs, output-limit stops, provider failures,
or context-limit suspicion flags. Input truncation remains **unknown**, not
verified absent. No independent labels were consumed, so accuracy is still null.

| Examples per query | Observed-placement agreement (not accuracy) | Mean generation-request latency | p95 latency | Mean prompt tokens | Changed versus nine |
| --- | --- | --- | --- | --- | --- |
| 9 | 78/100 | 246 ms | 287 ms | 813 | Baseline |
| 30 | 78/100 | 403 ms | 470 ms | 2,208 | 9/100 |
| 100 | 77/100 | 806 ms | 1,061 ms | 6,859 | 4/100 |

All calls generated six output tokens. Generation-request latency includes the
HTTP generation round trip but excludes snapshot preparation and before/after
model-provenance checks. This is one run on the current local provider, after a
pilot warmed it, not an isolated throughput or statistical-significance study.
The 30-example mean includes one 7,744 ms request; report p95 alongside the mean
rather than hiding the outlier.

Snapshot fingerprint:
`fb53a0e341ac6cd630c23b93b3370e09d51f23b01f60eb24d2f0773eeff21d11`.
Sample fingerprint:
`1a8055ceab40e37f170c901c16d36729913be94bcaa74f31620e099e2d8a44d4`.
Generation model digest:
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
Embedding model was `mxbai-embed-large:latest`, 1,024 dimensions, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.

## Recommendation and next component

Follow-up: [automatic disagreement investigation](benchmark-disagreement-investigation-outcome.md)
now identifies and rechecks discrepancies before asking for reference answers.
It does not promote re-check results into independently verified labels.

Keep the live budget unchanged for now. One hundred examples cost about **8.4×
the input tokens** and **3.3× the mean generation-request latency** of nine,
without improving observed-placement agreement in this experiment. This does
not prove nine is more accurate: larger contexts changed some destinations,
and current inventory can contain previous mistakes.

The next high-value component is a **label-backed benchmark comparison**:
connect independently confirmed/corrected destinations to a disjoint evaluation
set, examine the changed decisions and shortlist omissions, and report both
correctness and abstention quality. Do not train on that evaluation set or
treat automatic placements as their own ground truth. Then consider selective
larger-context retries only where verified results justify the extra cost.
The absence of abstentions in this run also deserves testing on deliberately
ambiguous and contradictory cases before enabling more automatic routing.

The recommendation stack remains: maintained descriptions → held-out retrieval
benchmark → independently verified evaluation → measured evidence-budget choice
→ routing qualification. No additional diagnostic panels or acknowledgements
are needed for this stage.

## Validation

- Focused benchmark and live-description unit regressions: **74 tests passed**.
- Final full backend coverage run: **1,220 suites / 34,547 tests passed**.
  Statements/lines: **89.99%**; branches: **81.15%**; functions: **92.11%**.
- Coverage ratchet passed without baseline changes, using the current server
  report and the existing coverage report for unchanged client source.
- PostgreSQL/pgvector integration: **3 suites / 10 tests passed**, including the
  new 100-title snapshot, read-only transaction, whole-cohort exclusion, and
  expired/different-model cache rejection checks.
- Server lint/typecheck, documentation lint, static ESM import checks, and ESM
  mock-shape checks passed. `git diff --check` passed.
- Rebuilt Compose and verified healthy startup. All five new service modules
  and the CLI matched their running-container copies byte-for-byte.
- Repeated the 100-title preflight plus nine local generation calls on the final
  rebuilt code. Snapshot/sample fingerprints matched the full benchmark; all
  calls succeeded and no estimated input-budget violation was reported.
- No client source changed; this component introduces no UI or HTTP API contract.

## PR scope

GitHub MCP returned no open PRs in `cloudbyday90/Classifarr` on September 11,
2026. There was no random open PR available to implement. No PR was merged,
reopened, or invented.

## CI boundary

The existing production-naming gate still reports **26** production references
against a zero-reference baseline. This benchmark did not add to that count or
relax its baseline. Do not describe repository-wide CI as green until that
separate existing gate failure is resolved.
