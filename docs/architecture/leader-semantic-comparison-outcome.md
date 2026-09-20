# Library-agnostic semantic comparison outcome

## Implemented on 20 September 2026

Implemented the [design](leader-semantic-comparison-design.md) with focused ESM
modules for the comparison contract/prompt, bounded evaluation and redacted report.
The existing local-only inference client gained a separate full-scope experimental
schema; the existing two/three-candidate live and adjudication contracts did not
widen. The benchmark gained exclusive `--leader-semantic` mode.

No application version, dependencies, database schema, API, UI, policy thresholds
or routing authority changed. No release, acknowledgement or user question was
created. This is an offline evaluation of organic library evidence, not model
fine-tuning or a claim that live classification has already improved.

## Evidence and safeguards

The query supplies its description and allowlisted genres, keywords, studio,
certification and language. Candidates supply at most three provenance-clean
description examples. Names, titles, IDs, prior destinations and policy scores
are absent from prompts. All candidate libraries stay in scope; oversized,
incomplete, shared or query-copy evidence is excluded rather than silently
shortlisting a smaller pool.

Each attempted case makes two local calls with reversed candidate/example order.
A stable nonzero mapped choice is reported as support; different choices are
order-sensitive and withheld. Schema failures, suspected truncation, model drift
and provider errors stop the run without repair loops. Cancellation closes the
runtime, and a fresh invocation can retry safely. If discovery admission defers
after inference starts, the outer report preserves actual call counts.

The configured installed model was `gemma4:e4b`, digest
`c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
Both passes use temperature 0, seed 42, a 32,768-token context and a 64-token output
ceiling. The transport checks model identity before and after generation and has
no paid/remote provider fallback, model pull or domain writer.

## Compose measurements

An eight-case smoke run was followed by the complete eligible set from the same
300-description cohort (150 movies and 150 TV shows across ten library strata).
The smoke cases are repeated observations, not eight
additional independent examples. The full run verified an unchanged source.

| First cohort result | Ordinary ambiguous cases | Library-withheld probes | Total |
| --- | ---: | ---: | ---: |
| Attempted | 25 | 3 | 28 |
| Stable proposal | 18 | 2 | 20 |
| Order-sensitive / withheld | 7 | 1 | 8 |
| Consistent abstention | 0 | 0 | 0 |

On the 18 stable ordinary proposals, placement agreement gained nine and lost two;
both losses were TV cases. Fifteen stable proposals were under an existing review
veto, which remained intact. The first cohort's exact baseline and all 429
corrupted-evidence rejection controls were unchanged. No semantic proposal was
used to route media, relabel inventory or train a policy.

These are **placement agreements, not verified accuracy**. Likewise, two stable
proposals after withholding the original library are not two proven mistakes:
another library may legitimately fit the content. Stability alone does not prove
correctness. The model did not consistently abstain on any first-cohort case,
which warrants attention to evidence sufficiency rather than relaxing thresholds.

The complete first run made 56 local calls, used 62,602 prompt / 336 output tokens,
and reported 13,437 ms cumulative generation latency. This is warm local inference
time, not end-to-end benchmark time or a cross-machine performance claim.

One initial expanded-run attempt deferred as `busy` with zero calls. A later
invocation acquired the existing lease normally; no lock or memory cap was bypassed.

### Separate held-out cohort

The second run uses `--exclude-prior-sizes 300`, the same seed and an unchanged
prompt/selection protocol. This excludes every first-cohort description group from
the evaluation sample; prior samples may still contribute clean training references.
The first attempt was invalidated by changes to the metadata/observed-traits
fingerprints after 44 calls. Those outputs are not included in the valid results.
A fresh retry completed with no source changes and matched the first cohort's
source-component fingerprints. Both runs kept the same model digest and settings.

The valid second sample contained 143 movies and 157 TV shows across nine remaining
library strata; one 30-description library was exhausted by the first cohort.
It produced 16 ambiguous nominations and six supported library-withheld probes.

| Separate cohort result | Ordinary ambiguous cases | Library-withheld probes | Total |
| --- | ---: | ---: | ---: |
| Attempted | 16 | 6 | 22 |
| Stable proposal | 7 | 1 | 8 |
| Order-sensitive / withheld | 9 | 5 | 14 |
| Consistent abstention | 0 | 0 | 0 |

Stable ordinary proposals gained six placement agreements and lost none; all seven
remained under review veto. The 338 integrity controls all rejected corrupted
evidence. The run made 44 calls, used 50,873 prompt / 264 output tokens, and reported
8,218 ms cumulative generation latency. The exact arm computed 1,273,482,240
components, below the unchanged two-billion ceiling.

Across the two valid runs, 50 semantic cases drawn from 600 distinct held-out
descriptions produced 28 stable proposals and 22 order-sensitive results. Ordinary
cases gained 15 placement agreements and lost two; no live changes followed.
The valid runs made 100 calls. Including the repeated smoke run and invalidated
attempt, this task made 160 local generation calls, not 160 independent cases.

Fixed seed and temperature are controls, not a reproducibility guarantee: the
invalidated attempt and valid retry had the same plan fingerprint but different
aggregate choices. These exploratory results establish neither accuracy nor a
safe live-promotion threshold. Strong ordering sensitivity and absent consistent
abstention make evidence sufficiency and repeatability the next priorities.

Sample fingerprints:

- First: `87f58693d97f5e4e251b93bdb0ab7d6a1e1bcf909b99e32c404520e65bbe231a`.
- Separate: `af7f968db982813130f515f2c660c0e14ad7ecbabe9b46bb8c141bb5af6dcc6f`.

Compose remained healthy and read-only with no restarts or memory-limit failures.
The observed cgroup peak after the second run was 1,740,181,504 bytes, including
background application work rather than isolated benchmark memory.

## Reproduction and privacy

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-leader-20260920 --size 300 --folds 5 --leader-semantic --generate-cases 32 --context 32768 --max-minutes 30
```

