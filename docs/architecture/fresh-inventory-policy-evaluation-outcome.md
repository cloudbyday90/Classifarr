# Fresh inventory policy evaluation outcome

## Delivered component

The [design document](fresh-inventory-policy-evaluation-design.md) records the
official research, alternatives, security boundaries and recommended stack.

The existing inventory benchmark CLI now has an exclusive
`--fresh-policy-evaluation` mode. Small ESM services own the snapshot/runtime,
fold-local evidence, production policy adapter, generation orchestration and
aggregate reporting. Production policy loading and profile scoring accept
explicit readers; live defaults and routing behavior remain unchanged.

This evaluates current configuration against fresh item metadata and held-out
library observations. It does not replay `classification_history.policyResult`.
Cached inventory descriptions provide RAG evidence; history RAG, learned patterns,
outcome history and exact-item inventory shortcuts are explicitly unavailable.
No policy, routing, learning, acknowledgement or UI setting was added or changed.

## Reproduction and interpretation

Run after the local Compose application is rebuilt and healthy, without concurrent
heavy builds/tests. This command uses the existing 300-item cohort, not 300 newly
added items or 300 duplicated retained policy decisions:

```sh
docker compose exec -T -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false classifarr \
  node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --fresh-policy-evaluation --seed classifarr-profile-20260912 --size 300 \
  --exclude-prior-sizes 100,200,300,300 --folds 5 \
  --generate-cases 300 --context 32768 --max-minutes 120
```

Omit `--generate-cases` for a zero-generation preflight. Generation count is an
upper bound, not permission to bypass production AI-mode admission. Verification
and generic classification modes are reported but not executed by this bounded
adjudication component. The snapshot closes before any model generation.

The cohort fingerprint is
`ca0cb510c117061372a669e58a69fca6975f1f4a50c2b5da6ff26cf9742784ba`;
the five-fold assignment fingerprint is
`77cb7990b67c02ab7db01bb764334910af9e744d4df04ad8979aa78f98bbe7f3`.
Each fold holds out 60 descriptions, including every identity sharing those
descriptions. Prior cohorts are excluded from sampling, not from other folds'
training. Query membership never enters the evaluator or its AI prompt.

The sample contains 172 movies and 128 TV shows. Seven libraries supply new test
cases; three smaller libraries have no unused cohort items left after the earlier
cohorts. All ten libraries remain in training/candidate consideration. Do not
describe this cohort as independent test coverage for all ten libraries.

Existing placements are weak labels, not verified truth. Agreement counts are not
accuracy, and policy scores are not calibrated correctness probabilities. Current
policy configuration can itself reflect historical inventory influence; this
evaluation does not retrain or erase that configuration.

## Completed local measurement

The final full run completed on September 12, 2026: 300 fresh policy evaluations,
248 admitted local generations, 248 valid proposals, no generation failures or
abstentions. The other 52 cases were not forced through adjudication: 31 selected
abstention, 16 verification and five policy-auto/skip. Verification remains
unmeasured by this component. Policy-auto is an assessed action, not an executed
route.

| Measurement | Movies | TV | Total |
| --- | ---: | ---: | ---: |
| Fresh policy cases | 172 | 128 | 300 |
| Policy leader agrees with placement | 123 | 102 | 225 |
| Placement absent from policy pool | 6 | 2 | 8 |
| Admitted AI proposals | 144 | 104 | 248 |
| AI proposal agrees with placement | 124 | 101 | 225 |
| Placement absent from admitted shortlist | 2 | 1 | 3 |
| AI differs from policy leader | 26 | 15 | 41 |
| Consensus-qualified proposals | 2 | 0 | 2 |
| Consensus rejected: policy review required | 142 | 104 | 246 |

AI placement agreement is 225/248 (90.7%); policy leader agreement is 225/300
(75.0%). These have **different denominators** and do not establish an accuracy
improvement. The 23 AI/placement disagreements need diagnosis; neither current
placement nor the model is automatically the correct answer.

