# Local content-community discovery outcome

## Scope

**Decision: do not replace runtime groups with local communities.** They discover
fine-grained neighborhoods, but leave too much inventory unsupported and regress
TV placement agreement. Promoting the supported arm would increase operator work,
not deliver the requested hands-off behavior.

September 19, 2026. Implement the [frozen design](local-content-communities-design.md)
as a modular, read-only ESM evaluation component. Library names, genres and
placement labels are not discovery features. No runtime routing, confidence,
automatic recovery, database schema, dependency, UI or configuration is changed.

The five new modules separate bounded graph construction, community discovery,
post-fit library participation, shared control validation and paired evaluation.
The adaptive evaluator now reuses the control reader. The CLI exposes an exclusive
`--local-communities` mode with zero inference and post-run source verification.
Near-tie handling uses the exact top two scores before applying tolerance, making
the evidence guard independent of input order. Cancellation also yields between
held-out queries, not just during fitting and quality summaries.

## Measurement

The delivered implementation completed five folds on 300 new descriptions:
172 movies and 128 TV descriptions. All ten libraries remained in candidate and
training scope. Seven supplied new queries; the other three had exhausted their
unseen descriptions in previous cohorts. Do not infer new query performance for
those three libraries. All 1,400 prior sample hashes were excluded from selection;
overlap was zero. Prior samples remained eligible training context.

Sample fingerprint prefix: `cb8d5559a724`. Source verification passed with no
changed components. Cached model `mxbai-embed-large:latest`, 1,024 dimensions,
digest `468836162de7f81e041c43663fedbbba921dcea9b9fefea135685a39b2d83dd8`.
Zero embedding or generation calls. Private aggregate report:
`.tmp/community-verified.json`. No inventory title, source identifier, description
or vector is committed.

| Held-out diagnostic | Current groups | Raw communities | Supported communities |
| --- | ---: | ---: | ---: |
| Queries evaluated | 300 | 300 | 300 |
| Recommendations | 300 | 300 | 106 |
| Placement agreements | 235 | 226 | 93 |
| Placement disagreements | 65 | 74 | 13 |
| Abstentions | 0 | 0 | 194 |
| Changed destinations among compared pairs | 0 | 66 | 11 |
| Gained placement agreements | 0 | 25 | 7 |
| Lost placement agreements | 0 | 34 | 3 |

Raw movie agreement was 134 → 136 out of 172; TV agreement was 101 → 90 out of
128. Supported communities recommended 55 movies (51 agreements) and 51 TV items
(42 agreements). Its 194 abstentions comprised 166 unassigned nearest items and
28 nearest items outside supported library participation. No shared-nearest or
near-tie abstention occurred in this cohort; those branches have synthetic tests.
All destinations had some community support, so none was silently removed.

The supported arm's 93/106 agreement is conditional on keeping only 35.3% of
queries. The control had 89 agreements on those same 106 queries. This is not an
87.7% accuracy claim, nor evidence that the other 194 items should require review.
Independent labels remain zero and accuracy remains null. Existing placement is
an observation, not semantic truth; none of these arms is the live routing pipeline.

| Library representation over 50 library/fold fits | Current groups | Community projections |
| --- | ---: | ---: |
| Groups | 320 | 2,693 |
| Groups per library/fold | 3–8 | 2–221 |
| Exclusive training appearances | 32,950 | 32,950 |
| Represented appearances | 32,940 | 9,091 |
| Unassigned appearances | 10 | 23,859 |
| Weighted mean member/center similarity | 0.717847 | 0.897434 |
| Weighted mean nearest representative similarity | 0.624462 | 0.972535 |

These counts repeat training descriptions across folds, not unique acquired
items. Means are weighted by represented members and have different denominators.
Representative similarity includes self-matches: a three-member group represented
by all three members scores one for that metric. The high community value is
therefore partly a granularity artifact, **not evidence of semantic understanding**.
Higher cohesion on only 27.6% of exclusive training appearances cannot justify
replacing a model that covers almost all items.

