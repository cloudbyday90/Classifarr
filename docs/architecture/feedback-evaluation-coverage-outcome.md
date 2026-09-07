# Feedback evaluation coverage: outcome

## Delivered behavior

Implemented the follow-up from
[prompt response persistence](prompt-pattern-persistence-outcome.md): missing or
inconsistent original-candidate evidence no longer counts as a correct decision.
All recorded observations remain available for activity totals and future inventory
work. No additional operator input is required.

Two invoker-rights PostgreSQL views provide one evaluation rule and current policy
aggregates. The ESM services, dashboard endpoints, monitoring and suggestion impact
reads use that rule. Compatibility caches are repaired by migration and refreshed
through the existing transaction-aware service. Original feedback is not rewritten.

Accuracy is null when there are no evaluated observations. APIs expose evaluated
and unevaluated counts and coverage; the dashboard and details explain N/A. Zero
accuracy remains a real value. Overall dashboard accuracy remains an average of
defined policy rates, while coverage is pooled across recorded policy observations.
The policy details card now uses a native button with a visible keyboard focus state.

Finite, nonfuture timestamps are required for evaluated evidence. Prompt history's
timezone-free timestamps are explicitly interpreted as UTC when producing feedback
instants or returning prompt creation times. Library deactivation, media mismatch
or policy reassignment immediately removes affected evidence from live accuracy.

New suggestions use `feedback_suggestions.v3`. Earlier v1/v2 cohorts cannot be
applied and can be dismissed or regenerated through normal analysis. Application
locks both original candidates and the selected destination, then rechecks the
frozen feedback against the current evaluation rule before effects.

## Verification

Local validation on 2026-09-07 UTC:

| Check | Result |
| --- | --- |
| Focused backend units | 242 tests across 21 suites passed. |
| PostgreSQL integration tests | 159 tests across 7 suites passed. |
| Scoped integration coverage: cohort, evidence and learning services | 98.09% statements/lines, 93.44% branches, 100% functions. |
| Full frontend suite | 4,543 tests across 330 files passed. |
| Frontend coverage | 85.45% statements, 77.09% branches, 84.16% functions, 87.48% lines; above the recorded baseline. |
| Server/client type checks, affected ESLint, ESM import/mock-shape checks | Passed. |
| Production Docker image | Built locally as `classifarr:evaluation-coverage-local`. |
| Fresh-install schema round trip and migration integrity | Passed after regeneration and PostgreSQL view normalization. |
| Changed Markdown lint and whitespace checks | Passed. |

Integration cases cover unknown/defaulted flags, contradictory labels, missing
library references, incompatible media, future/null/infinite timestamps, empty
policies, cache repair without history edits, current eligibility changes, old
cohort invalidation and original-candidate lock contention. A restricted database
role cannot read base data merely through a grant on the evaluation view.

A controlled 5,000-observation fixture produced 2,500 evaluated outcomes, 50%
coverage and 50% accuracy. Its aggregate query took 11.027 ms execution and
0.686 ms planning in the final local integration run. This checks arithmetic and
bounded local query cost; it is not a production throughput guarantee or a real
classifier error measurement.

The generated schema must come from the previous snapshot plus the new migration,
then be embedded in the fresh-install image. Rebuilding against an intermediate
snapshot that already marks the edited migration applied can preserve a stale view.
The final schema comparison passed against the regenerated database definition. Full backend
coverage and the combined coverage ratchet were not rerun; the backend measurements
above are explicitly scoped. Frontend coverage was not substituted for that gate.

## Existing installation and PR availability

A read-only inspection of the local Compose installation at
2026-09-07T00:44:01.730Z found PostgreSQL 18.6, zero recorded policy-feedback rows,
zero suggestions and zero eligible suggestion cohorts. The check returned counts
only, made no production writes and called no model provider. There is no real
24–32-case independently labeled study or measured error profile to report.
Controlled fixtures cannot satisfy that readiness contract. Semantic counter-evidence
and automatic routing authority remain unchanged.

GitHub MCP returned no open PRs on both checks during this task. A random open PR
could not be selected; no external PR was applied or merged.

## Recommendations and tradeoffs

The separate [design and official research](feedback-evaluation-coverage-design.md)
document records the PostgreSQL and W3C sources, the August 2026 guidance baseline
and alternatives. The recommended stack is retained observations, canonical nullable
evaluation, live aggregates with coverage, frozen v3 evidence and locked application
of reviewed suggestions.

This preserves useful inventory evidence, avoids manual refresh and keeps eligibility
consistent across consumers. The costs are live aggregation work, lower apparent
accuracy coverage where evidence is incomplete, and regeneration of old pending
suggestions. Monitor query plans at representative installation sizes before adding
a cache invalidation system. Historical false flags may have been defaulted; library
consistency does not prove independent human review. This work is not a W3C
conformance audit or authorization for automatic classification changes.

## Next item

Bind standalone feedback to a stable classification/source event and make retries
idempotent. The generic feedback endpoint still accepts original-candidate fields
and can record separate observations for retries, while the prompt-response path
already has atomic replay protection. Derive candidate provenance from a server-owned
event where available and reject conflicting replays. This improves future AI
evidence quality without requiring operators to label more items.

Keep source observations distinct from independently reviewed evaluation labels;
do not infer a passing readiness study from larger observation counts. README and
the Unreleased changelog describe this change; no release or version bump is included.
