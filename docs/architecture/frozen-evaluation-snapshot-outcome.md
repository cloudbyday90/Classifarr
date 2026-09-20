# Shared frozen-evaluation snapshot outcome

Date: 2026-09-20. Implementation follows the
[shared snapshot design](frozen-evaluation-snapshot-design.md). No release.

## What changed

Both fresh-policy and leader/scorer evaluations now use one small ESM drift
contract. Ordinary metadata enrichment preserves measurements from the captured
inputs, explicitly marks live metadata as changed and keeps `sourceVerified`
false. This lets normal enrichment continue without asking the user to stop it
or rerun an otherwise valid frozen experiment.

Policy/authority, library scope, document identity/membership/description, vectors,
configuration and training provenance changes still invalidate the evaluation.
Added/removed components and unexplained aggregate-fingerprint changes fail
closed. Drift observed at any check remains recorded after a later reversion.
Starting component digests are captured before preparation and cannot be changed
through returned report objects.

Optional leader/scorer inference now checks source/model state before making
calls, as well as afterward. Fresh-policy preparation, periodic and final checks
retain their existing schedule. Cancellation cannot publish a verified result;
runtime cleanup and actual call accounting remain intact. The extra check costs
one bounded snapshot read for runs requesting inference, not for zero-call runs.

No live classifier, SWR cache policy, route threshold, UI, database schema,
dependency, model or training label changed. The old scorer pilot remains
documented as invalidated under its original contract. Its unfavorable placement
counts are not reinterpreted as accuracy or permission to enable the scorer.

## Verification

The local Compose smoke exercised the actual problem without manufacturing a
database change. Normal enrichment changed `metadata` and `observedTraits` while
the isolated job evaluated 20 items: ten movies and ten TV shows across ten
libraries. It finished with `status: complete`, `evaluationSnapshotValid: true`,
`sourceVerified: false`, `liveMetadataRefreshed: true` and
`snapshotScope: frozen_at_start`. There were zero chat/scoring calls, no sample
shortfall and no live-routing/promotion authority. Eighteen items had complete
scorer evidence; two did not. That is readiness, not measured scorer accuracy.

The runner automatically waited through three busy-discovery checks, proceeded,
and cleaned up its isolated container. The app stayed healthy with zero restarts
and no OOM; the optional scorer stayed stopped. Host tests overlapped this
functional smoke, so no performance claim is made.

Command (private aggregate log retained only in ignored `.tmp`):

```powershell
node scripts/run-inventory-benchmark-compose.mjs --leader-cross-encoder --seed snapshot-contract-20260920 --size 20 --folds 2 --score-cases 0 --generate-cases 0 --max-minutes 10
```

Final backend coverage passed 1,364 suites / 39,818 tests; statements/lines
90.31%, branches 83.58%, functions 92.45%. The initial full run found four stale
orchestration assertions; they were corrected for the extra pre-inference read
and the entire backend suite was rerun. Focused checks passed six suites / 112
tests covering drift parity, fingerprint/schema mismatches, cancelled verification,
embedding changes, provider failure, actual costs and runtime cleanup.
PostgreSQL integration passed all 24 tests across three suites. Client coverage
passed all 5,128 tests across 369 files. Lint, type checks, dependency/copyright
preflight, Markdown lint, ESM checks and the coverage ratchet passed. The separate
naming gate still reports the same 43 pre-existing references
against its zero baseline; no waiver or new naming debt was introduced.

The previous commit's CI/CD, CodeQL, OSV, Trivy, Gitleaks and copyright runs all
passed. GitHub MCP returned no open pull requests on two checks, so none was available to
randomly select and implement locally. No PR was merged.

## Recommendation and next item

| Recommendation | Pros | Cons / boundary |
| --- | --- | --- |
| Keep shared historical validity separate from current freshness | Removes needless reruns while preserving safety checks | Consumers must read both fields |
| Promote the last scorer or tune another prompt immediately | More model experiments | No evidence of improved correctness; do not do this |
| Diagnose evidence gaps using existing investigation and recovery services | Targets organic library learning and reduces user work | Must separate repairable gaps from genuine ambiguity; do next |

**Next: connect case-level disagreement diagnosis to the existing evidence
readiness and recovery information.** Reuse
`inventoryDescriptionBenchmarkInvestigation`, `inventoryGroupReadiness`,
`inventoryNeighborhoodRecovery` and existing backfill services. First classify
whether a disagreement has missing/stale observations, missing eligible examples,
conflicting identity, overlapping libraries, or sufficient evidence but uncertain
fit. Report aggregate reasons and existing recovery state; do not add another
chat re-check or declaration screen.

Start with the two cases in this smoke that lacked complete scorer evidence.
The current aggregate `evidence_unavailable` does not distinguish missing data
from intentionally excluded or sparse examples. Preserve bounded reason codes
from the existing evidence validators and connect them to recovery state before
assuming that another backfill or more model calls will help.

Use that diagnosis to identify a concrete repair in the existing scheduler,
then verify its effect on a disjoint held-out movie/TV cohort. Do not enqueue
writes from the read-only evaluator, equate observed placement with truth, tune
on the prior 100 outcomes, or duplicate the recovery queue. Existing recovery
already prioritizes under-covered groups, so establish the gap before adding
new automation. Genuine preference ambiguity remains different from bad data.

Final recommendation stack: validated sync and organic enrichment → existing
provenance-clean library evidence → shared frozen evaluation → evidence-gap
diagnosis with existing recovery → measured production adoption only when
independent evidence supports it. The optional cross-encoder stays off live
routing, and no additional user acknowledgement is introduced.
