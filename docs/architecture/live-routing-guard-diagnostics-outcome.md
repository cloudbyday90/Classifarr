# Live routing guard diagnostics: outcome

Date: 2026-09-20. Follows the
[design and official-source research](live-routing-guard-diagnostics-design.md).
No release, version change, dependency change or database migration.

## What the live investigation established

The six content-agreeing cases from the preceding 100-item replay were reconstructed
with the same cohort seed and two folds. Cohort fingerprint:
`4119d45cab9fc334c544255bd4ffcf77c8d8048c50f57908f123213945808414`.

Unlike the earlier content-only replay, this probe used current complete library
rows, refreshed production policy evaluation, current full-pool retrieval and the
existing live routing service. It prepared the bound context before each local
model request, parsed the actual response and passed its advisory proposal through
the real familiarity and freshness checks. These six current policy results were
`prompt_select` / `weak_evidence_primary`; their earlier held-out overlap label is
not a claim about their current live policy state.

| Live result | Before refactor | After refactor |
| --- | --- | --- |
| Valid local proposals | 6: five movies, one TV item | Same |
| All strict live checks passed; confirmation held | 5 | 5 |
| Unusual familiarity, despite content agreement | 1 generic live-guard failure | 1 explicit `item_unusual` reason |
| Identity conflict or changed prompt evidence | 0 | 0 |
| Application-data writes / receipts / routes | 0 / 0 / 0 | 0 / 0 / 0 |

Both runs retained the administrator's `require_all_confirmations=true` setting.
The after-run also asserted the caller's review-only hold. Each run made six local
generation calls, with no remote fallback, model download or configuration change.
All checked source-component digests remained unchanged. Successful cases repeated
retrieval and policy/library/configuration checks; the unusual case stopped after
the first retrieval, without retrying or reaching final policy revalidation.

The unusual case had 256 reference descriptions and 99 calibration descriptions;
this was not missing backfill or an insufficient-sample error. The other checks
used 200–256 references and 66–128 calibration descriptions. The empirical rank is
a familiarity test, not a probability that a destination is correct.

This is a selected six-case integration smoke, not independently labeled accuracy
or an automation-rate estimate. It did not reproduce a stuck queue or prove that
all other deferrals are correct. Private media, prompts, vectors and responses stay
in ignored local artifacts and were not added to Git.

## Implemented

The existing routing assessment now supplies fixed first-stopping reasons while
retaining compatible boolean predicates. A small ESM projection validates the
optional reason map. The existing evaluation controller records those reasons only
alongside its already-counted live-guard failures, preserving one-use completion,
bounded counters and all route gates. Successful neighbor-shadow outcomes do not
keep superseded failure reasons.

The existing administrator-only live-stats endpoint and named client GET carry the
optional map. The Command Center displays nonzero plain-language reasons inside
its existing closed disclosure, using the existing SWR refresh. No extra endpoint,
poll, acknowledgement, default panel or user action was introduced. Reasons are
attempt counters since service start, not outstanding items or additional failures.

## Verification

- A regression test first reproduced the missing unusual-item diagnosis.
- Focused backend: 11 suites, 306 tests passed, including existing route-authority,
  configuration-change, freshness, concurrency, cancellation and fallback tests.
- Focused client: two files, 71 tests passed; API passthrough, malformed maps,
  saturation, old responses, pause/resume and permission clearing are covered.
- Browser regression: keyboard disclosure and pause/resume, existing SWR refresh,
  desktop/mobile fit, nonzero explanations, permission clearing and zero writes.
- Database integration: three suites, 24 tests passed.
- Full backend coverage: 1,366 suites, 39,945 tests passed. Statement/line coverage
  90.31%, branch coverage 83.62%, function coverage 92.46%. The guard assessment,
  reason projection and evaluation controller have 100% coverage in every metric.
- Full client coverage: 369 files, 5,146 tests passed. The combined coverage ratchet
  passed with no baseline changes.
- Lint, typecheck, dependency/copyright preflight, ESM import/mock checks, documentation
  lint and the local image build passed. The after-replay used the rebuilt image.
- The separate production-naming gate still reports 43 pre-existing references
  against its zero baseline. This count is unchanged; no waiver or relaxed baseline.

The previous commit `67440fec` passed all six GitHub workflows, including
[CI/CD](https://github.com/cloudbyday90/Classifarr/actions/runs/35522703587).
The open-PR collection was checked twice and was empty; no PR was available to randomly
select, and none was merged or represented as implemented.

## Recommendation and next functional fix

Follow-up: the recovery handoff below is now addressed by
[exhausted classification retry recovery](exhausted-classification-retry-recovery-outcome.md).
The investigation and original recommendation are retained here as historical context.

Keep the existing library-agnostic content and familiarity checks. The benefit of
this change is a truthful explanation without another scoring implementation; the
limitation is aggregate, restart-local visibility rather than per-item diagnosis.
Do not lower the familiarity threshold or automatically disable confirmation based
on this selected smoke. The latter remains an explicit operational decision.

The next high-value item is **repair the exhausted-retry recovery handoff**:

1. `schedulerOperationalTasks.mjs` moves exhausted `pending_retry` rows to `failed`
   and tells the operator to use Retry Classification after resolving the cause.
2. `classificationRetryService.mjs` admits only `awaiting_decision` and
   `pending_retry`. A synthetic call to the real service with a failed, exhausted
   row reproduced `queued: 0`, `reasonCode: status_ineligible`, before any write.
3. Reconcile the scheduler, retry eligibility, API and visible recovery action.
   Keep automatic retry budgets bounded; do not admit every failed row to automatic
   retry or reset budgets merely because the provider becomes reachable.
4. Verify a transient outage → exhaustion → recovery → authorized resubmission
   lifecycle, including restart, duplicate requests and already-routed exclusions.
   Reuse the existing row lock, task deduplication, lineage and routing gates.

This finding is separate from the six evidence holds and is not fixed by the
diagnostics change. It is a specific recovery contract mismatch, not a request for
another sampling study. After repairing it, evaluate narrowly scoped automatic
redrive tied to verified recovery, with persisted limits and no endless restart loop.

[AWS's dead-letter guidance](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/capturing-problematic-messages.html)
supports isolating repeatedly failing work. Its
[recovery lifecycle explanation](https://aws.amazon.com/blogs/compute/introducing-amazon-simple-queue-service-dead-letter-queue-redrive-to-source-queues/)
describes returning work after the underlying problem is resolved. Apply that
pattern to the existing PostgreSQL queue; adopting AWS or a second queue technology
is not necessary for this fix. Sources were discovered and read on 2026-09-20.

Final stack: current library evidence → bounded local proposal → identity and
familiarity checks → fresh server-owned authority → confirmation/route gate;
bounded durable retries and explicit recovery remain separate from evidence holds.