Add `--exclude-prior-sizes 300` for the separate cohort. Omit `--generate-cases` for
a zero-generation preflight. Budgets remain capped at 32 cases / 64 calls, 64
retained plans and four million retained prompt bytes, alongside existing discovery,
exact-neighbor, time and memory ceilings. Unattempted and excluded cases are reported.
Console artifacts stay under ignored `.tmp/`; only aggregate results are committed.

## Validation and delivery

Focused tests cover exact response grammar, complete candidate scope, private
projection, instruction-like content, reordered index mapping, abstention,
call/retention/context budgets, provider failure, cancellation, fresh retry,
post-generation source drift and nonzero-call deferred outcomes.

Validation passed:

- Full backend coverage run: 1,353 suites / 39,364 tests.
- Final focused run, including the later call-accounting and strict-context tests:
  eight suites / 177 tests. The three new services have 100% line/function coverage
  and 97.45% combined branch coverage in the isolated final coverage run.
- Database integration: three suites / 24 tests.
- Coverage ratchet, lint, type checks, CI preflight, dependency checks, ESM import
  and mock-shape checks, Markdown lint and whitespace checks.

The coverage ratchet uses the fresh full backend report and existing client
coverage; the unchanged frontend suite was not rerun. The final focused run tests
the small call-accounting and strict-context changes made after the full run started.

GitHub had no open PRs to select. The preceding commit's CI build/database checks
and release acceptance readout passed. The pre-existing production-naming gate
still reports 43 production references; no waiver or baseline change is included.

## Recommendations

| Recommendation | Benefit | Limitation |
| --- | --- | --- |
| Keep anonymous, full-scope paired comparison offline | Measures meaning without name shortcuts or user setup | Twice the inference cost; stability is not accuracy |
| Preserve review vetoes and explicit abstention | Prevents a promising aggregate from authorizing individual routes | Does not yet reduce live review volume |
| Investigate TV disagreements and evidence sufficiency next | Targets observed weaknesses in organic evidence | Existing placement alone cannot settle which destination is correct |

Final stack: validated inventory → provenance-clean examples → context-bound exact
baseline → anonymous semantic comparison → consistency/abstention → verified
snapshot report → unchanged routing safeguards.

The next high-value item is evidence-grounded per-candidate fit and contradiction
grading, starting with a content-evidence audit of the TV disagreements. Compare
item/show metadata and competing-library examples, identify missing or misleading
evidence, explicitly distinguish insufficient evidence from a positive fit, and
measure repeated/reordered stability on a disjoint cohort. Do not add genre-name rules,
more acknowledgement screens, or promote a model's consistent guess as truth.
