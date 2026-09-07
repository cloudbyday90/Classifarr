# Feedback source binding and retry protection: outcome

## Delivered behavior

The [evaluation-coverage follow-up](feedback-evaluation-coverage-outcome.md) is
implemented: standalone feedback uses a stored classification event, and matching
retries return its saved feedback ID without another vote or statistics update.
Candidate evidence, media identity, title, scores and timestamps come from history.
Missing original candidates remain unknown. Source-library membership is not
reconstructed into a classifier prediction or correctness label.

Input normalization, source receipts and transaction orchestration live in three
small ESM service modules. The existing feedback writer and classification
projection are reused. The client API has a named `submitClassificationFeedback`
leaf function exposed through the classification aggregator. There is no additional
operator form, classification action or automatic routing authority.

The new `policy_feedback_sources` table permits one receipt per classification ID.
Creation validates locked history and current selected policy/library compatibility,
then commits feedback, statistics and the receipt atomically. New prompt responses
register the same source identity in their existing transaction. Distinct history
events for the same media remain distinct observations.

## External API contract

`POST /api/feedback` remains authenticated and now accepts only:

```json
{
  "classification_id": "42",
  "selected_library_id": 3,
  "selected_policy_id": 7,
  "user_reason": "Preferred library",
  "user_reason_text": "Optional explanation"
}
```

Reasons are optional. Decimal bigint strings preserve source IDs above JavaScript's
safe integer limit; library/policy IDs remain positive PostgreSQL integers. Reason
text is bounded and whitespace normalized. Callers must remove metadata, original
scores, correction flags, media IDs and other previously accepted fields.

| Result | HTTP response |
| --- | --- |
| First accepted observation | 201, `feedbackId`, `replayed: false`. |
| Same normalized submission | 200, same `feedbackId`, `replayed: true`. |
| Different selection/annotation or prior prompt receipt | 409, `FEEDBACK_SOURCE_CONFLICT`. |
| Previously recorded feedback deleted | 409, `FEEDBACK_RESULT_UNAVAILABLE`. |
| Pending/unsupported state or invalid source creation time | 409, `FEEDBACK_SOURCE_NOT_READY`. |
| Missing source / invalid input or destination | 404 / 400 respectively. |

Prompt response URLs and their existing `PROMPT_NOT_PENDING` behavior remain intact.
A deliberately reopened prompt cannot bypass an existing source receipt. Receipts
survive history deletion; feedback deletion leaves a null-result tombstone rather
than enabling another vote. Legacy feedback is retained without guessed source IDs.
Later source edits do not reinterpret a committed replay.

## Local validation

Validation ran on 2026-09-07 UTC:

| Check | Result |
| --- | --- |
| Focused feedback/prompt backend units | 299 tests in 18 suites passed. |
| PostgreSQL integration tests | 125 tests in 4 suites passed. |
| Three new services, integration coverage | 96.85% statements/lines, 90.66% branches, 100% functions. |
| Full frontend suite | 4,552 tests in 331 files passed. |
| Frontend coverage | 85.46% statements, 77.09% branches, 84.17% functions, 87.48% lines. |
| Server/client type checks, affected ESLint, ESM import/mock-shape checks | Passed. |
| Production Docker image | Built locally as `classifarr:feedback-source-local`. |
| Fresh-install schema round trip and migration integrity | Passed after PostgreSQL normalized the dumped constraint expression. |
| Changed Markdown lint and whitespace checks | Passed. |

Real PostgreSQL tests cover six concurrent identical requests, conflicting choices
across policies, rollback at each write boundary, prompt/standalone races, prompt
receipt failure, forged evidence, invalid times/destinations, exact bigint identity,
history retention, deleted-result tombstones and independent events for one media
item. The original feedback/prompt/evaluation lifecycle suites remain green.
Full backend coverage and the combined coverage ratchet were not rerun; the service
coverage above is scoped and does not substitute for that gate.

The Docker schema workflow starts from the preceding committed snapshot plus the
new migration, dumps the result and checks a fresh-install image. The Unreleased
changelog and README describe the change. No version bump or release is included.

## Existing Compose data and PR availability

A read-only transaction at 2026-09-07T01:13:27.469Z found PostgreSQL 18.6 and:

| Observation | Count |
| --- | ---: |
| Classification history | 6,772 |
| Completed/verified/routed source events | 6,699 |
| Those events with ranked-candidate metadata | 0 |
| Recorded policy feedback | 0 |

A second aggregate grouped the 6,699 terminal events: all use `source_library`;
only one has a `classification_details` object. These are imported membership
observations, not a measured classifier comparison cohort. The inspections returned
aggregate counts only, made no production writes and called no model provider.
There is no independently labeled real error profile supporting semantic routing
changes. Synthetic test outcomes are not readiness-study evidence.

GitHub MCP returned no open PRs during this task, so there was no random open PR
to implement locally. No external PR was merged.

## Recommendations and next item

The separate [design and official research](feedback-source-idempotency-design.md)
records PostgreSQL, RFC 9110 and W3C provenance guidance available by August 2026,
with actual retrieval dates and alternatives. Recommended stack: stored source event,
strict request projection, transactional receipt and feedback, current evaluated
coverage, and existing reviewed suggestions.

Benefits are server-owned evidence, automatic retry identity, retained history and
consistent cross-workflow protection. Costs are an additional durable ledger and a
stricter external API contract. Historical source linkage remains unknown; receipts
assume classification IDs are not reused. Keep new feedback ingress behind the
source adapter rather than exposing the low-level writer directly.

**Next: add a read-only evidence-coverage breakdown by library and classification
method to existing statistics.** Distinguish imported membership observations,
available original-candidate snapshots, source-bound feedback and evaluated outcomes.
Use existing inventory summaries to show what is present and common; do not require
operators to re-label imported media or count current library membership as proof
of classifier correctness. This follows the actual Compose findings and makes the
available evidence visible before expanding classification automation.
