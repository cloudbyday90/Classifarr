# Adaptive content-group discovery outcome

## Decision

September 19, 2026: implement the bounded content-only discovery/evaluation
component, but **do not replace runtime groups with this method**. In all 150
library/fold fits it retained one broad group. Keeping every item is useful, but
putting small themes back into one large group is not understanding those themes.
No routing, confidence, policy, background recovery or UI behavior changed.

The [design and official research](adaptive-content-groups-design.md) were recorded
before measurement. Thresholds and budgets were not adjusted after seeing results.

## Delivered implementation

- `adaptiveGroupSplit.mjs`: deterministic two-start spherical bisection, separate
  fitting/internal-validation checks, convergence limits and cancellation.
- `inventoryAdaptiveGroups.mjs`: strict normalized-vector input, automatic group
  count, parent-preserving rejected splits and hard depth/group/work bounds.
- `inventoryGroupQuality.mjs`: cohesion, lower-tail and three-example coverage,
  small-group retention and complete-pool nearest-group diagnostics. Membership
  retention uses a map rather than quadratic array searches.
- `inventoryAdaptiveGroupBenchmark.mjs`: paired held-out evaluation across every
  library, movie/TV strata and prior disjoint cohorts. No generation or writes.
- Existing description benchmark CLI: exclusive `--adaptive-groups` mode with
  source revalidation and existing read-only repository transactions.

Final review also fixed sparse-library handling: the current profile fitter
intentionally omits members below three descriptions. The evaluator now accounts
for that contract, verifies coverage against the source, and retains the sparse
alternative instead of failing or silently removing it. Dedicated tests cover
one-description, empty, corrupt and scope-changing inputs.

## Verified local measurement

Three existing disjoint cohorts of 300 descriptions, five folds each, all ten
libraries in candidate/training scope. These are 900 reused samples, not 900 newly
acquired items. Original query coverage was 150 movies / 150 TV descriptions;
the later cohorts each had 172 movies / 128 TV descriptions from seven libraries
with remaining unseen descriptions. All copies of each held-out description were
excluded before fitting. Prior cohorts remained eligible training context.

