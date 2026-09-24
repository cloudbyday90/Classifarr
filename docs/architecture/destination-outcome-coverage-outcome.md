# Confirmation retention and intake coverage: outcome

Status: Unreleased, September 24, 2026. The
[design document](destination-outcome-coverage-design.md) records official research,
alternatives, tradeoffs and the recommendation stack.

## Implemented

Explicit standalone feedback and prompt resolutions now retain a small outcome
snapshot alongside their existing replay receipt, in the same transaction. The
snapshot uses the locked source decision and validated selected library, not the
policy shortlist or caller-supplied scores. Existing workflows and permissions
are unchanged. Resolving a deferred decision is not automatic success.

Intake receipts now retain the original decision projection and preserve it through
terminal events and queue cleanup. Changing the linked classification cannot reuse
another decision's capture. Existing best-effort receipt capture never blocks
classification. Feedback snapshot expiry clears evidence after 30 days but leaves
replay protection intact; replay cannot refresh or recreate expired evidence.

The existing private command now emits aggregate `destination_outcomes.v2` JSON:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --saved-decisions
```

Run against an installation containing this migration, using its normal database
environment. Inside an updated application container the script is at
`/app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs`. It needs no AI
provider, cached vectors or network model calls. The reader uses a repeatable
read-only transaction, bounded statements and independent 5,000-row budgets for
outcomes and intake. Overflow or malformed feedback fails the report, not a partial
rate. Output contains no media titles, library names, actor details or credentials.

`labeledCohortAgreementRate` measures only usable explicit labels for completed
saved decisions. `intake.overall.labelCoverageRate` measures usable labels among
retained, captured queue-linked classifier decisions. Missing labels are unknown,
never correct. Both movie and TV are supported without hard-coded library names;
music remains excluded. Review, retry, non-classifier, unavailable destination and
conflicting evidence are separate. Duplicate evidence contributes at most once.

## Limits and operational impact

No historical confirmations were fabricated. Missing original captures remain
missing, including receipts repaired only from queue links. Each task receipt
retains its last linked classification, not a complete attempt history. The two
retention windows can differ; outcomes without usable captured intake are counted
separately. These are decision events, not unique media or whole-platform accuracy.
Feedback selection bias remains; no quality gain or calibration improvement is
claimed from synthetic tests.
New feedback snapshots require typed TMDB identity; existing source-only correction
capture remains unchanged. Public API responses do not expose the new projections.

GitHub's connected search returned no open pull requests for
`cloudbyday90/Classifarr`; there was no random open PR to implement or merge.

No release, version bump, policy change, live migration or running application
container replacement is part of this increment. Disposable test containers only.

## Verification

- Complete backend coverage run: 1,425 suites and 41,877 tests passed; 90.35% line
  coverage and 84.02% branch coverage. Coverage ratchet passed using this backend
  report and the unchanged client's existing report. No client code changed or
  client test rerun was needed for this increment.
- Complete PostgreSQL integration run: 156 suites and 1,802 tests passed, with one
  pre-existing skipped suite/test. Covers concurrency, rollback, replay tombstones,
  history cleanup and the real private CLI without AI configuration.
- Final focused verification: 128 unit tests across six suites and 56 PostgreSQL
  tests across three suites passed, including same-ID capture immutability and
  changed-ID capture clearing.
- Five new projection/grouping/coverage/evaluation/repository modules have 100%
  statement, line and branch coverage in focused unit tests. The default database
  loader is additionally exercised by the subprocess CLI integration test.
- Isolated application image build, schema generation and fresh-install schema
  comparison passed. Live persistent data and the running container were untouched.
- Type checks, lint, ESM imports/mock shapes, dependency usage and copyright checks
  passed. Lint retains the existing unrelated nonliteral-file warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- Documentation/RAG API checks, product-language, delivery-term and runtime
  release-maintenance audits passed. No test or coverage baseline was weakened.

## Next component

After an approved deployment includes this migration, run the existing report on
real retained evidence and select **one measured movie/TV regression to fix**.
Do not build another dashboard or report first. Use its missing-capture,
missing-label, review/retry and completed-disagreement counts to select the
failure, then reuse existing retrieval miss diagnostics for a paired regression
experiment. If there are no usable labels yet, say so and let normal workflows
capture them; do not add another approval screen, infer success from silence or
tune thresholds against the same library placements used for learning.
