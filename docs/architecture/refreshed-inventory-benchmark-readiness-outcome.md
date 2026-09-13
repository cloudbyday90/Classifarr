# Refreshed inventory benchmark readiness

Date: 2026-09-13

Follow-up completed: the [focused AI comparison](focused-library-fallback-evaluation-outcome.md)
records actual inference on all 23 ready fallback targets and the remaining causes.

## Original objective and protocol

Evaluate whether refreshed descriptions improve library-agnostic movie/TV
matching and reduce unnecessary review. This is the follow-up explicitly
recommended by the [metadata recovery outcome](source-identity-self-healing-outcome.md).
It is not another logging or settings feature.

Reuse the [selective neighbor fallback design](selective-neighbor-fallback-design.md)
and existing grouped five-fold, zero-generation preflight. The existing service
reads a frozen snapshot, excludes held-out query evidence, fits fold-local
calibration and verifies source freshness. No benchmark algorithm, label source,
threshold, policy or routing authority was changed in this work item.

## Measured local result

The final read-only local Compose preflight returned:

| Measure | Result |
| --- | --- |
| Requested / sampled | 300 / 300; no shortfall |
| Media balance | 150 movies; 150 TV shows |
| Libraries represented | All 10; at least 30 sampled memberships each |
| Snapshot | Source verified; evaluation snapshot valid; no metadata drift |
| Ready for AI adjudication | 242: 133 movies and 109 TV shows |
| Other preparation mode | 58; not evaluated by this adjudication path |
| Strict neighbor support | 168 |
| Selected fallback targets | 28 |
| Fallback targets ready for adjudication | 23 |
| AI-generation calls | 0 |
| Independent ground-truth labels / accuracy | 0 / not measured |
| Live routing changes | None |

One movie library has 31 memberships because a sampled identity can already
belong to more than one library. Per-library membership counts therefore do not
sum to the unique 300-item sample. No item titles or individual library identities
are published in this document.

These counts establish readiness, not a causal improvement from the eight prior
recovered imports and not calibrated routing confidence. Existing placements are
weak comparison labels, not independent proof of the correct destination.

## Reproduction

From the repository root, with the configured local Compose service:

```powershell
docker exec -e LOG_LEVEL=fatal -e FILE_LOGGING_ENABLED=false -e 'PGOPTIONS=-c default_transaction_read_only=on' classifarr node src/scripts/runInventoryDescriptionBenchmark.mjs --seed classifarr-profile-20260912 --size 300 --folds 5 --fresh-policy-evaluation --neighbor-fallback --generate-cases 0 --max-minutes 10
```

The CLI emits progress on stderr and its aggregate JSON report on stdout. When
capturing the report, parse stdout directly as JSON; do not search it for a
separator after the progress lines. No paid provider or AI-generation call is
needed for this preflight. Snapshot-dependent counts may change on a later run.

## Recommendation, tradeoffs and next item

**Next: evaluate the 23 currently adjudication-ready fallback targets through
the existing local AI comparison.** Recheck the snapshot before generation;
do not hard-code these 23 identities or assume the count remains unchanged.

Keep strict matching first, selective calibrated retrieval second, existing
local AI adjudication third and fresh routing authorization last. Measure
preserved strict successes, additional review resolutions, disagreements and
suspected wrong destinations separately. Inspect contradictions against actual
metadata rather than treating placement agreement as accuracy.

The benefit is a focused test of the cases most likely to improve organic
library understanding. The cost is bounded local inference and the remaining
uncertainty from weak labels. Do not promote fallback automatically, lower
confidence thresholds or add another operator acknowledgement based on this
readiness result alone. No training, routing or policy write was performed.
