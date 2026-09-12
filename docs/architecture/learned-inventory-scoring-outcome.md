# Learned inventory scoring outcome

## Delivered behavior

Fresh description comparisons and organically learned metadata now participate
in policy scoring, not just the AI prompt. A clearly supported library can keep
its original policy score instead of receiving the blanket weak-evidence
discount. There is no new score boost, probability claim, manual declaration,
acknowledgement or settings panel.

The comparison covers the full eligible same-media pool, up to 64 libraries,
before the existing three-candidate AI boundary. Policy exclusions, RAG opt-out,
native ineligibility, unknown suppression reasons and configured thresholds
remain intact. Newly qualifying automatic-band results require the existing
local AI consensus and fresh-evidence receipt; the scoring component cannot
route media itself. Existing strong policy decisions are unchanged.

Three small ESM modules separate description comparison, score projection and
retrieval orchestration. The consensus path shares the same comparison rules.
The existing expandable score explanation receives one plain-language status;
no new UI section or HTTP endpoint was added.

See the separate [design document](learned-inventory-scoring-design.md) for
official research, alternatives, pros and cons, and the recommendation stack.

## Additional 200-title policy replay

The user requested 200 additional samples. The replay used 100 movies and 100
TV shows across all ten active libraries, five of each type. The earlier 100
seeded synopsis groups were excluded from both sample selection and training;
the additional 200 were also excluded from training together. This includes
synopsis copies, not just individual identifiers. One sampled movie belongs to
two libraries, so membership counts sum to 201 while distinct titles sum to 200.

Seed: `classifarr-profile-20260912`.
Sample fingerprint:
`6d0331ca6462abb62518d55e4aedc7ec7783269d59e15b3b696738a8422b4f1d`.

The read-only local probe reused production policy evaluation and the pure
inventory scoring/decision projections. It supplied frozen held-out description
neighbors and learned profiles, and an empty historical RAG cache. It did not
generate model responses, write evaluation labels or route media. This is a
controlled scoring comparison, not a full live-pipeline accuracy measurement.

| Result | Before | After |
| --- | --- | --- |
| Weak-evidence review flags | 176 | 173 |
| Manual decisions | 20 | 20 |
| Destination selections | 163 | 160 |
| Confirmations | 11 | 14 |
| Existing automatic policy decisions | 6 | 6 |
| Leading destination agrees with observed placement | 173/200 | 173/200 |

Three candidates retained their original scores: increases of 28.48, 32.41 and
28.46 points relative to their discounted scores. None exceeded the original
raw score or reached the configured automatic threshold. No leader changed,
and no observed-placement agreement was lost. Thus this sample demonstrates
three more supported confirmation decisions, **not fewer total confirmations
or newly automatic routes**. Existing placements are not verified correctness
labels; accuracy remains unknown.

Of 193 attempted inventory comparisons, three had distinct support, 110 were
ambiguous, and 80 lacked three training descriptions in at least one candidate.
The latter is an important sampling limitation: the smallest movie library has
29 distinct descriptions, and excluding the previous ten plus this sample's
remaining 19 leaves it empty. This is not a broken production index. The other
movie libraries retained 499, 366, 1,210 and 2,778 training descriptions; TV
libraries retained 15, 37, 237, 269 and 934. Seven decisions did not attempt this
new comparison because they had no eligible weak-scoring work.

## Additional local AI comparison

All 600 local generations completed on the same new cohort, comparing 9, 30 and
100 retrieved examples per title. Sample fingerprints matched the policy replay.
The learner had 6,342 training descriptions and trained nine libraries; the
tenth was emptied by the holdout described above. All ten libraries remained
represented in the evaluation sample.

| Examples per title | Agreement with observed placement | Abstentions | Mean input tokens | Mean latency |
| --- | --- | --- | --- | --- |
| 9 | 132/200 | 1 | 799 | 304 ms |
| 30 | 141/200 | 0 | 2,180 | 354 ms |
| 100 | 137/200 | 0 | 6,790 | 856 ms |

