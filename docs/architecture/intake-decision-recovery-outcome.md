# Intake decision capture recovery: outcome

Status: Unreleased, September 24, 2026. See the separate
[design and research document](intake-decision-recovery-design.md) for alternatives,
official sources, tradeoffs and the recommendation stack.

## Root cause and implementation

A PostgreSQL regression test reproduced the preceding commit's recovery gap:
maintenance restored a missing classification link but left `decision_context`
null despite an intact original capture in the exact history row. That would
permanently undercount available intake evidence after an interrupted diagnostic
write. No accuracy regression was inferred from that failure.

The existing maintenance sequence now reconciles receipts, reconciles links,
recovers original decision contexts, and expires receipts. Two small ESM modules
separate recovery coordination from parameterized SQL. Recovery is automatic and
advisory; no new UI, endpoint, dependency, schema migration or scheduled job.

Each pass reads at most 500 recent linked receipts missing context and a bounded
projection from history, never raw metadata. It reuses the original-decision
validator and copies only supported, matching movie/TV captures. The update checks
the current link, empty context, retention window, source projection, type, method
and identity. Locked receipts are skipped for retry. A stable keyset cursor moves
past malformed originals, wraps after exhaustion, and safely resets on restart.
Failed passes retain their cursor; concurrent calls share one pass.

Already-captured context, queue status and retention timestamps are preserved.
There is no classification replay, invented label, current-placement inference,
provider call, training update or routing action. Original review/retry states and
source-only null-TMDB identity are retained exactly. Missing/deleted originals stay
unknown; recovery cannot recreate evidence that no longer exists.

Related link reconciliation now preserves a concurrently supplied link and skips
an unrepresentable latest classification ID without overflowing the receipt field
or silently selecting an older decision.

## Live inspection and limitations

Read-only inspection on September 24 found the healthy running container still on
`2f17b44e`, with migrations through `20260924_190000`. Both newer capture columns
are absent. Aggregate counts were zero correction outcomes, zero feedback receipts,
and four intake receipts. The live read used read-only database options and bounded
statement/lock timeouts; no private titles, credentials or library contents were
exported. The new recovery code was not run against that installation.

The next accuracy experiment still requires an approved deployment followed by
genuine retained outcomes. The recovery fix is supported by reproduced database
failure evidence, not a claim that it is the largest live classification error.
Continuous backlog, locks, source cleanup and repeated restarts can delay or
prevent repair. Existing coverage metrics continue to expose missing evidence.

GitHub's connected search returned no open PRs for `cloudbyday90/Classifarr`, so
there was no random open PR to implement. None was merged or substituted.

## Verification

- Before the fix, the new PostgreSQL regression failed with a null decision context
  after successful link repair. The same test passes with recovery enabled.
- Complete backend run: 1,426 suites and 41,920 tests passed; 90.36% line coverage
  and 84.03% branch coverage. Coverage ratchet passed against this report and the
  unchanged client's existing coverage report. No client code changed.
- Complete PostgreSQL run: 157 suites and 1,829 tests passed, with one pre-existing
  skipped suite/test. The real concurrent-link test confirms that a newly committed
  live link wins over reconciliation's older snapshot.
- Focused verification: 37 unit tests across three suites and a final 32 PostgreSQL
  tests across two suites passed. Includes movie/TV and source-only originals,
  deferred/retry preservation, missing/malformed/oversized captures, expired and
  future receipts, write-time races, row locks, bigint boundaries and cursor wrap
  beyond 500 invalid originals.
- Both new recovery modules have 100% statement, branch, function and line coverage
  in focused unit tests. Recovery failure remains advisory and does not stop expiry.
- Isolated application image build and fresh-install schema comparison passed.
  The schema is unchanged; the user's running container was not replaced.
- Type checks, lint, dependency usage, ESM imports/mock shapes and copyright checks
  passed. Lint retains one existing unrelated nonliteral-file warning in
  `captureOperatorCorrectionFrozenPolicy.mjs`.
- Documentation/RAG API checks, product-language, delivery-term and runtime
  release-maintenance audits passed. No validation baseline was weakened.

## Next step

Follow-through: [automatic destination evaluation](automatic-destination-evaluation-outcome.md)
now schedules the existing retained-outcome evaluator with change detection and
restart-safe retry state. The user requested this automation before deployment;
it does not establish a live accuracy result or supersede the data limitation below.

Complete the separately approved deployment/release process before adding another
evaluation feature. Then run the existing `--saved-decisions` report against the
retained window, verify capture and repair are operating, and select one supported
movie/TV failure for a paired regression experiment. If labels are absent, report
that limitation rather than tune confidence or treat silence as success.

No release, version bump, live schema update or running-container replacement was
performed for this increment. Disposable test environments only.