Cached representation: `mxbai-embed-large:latest`, 1,024 dimensions, digest
`468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Generation and embedding calls: zero. All three runs completed with unchanged
source digests and verified embedding identity.

| Nearest-group diagnostic | Original | Additional | Fresh | Total |
| --- | ---: | ---: | ---: | ---: |
| Control placement agreements | 234 | 239 | 247 | 720 |
| Adaptive placement agreements | 245 | 240 | 247 | 732 |
| Changed destinations | 52 | 43 | 45 | 140 |
| Gained placement agreements | 29 | 20 | 21 | 70 |
| Lost placement agreements | 18 | 19 | 21 | 58 |
| Abstentions in either arm | 0 | 0 | 0 | 0 |

This deliberately measures unguarded nearest-group geometry, not the production
decision pipeline and not the previous semantic comparator's guarded decisions.
Do not compare these totals to its 676 selections. Independent labels remain
zero, accuracy is null, and existing placement is not ground truth. Of the 140
changes, 12 changed between two destinations that both disagreed with placement.
Movie agreement was 404 → 410; TV agreement was 316 → 322. The fresh cohort showed
no net placement gain, and the additional TV slice regressed 104 → 100.

| Representation diagnostic | Current groups | Adaptive groups |
| --- | ---: | ---: |
| Total groups over 150 library/fold fits | 953 | 150 |
| Groups per library/fold | 1–8 | 1 |
| Represented training appearances | 98,817 | 98,851 |
| Unassigned training appearances | 34 | 0 |
| Weighted mean member/center similarity | 0.717776 | 0.673677 |
| Weighted mean nearest representative similarity | 0.624734 | 0.577606 |
| Median library/fold lower-decile center similarity | 0.670135 | 0.618698 |
| Median library/fold lower-decile representative similarity | 0.530022 | 0.495873 |

Training appearances repeat across folds/cohorts and are not independent items.
Weighted means use represented members; the adaptive denominator includes the
34 previously unassigned appearances. Lower-decile rows are medians of 150
library/fold p10 values, not pooled-inventory quantiles. These cosine values are
not probabilities, accuracy or semantic proof.

All 7,417 appearances in the control's 164 smallest groups remained represented,
but every one of those groups was absorbed into a larger group. None was dropped;
none retained a separate small-group identity. This is why retention alone cannot
be the acceptance metric.

No split was accepted. Root stop reasons: insufficient fitting/validation gain
105; missing validation support in one child 31; unsupported or non-converged
training fit 14. The latter combines two causes and does not establish which
predominated. The global split gate is ineffective on this inventory; it does
not prove that the descriptions lack real subgroups or that the embedding model
is defective. Synthetic hierarchical content does produce more than eight groups.

Measured fit time across verified cohorts: control 107.898 seconds; adaptive
34.464 seconds. Different start/pass budgets and the coarse one-group result
make this an unequal-quality comparison, not a production speedup claim.

## Invalidated work and limitations

An earlier full original-cohort run was invalidated because background metadata
refresh changed the metadata digest. Documents, vectors and libraries were
unchanged. The command stopped the later cohorts; the three cohorts were then
rerun without another restart. No automatic sync/recovery was disabled. Its
results are excluded from the tables above. That run also made zero AI calls.

Measurements use the delivered splitting algorithm and quality calculations.
The final sparse-library/coverage guard was added during review and covered by
regression tests; measured libraries had non-sparse coverage, so that special
branch was not exercised by this live inventory. There is no claimed live test
of an unavailable or one-description library.

Current dataset and representation only; no independently verified theme or route
labels. Three central representatives can underserve tails. Binary greedy splits
can miss local minority structure even when all members remain present. The 10%
global loss-gain gate is a frozen hypothesis, not a universal best-practice value.

## Recommendations and next component

| Recommendation | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep current runtime groups | Avoids demonstrated loss of detail | Existing eight-group limit remains |
| Keep this evaluator offline | Reusable, secure and reproducible comparison | Does not itself improve routing |
| Evaluate local content communities next | Can discover small themes without first splitting an entire library | Neighborhood/radius selection, overlaps and CPU must be bounded |
| Do not add another LLM grading layer or lower confidence thresholds | Avoids hiding representation weakness | Ambiguous routing still uses existing safeguards |

Next high-value component: **training-only local content-community discovery**.
Build bounded nearest-neighbor neighborhoods across the inventory within each
media type, then summarize each library's observed participation. Do not use
library names, predefined genre buckets or rival-library membership as negative
labels. Preserve shared items, outliers, sparse alternatives and small themes;
measure these separately. Fit/calibrate locally from training data, and use a new
untouched evaluation cohort before any promotion. Neighborhood discovery is an
inference from these findings and the official clustering alternatives, not a
proven improvement yet.

Final stack: validated inventory → existing automatic recovery → cached vectors
and current runtime groups → bounded local-community evaluation → unchanged
retrieval/routing safeguards. No additional operator acknowledgements or panels.

## Reproduction and validation

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --adaptive-groups --max-minutes 30
```

For subsequent cohorts add `--exclude-prior-sizes 300,300,100,100` and
`--exclude-prior-sizes 300,300,100,100,300`. Sample fingerprint prefixes:
`7f40e9ebf6f3`, `58ec647b494f`, `d8d72ac31cb2`. Private reports remain ignored under
`.tmp/`; no inventory payload, title, identity, vector or credentials are committed.

- Full backend coverage run: 1,309 suites / 38,089 tests passed. Final focused
  sparse/CLI regression: 49 tests passed. New-service coverage in that final run:
  100% lines, statements and functions; 96.59% branches.
- Client coverage: 369 files / 5,128 tests passed; coverage ratchet passed without
  baseline changes. PostgreSQL integration: three suites / 26 tests passed.
- Browser checks: 24 development checks and seven production-build/route checks
  passed. Existing SWR, keyboard, mobile and recovery fixtures remain unchanged.
- Lint, typechecks, dependency/copyright preflight, ESM imports/mock shapes,
  documentation, product-language, delivery-term and maintenance checks passed.
- The separate production naming audit remains blocked on the same 43 existing
  references. This work adds none and weakens no baseline or timeout.

GitHub MCP returned no open PRs on both checks, so no random PR could be selected
or applied. No PR was merged, reopened or invented. Previous commit `56efef04`
passed hosted CI/CD, CodeQL, Trivy, OSV, Gitleaks and copyright checks.
Delivery uses a clean-source Compose provenance build and healthy read-only-root
container verification. No version bump, release, tag or database migration.
