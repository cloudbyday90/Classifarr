# Confirmation-independent library evaluation: outcome

## Outcome

Confirmation-required installations can now evaluate eligible existing AI proposals
against current library evidence. The service reports strict or calibrated evidence
qualification separately from the routing hold, then returns the original review
result without issuing a routing receipt. The confirmation preference is unchanged.

The previous commit, `e6d643cc`, stopped preparation whenever confirmations were
required. This change removes that coupling, not the final approval requirement.
Strict automatic routing when confirmations are off is preserved. Calibrated
fallback remains evaluation-only in both modes.

The separate [design](confirmation-independent-evaluation-design.md) contains the
September-verified official research, behavior matrix, alternatives and security
boundaries. This component does not train model weights, create verified labels,
add a background scan job, or demonstrate improved classification accuracy.

## Implementation

- `learnedEvidenceEvaluationControl.mjs` separates configuration admission from
  routing mode and owns fixed, saturating counters plus one bounded evaluation
  slot. Completion releases the slot once; an old completion cannot release a
  later attempt. No shared global singleton or new dependency is introduced.
- The routing service binds the effective mode and caller confirmation preference
  to its existing one-use context. A caller can tighten the hold, never relax the
  database preference. Unknown settings and either direction of configuration
  change reject the attempt rather than silently upgrading its authority.
- Shared evidence predicates still enforce policy scope, identity, metadata,
  familiarity, provider provenance and prompt-evidence consistency. Their existing
  confirmation behavior outside this live service is unchanged. Fresh policy,
  library, evidence, configuration and original-result checks remain in place.
- Confirmation-held strict evaluation and calibrated shadow work share the same
  per-service slot and ten-second cooperative signal. There is no queued backlog.
  The unchanged database timeouts and numeric budgets remain separate limits.
- `queryCacheOnly` is an internal boolean retriever option. Confirmation-held
  reads cannot generate a query embedding on a cache miss. Calibrated reads retain
  their existing cached-only requirement. Normal retrieval remains unchanged.
- Internal diagnostics use `learned_evidence_evaluation_v1`. The old preparation
  block count is replaced by `prepared_admin_held`, which counts successfully
  prepared held contexts, not qualified cases. `strict_qualified_admin_held` and
  `calibrated_qualified_admin_held` count completed, fresh evidence qualifications
  with routing still held. `qualified` continues to mean calibrated shadow
  qualification without that administrative hold; it is not a routing receipt.

Diagnostics contain no titles, identifiers, descriptions, vectors, model replies
or endpoint details. They remain process-local and reset on restart. No API, UI
card, new setting, acknowledgement or policy-score inflation was added.

## Local Compose verification: 13 September 2026

Two distinct checks were run with read-only database defaults and private logging
disabled. No heavy build or test ran during the measured inventory reads.

### Production configuration, synthetic control paths

The rebuilt service's default configuration reader loaded the actual local
`require_all_confirmations=true` preference. Synthetic policy, evidence and AI
proposal fixtures then exercised both successful branches:

| Control case | Fresh evidence reads | Qualified but held | Receipt issued |
| --- | ---: | --- | --- |
| Strict evidence | 2 | Yes | No |
| Calibrated evidence | 3 | Yes | No |

Both returned the exact original review object and remained blocked at the route
safety gate. These are control-path tests under real configuration, **not real AI
classification outcomes**. Test modules are intentionally absent from the production
image; only synthetic fixture values were streamed to the read-only container.

### Current library data, cached-only retrieval

One current item from each of ten libraries was compared against all five
same-media libraries and retrieved twice. All 20 reads returned available evidence,
each repeated result was identical, and no calibration was requested on this strict
cached-only retrieval path.

| Current library reads | Movies | TV shows |
| --- | ---: | ---: |
| Libraries/items checked | 5 | 5 |
| Mean first retrieval | 766.0 ms | 272.4 ms |
| Mean repeat retrieval | 621.2 ms | 240.6 ms |
| First retrieval range | 676–979 ms | 196–355 ms |
| Repeat retrieval range | 517–672 ms | 185–289 ms |

AI generation, embedding generation and routing attempts were all **zero**. The
confirmation setting was still `true` afterward. This is a small current-inventory
smoke check, not a natural-traffic qualification rate, a new benchmark cohort, or
an accuracy/performance guarantee. Existing placements were not promoted to labels.

Compose was healthy with a read-only root filesystem. All four changed production
service hashes matched the rebuilt container. The dirty working-tree build has
`VCS_REF=unknown`, not release provenance.

## Verification

- Focused coverage: **15 suites and 322 tests passed**; all four affected services
  have **100% line, statement and function coverage**, with **99.54% branches**.
- PostgreSQL integration: **4 suites and 25 tests passed**. Real cached descriptions
  and the strict baseline qualified while the setting remained on; expired vectors
  then stopped qualification without invoking embedding generation or writing
  classification history. Test fixture setup writes were confined to temporary
  integration tables, not local library data.
- Broader policy/routing/code-health regression: **613 suites and 28,608 tests passed**.
- Changed-file ESLint, the configured backend typecheck, static-import and service
  ESM mock-shape checks passed. No frontend code, API contract, migration or package
  version changed. No new client test result is claimed. Scoped coverage does not
  replace the repository-wide ratchet or full static typing of every service.
- Tests cover strict-route preservation, held strict/calibrated qualification,
  caller binding, replay, malformed settings, configuration toggles before and
  during evaluation, source/identity/policy drift, cached-only reads, cancellation,
  saturation and idempotent slot recovery. Diagnostic payloads cannot forge a receipt.
- The production naming gate still reports **26 pre-existing references** against
  its zero baseline. That gate was not weakened. This is not a fully green CI claim.
- Repository Markdown lint and whitespace checks passed.

## Recommendation and next component

Retain PostgreSQL/pgvector, the configured local embeddings, strict matching first,
selective cross-fit evaluation second, and independent fresh routing authorization.
The benefit is hands-off evidence evaluation even in approval-required installations.
The cost is bounded additional reads; cache misses remain unevaluated and no new
automatic-routing gain is claimed. Automatically disabling approval or treating
calibration as confidence would undermine this separation and is not recommended.

**Next: connect these bounded outcomes to the existing Command Center status
refresh.** Provide one concise summary distinguishing evidence qualification,
routing approval holds and unavailable evidence. Keep detail optional, preserve
access controls, and avoid another settings panel. That makes natural-traffic
results observable before deciding whether calibrated fallback merits promotion;
the current internal counters alone cannot establish a durable outcome history.

Implemented next in the [Command Center library evaluation summary](command-center-library-evaluation-outcome.md).

## PR, documentation and release

GitHub MCP returned no open Classifarr PRs on both checks, so none was available
for random selection or local implementation. No PR was substituted or merged.
Unreleased and the relevant architecture documents were updated. No version bump,
tag or release is included. Private smoke/coverage artifacts remain in ignored
`.tmp/`; only public code, tests and documentation belong in the commit.