| Anonymous library stratum | Type | Sampled | AI proposals | Placement agreement | AI/policy disagreements |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Movie | 0 | 0 | 0 | 0 |
| 2 | Movie | 43 | 41 | 31 | 6 |
| 3 | Movie | 43 | 32 | 32 | 2 |
| 4 | Movie | 43 | 41 | 39 | 4 |
| 5 | Movie | 43 | 30 | 22 | 14 |
| 6 | TV | 0 | 0 | 0 | 0 |
| 7 | TV | 0 | 0 | 0 | 0 |
| 8 | TV | 42 | 39 | 39 | 6 |
| 9 | TV | 43 | 31 | 30 | 3 |
| 10 | TV | 43 | 34 | 32 | 6 |

Movie strata 2 and 5 account for 18 of the 23 AI/placement disagreements. Include
those overlap-heavy cases when assessing review reduction, not only the overall
average. These are anonymous report groups, not new hard-coded library rules.

Mean measured generation latency was 2,038.15 ms, with 663,576 prompt tokens and
3,611 output tokens across 248 calls. This excludes preparation and model
inspection time and excludes preliminary attempts documented below. Generation
used installed `gemma4:e4b`, context 32,768, output budget 256, temperature zero,
seed 42, thinking disabled and the production two-field adjudication schema.
Embedding used cached `mxbai-embed-large:latest` vectors with 1,024 dimensions.

- Generation digest: `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.
- Embedding digest: `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Source fingerprint: `5a5e50af06b4fb918114edfc70ebf6945a9dad6668a2306cf31ba1de75e78c76`.
- Evidence fingerprint: `fa1a095ecb715913930cb8b2d9c99e78bff9f3b915a526e4b29d03ddd0331ecc`.

The frozen evaluation remained valid while live metadata/observed traits
refreshed. The report correctly records `sourceVerified: false`,
`evaluationSnapshotValid: true` and `liveMetadataRefreshed: true`. No policies,
configuration, library scope, descriptions, vectors or model identity drifted.
These measurements describe the starting snapshot, not the refreshed live state.

No route passed the final safety assessment; the offline adapter intentionally
does not mint the live revalidation/consensus receipt. Even the two
consensus-qualified proposals are not reported as automatic routes. There were
zero routing receipts, user questions, learning records or live routing changes.
Missing metadata was counted: 12 cases lacked certification and 44 lacked
keywords. No case lacked genres or language in this snapshot.

## Local integration findings

The first preflight exposed a metadata-envelope collision: the shared inventory
identity reader interprets a `metadata` property as the identity envelope. The new
SQL projection now uses `evaluation_metadata`, with regression coverage that
checks attributable keywords and language reach scoring without changing identity.
No model generation occurred before this correction.

A subsequent run made 25 generation calls before stopping at its first periodic
snapshot/representation recheck. Buffered shell output initially hid that progress. Those calls
are additional cost, not part of a completed cohort result. A separate pair of
read snapshots was stable, although earlier and later preflights had different
source fingerprints. The failed run's exact recheck error and changed fields were
not retained, so this document does not assign it to a particular background job.
Fingerprinting now covers the inputs actually consumed by evaluation, while
ignoring unused refresh timestamps. The later metadata-only freshness distinction
is documented below; authority and candidate-scope changes still fail closed.

The integration check also exposed concurrent queries queued on one PostgreSQL
transaction client. The dedicated reader now serializes them; production bulk
readers remain reusable without changing their shared behavior.

A later diagnostic completed 23 comparisons. A full diagnostic passed the earlier
checkpoints but was deliberately stopped after 81 completed request attempts when
review found a missing active-library flag in the offline projection. The query
already filtered active libraries, but consensus also requires `is_active: true`
on each candidate. That field is now selected and tested; the production check
was not relaxed. A second earlier full attempt had also stopped after 25 calls.
Those preliminary runs totaled 154 completed request attempts, with possibly one
additional in-flight request when the diagnostic was stopped. None is represented
as a completed 300-item benchmark.

If a periodic or final snapshot check fails after inference, the runner now
returns an `invalidated` aggregate report, preserves consumed call counts and
exits unsuccessfully. It exposes only a fixed failure category, not database,
model or metadata error text. Drift before inference still prevents generation.

Two further 25-call runs isolated the repeat failure to changes in inventory
metadata and observed traits. Policies, configuration, library/description
membership and vectors were unchanged. This established that a live-freshness
requirement was interrupting an otherwise frozen, read-only evaluation during
background enrichment. All cases, prompts and fold models are prepared from one
snapshot before inference; later metadata refresh cannot change those inputs.

