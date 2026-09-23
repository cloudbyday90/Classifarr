# Prospective inventory ranking: design

Date: 2026-09-22. Follows [operator-outcome calibration](operator-outcome-calibration-design.md).

## Problem and decision

The previous commit added a retrospective metadata/company benchmark. Its label
filter required the operator-selected destination to already contain the item.
That excluded corrections awaiting a move or sync, and could hide contradictory
choices. Keep that mismatch as a coverage count, not an exclusion. An inventory
description is still required for the retrospective study.

The larger problem is temporal: reconstructing predictions from today's library
cannot tell us what was available before a user's correction. Save an automatic,
bounded ranking pair at the existing live description-retrieval boundary instead.
Use later feedback linked to that exact classification, without another review
screen, another provider request, or synthetic feedback.

This is a **prospective candidate-ranking experiment**, not a replay of two AI
responses, calibrated confidence, or end-to-end classification accuracy. It adds
semantic descriptions to the prior metadata-only experiment, but does not claim
its experimental baseline equals the final policy/AI decision.

## Design

`policyInventoryEvidenceService` already retrieves the whole compatible pool
when weak or inferred-purpose candidates need inventory evidence. Reuse those
results, only when every candidate has complete indexed evidence, three distinct
descriptions, a valid learned profile, and the same training snapshot/count.
The existing retriever excludes the query identity and matching synopsis hashes
from its training evidence. Company observations remain diagnostic-only.

Predeclare both arms before seeing future outcomes:

- Baseline: mean of the three description similarities plus
  `0.25 * tanh(genre/studio/rating relative fit)`.
- Company arm: the same score plus `0.25 * tanh(company relative fit)`.

These bounded contrast scores are experimental, not percentages. No weight is
tuned on this cohort. A nonpositive leader or a margin at most `0.000001` abstains.
Company evidence must be complete across the pool; otherwise the company arm
equals baseline and the record explicitly reports unavailable company coverage.
Ties never select a destination by library name or ID.

`inventoryRankingShadow.mjs` freezes only numeric candidate inputs, the two
destinations, version, media type, capture time, and synopsis/training hashes.
It keeps a private weak receipt bound to the typed item identity. Policy result
spreads preserve that receipt reference. Persistence snapshots it before awaits
and rejects deserialized/client-provided copies and cross-item reuse. This is
an in-process provenance boundary, not a cryptographic database attestation.
No raw synopsis, company names, user reasons, endpoint URLs, or credentials are
added. No migration or separate unbounded event store is needed: the record lives
under existing classification history metadata and follows history retention.
The offline fold/replay service explicitly disables live capture, keeping replay
results deterministic and preventing synthetic cases from minting live receipts.

The existing outcome CLI gains `--prospective`. Its read-only, repeatable-read
query joins `policy_feedback_sources` to eligible, responded feedback by exact
classification ID and typed item identity. Explicit manual corrections use their
classification ID, actor marker, active same-media destination, and observation
time. Neither source requires current inventory membership. Feedback older than
the persisted event or in the future is excluded. Unlinked legacy feedback and
automatic route success do not become labels.

The evaluator validates stored scores and recalculates both choices from those
frozen numbers, never from current inventory. The earliest valid capture reserves
an identity and synopsis group even when it has no feedback yet; favorable retries
cannot replace it. Duplicate feedback counts once. Contradictory choices, choices
outside the captured pool, malformed records, and unavailable labels have separate
coverage counts. Report gains/regressions and decisions/abstentions separately for
movies, TV, confirmations, corrections, and anonymous selected-library strata.

Budgets: 64 candidates per capture, 32 KiB per stored capture read, 5,000 events per
query, 100 observations per event, and 64 selected-library strata. Oversized event
populations/strata fail rather than silently truncate. An oversized observation
group is counted invalid. Existing query/lock/idle timeouts remain. The default
window covers 30 days; optional `--since`/`--until` fix capture boundaries. Reports
include the later outcome observation cutoff. This is a retained-window cohort,
not a permanent archive; history expiry can change membership.

## Official sources, checked September 2026

URLs below were discovered using online search and the GitHub MCP service.

- [scikit-learn: leakage pitfalls](https://scikit-learn.org/dev/common_pitfalls.html)
  explains why evaluation information must not enter fitting. We freeze inputs
  before outcomes and retain the existing description-group exclusions.
- [River: online-learning concepts](https://riverml.xyz/0.14.0/introduction/basic-concepts/)
  describes making predictions before learning from revealed outcomes. This is
  methodological guidance, not a River dependency or claim that its older page
  represents a new September 2026 release.
- [OWASP RAG Security](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html)
  motivates provenance, bounded ingestion and separation between retrieved data
  and authority. This numeric diagnostic grants no routing permission.
- [W3C status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages)
  requires important status changes to be available to assistive technology
  without taking focus. No new UI is needed here. If aggregate progress is later
  shown in Command Center, use a concise status message with expandable details,
  not per-item warning cards or new acknowledgement requirements.
- [ESLint 10.11 release notes](https://eslint.org/blog/2026/09/eslint-v10.11.0-released/)
  document startup/linting improvements and rule fixes for the selected tooling PR.

## Options and final recommendation stack

Random PR selection from the open PRs not already implemented locally chose
[PR #545](https://github.com/cloudbyday90/Classifarr/pull/545): client ESLint
`10.10.0 -> 10.11.0` and `@types/node 26.6.1 -> 26.6.2`. Apply its package and
lockfile changes locally, preserving unrelated newer dependencies. This changes
lint tooling and type declarations, not the Node runtime or runtime APIs. Do not
merge the PR or tag/publish a release.

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Capture the existing live comparison | Automatic; no extra AI calls; preserves event-time evidence | Only covers comparisons actually performed; delayed/suggestion-biased feedback | Implement |
| Rebuild all historical recommendations | Immediate larger sample | Later placements/features leak into evaluation | Keep only as explicitly retrospective diagnostic |
| Run a second AI decision on every item | Tests full model behavior | Extra latency/cost and provider load | Not needed for this ranking experiment |
| Promote company weighting immediately | Immediate behavior change | No prospective benefit/regression evidence yet | Do not promote |

Recommended stack: existing PostgreSQL history and source receipts; small ESM
capture/validation, repository, and evaluation modules; existing local description
retriever and library-agnostic learned profiles; paired delayed-outcome metrics;
unchanged identity, eligibility, recovery and routing guards. No new service,
vector database, React SWR package, acknowledgement, or singleton is introduced.

## Remaining limitations and next decision

Current library contents can contain prior automated mistakes. Frozen timing
does not make those placements independent truth, and the capture path is not
representative of bypassed strong/authoritative decisions. Confirmations remain
suggestion-biased. Conflicting later corrections are excluded, not resolved by
majority vote. Missing company observations cannot demonstrate company benefit.

Next, deploy through the normal application workflow so existing company backfill
and this passive capture run on real movie/TV traffic. Evaluate the first retained
cohort with meaningful correction and company coverage, then use a disjoint later
cohort for the promotion decision. Inspect per-library regressions and abstention,
not only overall agreement. A minimum count alone is not a safety guarantee.
Only then consider a reversible company-assisted shortlist change; do not raise
confidence or lower routing safeguards to make the score look better.
