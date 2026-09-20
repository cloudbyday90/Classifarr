# Compact inventory evidence outcome

Date: 2026-09-19

## Implementation

The [design](compact-inventory-evidence-design.md) is implemented as a pure bounded
ESM selector and protocol-v2 paired benchmark wiring. Raw prompts retain their
previous byte representation in both candidate orders. The compact arm uses the
same formatter with at most three relevance/diversity-selected examples, rather
than appending context. Aggregate reports identify the selection version and
constants, pool size, selected examples, non-raw selections and empty candidates.

Live retrieval, routing, UI, database schema, model configuration and background
recovery are unchanged. No version bump, release or tag is planned.

## Verification and measurements

Six focused suites passed all 107 tests, including a byte-identical raw-control
regression test in both candidate orders. Three relevant real-PostgreSQL
integration suites passed all 22 tests. Lint,
client/server types, copyright/dependency preflight, ESM import and mock-shape
checks passed. All 1,376 Markdown files passed lint. The new selector has 100%
line, branch and function coverage in the full backend report.

Frontend regression passed 369 files / 5,128 tests in 385.68 seconds. Backend
regression finished 1,327 suites / 38,621 tests in 1,012.031 seconds: 1,326 suites
and 38,620 tests passed; the unchanged 8,000-item recovery test exceeded its
60-second limit while the build and other checks overlapped. Its entire five-test
suite subsequently passed in isolation with V8 coverage in 33.47 seconds, without
changing assertions or deadlines. That rerun is separate evidence, not a claim
that the original full run was green.

The current full reports pass the coverage ratchet: backend 90.25% lines / 83.18%
branches; frontend 87.67% lines / 77.54% branches. No coverage thresholds or
baselines were relaxed. The production-naming gate still reports its pre-existing
43 references against a zero baseline; this patch adds no references or waiver.

## Controlled local comparison

The warmed application initially rejected the CLI with `deferred / memory_pressure`.
This was an unverified, unsuccessful admission attempt, not a completed benchmark.
A fresh local Compose restart admitted the comparison with the same 2 GiB limit,
background services enabled and no memory-policy bypass. No host build or heavy
test workload overlapped the successful comparison. The shared lease coordinated
heavy discovery; ordinary synchronization and recovery were not disabled.

The existing CLI ran with read-only database transactions:

```sh
node src/scripts/runInventoryDescriptionBenchmark.mjs \
  --seed classifarr-profile-20260912 --size 300 --folds 5 \
  --multi-scale-ai --generate-cases 100 --context 32768 \
  --exclude-prior-sizes 300,300,100,100,300,300,300 --max-minutes 60
```

It completed all 100 paired cases and 400 valid local calls, with all five folds
available, `sourceVerified: true`, no changed components, and zero sample,
generation or prompt-budget shortfall. There were 6,655 document identities,
6,652 descriptions/vectors and ten libraries. All consumed source hashes, the
sample, inference prefix and model identities exactly matched the previous v1
comparison. Private scripts and full aggregate logs remain ignored under `.tmp/`.

- Sample fingerprint: `ad63320ed17b1c413293a6b801a73dbcc5dd017ec65394da67ae67907bd2f12c`.
- Inference-prefix fingerprint: `fb8007cae79621eea81854d20d8e5d6737d2e15a55f95182bcedce2ee58369be`.
- Embedding: `mxbai-embed-large:latest`, 1,024 dimensions, digest
  `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
- Generation: `gemma4:e4b`, digest
  `c6eb396dbd5992bbe3f5cdb947e8bbc0ee413d7c17e2beaae69f5d569cf982eb`.

The cohort contained 172 movie and 128 TV descriptions; inference used the same
58-movie/42-TV prefix. Seven library strata supplied held-out cases; three had none
after eligibility and previous-cohort exclusions. Their empty strata remain visible.
The 1,700 previously excluded descriptions remain usable for training folds under
the unchanged protocol. This reused development cohort is not an untouched test set.

| Measurement | Raw examples | Compact examples |
| --- | ---: | ---: |
| Generation calls / valid passes | 200 / 200 | 200 / 200 |
| Order-stable selected destinations | 74 | 68 |
| Stable abstentions | 1 | 0 |
| Order-sensitive cases | 25 | 32 |
| Existing-placement agreements (not accuracy) | 60 | 56 |
| Input tokens | 223,278 | 222,642 |
| Output tokens | 1,201 | 1,201 |
| Summed generation latency, ms | 53,708 | 46,518 |

The compact arm used 0.285% fewer input tokens and had 13.4% lower summed generation
latency in this run, but seven more order-sensitive cases. Single-run latency is
not a general performance guarantee. Compared with the old appended-context arm,
it used 46.5% fewer input tokens; that does not make it better than the raw control.
The raw control itself changed from 24 to 25 order-sensitive cases across runs,
despite matching source and model identities, illustrating residual inference
variability. Do not treat temperature zero and a fixed seed as perfect determinism.

Movie order sensitivity was 16 raw versus 20 compact; TV was 9 versus 12. Among
cases where both arms were order-stable, no stable destination changed and no
placement agreement was gained or lost. Across all 300 prepared cases, compact
selection chose 2,700 examples from a 6,008-example pool, including 76 non-raw
examples. No compact candidate was empty; one observed destination was outside
the unchanged raw shortlist. Independent labels remain zero and accuracy unknown.

All folds finished in 31.077, 60.581, 63.677, 57.702 and 58.540 seconds respectively.
At completion the whole-container peak was 1,789,853,696 bytes, with zero
memory-limit hits, OOM kills or restarts. The application remained healthy on its
read-only root filesystem. These are observations, not an OOM-proof guarantee.

## Pull request check

GitHub's open-PR collection returned no open pull requests on 2026-09-19. There is
no random open PR to implement; no pull request has been merged or fabricated.

## Recommendation

Do not promote compact MMR selection into live classification. It did not beat the
raw control on stability, and the token reduction versus raw was negligible. Keep
the versioned experiment reproducible; do not tune its constants repeatedly on
this same cohort or raise routing confidence to hide the negative result.

### Final recommendation stack

1. Preserve current production behavior, recovery, source checks and the raw
   nearest-example comparison control. Benefit: no unsupported routing change;
   limitation: current content-choice order sensitivity remains unresolved.
2. Next, prototype **candidate-independent semantic fit assessment**: evaluate a
   query against each anonymous candidate's descriptions separately, with bounded
   structured support/contradiction evidence, then use a deterministic selection
   contract. Keep library names, inventory-size counts and retrieval-score numbers
   out of that semantic assessment; retain them in private diagnostic calculations.
   Benefit: directly tests the decision step's dependence on option position;
   cost: potentially more calls and a new evidence-validation contract. It must not
   treat model-generated scores as calibrated confidence or independence as proof.
3. Compare that approach against the raw control with order controls, failures,
   abstention, cost and per-library coverage. Validate on a separate cohort before
   production adoption, and never train against the system's own choices as truth.
4. Separately measure warmed-container admission availability. The safe deferral
   worked, but cached discovery state can leave insufficient startup headroom for
   an extra evaluator. Prefer coordinated memory ownership or isolated evaluation
   resources over weakening the reserve or adding operator acknowledgements.

The recommendation to investigate decision order is an inference from this local
result. Primary research on
[option-order sensitivity](https://aclanthology.org/2024.findings-naacl.130/),
discovered through web search on 2026-09-19, motivates testing that hypothesis; it
does not prove that candidate-independent assessment will improve this model or
Classifarr's routing accuracy. The next item is a proposed experiment, not an
implemented production feature or a new user-facing workflow.