The runner now reports metadata-only refresh without restarting the evaluation.
It distinguishes `evaluationSnapshotValid` from `sourceVerified`, identifies
`snapshotScope: frozen_at_start` and records `liveMetadataRefreshed`. Configuration,
policy, library/description scope, vector or model changes still invalidate the
run. This permits organic enrichment to continue without treating old evidence
as current routing authority. The two diagnostic runs bring preliminary completed
request attempts to 204, plus the possible in-flight request noted above.

Final review added two failure-path protections after the completed measurement:
the runtime checks the immutable startup logging configuration before reading
private content, and generation-model drift invalidates the report and stops
further calls. The completed run already used safe logging flags and a stable
model. These changes do not alter its scoring or successful-generation path.

## Validation

- Focused policy, replay, consensus and fresh-evaluation coverage: 21 suites,
  361 tests passed. The five new services reached 100% statement, line and
  function coverage, with 95.67% branch coverage.
- The full backend coverage sweep passed 1,239 suites and 35,552 tests, with one
  failure: a code-health SQL-interpolation rule violation in
  the optional active-library projection. Two fixed SQL statements now preserve
  both query shapes without interpolation or an allowlist exception. The full
  code-health suite plus affected benchmark tests passed: nine suites, 24,106
  tests. A final Jest failed-suite recheck also passed all 23,996 code-health
  tests. No SQL rule or test threshold was relaxed. These are an initial sweep
  plus corrected-suite reruns, not a claim that the first sweep was all green.
  Backend coverage is statements/lines 90.04%, branches 81.73%, functions 92.13%;
  the fixed-query module has 100% coverage in the full report. The coverage
  ratchet passed without baseline changes.
- Full client repeat: 365 files, 5,036 tests passed. The initial concurrent run
  timed out in one router test; all 12 router tests passed in isolation and the
  clean full repeat passed without test or timeout changes. Coverage remains
  statements 85.49%, lines 87.55%, branches 77.39%, functions 84.98%.
- Full database integration: 139 suites, 1,608 tests passed; one existing
  suite/test skipped.
- Backend lint, server/client type checks, ESM static-import and mock-shape
  checks passed. Markdown lint passed.
- The final Compose image was rebuilt and healthy. All five new service hashes
  and the fixed repository-query module matched local files. Its zero-generation
  preflight evaluated all 300 cases, admitted 248 and retained the same sample
  fingerprint; background metadata refresh was explicitly marked again.
- The production-naming gate still reports 26 pre-existing references against
  the zero-reference baseline, matching the preceding commit's documented
  result. This change does not resolve or relax that unrelated gate.

## Next high-value component

Follow-up: the resolver and paired evaluation are now implemented in
[learned-evidence review resolution](learned-evidence-review-resolution-outcome.md).
It qualifies 147 comparisons versus two under existing consensus, with one
observed-placement disagreement. Live promotion remains pending per-library
novelty calibration; the recommendation below records this evaluation's original
handoff.

Implement a **library-agnostic learned-evidence decision resolver**. Its job is to
distinguish genuinely conflicting evidence from a low aggregate policy score, so
strong description retrieval, contrastive library metadata and an agreeing AI
proposal can resolve routine cases without asking the user to declare every
library's purpose.

The measured bottleneck is review resolution, not response formatting: all 248
responses were valid, but 246 were rejected by the first consensus review gate.
Of the final safety assessments, 237 specifically carried manual policy-evidence
review. These overlapping gates are not separate failed items.

Keep explicit hard exclusions, media-type boundaries, metadata conflicts and
stale evidence as blockers. Separate those from soft evidence insufficiency.
Evaluate the new resolver against the unchanged decision path on the same held-out
cohort, including the 23 placement disagreements, eight policy-pool misses and
three admitted-shortlist misses. Measure review reduction and disagreement by
library, not just average score. Do not globally lower thresholds, add another
acknowledgement screen, or label model agreement as verified correctness.

Recommended stack remains learned library metadata + held-out description RAG →
policy-eligible shortlist → strict AI proposal → evidence-based review resolution
→ fresh live revalidation before any automatic route. The resolver and its
validation are the next component; live routing was deliberately unchanged here.

## Pull request availability

GitHub MCP searches on September 12, 2026 returned no open Classifarr pull requests.
There was no random open PR to implement. No PR was merged, and no release,
version bump or release tag is included.
