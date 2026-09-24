# Source-description paired evaluation: outcome

Status: Unreleased implementation, September 24, 2026. See the separate
[design, official research, and tradeoff decision](source-description-paired-evaluation-design.md).

## Delivered

The existing private correction-evaluation CLI now has a `--source-pair` mode:

```powershell
npm --prefix server run study:evaluate:operator-corrections -- --source-pair --size 300
```

It compares the existing description/profile shortlist scorer with TMDB-linked
training evidence versus source-aware training evidence, on the same cases and
cached model representation. Three folds are assigned once before separating
the arms. Known transitive provider/source aliases and normalized synopsis copies
stay together. Explicit-feedback groups never train either arm. A source-only
query is permitted in the baseline, but cannot become baseline training evidence
even when it belongs to a different fold.

Results include movie/TV, source-only/TMDB-linked query strata, per-library
coverage, candidate changes, and paired correction-only gains/regressions.
Candidate recall counts only shortlisted candidates with training evidence.
Leading-proposal mismatch is measured among nonempty proposals with an explicit
correction label; no-evidence counts and labeled-proposal denominators accompany
it. Neither metric describes executed routing. Library strata describe observed
query membership, not corrected destinations, and overlapping memberships are
nonexclusive. Empty quality denominators remain null.

This reuses the existing benchmark, local model inspection, exact-model vector
cache, SQL bounds, and read-only runtime. No provider generation, embedding,
refresh, labels, approval changes, API, UI, dependency, schema, or scheduler was
added. A dead, unreferenced representation-age export was removed after the
dependency check found it; the existing SQL freshness interval is unchanged.

## Actual local readiness result

Ran the current code in a disposable, non-root, read-only container using the
existing Classifarr container's network namespace and installed dependencies.
The application entrypoint was bypassed, with no persistent volumes mounted.
The database connection used the evaluation's read-only transaction settings.
The running application was not rebuilt or restarted.

The September 24 snapshot reported:

| Measurement | Result |
| --- | --- |
| Requested / selected held-out groups | 300 / 300 |
| Movie / TV queries | 152 / 148 |
| Active video libraries represented | 10 of 10 |
| TMDB-linked / source-only queries | 297 / 3 |
| Eligible description identities | 6,661 |
| Unique normalized descriptions | 6,658 |
| Missing cached descriptions | 3, all source-only |
| Source-only training identities per fold | 2 / 2 / 2 |
| Usable recorded correction labels | 0 |

Result: `cache_incomplete`, deliberately nonzero exit, with comparison metrics
withheld. This is a successful readiness check, **not a completed real-inventory
quality benchmark**. The existing embedding-refresh worker can fill those gaps
when the source-description code is deployed through the normal release process;
this evaluation does not trigger deployment or backfill itself.

Whole-snapshot fingerprint:
`ade72e4d42b90bcbec5614c3e8a06345444fb802811f1513c5ede6c98b56a269`.
Sample fingerprint:
`e7ab0d9da39719ce0c973a0ccde14947ecfb47a65030c166ab2b4548c2793b89`.
The CLI's existing default seed is `operator-correction-readonly-v1`. Repeating
the check reproduced the same cohort/fingerprints. No per-item content or
identifiers were exported. A direct host invocation could not complete; the
isolated container reached the existing local services without exposing the DB
port or changing application configuration.

The three source-only identities are a small fraction of this inventory. More
sampling cannot manufacture missing verified outcomes or prove accuracy. Until
those outcomes exist, automatic-routing error and manual-review rate remain
unmeasured; this report never authorizes source-aware calibration or promotion.

## Verification

Completed local checks:

- Full backend unit suite: 1,413 suites and 41,406 tests passed. The final
  focused cohort/pair/benchmark/runtime run passed ten suites and 159 tests.
- Full isolated PostgreSQL integration suite: 152 suites and 1,730 tests passed;
  one pre-existing suite/test remains skipped. Final focused source-learning,
  paired-evaluation, and corpus-projection checks passed three suites/15 tests.
- Server/client typechecks and client production build passed. No client/API
  contracts changed; the client unit suite was not rerun for this increment.
- Server lint, dependency/unused-export checks, ESM static-import and mock-shape
  checks, Markdown lint, copyright, migration/schema integrity, and diff whitespace
  checks passed. One pre-existing lint warning remains in
  `captureOperatorCorrectionFrozenPolicy.mjs` for a non-literal filesystem path.

Regression coverage includes a complete synthetic 300-case paired run, movie/TV
stratification, transitive aliases, conflicting descriptions/feedback, source-only
baseline isolation, explicit cache/label shortages, paired regression counting,
redacted output, read-only snapshot capture, and runtime cleanup on failure.
Synthetic tests are not real placement-quality evidence.

## PR, release, and next decision

The GitHub MCP repository-scoped open-PR search returned zero pull requests on
September 24, including the final recheck. No random open PR was available;
none was fabricated, substituted from closed PRs, or merged. No release, tag,
version bump, container update, or production data mutation was performed.

Recommended next component: **durable source-aware outcome capture from normal
correction actions**. First reconcile the existing correction/feedback writers
and retention paths to explain the empty evaluation cohort. Extend that pathway
only where needed to retain bounded, versioned identity/provenance and explicit
corrected destinations, including items without TMDB IDs. Capture should be
automatic, deduplicated, retention-bound, and queryable without another approval
screen. Do not infer correctness from an auto-route, library name, or unverified
external move. Then rerun this paired evaluation on naturally accumulated labels
and add full decision/review metrics before changing approval calibration.

Recommendation stack: deploy the existing bounded backfill in a planned release
→ reconcile automatic outcome capture → rerun paired retrieval → evaluate full
decision outcomes → consider calibrated autonomy. This targets the actual missing
evidence rather than increasing synthetic sample counts or adding UI gates.
