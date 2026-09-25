# Automatic destination evaluation: outcome

Status: Unreleased, September 24, 2026. The separate
[design and research](automatic-destination-evaluation-design.md) records scope,
official sources, alternatives and the recommendation stack.

## Delivered

The existing scheduler now automatically evaluates retained movie/TV decisions
against explicit outcomes. A delayed startup check at two minutes and a one-minute
scheduler tick check a durable due time; the first cron tick may run earlier than
the delayed check. Normal evidence scans occur every five minutes.
Only a changed input fingerprint runs the existing pure evaluator. Changes include
new/corrected feedback, restored original captures, queue state, unavailable
destinations and evidence leaving the retained window. No writer hooks are needed.

This is saved-decision evaluation, not candidate-model comparison or training.
It uses all eligible retained evidence within the existing independent 5,000-row
outcome/intake budgets; it does not sample or silently truncate an oversized window.
Unknown labels, review, retry and unavailable destinations remain separate from
completed agreement. Music cannot become a supported evaluation label.

Five small ESM modules separate scheduling, coordination, checkpoint SQL,
repository ownership and report validation. The existing reader now exposes its
bounded input projection to both the CLI and automatic worker. Only the private
CLI changes its own environment and closes its own pool; the scheduler does neither.

A migration adds one aggregate checkpoint and the fresh-install schema is updated.
The checkpoint contains no titles, library names, identities, prompts, vectors,
credentials or arbitrary error text. Its internal fingerprint covers versioned
inputs, including malformed JSON keys, rather than just output counters. Exact
aggregate validation prevents unexpected stored fields from reaching CLI output.

## Automatic recovery and query

Database-wide advisory ownership prevents concurrent workers; local calls coalesce.
Reads use repeatable-read/read-only transactions, 15-second statement, one-second
lock and 45-second transaction timeouts. A separate bounded transaction stores only
the checkpoint. Uncertain writes are not replayed inside the transaction; later
checks safely converge on the single row. Source changes after a snapshot are
observed on the next check, not represented as part of the older snapshot.

Failures clear successful results and persist fixed reason codes with 5, 10, 20,
40 then 60-minute retry delays. A database outage that prevents persistence uses a
five-minute local cooldown, which alone does not survive restart. Stop cancels
publication before a subsequent operation; an already-committing checkpoint may
finish. No retry changes classification, policy, training or routing.

The existing private CLI can query the checkpoint without running an evaluation:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --automatic-status
```

Use the installation's normal private database environment; in an updated image
the script is `/app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs`.
`--saved-decisions` still performs the original fresh read-only report. These flags
cannot be combined with each other or benchmark options. Automatic status returns
`complete`, `never_run`, `failed`, `stale`, or `invalid`; only `complete` exits zero.
It does not start work, request AI, repair evidence or deploy the application.

`observed_at` is the most recent coherent evidence read; `evaluated_at` changes only
for a new input fingerprint. Unchanged checks revalidate freshness without claiming
a new experiment. Reports older than fifteen minutes or from a future timestamp
are withheld. Failed or malformed checkpoints also return no report. This is a
bounded, replaceable aggregate, not an accumulating archive of expired evidence.

## Validation

Focused unit and PostgreSQL tests cover scheduler registration and stop, unchanged
revalidation, changed and expired evidence, movie/TV outcomes, unknown labels,
malformed feedback, row-budget failures, cross-session locking, restart/backoff,
readonly snapshot consistency and CLI query behavior. A concurrent library change
cannot mix two source versions inside an evaluation. Test fixtures initially needed
an explicit integer cast for the shared bigint/integer parameter and a valid
synthetic receipt fingerprint; no production constraints were relaxed.
The full run also detected an undocumented empty cleanup catch in the preceding
commit's concurrency test. Cleanup now explicitly settles outstanding work before
releasing its client; its original assertions still determine success or failure.

Final verification completed successfully:

- Full backend coverage run: 1,428 suites and 42,012 tests passed. Coverage is
  90.36% statements/lines, 84.05% branches and 92.35% functions.
- Full PostgreSQL integration run: 158 suites and 1,844 tests passed; one existing
  suite/test remains skipped.
- Focused unit run: eight suites and 101 tests passed. The five new modules have
  100% statement/line/function coverage and 98.97% branch coverage (97 of 98).
- Focused PostgreSQL run: two suites and 42 tests passed, including the preceding
  intake-recovery scenarios and the new evaluation lifecycle.
- Coverage ratchet passed using the fresh backend report and the existing client
  report. No client code changed; frontend tests were not rerun for this increment.
- Type checks, lint, both server unused-code checks, ESM import/mock checks,
  copyright, migration/schema checks, documentation/API checks, product-language
  and delivery-term checks, release-maintenance audit and whitespace checks passed.
  Lint retains one existing nonliteral-filesystem-path warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`; no new warning was introduced.
- The final application image built successfully. Disposable PostgreSQL schema
  generation and snapshot comparison passed without unrelated schema changes.

## Disposable application smoke check

A fresh application image was started with no network access and no mounted user
data. Its real scheduler automatically changed private status from `never_run` to
`complete`, with an empty-cohort report (`no_eligible_outcomes` and null agreement).
The recorded observation was `2026-09-25T00:44:00.016Z`; the next check was five
minutes later. No model or routing calls were reported, and application/database
health remained healthy. Restarting this disposable container preserved the
checkpoint and due time. This proves lifecycle integration on an empty installation,
not classification quality or performance on production traffic.

## Limitations and next component

GitHub's connected search returned no open Classifarr PRs for random selection.
None was substituted or merged. No new dependency, public API, UI, version bump,
release, live migration or running-container replacement is included. Tests and
schema generation use disposable environments only.

This closes the manual invocation gap for saved outcomes. It does not establish
production accuracy, create missing independent labels, trigger on model/profile
changes, or compare old/new candidates. Oversized retained windows fail visibly;
they require a separately designed bounded complete-read strategy, not truncation.

Next: adapt the existing cached source-pair evaluator to the same automatic
lifecycle, using a frozen representative movie/TV cohort and its existing
identity/description leakage exclusions. Key work to source/model/profile revisions,
retain paired gains/losses and cost/coverage, and retry missing-cache readiness after
the existing refresh worker fills it. Do not introduce another benchmark framework,
mandatory approval screen, or automatic promotion. Deployment through the normal
release process is still required before collecting production results.

Follow-through: [automatic cached source-pair evaluation](automatic-source-pair-evaluation-outcome.md)
now implements this next component with a retained cohort, isolated CPU work and
private aggregate query. Saved-outcome grading and routing authority remain unchanged.