There were no invalid responses, generation failures or reported output/context
budget failures. Input truncation remains unknown. The nine-example mean
includes an 8.1-second outlier; p95 latencies were 375, 514 and 1,104 ms.
Thirty examples changed 15 proposals/abstentions versus nine, while 100 changed
16. Thirty examples produced nine more placement agreements than nine examples
with about 2.7 times the input tokens. A hundred examples used about 8.5 times
the input tokens and did worse than 30 on this cohort.

The learned shortlist missed 19 observed destinations, recovering three and
introducing one miss relative to description-only selection. This shortlist is
not the live policy-constrained shortlist. The depleted small library confounds
these measurements; neither the 70.5% best placement agreement nor the score
replay's 86.5% should be presented as classification accuracy. There are zero
independent correctness labels. This experiment measures proposal agreement,
not the authorization rate of the policy-scoring change.

Generation used installed `gemma4:e4b`, context 32,768, temperature zero, seed
42, thinking disabled and a 64-token output limit. Embeddings used installed
`mxbai-embed-large:latest`, 1,024 dimensions. No runtime model, retrieval-budget
default or automatic-routing threshold was changed based on these results.

Reproduce the AI comparison inside local Compose with read-only PostgreSQL:

```text
node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 200 --exclude-prior-size 100 --generate-cases 200 --context 32768 --max-minutes 20 --learned-profiles
```

The new optional exclusion flag recreates the earlier seeded sample from the
current snapshot. Comparing runs requires stable snapshot/sample fingerprints;
the flag does not reconstruct a historical inventory after membership changes.
Default benchmark size remains 100; maximum size is now 200. Generation remains
explicit and bounded. No paid provider, fallback or model pull was used.

## Verification and limitations

- Full backend coverage run: 1,229 suites, 34,953 tests passed. Backend coverage
  was 90.01% statements/lines, 81.35% branches and 92.10% functions.
- Full frontend coverage run: 365 files, 5,036 tests passed after correcting a
  new test fixture. Frontend coverage was 85.49% statements, 77.39% branches,
  84.98% functions and 87.55% lines.
- Latest focused backend run: 10 suites, 195 tests passed; an additional
  scoring-to-consensus regression test then passed in its 33-test suite.
- Real PostgreSQL integration: four suites, 15 tests passed, including evidence
  refresh after metadata edits, review recovery and automatic-history exclusion.
- Backend/frontend lint and typechecks, ESM import/mock-shape checks and the
  coverage ratchet passed. No baseline was lowered.
- Compose rebuilt both application layers and became healthy. Testing did not
  move media; route authority is exercised with mocked Arr calls.
- The unrelated production naming gate remains blocked at 26 references against
  a zero baseline, unchanged from the previous commit. This is not an all-green
  CI claim, and the gate was not weakened.
- GitHub MCP returned no open repository PRs. No random PR was available to
  implement and none was merged. No release or tag is created.

## Next high-value item

Implemented in the [grouped-library benchmark follow-up](grouped-library-benchmark-outcome.md):
five library-aware folds, a same-200 preflight comparison, and a new 300-item
cohort. The recommendation below records the reasoning at this commit.

Use **library-size-aware, grouped held-out folds** before tuning retrieval
thresholds. Evaluate the same 200 additional titles while retaining training
examples in small libraries; exclude each query identity and every synopsis
copy from its own fold. Report per-library performance and evidence gaps,
separately from verified corrections. This avoids interpreting an artificially
emptied library as a production learning failure.

Then use those measurements to improve the fixed similarity/separation gates
and organic score reliability. Evaluate an adaptive nine-to-30 example budget
for ambiguous cases; this run does not justify a global jump to 100 examples.
The goal remains fewer unnecessary user reviews,
not more purpose declarations or diagnostic panels. Do not raise scores or
lower automatic thresholds solely to make benchmark results look better.
