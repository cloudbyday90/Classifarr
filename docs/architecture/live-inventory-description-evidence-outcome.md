# Live inventory description evidence: outcome

## Implemented

The maintained description cache now feeds the existing live candidate
adjudication service. A separate repository performs exact per-library cosine
ranking in PostgreSQL, while a small retriever handles the local model boundary
and a separate projection/formatter bounds provider input.

Each request considers up to three existing policy candidates, with up to three
distinct description examples per candidate. Query identity and identical query
text are excluded across libraries; ambiguous descriptions and source conflicts
retain the shared corpus exclusions. Current membership and cached vectors are
read together, with exact representation keys and the existing 30-day expiry.
No inventory vectors are generated on the foreground path. Only an uncached
query synopsis may need one local embedding request.

Complete description evidence replaces the historical semantic lookup for that
comparison. Partial/unavailable evidence retains the historical fallback. Counts
refer to eligible distinct descriptions after exclusions, not total library size.
No matches or partial coverage is uncertainty, not a negative routing label.

The local provider receives normalized, JSON-quoted snippets capped at 600
Unicode code points each. Remote/public endpoints receive status and counts
only. Candidate adjudication logs drop response payloads, and parse/repair
diagnostics omit response previews that could echo private examples. Existing
finalization still discards model explanations and confidence and validates the
proposed destination against the closed candidate set.

## Local evidence

Rebuilt local Compose and exercised the saved Deep Water (2006) review without
confirming, retrying, moving media, or changing its stored classification.
Its existing top-three candidate set is Movies, Anime Movies, and Family.

| Candidate | Eligible distinct descriptions | Indexed | Examples supplied |
| --- | ---: | ---: | ---: |
| Movies | 2,809 | 2,809 | 3 |
| Anime Movies | 29 | 29 | 3 |
| Family | 1,240 | 1,240 | 3 |

The first live retrieval completed in 5.528 seconds. A subsequent complete
evidence/prompt build completed in 1.678 seconds and supplied nine snippets in a
9,325-character prompt. The remote projection contained no description snippets.
These are local observations, not latency guarantees or accuracy measurements.

The actual configured local AI comparison completed in 109.383 seconds including
evidence preparation. It returned a valid proposal for **Movies**. Finalization
kept the policy score at 45 and required a decision; the stored item remained
`awaiting_decision`. No classification history was rewritten or media routed by
the probe. Existing provider capability metrics may record the model execution.
One successful case does not establish an automatic-routing precision rate.

## Validation

- Focused unit tests: 158 passed.
- PostgreSQL integration: 3 suites / 9 tests passed, including live ranking,
  cache provenance/expiry, and background refresh regressions.
- Server lint/typecheck, documentation lint, static ESM imports and ESM mock
  shape checks passed.
- Full backend coverage suite: 1,216 suites / 34,430 tests passed. Statements
  and lines: 89.99%; branches: 81.08%; functions: 92.12%.
- Full client suite: 365 files / 5,035 tests passed. The rebuilt frontend also
  passed its production build. No client source changed.
- Coverage ratchet passed without baseline changes, using the new server report
  and the existing coverage report for the unchanged client source.
- All three new runtime modules have 100% statement/line coverage. Branch
  coverage is 96.42% for projection, 94.87% for the repository, and 100% for the
  retriever. The default database callback is also exercised by the live probe.
- All seven changed runtime modules matched the running container byte-for-byte;
  Compose remained healthy after the live model comparison.

The production naming gate still reports its existing 26 references above a
zero-reference baseline. This change did not alter that count or relax the gate;
the repository-wide CI command is therefore not claimed green.

## PR and release scope

GitHub MCP found no open Classifarr PRs to select. No PR was merged or invented.
No release, tag, version bump, image publication, new endpoint, schema change,
or user acknowledgement was introduced. The local dirty-build image has unknown
VCS provenance by design and is not release evidence.

## Recommendation and next component

Keep the adopted stack: maintained synopsis vectors, scoped current-membership
search, bounded local AI comparison, and deterministic routing authorization.
The tradeoff is a small query-time cost and dependence on index coverage in
exchange for richer content comparison without additional user configuration.
See the [design and official research](live-inventory-description-evidence-design.md)
for alternatives, pros/cons, and the September retrieval-date caveat.

Updated sequencing: first compare the evidence budget on a reproducible
100-title sample, as described in the
[9/30/100 benchmark design](inventory-description-benchmark-design.md).
This measures the cost and behavior of more context without inflating scores.

Then measure description-backed decisions against reviewed
outcomes and use those results to qualify a narrowly scoped automatic-routing
path. The remaining 45-point policy score is not an AI confidence estimate and
should not be increased merely because the model agrees. Reducing manual review
requires evidence-backed routing calibration, not another diagnostic panel.
