# Live calibrated-neighbor shadow: outcome

## Outcome

The existing learned-evidence routing service now selectively evaluates calibrated
neighbor overlap against fresh live evidence. It reuses the existing admitted AI
proposal and shared policy, identity, metadata and familiarity checks. A qualified
shadow **returns the original review result before receipt issuance**. Strict
matches retain their existing behavior; calibrated fallback routing is not enabled.

The separate [design](live-neighbor-shadow-design.md) records official sources
verified on 13 September 2026, security controls, tradeoffs and the recommended
stack. This builds on `c82409c4`, which found 11 potential familiarity-qualified
gains offline; those gains are not presented as measured live routing successes.

## Implementation and reconciliation

- `liveLibraryNeighborCalibration.mjs` reuses the existing cross-fit kernel over
  current same-media exclusive description groups. It excludes current and stored
  query synopses, including conflicting copies and shared memberships outside the
  candidate pool. Library names are not classification rules.
- The existing repository attaches calibration privately to the selected candidate
  inside the same read-only snapshot as its description and metadata evidence.
  Provider projection does not expose the new calibration payload.
- Actual current vectors are read before cache reuse. Completed kernels use the
  existing bounded eight-entry, 16 MiB, five-minute LRU cache; invalid, incomplete,
  sparse, degenerate, interrupted and over-budget fits do not populate it.
- The shared kernel accepts a fresh query work budget, so cached assessments do
  not exhaust an old request's counter. Fitting and query work remain bounded.
- `learnedEvidenceNeighborShadow.mjs` shares the existing guard predicates and
  fallback assessment. It skips fitting when description means or metadata do not
  uniquely support the AI destination. Only one shadow attempt per routing-service
  instance runs at a time, with no queued backlog and a shared ten-second signal.
- Extra shadow reads require an already-cached query embedding. They never create
  embeddings or another AI response, issue routing authority, modify policy scores,
  persist learning rows, or introduce an acknowledgement or settings panel.
- Fixed process-local counters distinguish administrative preparation blocks,
  live guard failures, busy/unavailable work, fallback rejection, freshness drift
  and qualified shadows. Counters contain no item content or identities, saturate
  at one million per category, and reset on restart. `shadowStatus()` is an internal
  service diagnostic, not a new API or dashboard endpoint.

## Local Compose check

A read-only check selected one current item from each of the ten libraries:
five movie and five TV libraries. Each item was compared against all five current
same-media libraries, then read again through the same repository instance.

| Current inventory check | Movies | TV shows |
| --- | ---: | ---: |
| Libraries/items checked | 5 | 5 |
| Mean first retrieval | 834.0 ms | 400.8 ms |
| Mean repeat retrieval | 733.2 ms | 346.2 ms |
| First retrieval range | 785–900 ms | 363–445 ms |
| Repeat retrieval range | 609–799 ms | 286–400 ms |

All 20 reads returned available evidence and complete calibration. Each repeated
result exactly matched its first result. Across the reads there were five completed
fits and 15 model-cache hits; different query exclusions can reuse an identical
selected training set, so a first retrieval is not necessarily a cold model fit.
Measured times include retrieval and freshness work, not just calibration.

There were **zero AI or embedding-generation calls and zero routing attempts**.
The test used read-only database defaults and suppressed private logging. No heavy
build or test ran during this measurement. This small current-inventory smoke
check is neither an accuracy benchmark nor a representative natural-traffic study.
It did not reuse old AI responses as if they were fresh live proposals.

Compose remained healthy with a read-only root filesystem. All seven changed
production service hashes matched the final rebuilt container. The working-tree
image has `VCS_REF=unknown`, not release provenance.

## Important local finding

This finding describes `e6d643cc`. The subsequent
[confirmation-independent evaluation outcome](confirmation-independent-evaluation-outcome.md)
documents the implemented separation: evaluation can now continue with the
preference on, while actual routing remains held.

`require_all_confirmations` is currently `true`. The existing preparation gate
therefore stops the learned-evidence path before calibrated shadow fitting.
That preference was not changed. The smoke check exercised current retrieval
directly, while service tests exercised qualified and blocked routing contexts.
**No fresh natural-traffic qualification rate was measured.** Administrative
preparation counters count preparation attempts, not otherwise-qualified gains.

This identifies a design coupling worth fixing: opting to approve final routing
should not also prevent background evaluation from understanding the library.
It does not justify silently treating observed placement as a verified training
label or turning off a user's routing preference.

## Verification

- Focused coverage: **11 suites, 204 tests passed**, with **100% lines, statements
  and functions; 97.32% branches** across the seven affected services.
- PostgreSQL integration: **4 suites, 25 tests passed**, including current vector
  expiry, read-only calibration, query exclusion and provider projection.
- Broader policy/routing/code-health regression: **611 suites, 28,563 tests passed**.
- Changed-file ESLint, configured backend typecheck, static-import and service ESM
  mock-shape checks passed. No new dependency, migration, API contract or frontend
  change was needed. Scoped coverage is not the repository-wide coverage ratchet,
  and the configured typecheck does not statically type every JavaScript service.
- Tests cover unchanged strict receipts, shadow no-receipt behavior, default
  production readers, current restrictions, identity/metadata/prompt conflicts,
  final policy/configuration/result drift, shared cancellation, concurrency and
  slot recovery, cache freshness, vector changes and independent query budgets.
- The production naming gate still reports **26 pre-existing references** against
  its zero baseline. The gate and baseline were not weakened; this is not a claim
  that full CI is green. No new frontend test result is claimed.
- Repository Markdown lint and whitespace checks passed.

## Recommendation and next component

Keep the existing PostgreSQL/pgvector and local embedding stack, strict learned
matching first, selective cached cross-fit shadow second, and fresh server-side
routing authorization last. This avoids extra inference and premature routing;
its costs are additional bounded reads and fits, and no immediate automatic-route
gain from the shadow branch. Neither wholesale replacement of strict matching nor
relaxation of identity/metadata requirements is recommended.

**Next: separate background evaluation from manual routing approval.** Let a
confirmation-required installation evaluate the same fresh AI/library evidence
without issuing a receipt or moving media. Report the administrative routing hold
separately from evidence qualification, then measure natural eligible traffic
before considering fallback promotion. Reuse the current service and bounded
diagnostics; do not add another acknowledgement, manual classification task or
dense settings panel.

## PR and release

GitHub MCP was checked twice on 13 September 2026 and returned no open Classifarr
PRs. No random PR was available to implement; none was substituted or merged.
The changelog is updated under Unreleased. No version bump, tag or release is part
of this change. Private local smoke/coverage artifacts remain ignored in `.tmp/`.