Before library projection, discovery produced 3,469 groups over ten media/fold
fits and assigned 11,709 of 32,960 training appearances (35.5%). There were ten
shared-description appearances; five were grouped and none counted as an exclusive
library vote. Of 2,440 appearances in the control's 59 smallest groups, only 558
remained in supported library projections. None of those control groups remained
intact; this records fragmentation, not proof that either partition is correct.

Measured cumulative fit time: control 38.606 seconds, community discovery and
projection 283.516 seconds. This is an offline exact-search cost on local Compose,
not a production latency benchmark; other local tests/background work overlapped.
No source recovery or sync was disabled, and no parameters were retuned on results.

## Recommendations and next component

| Recommendation | Benefit | Cost / limitation |
| --- | --- | --- |
| Keep current runtime profiles and routing | Preserves coverage and avoids 194 new reviews | Broad groups can still obscure local themes |
| Retain this bounded offline component | Reproducible content-only neighborhoods and failure diagnostics | Exact search is costly; neighborhoods are not validated semantic labels |
| Build a coverage-preserving multi-scale retrieval profile next | Broad groups and raw items retain coverage; local groups add detail | Must test evidence duplication, fallback and TV regressions |
| Do not lower confidence thresholds or promote the supported arm | Avoids trading safety for apparent automation | This commit does not itself increase automatic routing |

**Next high-value item: one snapshot-cached multi-scale retrieval profile.** Keep
all current broad groups and raw-item retrieval, add local communities only as
optional supporting context, and reuse unchanged source snapshots. A community
miss must fall back to existing evidence, not become a new operator task. Avoid
double-counting the same descriptions across levels. Evaluate held-out queries
and leave-one-out representative coverage, with explicit TV and ungrouped-item
slices, before production admission. This recommendation is an inference from
the measured coverage/detail trade-off, not a claim that the combined method is
already effective. Do not spend the next component solely on faster approximate
search before its retrieval quality is established.

Final recommendation stack: validated inventory and automatic recovery → cached
descriptions/vectors → current broad profiles plus raw-item retrieval → optional
local-community context → unchanged policy/routing safeguards. No extra settings,
acknowledgements or dense status panels. The [design](local-content-communities-design.md)
records the official research, security boundary and W3C UI considerations.

## Validation

- Full backend: 1,312 suites / 38,169 tests passed. Full client: 369 files /
  5,128 tests passed. Neither coverage baseline nor timeouts were relaxed.
- Final focused regression: seven suites / 61 tests passed; all five new services
  have 100% statement, branch, line and function coverage in that run.
- Real PostgreSQL integration: three suites / 26 tests passed. Browser regression:
  24 development checks and seven production-build/route checks passed.
- Lint, typechecks, dependency/copyright preflight, ESM imports/mock shapes,
  documentation, product-language, delivery-term and maintenance checks passed.
- Coverage ratchet passed: backend 90.20% statements/lines, 82.95% branches,
  92.30% functions; client 85.58% statements, 77.54% branches, 85.09% functions,
  87.67% lines.
- The separate production-naming gate remains blocked on 43 existing references.
  This component adds none and does not alter its baseline.

Synthetic fixtures cover minority themes, more than eight groups, a bridge,
outliers, large tied neighborhoods, input-order invariance, shared participation,
empty/sparse alternatives, holdout leakage, cancellation, malformed vectors,
work/memory limits, corrupted control profiles and post-run source invalidation.

An early partial live run was deliberately stopped after review corrected
near-tie handling. It is not evidence for the delivered implementation. A targeted
coverage invocation that collected the entire backend failed global thresholds
because it ran only seven suites; the full backend run and separately scoped
new-service coverage both passed. Initial production-browser invocation used the
root package by mistake; the correct client-package command passed.

## Reproduction

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --local-communities --exclude-prior-sizes 300,300,100,100,300,300 --max-minutes 30
```

No release, version bump, tag or PR merge. GitHub returned no open PRs on both
checks, so no random PR could be selected or applied. The previous commit's hosted build and
database jobs and CodeQL, Trivy, OSV, Gitleaks and copyright checks succeeded.
