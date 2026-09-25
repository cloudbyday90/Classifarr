# Automatic cached source-pair evaluation: outcome

Status: Unreleased, September 24, 2026. See the separate
[design and research](automatic-source-pair-evaluation-design.md) for alternatives,
official sources, pros/cons and the recommendation stack.

## Delivered

The scheduler now runs the existing cached source-description comparison without
manual invocation. It compares the same held-out movie/TV queries under two
training populations: TMDB-linked descriptions only, and those descriptions plus
source-only items. It preserves known identity/description group exclusions and
holds feedback groups out of every training fold. Music, inactive destinations and
known source conflicts remain outside the existing corpus eligibility boundary.

Up to 300 cohort members are retained as opaque identity-plus-description hashes.
New feedback, metadata and cached representation changes re-evaluate those cases.
Removed/changed/merged cases or thirty-day expiry automatically rotate the cohort;
the report records why. New arrivals wait for rotation rather than silently
changing a comparison. Small libraries can produce a shortfall, which is reported.
Both arms use one frozen snapshot; longitudinal improvements are not inferred.

The lifecycle coordinator is shared with saved-outcome evaluation. Domain readers,
cohort selection, worker execution, report validation and checkpoint storage stay
separate ESM modules. No new dependency or large singleton was introduced.

## Safety and recovery

The evaluator reads the cache refresher's verified representation, requiring the
matching configuration and a verification no more than ten minutes old and not in
the future. It makes no provider requests, generates no embeddings, and does not write
classification, routing, policies or the vector cache. Configuration is removed
before data is passed to the worker. Scorer-semantic changes require the evaluation
revision to change; a model-name change alone cannot reuse another digest.

One coherent read-only snapshot uses the existing source bounds and SQL timeouts.
Decoding remains outside the transaction. The worker has a 64 MiB serialized input
budget, 512 MiB old/32 MiB young JavaScript heap limits and a two-minute overall
deadline. The existing discovery lock and memory monitor also apply. These are
availability controls, not a sandbox or an absolute process-memory ceiling.
Worker output streams are discarded, errors use fixed codes, and termination is
awaited before releasing ownership.

Five-minute due times and 5-to-60-minute failure backoff survive restart. One-minute
cron checks and a three-minute delayed startup check share one handler; cron can
run first, and a due time is serviced on the next tick (up to one minute later).
Busy processing, memory pressure, disabled/unsupported configuration and
unavailable representation identity defer automatically without warning floods.
Incomplete vector coverage produces a report with no scores and retries after the
ordinary five-minute interval. The existing refresh worker owns cache backfill.

Failures clear the previous report. Readers withhold checkpoints older than fifteen
minutes, future checkpoints and malformed report shapes. Cohort references are
replaced on rotation and expired references are cleared on a subsequent failed
check. Retention cannot execute while the application is stopped. Stop/lock loss
cancels work before the next operation; an already-committing write may finish.

## Query

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --automatic-source-pair-status
```

Use the installation's normal private database environment. In the container the
script path is `/app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs`.
This reads a checkpoint only; it cannot schedule, train or promote a model. Status
is `never_run`, `complete`, `failed`, `stale` or `invalid`. A fresh checkpoint can
contain `cache_incomplete` or `no_eligible_cases`; inspect the nested report status
and label coverage, not just the outer execution status. Only outer `complete`
exits zero. The flag cannot be combined with benchmark options.

The status contains aggregate paired gains/losses, movie/TV and query-identity
breakdowns, sample/label/cache coverage, observation/evaluation timestamps and
computation duration. No per-case hashes, library names, titles, raw errors or
credentials are returned. Unchanged inputs reuse scores without claiming a new
experiment. Unknown quality labels never become a success count.

## Verification

- Full backend run: 1,431 suites and 42,166 tests passed. Coverage is 90.36%
  statements/lines, 84.07% branches and 92.35% functions.
- Full PostgreSQL integration run: 159 suites and 1,858 tests passed; one existing
  suite/test remains skipped. The new integration suite uses real migrations,
  cache rows, worker threads, cross-session locks and the actual private CLI.
- Focused run: 14 suites and 163 tests passed. The new source-pair modules and
  shared coordinator have 93.13% statement/line, 93.68% branch and 93.75% function
  coverage. Actual worker-thread behavior is also exercised by integration tests.
- Type checks, lint, both server unused-code checks, ESM import/mock checks,
  copyright, migration/schema checks, documentation/API checks, product-language
  and delivery-term checks, release-maintenance audit and whitespace checks passed.
  Lint retains the existing nonliteral-filesystem-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was added.
- Coverage ratchet passed with the fresh backend report and existing client
  report. No client code changed; frontend tests were not rerun for this increment.
- The application image built successfully. Disposable-container schema generation
  and comparison passed, with only the intended table/migration changes.
- A network-isolated disposable app, seeded with 400 synthetic cached items across
  four movie/TV libraries, recovered from its initial disabled-configuration
  deferral on the real scheduler's next due tick. It evaluated 300 cases (149 movie,
  151 TV) across all four libraries with zero provider calls and routing writes.
  Restarting that disposable app preserved the report, evaluation timestamp and
  next due time; its health check passed. This is an operational test, not evidence
  of classification accuracy. The user's running app and persistent data were untouched.

Tests caught and corrected two implementation issues before completion: vector
decoding had temporarily moved inside the read transaction, and failure-checkpoint
SQL needed qualified target-column references. The existing post-commit decoding
contract remains intact. Expiry tests also ensure a rotated cohort cannot reuse
an old report merely because its selected hashes happen to match.

## Limitations and next component

This measures retrieval-shortlist behavior against retained corrections, not
end-to-end AI accuracy, independent blind labels or safe automatic routing. Unknown
identity aliases can still exist. A frozen cohort intentionally delays inclusion
of newly discovered items until rotation. Oversized evidence fails visibly; no
truncated successful evaluation is published. No automatic promotion is included.

GitHub's connected search returned no open Classifarr PRs for random selection;
none was substituted or merged. No release, version bump or live-container change
is part of this work.

Next: adapt the existing frozen-policy replay to the automatic lifecycle, so we
measure whether retrieval changes actually improve policy decisions or reduce
deferrals. Reuse the existing policy preparation and response reducer rather than
introducing another evaluation framework. Begin with captured/cached evidence;
separately bound and configure any required model inference. Continue reporting
unavailable evidence as unknown, keep live routing unchanged, and use real
post-release correction results to prioritize scorer changes.

Follow-through: [automatic frozen policy replay](automatic-policy-replay-outcome.md)
now extends this same worker and checkpoint with paired deterministic policy
outcomes. It does not add another scheduler or change live routing.
