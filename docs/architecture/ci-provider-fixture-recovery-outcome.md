# Provider integration fixture recovery outcome

The three failing suites from
[run 36927804801](https://github.com/cloudbyday90/Classifarr/actions/runs/36927804801)
were reproduced locally: 31 failures, one pass. Their fixtures now include the OMDb
selection columns and explicitly unwind both known credential views for historical
replay. A new regression verifies that a blank newest active key does not fall back
to an older credential; supplying the current key restores standard refill.

The focused post-fix run passed 41 tests across five suites, including all three
previously failing suites and the new database cancellation coverage. The complete
PostgreSQL integration run then passed 225 suites / 2,638 tests, with one existing
skipped suite/test. The original
GitHub run remains failed; these local results do not retroactively change it or
claim that a future remote run has passed.

No production migration, provider-selection rule, release requirement or live data
was changed. All fixture DDL remains transaction-local and rolled back. Broader
validation is recorded with the
[cancellation outcome](classification-retrieval-cancellation-outcome.md).

Recommendation: retain the release gate and explicit fixture dependencies. The
immediate failure is repaired without expanding test-only schema destruction.
The [design](ci-provider-fixture-recovery-design.md) records causes and alternatives.
