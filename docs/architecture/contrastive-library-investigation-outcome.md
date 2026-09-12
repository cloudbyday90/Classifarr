# Contrastive library investigation outcome

## Scope

This implements the [controlled investigation design](contrastive-library-investigation-design.md)
as an opt-in local benchmark mode. Legacy benchmark and 25-case investigation
behavior remains available. No routing thresholds, policies, model weights,
media placements or UI settings are changed.

## Reproduction

```powershell
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false `
  -e 'PGOPTIONS=-c default_transaction_read_only=on -c statement_timeout=15000 -c lock_timeout=1000' `
  classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs `
  --seed classifarr-profile-20260912 --size 300 --exclude-prior-sizes 100,200 `
  --folds 5 --generate-cases 300 --context 32768 --max-minutes 20 `
  --learned-profiles --contrastive-investigation
```

Omit generation cases for preflight. The same 300-title cohort from the
[previous grouped run](grouped-library-benchmark-outcome.md) is reused, not an
additional 300 titles. It contains 144 movies and 156 TV titles, with the prior
100/200 cohorts excluded from sampling. All ten libraries retain training
evidence; one small movie library has no remaining new sample identities.

The baseline was regenerated because private per-item answers were not retained.
It again agreed with observed placement on 243/300 cases (81%). All 57 valid
disagreements were selected, with 57 distinct agreeing controls: 54 matched by
library and media type, three by media type. There was no control shortfall or
deferred disagreement.

### Provenance and limits

Sample fingerprint:
`6a35df4dfced22a5c8f7a608ae26cdfac8db6316f386328be451463f76a040ce`.
Fold assignment:
`49e220b946dfd7e8e019491b374fa3050399808ca67d6e5a125ea32fc086a784`.
Both match the prior run. Each of five folds holds out 60 descriptions, including
copies; training retains 6,582–6,583 descriptions and all ten libraries.

This run's snapshot fingerprint is
`9474472315c92add02b350668e09e87cff6a84339dc2ccba755add524d4e784d`,
not the previous `ff30d1a8...` fingerprint. Separate preflight processes produced
different full snapshot hashes, despite matching cohort and coverage summaries.
The cause is not established; do not claim identical historical training input.
Both modes produce identical fingerprints and baseline prompts when given the
same in-memory snapshot, verified by a regression test and local diagnostic.
All baseline and treatment comparisons here use one frozen snapshot, so the
within-run comparison does not mix those separate reads.

Generation used installed local `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`,
context 32,768, temperature zero, seed 42, thinking disabled, output limit 64.
Embeddings were `mxbai-embed-large:latest`, 1,024 dimensions, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.

## Validation and measurements

The experiment completed 642 local generation calls: 300 baseline calls and
342 comparisons. All outputs were valid proposals, with zero abstentions,
provider failures, output/context-limit signals or missing-evidence results.
Actual input truncation remains unknown; no guarantee is inferred from the
absence of a limit signal. Contrastive evidence was available for all 114 cases
and replaced 708 example positions across those packets.

| Comparison | Agreed among 57 baseline disagreements | Still agreed among 57 controls | Controls losing agreement | Net agreement change on selected 114 |
| --- | ---: | ---: | ---: | ---: |
| Ordinary examples, original names (baseline) | 0 | 57 | 0 | 0 |
| Ordinary examples, anonymous labels | 21 | 51 | 6 | +15 |
| Contrastive examples, original names | 9 | 53 | 4 | +5 |
| Contrastive examples, anonymous labels | 17 | 51 | 6 | +11 |

Anonymous ordinary examples changed 23 disagreement proposals; 21 aligned with
observed placement and two changed to another disagreeing destination.
Contrastive named examples changed nine, all aligning with observed placement.
Contrastive anonymous examples changed 18, with 17 aligning.

Mean generation latency was 884.64 ms for the baseline, with 808.57 input tokens.
Across the two equal-size selected groups, ordinary anonymous comparisons used
807.82 mean tokens and 882.54 ms; contrastive named used 815.74 and 882.49 ms;
contrastive anonymous used 816.50 and 880.59 ms. Timings were collected while
local validation also ran and are not a controlled throughput benchmark.

The largest baseline disagreement pairs were TV stratum 7 to 9 (17 cases),
TV 6 to 10 (seven), and TV 8 to 10 (six). Stratum numbers are anonymous positions
in this snapshot's library-ID ordering, not hardcoded categories or reusable
library identities. No names, descriptions, item IDs or raw answers are published.

These are conditional case/control measurements, not overall accuracy or an
estimate of improvement across all 300 titles. The remaining 186 agreeing cases
were not rerun under the treatments. There are zero independent labels; observed
placement can itself be wrong. No model answer became a verified training label.

### Engineering checks

- Backend: 1,231 suites and 35,066 tests passed with coverage. Statements/lines
  90.03%, branches 81.45%, functions 92.13%.
- Focused final-code tests: six suites, 87 tests passed, including unchanged
  baseline prompts and the final progress-field naming adjustment.
- PostgreSQL integration: seven live-inventory-description tests passed,
  including held-out example exclusion and unchanged vector-cache row counts.
- Server and client lint/typechecks, ESM static-import and test mock-shape checks,
  documentation lint and whitespace checks passed.
- Coverage ratchet passed using the new backend report and the existing report
  for the unchanged client. The full client unit suite was not rerun.
- Local Compose benchmark ran with read-only database defaults, bounded queries,
  existing cached vectors and installed local models. No paid fallback, model
  download, policy edit, label write or media move was performed.
- Final Compose image rebuilt and became healthy with its database connected.
  Its investigation-service SHA-256 matches the final workspace file. The only
  post-measurement runtime edit renamed the progress field; prompt and selection
  behavior were unchanged. The unchanged frontend build layer was reused.

The production naming gate remains blocked by 26 pre-existing references against
its zero-debt baseline. Two new progress-field references were renamed to `stage`;
this change adds no naming debt and does not weaken the gate. Do not describe
all CI gates as passing.

## Recommendations after measurement

| Recommendation | Pros | Cons / boundary |
| --- | --- | --- |
| Keep nine examples as the current baseline | Low token cost; current production behavior preserved | Existing disagreements remain unresolved |
| Evaluate content-first, anonymous-label comparison across the full cohort next | Largest signal here; tests organic library understanding without relying on naming conventions | Names can convey legitimate intent; six selected controls lost agreement |
| Keep contrastive selection experimental | Bounded and library-name-agnostic | Smaller observed benefit than name masking; no proven accuracy gain |
| Do not add another declaration screen or auto-label model answers | No extra user work and no circular training labels | Requires trustworthy outcome evidence before claiming validated learning |

Final recommendation stack: **learned inventory profiles + nine-example retrieval
→ full-cohort content-first comparison → independently validated outcomes
→ measured production adoption**.

The next high-value component is a controlled, full-cohort content-first comparator:
evaluate all 300 titles with anonymous labels and unchanged ordinary examples,
report per-library gains and regressions, and retain explicit user policies as
separate constraints. Use the existing descriptions and learned metadata, not
hardcoded library categories. Do not choose treatments using knowledge of whether
the baseline agrees with inventory; that diagnostic selection is not available
as a trustworthy production decision rule. Keep all current routing safeguards
until the broader comparison and outcome validation support a change.

Also retain canonical per-component snapshot hashes in future aggregate reports
to localize provenance differences without storing private corpus contents.

Follow-up: the [full-cohort paired comparison](content-first-library-comparison-outcome.md)
now covers all 300 cases. It found more lost agreements than recoveries, so the
selected case/control result above must not be used to justify a blanket switch.

## Pull requests

GitHub MCP returned no open PRs for this repository on September 12, 2026,
both initially and at final recheck. No random PR was available to implement
locally; none was merged. Changelog changes remain under Unreleased, with no
release, tag or version bump.
