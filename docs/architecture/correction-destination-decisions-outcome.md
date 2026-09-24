# Retained destination decisions: outcome

Status: Unreleased, September 24, 2026. The
[design document](correction-destination-decisions-design.md) contains official
research, alternatives, tradeoffs and the recommendation stack.

## Implemented

Classification persistence now records the actual saved destination/status in a
small ESM projection, independently of the existing policy-candidate capture.
Caller-supplied captures are replaced. A later correction retains only validated
context for the same media identity and method, plus the exact classification ID,
inside the existing atomic correction write. API, Discord and verified move paths
share that writer. History/queue cleanup cannot erase this retained evidence.

The additive nullable `decision_context` column has a 1 KiB object constraint and
the same 30-day retention as its correction. Old rows remain valid with null
context; no historical baseline is fabricated. The migration and generated
fresh-install schema have been checked in isolated containers, not applied to
the user's running installation.

The private evaluator adds:

```sh
node server/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs --saved-decisions
```

Use `/app/src/scripts/runOperatorCorrectionPolicyEvaluation.mjs` inside a future
updated application container. Run with that installation's normal database
environment. The command configures private logging before loading the database,
uses an explicit read-only repeatable transaction with 15-second statement and
1-second lock timeouts, reads at most 5,001 rows, and fails if more than 5,000 are
eligible. It does not require AI configuration, cached vectors or network model
access. It returns aggregate JSON only and closes the database pool on failure.

Output distinguishes completed agreement/disagreement, pending review, pending
retry, non-classifier decisions, unavailable destinations and conflicting
evidence. Missing-context rows are reported separately; known lineage with a
malformed capture cannot silently disappear beside a valid capture. Repeated
corrections do not inflate the decision denominator. Movie and TV have separate
counts; music does not enter the evaluation.

## Evidence and limits

The initial read-only check of the current installation found **0 retained
outcomes, 0 correction events and 0 labeled feedback rows**. No real-world quality
gain can be claimed. This change prepares automatic prospective evidence capture;
it does not make the existing 300-case retrieval comparison an accuracy benchmark.

The report measures saved classifier decisions in the explicitly corrected
cohort, not completed filesystem routing and not whole-platform accuracy. It does
not evaluate uncorrected items or treat lack of feedback as approval. Source-only
library observations remain useful correction labels for the existing retrieval
evaluation, but are not themselves classifier decisions.

GitHub's connected PR search returned no open pull requests for
`cloudbyday90/Classifarr` during this work. There was no random open PR to implement;
none was merged, fabricated or substituted with a closed PR.

## Verification

- Focused unit checks: 130 passing tests across six suites.
- Complete backend coverage run: 1,423 suites and 41,804 tests passed, with 90.35%
  line coverage and 84.00% branch coverage. Coverage ratchet passed against the
  current backend report and unchanged client's existing report; no client code
  was changed in this increment.
- Complete PostgreSQL integration run: 156 suites and 1,795 tests passed; one
  pre-existing suite/test remains skipped. Includes the real private CLI against
  the migrated test database without model configuration, correction transaction
  rollback, history cleanup, verified moves, deferrals and database size guards.
- New projection, measurement and repository modules: 100% statement, line and
  branch coverage in focused unit tests. The default database loader is also
  exercised by the subprocess CLI integration test.
- Isolated application image build, schema generation and fresh-install schema
  comparison passed.
- Final focused PostgreSQL rerun: 49 tests across three suites passed.
- Type checks, lint, ESM import/mock checks, dependency usage checks and copyright
  checks passed. Lint retains one existing unrelated nonliteral-file warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- Documentation/RAG API checks and product-language, delivery-term and runtime
  release-maintenance audits passed. The unrelated optional production-naming
  gate was not part of this validation; no baseline was weakened.

No release, version bump, production migration, policy change or local application
container replacement was performed. Only disposable test containers were used.

## Next component

Extend the same retained decision linkage to **genuine confirmations and intake
denominators**. Reuse the existing feedback receipts; do not add a confirmation
screen or infer success from silence. Separate unlabelled, confirmed, corrected,
deferred and retried decisions so the system can measure both correction burden
and coverage. Then target the largest measured movie/TV failure with a paired
regression experiment, instead of increasing samples or tuning confidence without
independent outcome evidence.
